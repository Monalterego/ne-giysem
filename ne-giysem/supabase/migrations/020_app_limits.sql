-- ============================================================
-- 020_app_limits
-- Plan limitleri SQL sabitlerinden app_limits tablosuna. DAVRANIŞ DEĞİŞMEZ:
-- tablo bugünkü değerlerle doldurulur; dört fonksiyonda yalnızca sabitler
-- limit_for(...) çağrısıyla değişir, başka mantık aynen (013'ten kopya).
--
-- Taşınan sabitler (013_premium_entitlements.sql):
--   free.wardrobe_max      50  enforce_wardrobe_limit  :200 (c_free_limit)    · get_usage :362
--   free.tryon_lifetime     3  start_tryon             :143 (c_free_limit)    · get_usage :371
--   premium.tryon_monthly   8  start_tryon             :144 (c_premium_limit) · get_usage :367
--   free.scan_monthly       3  start_scan              :273 (c_free_limit)    · get_usage :376
--
-- Taşınmayanlar (plan limiti değil ya da kapsam dışı):
--   • Premium dolap / tarama sınırsızlığı — fonksiyonlarda is_premium dalı (yapısal)
--   • register_run c_max_runs = 6, render penceresi 30 dk (008:107-109, 013:128)
--   • Edge function günlük tavanları (bg / anthropic 150) — TypeScript sabitleri
--
-- Değer anlamı: integer ≥ 0; NULL = sınırsız (karşılaştırmalar NULL'da engellemez,
-- yanıttaki 'limit' null olur — istemci tryon.limit null'ı henüz beklemiyor).
-- Satır yoksa limit_for bugünkü sabite döner; bilinmeyen anahtar hata verir.
--
-- Değiştirme (build gerekmez): update public.app_limits set value = … where key = …;
--
-- Erişim: yalnızca service_role (ve SQL Editor). İstemci okumaz — sayıları
-- get_usage zaten döndürüyor.
--
-- Önkoşul: 013. Elle çalıştırılır (SQL Editor). Tekrar çalıştırılabilir:
-- mevcut satırların değerleri ezilmez (on conflict do nothing).
-- ============================================================

begin;

-- ─── app_limits ──────────────────────────────────────────────────────────────
create table if not exists public.app_limits (
  key         text primary key,
  value       int check (value is null or value >= 0),   -- NULL = sınırsız
  description text not null default '',
  updated_at  timestamptz not null default now()
);

alter table public.app_limits enable row level security;
-- Policy YOK: anon/authenticated erişemez. Yazma yalnızca service_role.
revoke all on table public.app_limits from anon, authenticated;
grant all on table public.app_limits to service_role;

insert into public.app_limits (key, value, description) values
  ('free.wardrobe_max',     50, 'Ücretsiz plan dolap parça sınırı (enforce_wardrobe_limit, get_usage)'),
  ('free.tryon_lifetime',    3, 'Ücretsiz plan sanal deneme, ömür boyu (start_tryon, get_usage)'),
  ('premium.tryon_monthly',  8, 'Premium sanal deneme, Istanbul takvim ayı (start_tryon, get_usage)'),
  ('free.scan_monthly',      3, 'Ücretsiz plan "Uyar mı?" taraması, Istanbul takvim ayı (start_scan, get_usage)')
on conflict (key) do nothing;

-- updated_at elle unutulmasın
create or replace function public.app_limits_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists app_limits_touch on public.app_limits;
create trigger app_limits_touch
  before update on public.app_limits
  for each row execute function public.app_limits_touch();

-- ─── limit_for ───────────────────────────────────────────────────────────────
-- Tablodaki değer (NULL = sınırsız); satır yoksa 013'teki sabit. Bilinmeyen anahtar
-- hata verir — yazım hatası sessizce "sınırsız"a dönmesin.
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
    when 'free.wardrobe_max'     then 50
    when 'free.tryon_lifetime'   then 3
    when 'premium.tryon_monthly' then 8
    when 'free.scan_monthly'     then 3
    else limit_for_unknown(p_key)
  end;
end;
$$;

-- CASE içinde raise yazılamadığı için ayrı
create or replace function public.limit_for_unknown(p_key text)
returns int
language plpgsql
set search_path = public
as $$
begin
  raise exception 'limit_for: bilinmeyen anahtar %', p_key using errcode = '22023';
end;
$$;

-- ─── start_tryon (013 + limit_for) ───────────────────────────────────────────
create or replace function public.start_tryon(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_free_limit    int := limit_for('free.tryon_lifetime');
  c_premium_limit int := limit_for('premium.tryon_monthly');
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

-- ─── enforce_wardrobe_limit (013 + limit_for) ────────────────────────────────
create or replace function public.enforce_wardrobe_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c_free_limit int := limit_for('free.wardrobe_max');
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

-- ─── start_scan (013 + limit_for) ────────────────────────────────────────────
create or replace function public.start_scan()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_free_limit int := limit_for('free.scan_monthly');
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

-- ─── get_usage (013 + limit_for) ─────────────────────────────────────────────
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
    )
  );
end;
$$;

-- ─── Yetkiler ────────────────────────────────────────────────────────────────
-- Yeni fonksiyonlar: default privileges'ı geri al, yalnızca service_role.
-- Dört fonksiyonun yetkileri create or replace ile korunur; 013 ile aynı biçimde tekrar.
revoke execute on function public.limit_for(text)          from public, anon, authenticated;
revoke execute on function public.limit_for_unknown(text)  from public, anon, authenticated;
revoke execute on function public.app_limits_touch()       from public, anon, authenticated;
grant  execute on function public.limit_for(text)          to service_role;

revoke execute on function public.start_tryon(uuid)            from public, anon, authenticated;
revoke execute on function public.enforce_wardrobe_limit()     from public, anon, authenticated;
revoke execute on function public.start_scan()                 from public, anon, authenticated;
revoke execute on function public.get_usage()                  from public, anon, authenticated;
grant  execute on function public.start_tryon(uuid)            to service_role;
grant  execute on function public.start_scan()                 to authenticated;
grant  execute on function public.get_usage()                  to authenticated;

commit;

-- ─── Doğrulama (ayrı çalıştır) ───────────────────────────────────────────────
-- select key, value, public.limit_for(key) as effective from public.app_limits order by key;
-- Beklenen: 4 satır, value = effective = 50 / 3 / 8 / 3.
--
-- select p.proname, r.rolname, has_function_privilege(r.rolname, p.oid, 'execute') as can_execute
--   from pg_proc p
--   cross join (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
--  where p.pronamespace = 'public'::regnamespace
--    and p.proname in ('limit_for', 'start_tryon', 'start_scan', 'get_usage')
--  order by 1, 2;
-- Beklenen: limit_for / start_tryon → yalnızca service_role; start_scan / get_usage → authenticated.
--
-- select has_table_privilege('authenticated', 'public.app_limits', 'select'); -- false
--
-- ─── GERİ ALMA (rollback) — ayrı çalıştır ────────────────────────────────────
-- Dört fonksiyonu 013'teki sabitli hâllerine döndürür, sonra limit_for ve tabloyu siler.
-- Sıra önemli: fonksiyonlar limit_for'u çağırmayı bırakmadan limit_for silinemez
-- (plpgsql bağımlılığı derleme anında değil çağrı anında kırılır → önce fonksiyonlar).
--
-- begin;
--
-- create or replace function public.start_tryon(p_user uuid)
-- returns jsonb language plpgsql security definer set search_path = public as $$
-- declare
--   c_free_limit    constant int := 3;
--   c_premium_limit constant int := 8;
--   v_is_premium boolean; v_limit int; v_since timestamptz; v_reset_at timestamptz;
--   v_used int; v_render uuid;
-- begin
--   perform 1 from profiles where id = p_user for update;
--   if not found then
--     return jsonb_build_object('allowed', false, 'error', 'no-profile');
--   end if;
--   v_is_premium := is_premium_user(p_user);
--   if v_is_premium then
--     v_limit := c_premium_limit; v_since := istanbul_month_start(); v_reset_at := istanbul_next_month_start();
--   else
--     v_limit := c_free_limit; v_since := null; v_reset_at := null;
--   end if;
--   v_used := tryon_used(p_user, v_since);
--   if v_used >= v_limit then
--     return jsonb_build_object('allowed', false, 'used', v_used, 'limit', v_limit,
--       'plan', case when v_is_premium then 'premium' else 'free' end, 'reset_at', v_reset_at);
--   end if;
--   insert into tryon_renders (user_id) values (p_user) returning id into v_render;
--   return jsonb_build_object('allowed', true, 'render_id', v_render, 'used', v_used + 1, 'limit', v_limit,
--     'plan', case when v_is_premium then 'premium' else 'free' end, 'reset_at', v_reset_at);
-- end;
-- $$;
--
-- create or replace function public.enforce_wardrobe_limit()
-- returns trigger language plpgsql security definer set search_path = public as $$
-- declare
--   c_free_limit constant int := 50;
--   v_count int;
-- begin
--   if is_premium_user(new.user_id) then return new; end if;
--   perform 1 from profiles where id = new.user_id for update;
--   select count(*) into v_count from wardrobe_items where user_id = new.user_id;
--   if v_count >= c_free_limit then
--     raise exception 'wardrobe-limit'
--       using errcode = 'P0001',
--             detail  = jsonb_build_object('used', v_count, 'limit', c_free_limit)::text,
--             hint    = 'premium';
--   end if;
--   return new;
-- end;
-- $$;
--
-- create or replace function public.start_scan()
-- returns jsonb language plpgsql security definer set search_path = public as $$
-- declare
--   c_free_limit constant int := 3;
--   v_user uuid := auth.uid();
--   v_is_premium boolean;
--   v_today date := (now() at time zone 'Europe/Istanbul')::date;
--   v_month_day date := date_trunc('month', now() at time zone 'Europe/Istanbul')::date;
--   v_reset_at timestamptz := istanbul_next_month_start();
--   v_used int;
-- begin
--   if v_user is null then
--     return jsonb_build_object('allowed', false, 'error', 'unauthorized');
--   end if;
--   perform 1 from profiles where id = v_user for update;
--   if not found then
--     return jsonb_build_object('allowed', false, 'error', 'no-profile');
--   end if;
--   v_is_premium := is_premium_user(v_user);
--   select coalesce(sum(count), 0)::int into v_used
--     from api_usage where user_id = v_user and fn = 'store_scan' and day >= v_month_day;
--   if not v_is_premium and v_used >= c_free_limit then
--     return jsonb_build_object('allowed', false, 'plan', 'free',
--       'used', v_used, 'limit', c_free_limit, 'reset_at', v_reset_at);
--   end if;
--   insert into api_usage (user_id, fn, day, count) values (v_user, 'store_scan', v_today, 1)
--   on conflict (user_id, fn, day) do update set count = api_usage.count + 1;
--   return jsonb_build_object('allowed', true,
--     'plan', case when v_is_premium then 'premium' else 'free' end,
--     'used', v_used + 1,
--     'limit', case when v_is_premium then null else c_free_limit end,
--     'reset_at', v_reset_at);
-- end;
-- $$;
--
-- create or replace function public.get_usage()
-- returns jsonb language plpgsql stable security definer set search_path = public as $$
-- declare
--   v_user uuid := auth.uid(); v_is_premium boolean; v_ent entitlements%rowtype;
--   v_wardrobe int; v_scan int;
-- begin
--   if v_user is null then raise exception 'unauthorized' using errcode = '42501'; end if;
--   v_is_premium := is_premium_user(v_user);
--   select * into v_ent from entitlements where user_id = v_user;
--   select count(*)::int into v_wardrobe from wardrobe_items where user_id = v_user;
--   select coalesce(sum(count), 0)::int into v_scan from api_usage
--    where user_id = v_user and fn = 'store_scan'
--      and day >= date_trunc('month', now() at time zone 'Europe/Istanbul')::date;
--   return jsonb_build_object(
--     'plan', case when v_is_premium then 'premium' else 'free' end,
--     'premium_expires_at', v_ent.expires_at,
--     'will_renew', v_ent.will_renew,
--     'wardrobe', jsonb_build_object('used', v_wardrobe, 'limit', case when v_is_premium then null else 50 end),
--     'tryon', case when v_is_premium
--       then jsonb_build_object('used', tryon_used(v_user, istanbul_month_start()), 'limit', 8, 'reset_at', istanbul_next_month_start())
--       else jsonb_build_object('used', tryon_used(v_user, null), 'limit', 3, 'reset_at', null)
--       end,
--     'scan', jsonb_build_object('used', v_scan, 'limit', case when v_is_premium then null else 3 end,
--       'reset_at', istanbul_next_month_start()));
-- end;
-- $$;
--
-- drop function if exists public.limit_for(text);
-- drop function if exists public.limit_for_unknown(text);
-- drop trigger  if exists app_limits_touch on public.app_limits;
-- drop function if exists public.app_limits_touch();
-- drop table    if exists public.app_limits;
--
-- commit;
-- Yetkiler: create or replace mevcut yetkileri korur; ek grant gerekmez.
