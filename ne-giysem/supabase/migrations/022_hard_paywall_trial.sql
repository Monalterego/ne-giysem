-- ============================================================
-- 022_hard_paywall_trial
-- Adım 15 (H1): hard paywall + 7 günlük deneme + yeni limitler. Ücretsiz plan YOK:
-- abonelik ya da deneme (entitlements.expires_at > now()) olmadan ekleme, try-on,
-- packshot ve tarama yapılamaz. Tasarım: docs/plans/packshot-gecis-inceleme.md
-- "Adım 15 tasarım".
--
--   1) entitlements.period_started_at — RevenueCat aboneliğinin purchase_date'i
--      (son satın alma / yenileme; denemede deneme başlangıcı). H2'de yazılır.
--   2) trials — deneme kaydı (kalıcı; entitlements satırı silinse de kalır).
--      entitlements tetikleyicisi doldurur; ücretliye geçişte converted_at.
--   3) packshot_setup: yıllık kurulum ayı DENEMEDE başlamaz, ilk ücretli günde başlar.
--   4) Erişim yardımcıları: has_access, trial_since, premium_since.
--   5) app_limits: free.* kalkar; trial.* ve premium.scan_monthly eklenir,
--      premium.tryon_monthly 8 → 5; packshot / abuse anahtarları satır olarak girer.
--   6) Kota fonksiyonları: tryon_quota, scan_quota (yeni), packshot_quota (yeniden).
--      start_tryon / start_garment_job erişim yoksa 'subscription-required'.
--   7) scan_jobs — "Uyar mı?" hakkı sunucuda (anthropic-proxy purpose 'scan', H3).
--      start_scan (istemci RPC) uyumluluk için kalır ama ARTIK SAYMAZ (H5'te kaldırılır).
--   8) enforce_wardrobe_limit: dolap sınırı yok; erişim yoksa 'subscription-required'.
--   9) get_usage yeni biçim + get_limits (paywall'daki limit satırı).
--  10) purge_retention: garment_jobs, scan_jobs, tryon_renders 13 ay (kota kayıtları).
--
-- Pencereler:
--   deneme  : trial_since (deneme başlangıcı) → deneme sonu, toplam trial.* hakları
--   premium : greatest(İstanbul ayı başı, son denemenin converted_at / ends_at)
--             → denemedeki harcamalar ilk ücretli ayda sayılmaz (karar 5)
--   packshot yıllık: kurulum ayı (packshot_setup.started_at = ilk ücretli dönem) 150,
--             sonra İstanbul ayı 40
--
-- Önkoşul: 021. Elle çalıştırılır (SQL Editor). Tekrar çalıştırılabilir.
-- ============================================================

begin;

-- ─── 1) entitlements.period_started_at ───────────────────────────────────────
alter table public.entitlements add column if not exists period_started_at timestamptz;

-- ─── 2) trials ───────────────────────────────────────────────────────────────
create table if not exists public.trials (
  user_id      uuid not null references auth.users(id) on delete cascade,
  started_at   timestamptz not null,
  ends_at      timestamptz,
  product_id   text,
  store        text,
  -- ilk ücretli dönemin başı (deneme → ücretli); dolmadıysa deneme ücretliye dönmedi
  converted_at timestamptz,
  created_at   timestamptz not null default now(),
  primary key (user_id, started_at)
);

alter table public.trials enable row level security;
-- Policy YOK: yalnızca service_role (tetikleyici security definer)
revoke all on table public.trials from anon, authenticated;
grant all on table public.trials to service_role;

-- Deneme dönemi yazılınca kaydı aç / güncelle; denemeden ücretli döneme geçişi işaretle.
-- period_started_at yoksa (H2 öncesi senkron) kayıt açılmaz.
create or replace function public.trials_on_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.period_type = 'trial' then
    if new.period_started_at is not null then
      insert into trials (user_id, started_at, ends_at, product_id, store)
      values (new.user_id, new.period_started_at, new.expires_at, new.product_id, new.store)
      on conflict (user_id, started_at) do update
        set ends_at = excluded.ends_at, product_id = excluded.product_id, store = excluded.store;
    end if;
  elsif tg_op = 'UPDATE'
        and old.period_type = 'trial'
        and new.expires_at > now() then
    update trials
       set converted_at = coalesce(new.period_started_at, now())
     where user_id = new.user_id
       and converted_at is null
       and started_at = (select max(started_at) from trials where user_id = new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trials_on_entitlement on public.entitlements;
create trigger trials_on_entitlement
  after insert or update on public.entitlements
  for each row execute function public.trials_on_entitlement();

-- ─── 3) Kurulum ayı ilk ücretli günde (021 + deneme şartı) ───────────────────
create or replace function public.packshot_setup_on_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.expires_at > now()
     and coalesce(new.period_type, '') <> 'trial'
     and exists (select 1 from annual_products where product_id = new.product_id) then
    insert into packshot_setup (user_id, started_at)
    values (new.user_id, coalesce(new.period_started_at, now()))
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

-- 021 ile denemedeyken açılmış kurulum ayları (yalnızca test hesapları) → ilk ücretli günde yeniden açılır
delete from public.packshot_setup s
 using public.entitlements e
 where e.user_id = s.user_id and e.period_type = 'trial' and e.expires_at > now();

-- ─── 4) Erişim yardımcıları ──────────────────────────────────────────────────
-- has_access: abonelik ya da deneme (= is_premium_user; ad netlik için)
create or replace function public.has_access(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_premium_user(p_user);
$$;

-- Aktif denemenin başlangıcı; denemede değilse null.
-- Başlangıç bilinmiyorsa (H2 öncesi) -infinity: tüm geçmiş sayılır (sıkı taraf).
create or replace function public.trial_since(p_user uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(e.period_started_at, '-infinity'::timestamptz)
    from entitlements e
   where e.user_id = p_user and e.period_type = 'trial' and e.expires_at > now();
$$;

-- Premium aylık pencerenin başı: ay başı, ama son deneme bu ay bittiyse / ücretliye
-- döndüyse o andan (denemedeki harcamalar sayılmaz)
create or replace function public.premium_since(p_user uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    istanbul_month_start(),
    coalesce((select coalesce(t.converted_at, t.ends_at)
                from trials t
               where t.user_id = p_user
               order by t.started_at desc
               limit 1),
             '-infinity'::timestamptz));
$$;

-- ─── 5) app_limits ───────────────────────────────────────────────────────────
delete from public.app_limits
 where key in ('free.wardrobe_max', 'free.tryon_lifetime', 'free.scan_monthly', 'free.packshot_lifetime');

insert into public.app_limits (key, value, description) values
  ('trial.packshot_total',          15, 'Deneme: stüdyo görseli, deneme süresince toplam (packshot_quota)'),
  ('trial.tryon_total',              2, 'Deneme: sanal deneme, deneme süresince toplam (tryon_quota)'),
  ('trial.scan_total',               5, 'Deneme: "Uyar mı?", deneme süresince toplam (scan_quota)'),
  ('premium.scan_monthly',          40, 'Premium: "Uyar mı?", Istanbul takvim ayı (scan_quota)'),
  ('premium.packshot_monthly',      40, 'Premium: stüdyo görseli, Istanbul takvim ayı (packshot_quota)'),
  ('premium.packshot_annual_setup', 150, 'Yıllık plan: ilk ücretli günden itibaren kurulum ayında stüdyo görseli'),
  ('premium.packshot_setup_days',   30, 'Yıllık plan kurulum ayının uzunluğu (gün)'),
  ('abuse.garment_daily',           60, 'Günlük stüdyo görseli tavanı (api_usage garment)')
on conflict (key) do nothing;

-- premium.tryon_monthly 020'de 8 ile girdi → 5 (elle değiştirilmişse dokunma)
insert into public.app_limits (key, value, description) values
  ('premium.tryon_monthly', 5, 'Premium: sanal deneme, Istanbul takvim ayı (tryon_quota)')
on conflict (key) do nothing;
update public.app_limits
   set value = 5, description = 'Premium: sanal deneme, Istanbul takvim ayı (tryon_quota)'
 where key = 'premium.tryon_monthly' and value = 8;

-- Tablo + varsayılan; bilinmeyen anahtar hata (free.* artık bilinmiyor)
create or replace function public.limit_for(p_key text)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_value int;
begin
  select value into v_value from app_limits where key = p_key;
  if found then
    return v_value;
  end if;

  return case p_key
    when 'trial.packshot_total'          then 15
    when 'trial.tryon_total'             then 2
    when 'trial.scan_total'              then 5
    when 'premium.tryon_monthly'         then 5
    when 'premium.scan_monthly'          then 40
    when 'premium.packshot_monthly'      then 40
    when 'premium.packshot_annual_setup' then 150
    when 'premium.packshot_setup_days'   then 30
    when 'abuse.garment_daily'           then 60
    else limit_for_unknown(p_key)
  end;
end;
$$;

-- ─── 6) Kota fonksiyonları ───────────────────────────────────────────────────
-- Ortak yanıt: { plan ('trial'|'premium'|'none'), window, used, limit, reset_at }
--   limit NULL = sınırsız; deneme reset_at null (deneme bitince ücretli pencere başlar)

create or replace function public.tryon_quota(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trial timestamptz := trial_since(p_user);
  v_since timestamptz;
begin
  if not has_access(p_user) then
    return jsonb_build_object('plan', 'none', 'window', 'none', 'used', 0, 'limit', 0, 'reset_at', null);
  end if;
  if v_trial is not null then
    return jsonb_build_object(
      'plan', 'trial', 'window', 'trial',
      'used', tryon_used(p_user, v_trial),
      'limit', limit_for('trial.tryon_total'),
      'reset_at', null);
  end if;
  v_since := premium_since(p_user);
  return jsonb_build_object(
    'plan', 'premium', 'window', 'monthly',
    'used', tryon_used(p_user, v_since),
    'limit', limit_for('premium.tryon_monthly'),
    'reset_at', istanbul_next_month_start());
end;
$$;

-- start_tryon (020 + erişim + pencere). Yanıt: allowed, render_id?, used, limit, plan,
-- window, reset_at, error? ('no-profile' | 'subscription-required')
create or replace function public.start_tryon(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quota  jsonb;
  v_used   int;
  v_limit  int;
  v_render uuid;
begin
  -- Aynı kullanıcının paralel start'larını sıraya sok: profil satırını kilitle
  perform 1 from profiles where id = p_user for update;
  if not found then
    return jsonb_build_object('allowed', false, 'error', 'no-profile');
  end if;

  v_quota := tryon_quota(p_user);
  if v_quota->>'plan' = 'none' then
    return v_quota || jsonb_build_object('allowed', false, 'error', 'subscription-required');
  end if;

  v_used  := (v_quota->>'used')::int;
  v_limit := (v_quota->>'limit')::int;   -- null → sınırsız
  if v_limit is not null and v_used >= v_limit then
    return v_quota || jsonb_build_object('allowed', false);
  end if;

  insert into tryon_renders (user_id) values (p_user) returning id into v_render;
  return v_quota || jsonb_build_object('allowed', true, 'render_id', v_render, 'used', v_used + 1);
end;
$$;

-- Packshot (021 yeniden): 'free' penceresi kalktı → 'trial' / 'none'
create or replace function public.packshot_quota(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trial       timestamptz := trial_since(p_user);
  v_setup_start timestamptz;
  v_setup_end   timestamptz;
  v_since       timestamptz;
begin
  if not has_access(p_user) then
    return jsonb_build_object('plan', 'none', 'window', 'none', 'used', 0, 'limit', 0, 'reset_at', null);
  end if;

  if v_trial is not null then
    return jsonb_build_object(
      'plan', 'trial', 'window', 'trial',
      'used', packshot_used(p_user, v_trial),
      'limit', limit_for('trial.packshot_total'),
      'reset_at', null);
  end if;

  select started_at into v_setup_start from packshot_setup where user_id = p_user;
  if v_setup_start is not null then
    v_setup_end := v_setup_start + make_interval(days => limit_for('premium.packshot_setup_days'));
  end if;

  if v_setup_start is not null and now() < v_setup_end and is_annual_user(p_user) then
    return jsonb_build_object(
      'plan', 'premium', 'window', 'setup',
      'used', packshot_used(p_user, v_setup_start),
      'limit', limit_for('premium.packshot_annual_setup'),
      'reset_at', v_setup_end);
  end if;

  v_since := greatest(premium_since(p_user), coalesce(v_setup_end, '-infinity'::timestamptz));
  return jsonb_build_object(
    'plan', 'premium', 'window', 'monthly',
    'used', packshot_used(p_user, v_since),
    'limit', limit_for('premium.packshot_monthly'),
    'reset_at', istanbul_next_month_start());
end;
$$;

-- start_garment_job (021 + erişim kontrolü). error: 'no-profile' | 'item-not-found' |
-- 'subscription-required' | 'daily-limit'
create or replace function public.start_garment_job(p_user uuid, p_kind text, p_item uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quota jsonb;
  v_used  int;
  v_limit int;
  v_job   uuid;
begin
  if p_kind is distinct from 'packshot' then
    raise exception 'start_garment_job: geçersiz tür %', p_kind using errcode = '22023';
  end if;

  -- Aynı kullanıcının paralel start'larını sıraya sok
  perform 1 from profiles where id = p_user for update;
  if not found then
    return jsonb_build_object('allowed', false, 'error', 'no-profile');
  end if;

  if p_item is not null
     and not exists (select 1 from wardrobe_items where id = p_item and user_id = p_user) then
    return jsonb_build_object('allowed', false, 'error', 'item-not-found');
  end if;

  v_quota := packshot_quota(p_user);
  if v_quota->>'plan' = 'none' then
    return v_quota || jsonb_build_object('allowed', false, 'error', 'subscription-required');
  end if;

  v_used  := (v_quota->>'used')::int;
  v_limit := (v_quota->>'limit')::int;   -- null → sınırsız

  if v_limit is not null and v_used >= v_limit then
    return v_quota || jsonb_build_object('allowed', false);
  end if;

  -- Günlük kötüye kullanım tavanı (bump_usage sınır aşılınca da artırır)
  if not bump_usage(p_user, 'garment', limit_for('abuse.garment_daily')) then
    return v_quota || jsonb_build_object('allowed', false, 'error', 'daily-limit');
  end if;

  insert into garment_jobs (user_id, kind, item_id)
  values (p_user, p_kind, p_item)
  returning id into v_job;

  return v_quota || jsonb_build_object('allowed', true, 'job_id', v_job, 'used', v_used + 1);
end;
$$;

-- ─── 7) scan_jobs: "Uyar mı?" hakkı sunucuda ─────────────────────────────────
-- garment_jobs deseni: iş 10 dk açık sayılır, başarıyla kalıcı, hatada failed_at ile iade.
-- anthropic-proxy (purpose 'scan') açar ve kapatır; istemci yazamaz.
create table if not exists public.scan_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  succeeded_at timestamptz,
  failed_at    timestamptz
);

create index if not exists idx_scan_jobs_user_created
  on public.scan_jobs (user_id, created_at desc);

alter table public.scan_jobs enable row level security;
revoke all on table public.scan_jobs from anon, authenticated;
grant all on table public.scan_jobs to service_role;

-- ⚠️ 10 dk açık pencere start_scan_job ile aynı anlamda
create or replace function public.scan_used(p_user uuid, p_since timestamptz)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from scan_jobs
   where user_id = p_user
     and failed_at is null
     and (succeeded_at is not null or created_at > now() - interval '10 minutes')
     and (p_since is null or created_at >= p_since);
$$;

create or replace function public.scan_quota(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trial timestamptz := trial_since(p_user);
  v_since timestamptz;
begin
  if not has_access(p_user) then
    return jsonb_build_object('plan', 'none', 'window', 'none', 'used', 0, 'limit', 0, 'reset_at', null);
  end if;
  if v_trial is not null then
    return jsonb_build_object(
      'plan', 'trial', 'window', 'trial',
      'used', scan_used(p_user, v_trial),
      'limit', limit_for('trial.scan_total'),
      'reset_at', null);
  end if;
  v_since := premium_since(p_user);
  return jsonb_build_object(
    'plan', 'premium', 'window', 'monthly',
    'used', scan_used(p_user, v_since),
    'limit', limit_for('premium.scan_monthly'),
    'reset_at', istanbul_next_month_start());
end;
$$;

-- Döner: { allowed, job_id?, used, limit, reset_at, plan, window, error? }
--   error: 'no-profile' | 'subscription-required'
create or replace function public.start_scan_job(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quota jsonb;
  v_used  int;
  v_limit int;
  v_job   uuid;
begin
  perform 1 from profiles where id = p_user for update;
  if not found then
    return jsonb_build_object('allowed', false, 'error', 'no-profile');
  end if;

  v_quota := scan_quota(p_user);
  if v_quota->>'plan' = 'none' then
    return v_quota || jsonb_build_object('allowed', false, 'error', 'subscription-required');
  end if;

  v_used  := (v_quota->>'used')::int;
  v_limit := (v_quota->>'limit')::int;
  if v_limit is not null and v_used >= v_limit then
    return v_quota || jsonb_build_object('allowed', false);
  end if;

  insert into scan_jobs (user_id) values (p_user) returning id into v_job;
  return v_quota || jsonb_build_object('allowed', true, 'job_id', v_job, 'used', v_used + 1);
end;
$$;

-- Claude yanıtı ürün olarak tanındı → kalıcı. Tekrar çağrılabilir.
create or replace function public.complete_scan_job(p_user uuid, p_job uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update scan_jobs
     set succeeded_at = coalesce(succeeded_at, now())
   where id = p_job and user_id = p_user and failed_at is null;
  return found;
end;
$$;

-- Üst servis hatası ya da tanınamayan yanıt → iade. Başarılı işi iade etmez.
create or replace function public.fail_scan_job(p_user uuid, p_job uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update scan_jobs
     set failed_at = now()
   where id = p_job and user_id = p_user
     and failed_at is null and succeeded_at is null;
  return found;
end;
$$;

-- start_scan (istemci RPC, 013/020): eski bundle'lar sonuçtan önce çağırıyor. Artık
-- SAYMAZ (hak anthropic-proxy'de scan_jobs ile düşüyor; sayarsa iki kez düşerdi).
-- Yalnızca erişim yoksa allowed false. H5'te yetki geri alınıp fonksiyon silinir.
create or replace function public.start_scan()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return jsonb_build_object('allowed', false, 'error', 'unauthorized');
  end if;
  return scan_quota(v_user) || jsonb_build_object('allowed', has_access(v_user));
end;
$$;

-- ─── 8) Dolap: sınır yok, erişim şart ────────────────────────────────────────
-- Yalnızca INSERT — erişimi biten kullanıcı mevcut parçaları düzenleyip silebilir.
create or replace function public.enforce_wardrobe_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if has_access(new.user_id) then
    return new;
  end if;
  raise exception 'subscription-required'
    using errcode = 'P0001',
          hint    = 'subscription';
end;
$$;

-- ─── 9) get_usage + get_limits ───────────────────────────────────────────────
-- {
--   plan: 'trial'|'premium'|'none', access_expires_at, premium_expires_at (eski ad),
--   will_renew, trial: {started_at, ends_at} | null, trial_used,
--   ended: 'trial'|'subscription'|null   -- erişim yoksa neyin bittiği (paywall başlığı)
--   wardrobe: {used, limit: null},
--   tryon / scan / packshot: {used, limit, reset_at, window}
-- }
create or replace function public.get_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_ent      entitlements%rowtype;
  v_access   boolean;
  v_trial    timestamptz;
  v_tryon    jsonb;
  v_scan     jsonb;
  v_packshot jsonb;
  v_wardrobe int;
  v_plan     text;
  v_ended    text;
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select * into v_ent from entitlements where user_id = v_user;
  v_access := has_access(v_user);
  v_trial  := trial_since(v_user);
  v_plan   := case when not v_access then 'none' when v_trial is not null then 'trial' else 'premium' end;

  if not v_access then
    if v_ent.user_id is not null then
      v_ended := case when v_ent.period_type = 'trial' then 'trial' else 'subscription' end;
    elsif exists (select 1 from trials where user_id = v_user) then
      v_ended := 'trial';   -- iade / iptal → entitlements satırı silinmiş
    end if;
  end if;

  select count(*)::int into v_wardrobe from wardrobe_items where user_id = v_user;
  v_tryon    := tryon_quota(v_user);
  v_scan     := scan_quota(v_user);
  v_packshot := packshot_quota(v_user);

  return jsonb_build_object(
    'plan',               v_plan,
    'access_expires_at',  v_ent.expires_at,
    'premium_expires_at', v_ent.expires_at,
    'will_renew',         v_ent.will_renew,
    'trial', case when v_trial is not null
      then jsonb_build_object('started_at', v_ent.period_started_at, 'ends_at', v_ent.expires_at)
      else null end,
    'trial_used', exists (select 1 from trials where user_id = v_user),
    'ended',      v_ended,
    'wardrobe',   jsonb_build_object('used', v_wardrobe, 'limit', null),
    'tryon',    v_tryon    - 'plan',
    'scan',     v_scan     - 'plan',
    'packshot', v_packshot - 'plan'
  );
end;
$$;

-- Paywall'daki limit satırı: sayılar app_limits'ten (istemcide sayı yok). NULL = sınırsız.
create or replace function public.get_limits()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'trial', jsonb_build_object(
      'packshot', limit_for('trial.packshot_total'),
      'tryon',    limit_for('trial.tryon_total'),
      'scan',     limit_for('trial.scan_total')),
    'premium', jsonb_build_object(
      'packshot_monthly',      limit_for('premium.packshot_monthly'),
      'packshot_annual_setup', limit_for('premium.packshot_annual_setup'),
      'packshot_setup_days',   limit_for('premium.packshot_setup_days'),
      'packshot_daily',        limit_for('abuse.garment_daily'),
      'tryon_monthly',         limit_for('premium.tryon_monthly'),
      'scan_monthly',          limit_for('premium.scan_monthly'))
  );
$$;

-- ─── 10) Saklama: kota kayıtları 13 ay (016 + üç tablo) ──────────────────────
create or replace function public.purge_retention()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage    int;
  v_ops      int;
  v_deletion int;
  v_audit    int;
  v_garment  int;
  v_scan     int;
  v_tryon    int;
begin
  delete from api_usage  where day        < (current_date - interval '13 months')::date;
  get diagnostics v_usage = row_count;

  delete from ops_events where created_at < now() - interval '12 months';
  get diagnostics v_ops = row_count;

  -- Silme/Yok Etme Yönetmeliği m. 7/3: en az 3 yıl, sonra silinir (015)
  delete from deletion_log where deleted_at < now() - interval '3 years';
  get diagnostics v_deletion = row_count;

  -- Kota kayıtları: 13 ay (022). En uzun pencere 30 günlük kurulum ayı.
  delete from garment_jobs  where created_at < now() - interval '13 months';
  get diagnostics v_garment = row_count;
  delete from scan_jobs     where created_at < now() - interval '13 months';
  get diagnostics v_scan = row_count;
  delete from tryon_renders where created_at < now() - interval '13 months';
  get diagnostics v_tryon = row_count;

  -- Auth denetim kayıtları: en fazla 90 gün (m. 5/2-f). Yetki yoksa diğerlerini bozma.
  begin
    delete from auth.audit_log_entries where created_at < now() - interval '90 days';
    get diagnostics v_audit = row_count;
  exception when insufficient_privilege or undefined_table then
    raise warning 'purge_retention: auth.audit_log_entries temizlenemedi (%)', sqlerrm;
    v_audit := -1;
  end;

  return jsonb_build_object(
    'api_usage', v_usage, 'ops_events', v_ops, 'deletion_log', v_deletion, 'auth_audit', v_audit,
    'garment_jobs', v_garment, 'scan_jobs', v_scan, 'tryon_renders', v_tryon
  );
end;
$$;

-- ─── Yetkiler ────────────────────────────────────────────────────────────────
revoke execute on function public.trials_on_entitlement()                  from public, anon, authenticated;
revoke execute on function public.packshot_setup_on_entitlement()          from public, anon, authenticated;
revoke execute on function public.has_access(uuid)                         from public, anon, authenticated;
revoke execute on function public.trial_since(uuid)                        from public, anon, authenticated;
revoke execute on function public.premium_since(uuid)                      from public, anon, authenticated;
revoke execute on function public.limit_for(text)                          from public, anon, authenticated;
revoke execute on function public.tryon_quota(uuid)                        from public, anon, authenticated;
revoke execute on function public.start_tryon(uuid)                        from public, anon, authenticated;
revoke execute on function public.packshot_quota(uuid)                     from public, anon, authenticated;
revoke execute on function public.start_garment_job(uuid, text, uuid)      from public, anon, authenticated;
revoke execute on function public.scan_used(uuid, timestamptz)             from public, anon, authenticated;
revoke execute on function public.scan_quota(uuid)                         from public, anon, authenticated;
revoke execute on function public.start_scan_job(uuid)                     from public, anon, authenticated;
revoke execute on function public.complete_scan_job(uuid, uuid)            from public, anon, authenticated;
revoke execute on function public.fail_scan_job(uuid, uuid)                from public, anon, authenticated;
revoke execute on function public.start_scan()                             from public, anon, authenticated;
revoke execute on function public.enforce_wardrobe_limit()                 from public, anon, authenticated;
revoke execute on function public.get_usage()                              from public, anon, authenticated;
revoke execute on function public.get_limits()                             from public, anon, authenticated;
revoke execute on function public.purge_retention()                        from public, anon, authenticated;

grant execute on function public.has_access(uuid)                          to service_role;
grant execute on function public.trial_since(uuid)                         to service_role;
grant execute on function public.premium_since(uuid)                       to service_role;
grant execute on function public.limit_for(text)                           to service_role;
grant execute on function public.tryon_quota(uuid)                         to service_role;
grant execute on function public.start_tryon(uuid)                         to service_role;
grant execute on function public.packshot_quota(uuid)                      to service_role;
grant execute on function public.start_garment_job(uuid, text, uuid)       to service_role;
grant execute on function public.scan_used(uuid, timestamptz)              to service_role;
grant execute on function public.scan_quota(uuid)                          to service_role;
grant execute on function public.start_scan_job(uuid)                      to service_role;
grant execute on function public.complete_scan_job(uuid, uuid)             to service_role;
grant execute on function public.fail_scan_job(uuid, uuid)                 to service_role;
grant execute on function public.start_scan()                              to authenticated;   -- H5'te geri alınır
grant execute on function public.get_usage()                               to authenticated;
grant execute on function public.get_limits()                              to authenticated;
grant execute on function public.purge_retention()                         to service_role;

commit;

-- ─── Mevcut hesaplar (uygulamadan önce, ayrı çalıştır) ──────────────────────
-- select count(*) as toplam,
--        count(*) filter (where e.expires_at > now()) as erisimi_var,
--        count(*) filter (where e.user_id is null or e.expires_at <= now()) as paywall
--   from auth.users u left join public.entitlements e on e.user_id = u.id;
-- Demo (ömür boyu promosyonel → expires_at 'infinity'):
-- select e.* from public.entitlements e join auth.users u on u.id = e.user_id
--  where u.email = 'demo@sestinaapp.com';
--
-- ─── Doğrulama (ayrı çalıştır) ───────────────────────────────────────────────
-- select key, value, public.limit_for(key) as effective from public.app_limits order by key;
--   Beklenen: free.* yok; trial.* 15 / 2 / 5; premium.tryon_monthly 5; premium.scan_monthly 40;
--   premium.packshot_* 40 / 150 / 30; abuse.garment_daily 60.
--
-- Deneme testi (test kullanıcısı <uid>; FASHN / Anthropic çağrısı YOK):
--   insert into public.entitlements (user_id, product_id, store, period_type, period_started_at, expires_at, will_renew)
--   values ('<uid>', '<yillik_urun>', 'app_store', 'trial', now() - interval '1 day', now() + interval '6 days', true)
--   on conflict (user_id) do update set period_type = excluded.period_type,
--     period_started_at = excluded.period_started_at, expires_at = excluded.expires_at,
--     product_id = excluded.product_id, will_renew = true;
--   select * from public.trials where user_id = '<uid>';                       -- 1 satır
--   select * from public.packshot_setup where user_id = '<uid>';               -- yok
--   select public.tryon_quota('<uid>'), public.scan_quota('<uid>'), public.packshot_quota('<uid>');
--     -- plan 'trial', window 'trial', limit 2 / 5 / 15
--   select public.start_scan_job('<uid>');   -- ×5 allowed true, 6. allowed false
--   select public.start_tryon('<uid>');      -- ×2 allowed true, 3. allowed false
--   select public.start_garment_job('<uid>', 'packshot');   -- 15'e kadar true, 16. false
--   select public.fail_scan_job('<uid>', '<job_id>');      -- true → hak geri
--
-- Ücretliye geçiş (sayaçlar sıfırlanır, yıllıkta kurulum ayı şimdi başlar):
--   update public.entitlements set period_type = 'normal', period_started_at = now(),
--          expires_at = now() + interval '1 year' where user_id = '<uid>';
--   select converted_at from public.trials where user_id = '<uid>';            -- dolu
--   select * from public.packshot_setup where user_id = '<uid>';               -- yıllık ürün annual_products'taysa var
--   select public.tryon_quota('<uid>'), public.scan_quota('<uid>');            -- premium, used 0, limit 5 / 40
--
-- Erişim yok:
--   update public.entitlements set expires_at = now() - interval '1 minute' where user_id = '<uid>';
--   select public.start_tryon('<uid>');  -- error 'subscription-required'
--   insert into public.wardrobe_items (user_id, category) values ('<uid>', 'upper');  -- hata 'subscription-required'
--   -- get_usage auth.uid() ister; SQL Editor'de: set local request.jwt.claims = '{"sub":"<uid>"}';
--
-- Temizlik:
--   delete from public.scan_jobs where user_id = '<uid>';
--   delete from public.garment_jobs where user_id = '<uid>';
--   delete from public.tryon_renders where user_id = '<uid>';
--   delete from public.api_usage where user_id = '<uid>' and fn = 'garment';
--   delete from public.trials where user_id = '<uid>';
--   delete from public.packshot_setup where user_id = '<uid>';
--   delete from public.entitlements where user_id = '<uid>';   -- sonra sync-entitlement gerçek durumu yazar
--
-- ─── GERİ ALMA (rollback) — ayrı çalıştır ────────────────────────────────────
-- Ücretsiz plan davranışına dönüş: 020'deki enforce_wardrobe_limit, start_tryon, start_scan
-- ve 021'deki limit_for, packshot_quota, start_garment_job, packshot_setup_on_entitlement,
-- get_usage bloklarını (yetki satırlarıyla) yeniden çalıştır; 016'daki purge_retention'ı
-- yeniden çalıştır; ardından:
-- begin;
--   insert into public.app_limits (key, value, description) values
--     ('free.wardrobe_max', 50, ''), ('free.tryon_lifetime', 3, ''), ('free.scan_monthly', 3, '')
--   on conflict do nothing;
--   update public.app_limits set value = 8 where key = 'premium.tryon_monthly';
--   delete from public.app_limits where key like 'trial.%' or key = 'premium.scan_monthly';
--   drop trigger if exists trials_on_entitlement on public.entitlements;
--   drop function if exists public.trials_on_entitlement();
--   drop function if exists public.get_limits();
--   drop function if exists public.start_scan_job(uuid);
--   drop function if exists public.complete_scan_job(uuid, uuid);
--   drop function if exists public.fail_scan_job(uuid, uuid);
--   drop function if exists public.scan_quota(uuid);
--   drop function if exists public.scan_used(uuid, timestamptz);
--   drop function if exists public.tryon_quota(uuid);
--   drop function if exists public.premium_since(uuid);
--   drop function if exists public.trial_since(uuid);
--   drop function if exists public.has_access(uuid);
--   drop table if exists public.scan_jobs;
--   drop table if exists public.trials;
--   alter table public.entitlements drop column if exists period_started_at;
-- commit;
