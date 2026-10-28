-- Jalankan di Supabase > SQL Editor (SETELAH schema.sql). Aman untuk data lama.
create table files(id uuid primary key default gen_random_uuid(), project_id uuid not null references projects on delete cascade, path text not null check (length(path) between 1 and 200 and path !~ '\.\.'), mime text not null default 'application/octet-stream', is_b64 boolean not null default false, content text not null default '', size int not null default 0, updated_at timestamptz default now(), unique(project_id,path));
alter table files enable row level security;
create policy "file milik sendiri" on files for all using (exists(select 1 from projects p where p.id=project_id and p.user_id=auth.uid())) with check (exists(select 1 from projects p where p.id=project_id and p.user_id=auth.uid()));
create policy "file publik" on files for select using (exists(select 1 from projects p where p.id=project_id and p.is_public));
create policy "file developer" on files for all using (is_admin()) with check (is_admin());
