-- ============================================================
-- 016_auth_audit_retention
-- Supabase Auth denetim kayıtları (auth.audit_log_entries): giriş / çıkış / token
-- olayları, IP adresi dahil. Hukuki sebep KVKK m. 5/2-f. Saklama: en fazla 90 gün.
--
-- Not: bu tablo auth.users'a bağlı DEĞİL (payload içinde actor_id) → hesap silinince
-- cascade ile gitmez; 90 gün kuralı silinmiş hesapların kayıtları için de geçerlidir.
--
-- ÖLÇÜM (önce çalıştır, sonucu data-inventory.md #24'e yaz):
--   select count(*) as satir, min(created_at) as en_eski, max(created_at) as en_yeni
--     from auth.audit_log_entries;
--   • 0 satır  → denetim kayıtları DB'ye yazılmıyor; olaylar yalnızca Supabase auth
--                log'unda (Free plan 1 gün). Bu dosya yine de zararsız (silinecek satır yok).
--   • >0 satır → aşağıdaki fonksiyon 90 günden eskileri günlük siler.
--
-- Yetki: Supabase'de auth şeması supabase_auth_admin'e ait; postgres'in DELETE yetkisi
-- yoksa purge_retention() HATA VERMEZ, uyarı yazar ve 'auth_audit' = -1 döner
-- (diğer temizlikler sürer). Bu durumda satırlar panelden / destekle silinmeli.
--
-- Önkoşul: 014, 015. Elle çalıştırılır (SQL Editor). Tekrar çalıştırılabilir.
-- ============================================================

begin;

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
begin
  delete from api_usage  where day        < (current_date - interval '13 months')::date;
  get diagnostics v_usage = row_count;

  delete from ops_events where created_at < now() - interval '12 months';
  get diagnostics v_ops = row_count;

  -- Silme/Yok Etme Yönetmeliği m. 7/3: en az 3 yıl, sonra silinir (015)
  delete from deletion_log where deleted_at < now() - interval '3 years';
  get diagnostics v_deletion = row_count;

  -- Auth denetim kayıtları: en fazla 90 gün (m. 5/2-f). Yetki yoksa diğerlerini bozma.
  begin
    delete from auth.audit_log_entries where created_at < now() - interval '90 days';
    get diagnostics v_audit = row_count;
  exception when insufficient_privilege or undefined_table then
    raise warning 'purge_retention: auth.audit_log_entries temizlenemedi (%)', sqlerrm;
    v_audit := -1;
  end;

  return jsonb_build_object(
    'api_usage', v_usage, 'ops_events', v_ops, 'deletion_log', v_deletion, 'auth_audit', v_audit
  );
end;
$$;

revoke execute on function public.purge_retention() from public, anon, authenticated;
grant  execute on function public.purge_retention() to service_role;

commit;

-- ─── Doğrulama (ayrı çalıştır) ───────────────────────────────────────────────
-- select public.purge_retention();   -- 'auth_audit' -1 ise yetki yok (yukarıdaki nota bak)
-- select count(*) from auth.audit_log_entries where created_at < now() - interval '90 days';  -- 0 beklenir
