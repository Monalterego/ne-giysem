-- ============================================================
-- 006_server_side_quota
-- Try-on kotası ve API kullanım sayacı sunucuya taşınıyor.
--
-- Bağlam (schema/public_2026-10-15.sql):
--   • profiles tablosunda authenticated'a GRANT ALL var ve UPDATE policy'si kolon
--     ayırt etmiyor → kullanıcı virtual_model_renders'ı istediği değere çekebiliyordu.
--   • ALTER DEFAULT PRIVILEGES yeni tablo ve fonksiyonlara anon/authenticated'a
--     otomatik ALL/EXECUTE veriyor → aşağıda hepsi açıkça REVOKE ediliyor.
--
-- Silme: tryon_renders ve api_usage → auth.users ON DELETE CASCADE.
--   delete-account auth.admin.deleteUser ile auth.users satırını siliyor, bu iki
--   tablo da onunla birlikte temizlenir. (Snapshot teyidi: favorite_combos da
--   auth.users'a cascade — schema satır 199; profiles → auth.users — satır 204.)
--
-- Elle çalıştırılır (SQL Editor). Tekrar çalıştırılabilir (idempotent).
-- ============================================================

begin;

-- ─── Tablolar ────────────────────────────────────────────────────────────────

-- Bir satır = bir try-on denemesi (manken üretimi + tüm katmanlar + ayakkabı)
create table if not exists public.tryon_renders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  runs_used      int not null default 0,
  prediction_ids text[] not null default '{}',
  -- prediction_ids'in try-on olanları (model-create HARİÇ). Model türünü istemci değil
  -- fashn-proxy belirler; bunlardan biri tamamlanınca render başarılı sayılır.
  tryon_prediction_ids text[] not null default '{}',
  -- FASHN'ın bu render için döndürdüğü çıktı URL'leri. fashn-proxy bir sonraki
  -- katmanın model_image'ını bunlarla doğrular (CDN host'unu tahmin etmek yerine).
  output_urls    text[] not null default '{}',
  succeeded_at   timestamptz
);

create index if not exists idx_tryon_renders_user_created
  on public.tryon_renders (user_id, created_at desc);
create index if not exists idx_tryon_renders_prediction_ids
  on public.tryon_renders using gin (prediction_ids);
create index if not exists idx_tryon_renders_output_urls
  on public.tryon_renders using gin (output_urls);

alter table public.tryon_renders enable row level security;
-- Policy YOK: yalnızca service_role (edge function'lar) erişir
revoke all on table public.tryon_renders from anon, authenticated;

-- Günlük çağrı sayacı (anthropic, bg, ...)
create table if not exists public.api_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  fn      text not null,
  day     date not null,
  count   int  not null default 0,
  primary key (user_id, fn, day)
);

alter table public.api_usage enable row level security;
revoke all on table public.api_usage from anon, authenticated;

-- ─── start_tryon ─────────────────────────────────────────────────────────────
-- Kota kontrolü + render oluşturma tek işlemde. Sayılanlar:
--   • başarılı render'lar (succeeded_at dolu)
--   • son 30 dk içinde başlamış, hâlâ açık render'lar (paralel başlatmayı engeller)
-- Başarısız/terk edilmiş render 30 dk sonra kotadan düşer.
create or replace function public.start_tryon(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_free_limit  constant int      := 3;
  -- ⚠️ register_run'daki c_open_window ile AYNI olmalı (plpgsql'de paylaşılan sabit yok)
  c_open_window constant interval := interval '30 minutes';
  -- Premium henüz yok. Eklenince burada abonelik kaynağından okunacak
  -- (örn. subscriptions tablosu / RevenueCat webhook'unun yazdığı kolon).
  v_is_premium  boolean := false;
  v_limit       int;
  v_used        int;
  v_render      uuid;
begin
  -- Aynı kullanıcının paralel start'larını sıraya sok: profil satırını kilitle
  perform 1 from profiles where id = p_user for update;
  if not found then
    return jsonb_build_object('allowed', false, 'error', 'no-profile');
  end if;

  -- null = limitsiz (premium)
  v_limit := case when v_is_premium then null else c_free_limit end;

  select count(*) into v_used
    from tryon_renders
   where user_id = p_user
     and (succeeded_at is not null or created_at > now() - c_open_window);

  if v_limit is not null and v_used >= v_limit then
    return jsonb_build_object('allowed', false, 'used', v_used, 'limit', v_limit);
  end if;

  insert into tryon_renders (user_id) values (p_user) returning id into v_render;

  return jsonb_build_object(
    'allowed', true, 'render_id', v_render, 'used', v_used + 1, 'limit', v_limit
  );
end;
$$;

-- ─── register_run ────────────────────────────────────────────────────────────
-- İki aşamalı:
--   p_prediction_id NULL     → FASHN /run'dan ÖNCE yer ayır: render bu kullanıcının,
--                              30 dk içinde ve runs_used < 6 ise runs_used++ ve true.
--   p_prediction_id dolu     → /run başarılı olunca id'yi render'a ekle (sayaç artmaz).
--                              p_is_tryon (proxy model_name'den belirler) true ise
--                              tryon_prediction_ids'e de eklenir.
-- Neden iki aşama: id ancak /run yanıtında gelir. Kontrol id'den sonra yapılsaydı
-- bütçeyi aşan çağrı FASHN'da zaten başlamış (faturalanmış) olurdu.
-- Not: succeeded_at kontrolü YOK — render ilk try-on katmanında başarılı sayılır,
-- sonraki katmanlar/ayakkabı aynı render'da sürmeli. Yeniden kullanımı 6 run tavanı
-- ve 30 dk pencere sınırlar.
create or replace function public.register_run(
  p_user uuid, p_render uuid, p_prediction_id text default null, p_is_tryon boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c_max_runs    constant int      := 6;   -- manken + 3 katman + ayakkabı = 5, +1 pay
  -- ⚠️ start_tryon'daki c_open_window ile AYNI olmalı
  c_open_window constant interval := interval '30 minutes';
begin
  if p_prediction_id is null then
    update tryon_renders
       set runs_used = runs_used + 1
     where id = p_render
       and user_id = p_user
       and created_at > now() - c_open_window
       and runs_used < c_max_runs;
    return found;
  end if;

  update tryon_renders
     set prediction_ids       = array_append(prediction_ids, p_prediction_id),
         tryon_prediction_ids = case when p_is_tryon
                                     then array_append(tryon_prediction_ids, p_prediction_id)
                                     else tryon_prediction_ids end
   where id = p_render
     and user_id = p_user
     and not (p_prediction_id = any (prediction_ids));
  if found then return true; end if;

  -- Zaten ekliyse de başarılı say (idempotent)
  return exists (
    select 1 from tryon_renders
     where id = p_render and user_id = p_user and p_prediction_id = any (prediction_ids)
  );
end;
$$;

-- ─── render_for_prediction ───────────────────────────────────────────────────
-- status çağrısında sahiplik kontrolü: id bu kullanıcının bir render'ına ait mi?
create or replace function public.render_for_prediction(p_user uuid, p_prediction_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from tryon_renders
   where user_id = p_user and prediction_ids @> array[p_prediction_id]
   limit 1;
$$;

-- ─── complete_prediction / user_owns_output ──────────────────────────────────
-- fashn-proxy status 'completed' gördüğünde tek çağrı:
--   1) çıktı URL'lerini sakla — sonraki run'larda model_image olarak yalnızca
--      kullanıcının kendi storage'ı veya kendi FASHN çıktıları kabul edilir
--   2) prediction bir try-on ise (model-create değilse) render'ı başarılı işaretle
-- Başarı kararı tamamen sunucuda: istemcinin gönderdiği hiçbir alan kullanılmaz.
-- Döner: render başarılı işaretlendiyse true.
create or replace function public.complete_prediction(
  p_user uuid, p_render uuid, p_prediction_id text, p_urls text[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_tryon boolean;
begin
  update tryon_renders
     set output_urls = array(
           select distinct u from unnest(output_urls || coalesce(p_urls, '{}')) as u
         )
   where id = p_render and user_id = p_user and p_prediction_id = any (prediction_ids)
  returning p_prediction_id = any (tryon_prediction_ids) into v_is_tryon;

  if not coalesce(v_is_tryon, false) then return false; end if;
  return mark_render_success(p_user, p_render);
end;
$$;

create or replace function public.user_owns_output(p_user uuid, p_url text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from tryon_renders
     where user_id = p_user and output_urls @> array[p_url]
  );
$$;

-- ─── mark_render_success ─────────────────────────────────────────────────────
-- Render'ı başarılı işaretle; profiles.virtual_model_renders yalnızca UI uyumu için
-- başarılı render sayısının aynası (asıl karar start_tryon'da).
create or replace function public.mark_render_success(p_user uuid, p_render uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update tryon_renders
     set succeeded_at = coalesce(succeeded_at, now())
   where id = p_render and user_id = p_user;
  if not found then return false; end if;

  update profiles
     set virtual_model_renders = (
           select count(*) from tryon_renders
            where user_id = p_user and succeeded_at is not null
         )
   where id = p_user;
  return true;
end;
$$;

-- ─── bump_usage ──────────────────────────────────────────────────────────────
-- Günlük sayaç (gün = veritabanı saat dilimine göre current_date; Supabase'de UTC).
-- Atomik: tek INSERT ... ON CONFLICT. Sınır aşılınca false (sayaç yine artar).
create or replace function public.bump_usage(p_user uuid, p_fn text, p_cap int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into api_usage (user_id, fn, day, count)
  values (p_user, p_fn, current_date, 1)
  on conflict (user_id, fn, day)
  do update set count = api_usage.count + 1
  returning count into v_count;
  return v_count <= p_cap;
end;
$$;

-- ─── Yetkiler: fonksiyonlar yalnızca service_role ────────────────────────────
revoke execute on function public.start_tryon(uuid)                    from public, anon, authenticated;
revoke execute on function public.register_run(uuid, uuid, text, boolean)          from public, anon, authenticated;
revoke execute on function public.render_for_prediction(uuid, text)                from public, anon, authenticated;
revoke execute on function public.complete_prediction(uuid, uuid, text, text[])    from public, anon, authenticated;
revoke execute on function public.user_owns_output(uuid, text)         from public, anon, authenticated;
revoke execute on function public.mark_render_success(uuid, uuid)      from public, anon, authenticated;
revoke execute on function public.bump_usage(uuid, text, int)          from public, anon, authenticated;

grant execute on function public.start_tryon(uuid)                     to service_role;
grant execute on function public.register_run(uuid, uuid, text, boolean)           to service_role;
grant execute on function public.render_for_prediction(uuid, text)                 to service_role;
grant execute on function public.complete_prediction(uuid, uuid, text, text[])     to service_role;
grant execute on function public.user_owns_output(uuid, text)          to service_role;
grant execute on function public.mark_render_success(uuid, uuid)       to service_role;
grant execute on function public.bump_usage(uuid, text, int)           to service_role;

-- ─── profiles: kolon bazlı UPDATE ────────────────────────────────────────────
-- virtual_model_renders, email, age_range, id, created_at istemciye kapalı.
-- Liste = istemcinin bugün yazdığı kolonlar (Aşama 1 raporu, madde 6).
revoke update on public.profiles from anon, authenticated;
grant update (
  name, height, weight, age, body_type, skin_tone,
  hair_color, hair_length, hair_type, avatar_url, mannequin_url
) on public.profiles to authenticated;

-- ─── Mevcut kullanıcıların kota geçmişi ──────────────────────────────────────
-- virtual_model_renders kadar başarılı render satırı. Daha önce satırı olan
-- kullanıcı atlanır (tekrar çalıştırmada çift kayıt olmasın). Değer istemciden
-- yazılabildiği için anormal büyük olabilir → 50 ile sınırlı (kota zaten 3).
insert into public.tryon_renders (user_id, created_at, succeeded_at)
select p.id, now(), now()
  from public.profiles p
  cross join lateral generate_series(1, least(p.virtual_model_renders, 50))
 where p.virtual_model_renders > 0
   and not exists (select 1 from public.tryon_renders r where r.user_id = p.id);

commit;
