-- ============================================================
-- 008_render_refund
-- Üst servis hatasında (FASHN OutOfCredits / 5xx) render iade edilir.
--
-- Ölçülmüş vaka: 1. try-on katmanı tamamlandı (succeeded_at doldu), 2. katmanda
-- FASHN OutOfCredits → kullanıcı görsel almadı ama kota düştü.
--
-- • tryon_renders.failed_at: dolu render ne başarılı ne açık sayılır (kotadan düşmez)
-- • fail_render: succeeded_at = null, failed_at = now(), profil aynası güncellenir
-- • start_tryon / register_run / mark_render_success failed_at'i dikkate alacak
--   şekilde yeniden tanımlanır (006'daki gövdeler + failed_at koşulları)
--
-- Yalnızca fashn-proxy çağırır ve yalnızca ÜST SERVİS hatasında — bizim
-- doğrulamalarımızda (400/403/426/429) çağrılmaz, aksi halde istemci bilerek
-- geçersiz istek atıp kotasını geri alabilirdi.
--
-- Önkoşul: 006. Elle çalıştırılır (SQL Editor). Tekrar çalıştırılabilir.
-- ============================================================

begin;

alter table public.tryon_renders
  add column if not exists failed_at timestamptz;

-- ─── fail_render ─────────────────────────────────────────────────────────────
-- Döner: render bu kullanıcınınsa ve henüz iade edilmemişse true.
create or replace function public.fail_render(p_user uuid, p_render uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update tryon_renders
     set succeeded_at = null,
         failed_at    = now()
   where id = p_render and user_id = p_user and failed_at is null;
  if not found then return false; end if;

  -- Ayna: mark_render_success'teki sayımın AYNISI (başarılı render sayısı)
  update profiles
     set virtual_model_renders = (
           select count(*) from tryon_renders
            where user_id = p_user and succeeded_at is not null
         )
   where id = p_user;
  return true;
end;
$$;

-- ─── start_tryon (006 + failed_at) ───────────────────────────────────────────
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

  -- İade edilmiş (failed_at dolu) render ne başarılı ne açık sayılır
  select count(*) into v_used
    from tryon_renders
   where user_id = p_user
     and failed_at is null
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

-- ─── register_run (006 + failed_at) ──────────────────────────────────────────
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
    -- İade edilmiş render'a yeni run eklenmez
    update tryon_renders
       set runs_used = runs_used + 1
     where id = p_render
       and user_id = p_user
       and failed_at is null
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

-- ─── mark_render_success (006 + failed_at) ───────────────────────────────────
-- İade edilmiş render'da önceden başlamış bir katman sonradan tamamlansa bile
-- render yeniden başarılı sayılmaz (iade geri alınmaz).
create or replace function public.mark_render_success(p_user uuid, p_render uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update tryon_renders
     set succeeded_at = coalesce(succeeded_at, now())
   where id = p_render and user_id = p_user and failed_at is null;
  if not found then return false; end if;

  -- Ayna: fail_render'daki sayımın AYNISI
  update profiles
     set virtual_model_renders = (
           select count(*) from tryon_renders
            where user_id = p_user and succeeded_at is not null
         )
   where id = p_user;
  return true;
end;
$$;

-- ─── Yetkiler ────────────────────────────────────────────────────────────────
-- create or replace mevcut yetkileri korur; yine de açıkça (yeni fonksiyon dahil)
revoke execute on function public.fail_render(uuid, uuid)                    from public, anon, authenticated;
revoke execute on function public.start_tryon(uuid)                          from public, anon, authenticated;
revoke execute on function public.register_run(uuid, uuid, text, boolean)    from public, anon, authenticated;
revoke execute on function public.mark_render_success(uuid, uuid)            from public, anon, authenticated;

grant execute on function public.fail_render(uuid, uuid)                     to service_role;
grant execute on function public.start_tryon(uuid)                           to service_role;
grant execute on function public.register_run(uuid, uuid, text, boolean)     to service_role;
grant execute on function public.mark_render_success(uuid, uuid)             to service_role;

commit;
