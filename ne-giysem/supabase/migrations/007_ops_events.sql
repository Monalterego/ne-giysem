-- ============================================================
-- 007_ops_events
-- Operasyonel olaylar (üst servis kredisi bitti vb.). Edge function'lar
-- service_role ile record_ops_event üzerinden yazar; istemci erişemez.
--
-- Tekrar bastırma: aynı kind için 10 dk içinde ikinci satır yazılmaz.
-- Kontrol + insert advisory lock altında atomik (eşzamanlı istekler çift yazmaz).
--
-- Silme: tablo kullanıcıya bağlı değil (user_id yok) → delete-account etkilemez.
--
-- Elle çalıştırılır (SQL Editor). Tekrar çalıştırılabilir (idempotent).
-- ============================================================

begin;

create table if not exists public.ops_events (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source     text not null,               -- 'fashn-proxy' | 'anthropic-proxy' | ...
  kind       text not null,               -- 'fashn_out_of_credits' | 'anthropic_out_of_credits' | ...
  detail     jsonb not null default '{}'::jsonb
);

create index if not exists idx_ops_events_kind_created
  on public.ops_events (kind, created_at desc);

alter table public.ops_events enable row level security;
-- Policy YOK: yalnızca service_role. Default privileges anon/authenticated'a
-- ALL veriyor (schema snapshot) → açıkça geri al.
revoke all on table public.ops_events from anon, authenticated;

-- Döner: satır yazıldıysa true, 10 dk içinde aynı kind varsa false
create or replace function public.record_ops_event(p_source text, p_kind text, p_detail jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c_dedupe_window constant interval := interval '10 minutes';
begin
  -- Aynı kind için eşzamanlı çağrıları sıraya sok (transaction sonunda bırakılır)
  perform pg_advisory_xact_lock(hashtext('ops_events:' || p_kind));

  if exists (
    select 1 from ops_events
     where kind = p_kind and created_at > now() - c_dedupe_window
  ) then
    return false;
  end if;

  insert into ops_events (source, kind, detail)
  values (p_source, p_kind, coalesce(p_detail, '{}'::jsonb));
  return true;
end;
$$;

revoke execute on function public.record_ops_event(text, text, jsonb) from public, anon, authenticated;
grant  execute on function public.record_ops_event(text, text, jsonb) to service_role;

commit;
