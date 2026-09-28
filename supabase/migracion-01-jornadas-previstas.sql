-- =====================================================================
-- Migración 01 · Jornadas previstas (Presti puede pedirle jornadas a Iván)
-- Ejecutar una vez en Supabase > SQL Editor. Se puede repetir sin problema.
-- =====================================================================

-- 'hecha' = trabajada (cuenta para cobros) · 'prevista' = pedida/planificada
alter table public.workdays
  add column if not exists status text not null default 'hecha' check (status in ('prevista', 'hecha'));
alter table public.workdays
  add column if not exists created_by uuid default auth.uid() references public.profiles on delete set null;

-- Asistente: todo sobre sus jornadas
drop policy if exists "jornadas escritura" on public.workdays;
drop policy if exists "jornadas asistente" on public.workdays;
create policy "jornadas asistente" on public.workdays for all to authenticated
  using (public.is_asistente() and user_id = auth.uid())
  with check (public.is_asistente() and user_id = auth.uid());

-- Editor: solo puede pedir (crear), cambiar o borrar jornadas PREVISTAS de la asistente
drop policy if exists "jornadas editor crea previstas" on public.workdays;
create policy "jornadas editor crea previstas" on public.workdays for insert to authenticated
  with check (
    not public.is_asistente() and status = 'prevista'
    and user_id in (select id from public.profiles where role = 'asistente')
  );
drop policy if exists "jornadas editor cambia previstas" on public.workdays;
create policy "jornadas editor cambia previstas" on public.workdays for update to authenticated
  using (not public.is_asistente() and status = 'prevista')
  with check (not public.is_asistente() and status = 'prevista');
drop policy if exists "jornadas editor borra previstas" on public.workdays;
create policy "jornadas editor borra previstas" on public.workdays for delete to authenticated
  using (not public.is_asistente() and status = 'prevista');
