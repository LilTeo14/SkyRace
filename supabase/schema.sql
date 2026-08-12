-- Ejecuta este archivo una sola vez en Supabase > SQL Editor.

create table if not exists public.pilots (
  id text primary key,
  name text not null check (char_length(name) between 1 and 40),
  drone text not null check (char_length(drone) between 1 and 20),
  created_at timestamptz not null default now()
);

create table if not exists public.runs (
  id text primary key,
  pilot_id text not null references public.pilots(id) on delete cascade,
  splits jsonb not null check (jsonb_array_length(splits) = 5),
  total integer not null check (total > 0),
  created_at timestamptz not null default now()
);

create index if not exists runs_total_idx on public.runs(total asc);
create index if not exists runs_pilot_id_idx on public.runs(pilot_id);
create index if not exists runs_created_at_idx on public.runs(created_at desc);

alter table public.pilots enable row level security;
alter table public.runs enable row level security;

-- Estas políticas son adecuadas para un evento público sin autenticación.
-- Antes de una competición de mayor escala conviene exigir acceso de juez para INSERT/DELETE.
create policy "Lectura pública de pilotos"
  on public.pilots for select
  to anon, authenticated
  using (true);

create policy "Registro público de pilotos"
  on public.pilots for insert
  to anon, authenticated
  with check (true);

create policy "Eliminación pública de pilotos"
  on public.pilots for delete
  to anon, authenticated
  using (true);

create policy "Lectura pública de tiempos"
  on public.runs for select
  to anon, authenticated
  using (true);

create policy "Registro público de tiempos"
  on public.runs for insert
  to anon, authenticated
  with check (true);

create policy "Eliminación pública de tiempos"
  on public.runs for delete
  to anon, authenticated
  using (true);

-- Pilotos iniciales. Puedes cambiarlos o eliminarlos desde Table Editor.
insert into public.pilots (id, name, drone) values
  ('pilot-ms', 'Matías Silva', 'MS-07'),
  ('pilot-cr', 'Camila Rojas', 'CR-21'),
  ('pilot-tf', 'Tomás Fuentes', 'TF-X1'),
  ('pilot-av', 'Antonia Vega', 'AV-14'),
  ('pilot-dm', 'Diego Muñoz', 'DM-88'),
  ('pilot-sp', 'Sofía Pérez', 'SP-05')
on conflict (id) do nothing;

-- Incluye ambas tablas en la publicación utilizada por Supabase Realtime.
do $$
begin
  alter publication supabase_realtime add table public.pilots;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.runs;
exception when duplicate_object then null;
end $$;
