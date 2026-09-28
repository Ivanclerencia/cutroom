-- =====================================================================
-- ESTUDIO · esquema de base de datos
-- Pégalo entero en Supabase > SQL Editor > New query > Run.
-- Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- ---------- Perfiles (uno por usuario) --------------------------------
-- role = 'asistente' -> quien apunta jornadas y cobra (ve importes)
-- role = 'editor'    -> ve proyectos, tareas y los días trabajados, sin importes
create table if not exists public.profiles (
  id    uuid primary key references auth.users on delete cascade,
  email text,
  name  text,
  role  text not null default 'editor' check (role in ('asistente', 'editor'))
);

-- Crea el perfil automáticamente al dar de alta un usuario
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfiles de usuarios que ya existieran antes de ejecutar este script
insert into public.profiles (id, email, name)
select id, email, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

create or replace function public.is_asistente()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'asistente');
$$;

-- ---------- Proyectos, entregas y tareas (compartido) -----------------
create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  client     text,
  status     text not null default 'activo'
             check (status in ('activo', 'en_pausa', 'entregado', 'archivado')),
  color      text not null default '#4f6bed',
  notes      text,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.deliveries (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  title      text not null,
  due_date   date not null,
  status     text not null default 'pendiente'
             check (status in ('pendiente', 'enviada', 'aprobada')),
  notes      text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  title      text not null,
  assignee   uuid references public.profiles on delete set null,
  due_date   date,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Jornadas (las ve el editor; él solo puede pedir previstas) --
create table if not exists public.workdays (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  date       date not null,
  amount     numeric(2,1) not null check (amount in (0.5, 1)),
  project_id uuid references public.projects on delete set null,
  note       text,
  created_at timestamptz not null default now()
);

-- ---------- Tarifa y cobros (solo la asistente) -----------------------
create table if not exists public.settings (
  id       int primary key default 1 check (id = 1),
  day_rate numeric(10,2) not null default 0
);

-- Un registro por mes. `rate` guarda la tarifa del momento en que se factura,
-- para que cambiar la tarifa después no altere meses ya facturados.
create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  month          date not null unique,          -- día 1 del mes
  status         text not null default 'pendiente'
                 check (status in ('pendiente', 'facturado', 'pagado')),
  rate           numeric(10,2),
  invoice_number text,
  invoiced_on    date,
  paid_on        date,
  notes          text
);

-- ---------- Seguridad (Row Level Security) ----------------------------
alter table public.profiles   enable row level security;
alter table public.projects   enable row level security;
alter table public.deliveries enable row level security;
alter table public.tasks      enable row level security;
alter table public.workdays   enable row level security;
alter table public.settings   enable row level security;
alter table public.invoices   enable row level security;

-- Perfiles: todos se ven; el rol solo se cambia desde este SQL Editor
drop policy if exists "perfiles lectura" on public.profiles;
create policy "perfiles lectura" on public.profiles for select to authenticated using (true);

-- Proyectos, entregas, tareas: los dos lo pueden todo
drop policy if exists "proyectos todo" on public.projects;
create policy "proyectos todo" on public.projects for all to authenticated using (true) with check (true);
drop policy if exists "entregas todo" on public.deliveries;
create policy "entregas todo" on public.deliveries for all to authenticated using (true) with check (true);
drop policy if exists "tareas todo" on public.tasks;
create policy "tareas todo" on public.tasks for all to authenticated using (true) with check (true);

-- Jornadas: los dos las ven, solo la asistente crea/edita/borra las suyas
drop policy if exists "jornadas lectura" on public.workdays;
create policy "jornadas lectura" on public.workdays for select to authenticated using (true);
-- Jornadas: ver migracion-01 (previstas)
-- 'hecha' = trabajada (cuenta para cobros) · 'prevista' = pedida/planificada
alter table public.workdays
  add column if not exists status text not null default 'hecha' check (status in ('prevista', 'aceptada', 'hecha'));
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

-- Tarifa y cobros: invisibles para el editor
drop policy if exists "tarifa asistente" on public.settings;
create policy "tarifa asistente" on public.settings for all to authenticated
  using (public.is_asistente()) with check (public.is_asistente());
drop policy if exists "cobros asistente" on public.invoices;
create policy "cobros asistente" on public.invoices for all to authenticated
  using (public.is_asistente()) with check (public.is_asistente());

insert into public.settings (id, day_rate) values (1, 0) on conflict (id) do nothing;

-- ---------- Tiempo real -----------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','projects','deliveries','tasks','workdays','settings','invoices'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Que la API vea los cambios al momento
notify pgrst, 'reload schema';
