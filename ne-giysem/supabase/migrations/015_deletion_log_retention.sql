-- ============================================================
-- 015_deletion_log_retention
-- purge_retention() (014) genişletiliyor: deletion_log'tan 3 yıldan eski satırlar da silinir.
--
-- Dayanak: Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi
-- Hakkında Yönetmelik m. 7/3 — silme, yok etme ve anonimleştirme işlemlerinin kayıtları,
-- diğer hukuki yükümlülükler hariç, en az üç yıl saklanır. Bu süre dolunca kayıt silinir
-- (süresiz saklama yok). Metinlerde: "en az 3 yıl saklanır, sonra silinir".
--
-- Diğer süreler değişmedi: api_usage 13 ay, ops_events 12 ay.
-- Zamanlama: 014'teki pg_cron işi (sestina_retention_purge, her gün 03:17 UTC) aynı
-- fonksiyonu çağırır; yeniden planlamak gerekmez. pg_cron yoksa elle çalıştırılmalı.
--
-- Önkoşul: 014. Elle çalıştırılır (SQL Editor). Tekrar çalıştırılabilir.
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
begin
  delete from api_usage  where day        < (current_date - interval '13 months')::date;
  get diagnostics v_usage = row_count;

  delete from ops_events where created_at < now() - interval '12 months';
  get diagnostics v_ops = row_count;

  -- Silme/Yok Etme Yönetmeliği m. 7/3: en az 3 yıl, sonra silinir
  delete from deletion_log where deleted_at < now() - interval '3 years';
  get diagnostics v_deletion = row_count;

  return jsonb_build_object('api_usage', v_usage, 'ops_events', v_ops, 'deletion_log', v_deletion);
end;
$$;

-- create or replace yetkileri korur; yine de açıkça (014 ile aynı)
revoke execute on function public.purge_retention() from public, anon, authenticated;
grant  execute on function public.purge_retention() to service_role;

commit;

-- ─── Doğrulama (ayrı çalıştır) ───────────────────────────────────────────────
-- select public.purge_retention();   -- {"api_usage": n, "ops_events": m, "deletion_log": k}
-- select jobname, schedule, command, active from cron.job where jobname = 'sestina_retention_purge';
