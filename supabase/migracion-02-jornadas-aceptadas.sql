-- =====================================================================
-- Migración 02 · Jornadas aceptadas
-- Flujo: prevista (pedida por el editor) → aceptada (por la asistente) → hecha (cuenta para cobros)
-- Ejecutar una vez en Supabase > SQL Editor. Se puede repetir sin problema.
-- =====================================================================

alter table public.workdays drop constraint if exists workdays_status_check;
alter table public.workdays
  add constraint workdays_status_check check (status in ('prevista', 'aceptada', 'hecha'));

-- (Las reglas no cambian: el editor solo puede tocar jornadas 'prevista';
--  una vez aceptada o hecha, solo la asistente puede cambiarla.)

notify pgrst, 'reload schema';
