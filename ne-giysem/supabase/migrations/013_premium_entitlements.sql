-- ============================================================
-- 013_premium_entitlements
-- Premium (RevenueCat) — sunucu tarafı yetki ve limitler.
--
-- Kaynak: entitlements tablosu. Yalnızca service_role yazar:
--   • revenuecat-webhook  (RevenueCat olayı → REST v1 GET /subscribers → upsert)
--   • sync-entitlement    (istemci satın alma / geri yükleme sonrası, kendi uid'i)
-- Premium kuralı: satır var VE expires_at > now(). Yani süre dolunca webhook
-- gelmese bile premium kendiliğinden biter.
--
-- Limitler (CLAUDE.md → Monetizasyon):
--   Dolap      : ücretsiz 50 parça, premium sınırsız          → wardrobe_items trigger'ı
--   Try-on     : ücretsiz 3 (ömür boyu), premium 8 / takvim ayı → start_tryon
--   "Uyar mı?" : ücretsiz 3 / takvim ayı, premium sınırsız     → start_scan
--   Planlama   : yalnızca premium                              → combos trigger'ı
--   Takvim ayı = Europe/Istanbul.
--
-- Premium bitince: mevcut planlar ve 50 üstü parçalar KALIR (UPDATE/DELETE serbest);
-- yalnızca yeni parça / yeni plan eklenemez.
--
-- İstemcinin ayırt edeceği hata mesajları (PostgREST error.message, code P0001):
--   'wardrobe-limit'   — wardrobe_items INSERT, ücretsiz kullanıcı ≥ 50 parça
--   'planning-premium' — combos planned_for yazma, premium değil
--
-- Silme: entitlements → auth.users ON DELETE CASCADE (delete-account ile gider).
--
-- Önkoşul: 006, 008. Elle çalıştırılır (SQL Editor). Tekrar çalıştırılabilir.
-- ============================================================

begin;

-- ─── entitlements ────────────────────────────────────────────────────────────
create table if not exists public.entitlements (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  entitlement    text not null default 'premium',
  product_id     text,
  store          text,                -- 'app_store' | 'play_store' | 'promotional' | ...
  period_type    text,                -- 'normal' | 'trial' | 'intro' | ...
  expires_at     timestamptz,         -- null → premium DEĞİL; süresiz (ömür boyu) ürün = 'infinity'
  will_renew     boolean,
  updated_at     timestamptz not null default now(),
  last_synced_at timestamptz
);

alter table public.entitlements enable row level security;

-- Default privileges anon/authenticated'a ALL veriyor (schema snapshot) → geri al,
-- sonra yalnızca okuma ver. Yazma policy'si YOK: authenticated yazamaz.
revoke all on table public.entitlements from anon, authenticated;
grant select on table public.entitlements to authenticated;
grant all    on table public.entitlements to service_role;

drop policy if exists "entitlements: kendi satırını oku" on public.entitlements;
create policy "entitlements: kendi satırını oku"
  on public.entitlements
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ─── Yardımcılar: Istanbul takvim ayı ────────────────────────────────────────
-- now() at time zone 'Europe/Istanbul' → yerel saat (timestamp); ay başına kırp;
-- tekrar at time zone ile timestamptz'ye çevir.
create or replace function public.istanbul_month_start()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select date_trunc('month', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul';
$$;

create or replace function public.istanbul_next_month_start()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select (date_trunc('month', now() at time zone 'Europe/Istanbul') + interval '1 month')
         at time zone 'Europe/Istanbul';
$$;

-- ─── is_premium_user / is_premium ────────────────────────────────────────────
-- is_premium_user: başkasının durumunu sızdırmasın diye yalnızca service_role.
-- SECURITY DEFINER fonksiyonlar sahibi (postgres) olarak çalıştığından onlar da çağırabilir.
create or replace function public.is_premium_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from entitlements
     where user_id = p_user
       and entitlement = 'premium'
       and expires_at > now()
  );
$$;

-- is_premium: çağıranın kendi durumu
create or replace function public.is_premium()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and is_premium_user(auth.uid());
$$;

-- ─── tryon_used ──────────────────────────────────────────────────────────────
-- Kotadan düşen render sayısı. Sayılanlar (008 ile aynı):
--   • failed_at null (iade edilmemiş) VE
--   • başarılı (succeeded_at dolu) YA DA son 30 dk içinde başlamış (açık)
-- p_since null → ömür boyu; dolu → created_at >= p_since (ay başı).
create or replace function public.tryon_used(p_user uuid, p_since timestamptz)
returns int
language sql
stable
security definer
set search_path = public
as $$
  -- ⚠️ 30 dk = start_tryon / register_run'daki c_open_window ile AYNI olmalı
  select count(*)::int
    from tryon_renders
   where user_id = p_user
     and failed_at is null
     and (succeeded_at is not null or created_at > now() - interval '30 minutes')
     and (p_since is null or created_at >= p_since);
$$;

-- ─── start_tryon (008 + premium) ─────────────────────────────────────────────
-- Ücretsiz : ömür boyu 3 (008'deki mantık aynen).
-- Premium  : bu takvim ayında (Istanbul, render created_at'ine göre) 8.
-- Yanıt: allowed, render_id?, used, limit, plan ('free'|'premium'), reset_at (premium; free'de null)
create or replace function public.start_tryon(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_free_limit    constant int := 3;
  c_premium_limit constant int := 8;
  v_is_premium    boolean;
  v_limit         int;
  v_since         timestamptz;
  v_reset_at      timestamptz;
  v_used          int;
  v_render        uuid;
begin
  -- Aynı kullanıcının paralel start'larını sıraya sok: profil satırını kilitle
  perform 1 from profiles where id = p_user for update;
  if not found then
    return jsonb_build_object('allowed', false, 'error', 'no-profile');
  end if;

  v_is_premium := is_premium_user(p_user);
  if v_is_premium then
    v_limit    := c_premium_limit;
    v_since    := istanbul_month_start();
    v_reset_at := istanbul_next_month_start();
  else
    v_limit    := c_free_limit;
    v_since    := null;   -- ömür boyu
    v_reset_at := null;
  end if;

  v_used := tryon_used(p_user, v_since);

  if v_used >= v_limit then
    return jsonb_build_object(
      'allowed', false, 'used', v_used, 'limit', v_limit,
      'plan', case when v_is_premium then 'premium' else 'free' end,
      'reset_at', v_reset_at
    );
  end if;

  insert into tryon_renders (user_id) values (p_user) returning id into v_render;

  return jsonb_build_object(
    'allowed', true, 'render_id', v_render, 'used', v_used + 1, 'limit', v_limit,
    'plan', case when v_is_premium then 'premium' else 'free' end,
    'reset_at', v_reset_at
  );
end;
$$;

-- ─── Dolap limiti: BEFORE INSERT ON wardrobe_items ───────────────────────────
-- Yalnızca INSERT — premium bitince 50 üstü parçalar düzenlenebilir/silinebilir.
-- SECURITY DEFINER: profiles'ı FOR UPDATE kilitlemek ve entitlements'ı okumak için
-- (authenticated'ın profiles üzerinde yalnızca kolon bazlı UPDATE'i var).
create or replace function public.enforce_wardrobe_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c_free_limit constant int := 50;
  v_count      int;
begin
  if is_premium_user(new.user_id) then
    return new;
  end if;

  -- Paralel eklemeleri sıraya sok (iki istek aynı anda 49'u görüp 51'e çıkmasın)
  perform 1 from profiles where id = new.user_id for update;

  select count(*) into v_count from wardrobe_items where user_id = new.user_id;
  if v_count >= c_free_limit then
    raise exception 'wardrobe-limit'
      using errcode = 'P0001',
            detail  = jsonb_build_object('used', v_count, 'limit', c_free_limit)::text,
            hint    = 'premium';
  end if;

  return new;
end;
$$;

drop trigger if exists wardrobe_items_limit on public.wardrobe_items;
create trigger wardrobe_items_limit
  before insert on public.wardrobe_items
  for each row execute function public.enforce_wardrobe_limit();

-- ─── Planlama: BEFORE INSERT OR UPDATE ON combos ─────────────────────────────
-- Policy değil trigger: eski/yeni planned_for karşılaştırılmalı.
-- Engellenen: yeni plan (INSERT planned_for dolu) ve planı başka güne taşıma.
-- Serbest: planı kaldırma (null), giyildi işaretleme, diğer kolonlar, DELETE.
create or replace function public.enforce_planning_premium()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.planned_for is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.planned_for is not distinct from old.planned_for then
    return new;
  end if;
  if is_premium_user(new.user_id) then
    return new;
  end if;

  raise exception 'planning-premium'
    using errcode = 'P0001',
          hint    = 'premium';
end;
$$;

drop trigger if exists combos_planning_premium on public.combos;
create trigger combos_planning_premium
  before insert or update on public.combos
  for each row execute function public.enforce_planning_premium();

-- ─── start_scan ──────────────────────────────────────────────────────────────
-- "Uyar mı?" taraması başlatılırken istemci çağırır (auth.uid()).
-- Sayaç: api_usage, fn = 'store_scan', day = Istanbul tarihi; ay toplamı = bu ayın
-- günlerinin toplamı. Premium da kaydedilir (istatistik), limit uygulanmaz.
-- Atomik: profil satırı kilitli → paralel çağrılar ay toplamını aynı anda okuyamaz.
-- Not: start_scan'i atlayan değiştirilmiş istemci riski kabul edildi (günlük
-- anthropic/bg tavanları zaten var).
create or replace function public.start_scan()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_free_limit constant int := 3;
  v_user       uuid := auth.uid();
  v_is_premium boolean;
  v_today      date := (now() at time zone 'Europe/Istanbul')::date;
  v_month_day  date := date_trunc('month', now() at time zone 'Europe/Istanbul')::date;
  v_reset_at   timestamptz := istanbul_next_month_start();
  v_used       int;
begin
  if v_user is null then
    return jsonb_build_object('allowed', false, 'error', 'unauthorized');
  end if;

  perform 1 from profiles where id = v_user for update;
  if not found then
    return jsonb_build_object('allowed', false, 'error', 'no-profile');
  end if;

  v_is_premium := is_premium_user(v_user);

  select coalesce(sum(count), 0)::int into v_used
    from api_usage
   where user_id = v_user and fn = 'store_scan' and day >= v_month_day;

  if not v_is_premium and v_used >= c_free_limit then
    return jsonb_build_object(
      'allowed', false, 'plan', 'free',
      'used', v_used, 'limit', c_free_limit, 'reset_at', v_reset_at
    );
  end if;

  insert into api_usage (user_id, fn, day, count)
  values (v_user, 'store_scan', v_today, 1)
  on conflict (user_id, fn, day)
  do update set count = api_usage.count + 1;

  return jsonb_build_object(
    'allowed', true,
    'plan',    case when v_is_premium then 'premium' else 'free' end,
    'used',    v_used + 1,
    'limit',   case when v_is_premium then null else c_free_limit end,
    'reset_at', v_reset_at
  );
end;
$$;

-- ─── get_usage ───────────────────────────────────────────────────────────────
-- Paywall + Profil kartı için tek çağrı (auth.uid()). limit null = sınırsız.
-- {
--   plan, premium_expires_at, will_renew,
--   wardrobe: {used, limit},
--   tryon:    {used, limit, reset_at},   -- ücretsiz: ömür boyu, reset_at null
--   scan:     {used, limit, reset_at}
-- }
-- premium_expires_at / will_renew: satır varsa (süresi geçmiş olsa da) döner —
-- "premium'un bitti" mesajı için.
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

  return jsonb_build_object(
    'plan',               case when v_is_premium then 'premium' else 'free' end,
    'premium_expires_at', v_ent.expires_at,
    'will_renew',         v_ent.will_renew,
    'wardrobe', jsonb_build_object(
      'used',  v_wardrobe,
      'limit', case when v_is_premium then null else 50 end
    ),
    'tryon', case when v_is_premium
      then jsonb_build_object(
        'used',     tryon_used(v_user, istanbul_month_start()),
        'limit',    8,
        'reset_at', istanbul_next_month_start())
      else jsonb_build_object(
        'used',     tryon_used(v_user, null),
        'limit',    3,
        'reset_at', null)
      end,
    'scan', jsonb_build_object(
      'used',     v_scan,
      'limit',    case when v_is_premium then null else 3 end,
      'reset_at', istanbul_next_month_start()
    )
  );
end;
$$;

-- ─── Yetkiler ────────────────────────────────────────────────────────────────
-- Default privileges her yeni fonksiyona public/anon/authenticated EXECUTE veriyor
-- → hepsinden geri al, sonra açıkça ver. create or replace mevcut yetkileri korur;
-- start_tryon yine de açıkça tekrarlanıyor.
revoke execute on function public.istanbul_month_start()          from public, anon, authenticated;
revoke execute on function public.istanbul_next_month_start()     from public, anon, authenticated;
revoke execute on function public.is_premium_user(uuid)           from public, anon, authenticated;
revoke execute on function public.is_premium()                    from public, anon, authenticated;
revoke execute on function public.tryon_used(uuid, timestamptz)   from public, anon, authenticated;
revoke execute on function public.start_tryon(uuid)               from public, anon, authenticated;
revoke execute on function public.enforce_wardrobe_limit()        from public, anon, authenticated;
revoke execute on function public.enforce_planning_premium()      from public, anon, authenticated;
revoke execute on function public.start_scan()                    from public, anon, authenticated;
revoke execute on function public.get_usage()                     from public, anon, authenticated;

-- Yalnızca sunucu (edge function'lar)
grant execute on function public.istanbul_month_start()           to service_role;
grant execute on function public.istanbul_next_month_start()      to service_role;
grant execute on function public.is_premium_user(uuid)            to service_role;
grant execute on function public.tryon_used(uuid, timestamptz)    to service_role;
grant execute on function public.start_tryon(uuid)                to service_role;
-- Trigger fonksiyonları: tetiklenirken EXECUTE kontrol edilmez; kimseye verilmez.

-- İstemci (kendi auth.uid()'i ile)
grant execute on function public.is_premium()                     to authenticated, service_role;
grant execute on function public.start_scan()                     to authenticated;
grant execute on function public.get_usage()                      to authenticated;

commit;

-- ─── Doğrulama (ayrı çalıştır) ───────────────────────────────────────────────
-- select tgname, tgrelid::regclass from pg_trigger
--  where tgname in ('wardrobe_items_limit', 'combos_planning_premium');
--
-- select p.proname, r.rolname,
--        has_function_privilege(r.rolname, p.oid, 'execute') as can_execute
--   from pg_proc p
--   cross join (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
--  where p.pronamespace = 'public'::regnamespace
--    and p.proname in ('is_premium_user', 'is_premium', 'start_tryon', 'start_scan',
--                      'get_usage', 'tryon_used')
--  order by 1, 2;
-- Beklenen: is_premium_user / start_tryon / tryon_used → yalnızca service_role;
--           is_premium → authenticated + service_role; start_scan / get_usage → authenticated.
--
-- ─── TEST: RevenueCat olmadan premium ────────────────────────────────────────
-- '<uid>' = auth.users.id (Authentication → Users). Premium aç (30 gün):
--
-- insert into public.entitlements (user_id, product_id, store, period_type, expires_at, will_renew, last_synced_at)
-- values ('<uid>', 'manual_test', 'promotional', 'normal', now() + interval '30 days', false, now())
-- on conflict (user_id) do update
--   set expires_at = excluded.expires_at, product_id = excluded.product_id,
--       store = excluded.store, will_renew = excluded.will_renew, updated_at = now();
--
-- Premium-bitmiş durumu (satır kalır, süre geçmiş):
-- update public.entitlements set expires_at = now() - interval '1 minute', updated_at = now()
--  where user_id = '<uid>';
--
-- Ücretsize dön (satırı sil):
-- delete from public.entitlements where user_id = '<uid>';
--
-- Not: RevenueCat kurulduktan sonra bu kullanıcı için gelen ilk webhook / sync-entitlement
-- satırı RevenueCat'teki gerçek duruma göre ezer ya da siler.
