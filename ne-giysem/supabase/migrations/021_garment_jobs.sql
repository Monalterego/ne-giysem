-- ============================================================
-- 021_garment_jobs
-- Adım 8-10 (G1): kıyafet görseli kaynağı + packshot kotası. Try-on kotasına
-- (start_tryon, tryon_used, register_run, fail_render, tryon_renders) DOKUNULMAZ.
--
--   1) wardrobe_items.image_source — 'packshot' | 'bg_removed' | 'device_cutout' |
--      'original'; NULL = eski (Poof dönemi) parça. 'bg_removed' şu an kullanılmıyor
--      (FASHN background-remove hiçbir dalda yok — karar 07.11.2026), değer ayrılmış.
--   2) garment_jobs — her packshot FASHN çağrısı bir iş. Kota ve sahiplik (status
--      çağrısında prediction id'nin kullanıcıya ait olması) buradan. tryon_renders
--      deseni: rezervasyon 10 dk açık sayılır, başarıyla kalıcı olur, üst servis
--      hatasında failed_at ile iade. api_usage KULLANILMAZ: 13 ayda siliniyor
--      (purge_retention) → ömür boyu "ilk 3 parça" sayımı zamanla sıfırlanırdı.
--   3) Yıllık plan "kurulum ayı": yıllık abonenin ilk N günü (varsayılan 30) limit 150,
--      sonra İstanbul takvim ayı başına 40.
--        • annual_products(product_id) — yıllık ürün kimlikleri ELLE eklenir (App Store
--          ve Play ayrı; entitlements.product_id'de nasıl yazıyorsa öyle). Liste boşsa
--          kimse yıllık sayılmaz, kurulum ayı yok.
--        • packshot_setup(user_id, started_at) — entitlements'a yıllık ve geçerli bir
--          ürün ilk kez yazıldığında tetikleyici bir kez doldurur (RevenueCat'in
--          belgelenmemiş original_purchase_date alanına dayanmaz). Satır entitlements
--          silinse de kalır → kurulum ayı kullanıcı başına bir kez.
--   4) limit_for yeni anahtarlar (app_limits'e 15. adımda girecek; şimdilik varsayılan):
--        free.packshot_lifetime        3   ücretsiz, ömür boyu
--        premium.packshot_monthly     40   premium, İstanbul takvim ayı
--        premium.packshot_annual_setup 150 yıllık abonenin kurulum ayında
--        premium.packshot_setup_days  30   kurulum ayının uzunluğu (gün)
--        abuse.garment_daily          60   günlük kötüye kullanım tavanı (api_usage 'garment')
--   5) packshot_quota / start_garment_job / register_garment_prediction /
--      complete_garment_job / fail_garment_job (yalnızca service_role)
--   6) get_usage: 'packshot' alanı (020'deki gövde + bu alan)
--
-- Sayım: packshot işi kotadan düşer ⇔ failed_at null VE (succeeded_at dolu YA DA
-- son 10 dk içinde açılmış). Kullanıcı packshot'ı reddederse iade YOK (kredi harcandı).
-- Parça silinince iş satırı kalır (item_id null olur) → hak geri gelmez.
--
-- Önkoşul: 020. Elle çalıştırılır (SQL Editor). Tekrar çalıştırılabilir.
-- ============================================================

begin;

-- ─── 1) wardrobe_items.image_source ──────────────────────────────────────────
alter table public.wardrobe_items add column if not exists image_source text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'wardrobe_items_image_source_check'
       and conrelid = 'public.wardrobe_items'::regclass
  ) then
    alter table public.wardrobe_items
      add constraint wardrobe_items_image_source_check
      check (image_source is null
             or image_source in ('packshot', 'bg_removed', 'device_cutout', 'original'));
  end if;
end;
$$;

-- ─── 2) garment_jobs ─────────────────────────────────────────────────────────
create table if not exists public.garment_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('packshot')),
  -- "stüdyo kalitesine yükselt": hangi parça. Parça silinince iş kalır (kota kaydı)
  item_id       uuid references public.wardrobe_items(id) on delete set null,
  prediction_id text,
  created_at    timestamptz not null default now(),
  succeeded_at  timestamptz,
  failed_at     timestamptz
);

create index if not exists idx_garment_jobs_user_created
  on public.garment_jobs (user_id, created_at desc);
create unique index if not exists idx_garment_jobs_prediction
  on public.garment_jobs (prediction_id) where prediction_id is not null;

alter table public.garment_jobs enable row level security;
-- Policy YOK: yalnızca service_role (garment-image)
revoke all on table public.garment_jobs from anon, authenticated;
grant all on table public.garment_jobs to service_role;

-- ─── 3) Yıllık plan: ürün listesi + kurulum ayı başlangıcı ────────────────────
create table if not exists public.annual_products (
  product_id text primary key,
  note       text not null default ''
);
alter table public.annual_products enable row level security;
revoke all on table public.annual_products from anon, authenticated;
grant all on table public.annual_products to service_role;

create table if not exists public.packshot_setup (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null default now()
);
alter table public.packshot_setup enable row level security;
revoke all on table public.packshot_setup from anon, authenticated;
grant all on table public.packshot_setup to service_role;

-- Yıllık ve geçerli bir ürün entitlements'a ilk kez yazılınca kurulum ayı başlar (bir kez)
create or replace function public.packshot_setup_on_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.expires_at > now()
     and exists (select 1 from annual_products where product_id = new.product_id) then
    insert into packshot_setup (user_id) values (new.user_id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists packshot_setup_on_entitlement on public.entitlements;
create trigger packshot_setup_on_entitlement
  after insert or update on public.entitlements
  for each row execute function public.packshot_setup_on_entitlement();

-- Şu an yıllık bir üründe mi? (premium + ürün listede)
create or replace function public.is_annual_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from entitlements e
      join annual_products a on a.product_id = e.product_id
     where e.user_id = p_user and e.expires_at > now()
  );
$$;

-- ─── 4) limit_for (020 + packshot anahtarları) ────────────────────────────────
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
    when 'free.wardrobe_max'             then 50
    when 'free.tryon_lifetime'           then 3
    when 'premium.tryon_monthly'         then 8
    when 'free.scan_monthly'             then 3
    -- 021: geçici varsayılanlar, 15. adımda app_limits'e girer
    when 'free.packshot_lifetime'        then 3
    when 'premium.packshot_monthly'      then 40
    when 'premium.packshot_annual_setup' then 150
    when 'premium.packshot_setup_days'   then 30
    when 'abuse.garment_daily'           then 60
    else limit_for_unknown(p_key)
  end;
end;
$$;

-- ─── 5) Packshot kotası ──────────────────────────────────────────────────────
-- Kotadan düşen packshot işi sayısı, p_since'ten (null → ömür boyu) itibaren.
-- ⚠️ 10 dk açık pencere start_garment_job'daki rezervasyonla aynı anlamda
create or replace function public.packshot_used(p_user uuid, p_since timestamptz)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from garment_jobs
   where user_id = p_user
     and kind = 'packshot'
     and failed_at is null
     and (succeeded_at is not null or created_at > now() - interval '10 minutes')
     and (p_since is null or created_at >= p_since);
$$;

-- { plan, window ('free'|'setup'|'monthly'), used, limit, reset_at }
--   free    : ömür boyu free.packshot_lifetime
--   setup   : yıllık abone, kurulum ayı içinde → premium.packshot_annual_setup
--             (sayım kurulum başlangıcından; reset_at = kurulum bitişi)
--   monthly : premium → premium.packshot_monthly, İstanbul ayı (kurulum ayı bu ay
--             içinde bittiyse sayım bitişten itibaren; reset_at = sonraki ay başı)
-- limit NULL = sınırsız.
create or replace function public.packshot_quota(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_setup_start timestamptz;
  v_setup_end   timestamptz;
  v_since       timestamptz;
begin
  if not is_premium_user(p_user) then
    return jsonb_build_object(
      'plan', 'free', 'window', 'free',
      'used', packshot_used(p_user, null),
      'limit', limit_for('free.packshot_lifetime'),
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

  v_since := greatest(istanbul_month_start(), coalesce(v_setup_end, '-infinity'::timestamptz));
  return jsonb_build_object(
    'plan', 'premium', 'window', 'monthly',
    'used', packshot_used(p_user, v_since),
    'limit', limit_for('premium.packshot_monthly'),
    'reset_at', istanbul_next_month_start());
end;
$$;

-- Kota kontrolü + iş kaydı tek işlemde (start_tryon deseni).
-- Döner: { allowed, job_id?, used, limit, reset_at, plan, window, error? }
--   error: 'no-profile' | 'item-not-found' | 'daily-limit'
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
  v_used  := (v_quota->>'used')::int;
  v_limit := (v_quota->>'limit')::int;   -- null → sınırsız

  if v_limit is not null and v_used >= v_limit then
    return v_quota || jsonb_build_object('allowed', false);
  end if;

  -- Günlük kötüye kullanım tavanı (bump_usage sınır aşılınca da artırır — bg deseni)
  if not bump_usage(p_user, 'garment', limit_for('abuse.garment_daily')) then
    return v_quota || jsonb_build_object('allowed', false, 'error', 'daily-limit');
  end if;

  insert into garment_jobs (user_id, kind, item_id)
  values (p_user, p_kind, p_item)
  returning id into v_job;

  return v_quota || jsonb_build_object('allowed', true, 'job_id', v_job, 'used', v_used + 1);
end;
$$;

-- FASHN /run başarılı → prediction id işe yazılır (bir kez). Döner: yazıldıysa true.
create or replace function public.register_garment_prediction(p_user uuid, p_job uuid, p_prediction text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update garment_jobs
     set prediction_id = p_prediction
   where id = p_job and user_id = p_user
     and prediction_id is null and failed_at is null;
  return found;
end;
$$;

-- completed → kalıcı (iade edilmiş işi başarılı saymaz). Tekrar çağrılabilir.
create or replace function public.complete_garment_job(p_user uuid, p_job uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update garment_jobs
     set succeeded_at = coalesce(succeeded_at, now())
   where id = p_job and user_id = p_user and failed_at is null;
  return found;
end;
$$;

-- Üst servis hatası (/run OutOfCredits ya da 5xx, /status failed) → iade.
-- Başarılı işi iade etmez. Döner: iade edildiyse true.
create or replace function public.fail_garment_job(p_user uuid, p_job uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update garment_jobs
     set failed_at = now()
   where id = p_job and user_id = p_user
     and failed_at is null and succeeded_at is null;
  return found;
end;
$$;

-- ─── 6) get_usage (020 + packshot) ───────────────────────────────────────────
create or replace function public.get_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_is_premium boolean;
  v_ent        entitlements%rowtype;
  v_wardrobe   int;
  v_scan       int;
  v_packshot   jsonb;
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  v_is_premium := is_premium_user(v_user);
  select * into v_ent from entitlements where user_id = v_user;

  select count(*)::int into v_wardrobe from wardrobe_items where user_id = v_user;

  select coalesce(sum(count), 0)::int into v_scan
    from api_usage
   where user_id = v_user and fn = 'store_scan'
     and day >= date_trunc('month', now() at time zone 'Europe/Istanbul')::date;

  v_packshot := packshot_quota(v_user);

  return jsonb_build_object(
    'plan',               case when v_is_premium then 'premium' else 'free' end,
    'premium_expires_at', v_ent.expires_at,
    'will_renew',         v_ent.will_renew,
    'wardrobe', jsonb_build_object(
      'used',  v_wardrobe,
      'limit', case when v_is_premium then null else limit_for('free.wardrobe_max') end
    ),
    'tryon', case when v_is_premium
      then jsonb_build_object(
        'used',     tryon_used(v_user, istanbul_month_start()),
        'limit',    limit_for('premium.tryon_monthly'),
        'reset_at', istanbul_next_month_start())
      else jsonb_build_object(
        'used',     tryon_used(v_user, null),
        'limit',    limit_for('free.tryon_lifetime'),
        'reset_at', null)
      end,
    'scan', jsonb_build_object(
      'used',     v_scan,
      'limit',    case when v_is_premium then null else limit_for('free.scan_monthly') end,
      'reset_at', istanbul_next_month_start()
    ),
    'packshot', jsonb_build_object(
      'used',     v_packshot->'used',
      'limit',    v_packshot->'limit',
      'reset_at', v_packshot->'reset_at',
      'window',   v_packshot->'window'
    )
  );
end;
$$;

-- ─── Yetkiler ────────────────────────────────────────────────────────────────
revoke execute on function public.packshot_setup_on_entitlement()           from public, anon, authenticated;
revoke execute on function public.is_annual_user(uuid)                      from public, anon, authenticated;
revoke execute on function public.limit_for(text)                           from public, anon, authenticated;
revoke execute on function public.packshot_used(uuid, timestamptz)          from public, anon, authenticated;
revoke execute on function public.packshot_quota(uuid)                      from public, anon, authenticated;
revoke execute on function public.start_garment_job(uuid, text, uuid)       from public, anon, authenticated;
revoke execute on function public.register_garment_prediction(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.complete_garment_job(uuid, uuid)          from public, anon, authenticated;
revoke execute on function public.fail_garment_job(uuid, uuid)              from public, anon, authenticated;
revoke execute on function public.get_usage()                               from public, anon, authenticated;

grant execute on function public.is_annual_user(uuid)                       to service_role;
grant execute on function public.limit_for(text)                            to service_role;
grant execute on function public.packshot_used(uuid, timestamptz)           to service_role;
grant execute on function public.packshot_quota(uuid)                       to service_role;
grant execute on function public.start_garment_job(uuid, text, uuid)        to service_role;
grant execute on function public.register_garment_prediction(uuid, uuid, text) to service_role;
grant execute on function public.complete_garment_job(uuid, uuid)           to service_role;
grant execute on function public.fail_garment_job(uuid, uuid)               to service_role;
grant execute on function public.get_usage()                                to authenticated;

commit;

-- ─── Yıllık ürünleri ekle (gerçek kimliklerle; ayrı çalıştır) ────────────────
-- Kimlik, entitlements.product_id'de göründüğü gibi (Android 'urun:baseplan' olabilir):
--   select distinct product_id, store from public.entitlements;
-- insert into public.annual_products (product_id, note) values
--   ('<app_store_yillik_urun_id>', 'App Store yıllık'),
--   ('<play_yillik_urun_id>',      'Play yıllık')
-- on conflict do nothing;
-- Liste eklenmeden önce yıllık abone olmuş kullanıcıda kurulum ayı, entitlements bir
-- sonraki senkronda (webhook / sync-entitlement) güncellenince başlar.
--
-- ─── Doğrulama (ayrı çalıştır) ───────────────────────────────────────────────
-- select column_name, data_type from information_schema.columns
--  where table_schema = 'public' and table_name = 'wardrobe_items' and column_name = 'image_source';
-- select public.limit_for('free.packshot_lifetime'), public.limit_for('premium.packshot_monthly'),
--        public.limit_for('premium.packshot_annual_setup'), public.limit_for('premium.packshot_setup_days'),
--        public.limit_for('abuse.garment_daily');                      -- 3, 40, 150, 30, 60
-- select public.packshot_quota('<test_uid>');
--
-- Kota testi (test kullanıcısı, ücretsiz plan; FASHN çağrısı YOK):
--   select public.start_garment_job('<uid>', 'packshot');   -- ×3 → allowed true, used 1..3
--   select public.start_garment_job('<uid>', 'packshot');   -- 4. → allowed false, used 3, limit 3
--   select public.fail_garment_job('<uid>', '<job_id>');     -- true → hak geri
--   select public.start_garment_job('<uid>', 'packshot');   -- allowed true
--   select public.complete_garment_job('<uid>', '<job_id>'); -- true
--   select public.fail_garment_job('<uid>', '<aynı job_id>'); -- false (başarılı iş iade edilmez)
-- Temizlik: delete from public.garment_jobs where user_id = '<uid>';
--           delete from public.api_usage where user_id = '<uid>' and fn = 'garment';
--
-- ─── GERİ ALMA (rollback) — ayrı çalıştır ────────────────────────────────────
-- begin;
--   -- get_usage ve limit_for: 020_app_limits.sql'deki iki create or replace bloğunu
--   -- (limit_for, get_usage) ve yetki satırlarını yeniden çalıştır.
--   drop trigger if exists packshot_setup_on_entitlement on public.entitlements;
--   drop function if exists public.packshot_setup_on_entitlement();
--   drop function if exists public.start_garment_job(uuid, text, uuid);
--   drop function if exists public.register_garment_prediction(uuid, uuid, text);
--   drop function if exists public.complete_garment_job(uuid, uuid);
--   drop function if exists public.fail_garment_job(uuid, uuid);
--   drop function if exists public.packshot_quota(uuid);
--   drop function if exists public.packshot_used(uuid, timestamptz);
--   drop function if exists public.is_annual_user(uuid);
--   drop table if exists public.garment_jobs;
--   drop table if exists public.packshot_setup;
--   drop table if exists public.annual_products;
--   alter table public.wardrobe_items drop constraint if exists wardrobe_items_image_source_check;
--   alter table public.wardrobe_items drop column if exists image_source;
-- commit;
