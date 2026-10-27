-- Jalankan sekali di Supabase > SQL Editor
create table profiles(id uuid primary key references auth.users on delete cascade, username text unique not null check (username ~ '^[a-z0-9_-]{3,20}$' and username not in ('admin','api','css','js','monitor','assets','login','static')), created_at timestamptz default now());
create table projects(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, username text not null, title text not null, html text default '', css text default '', js text default '', slug text check (slug ~ '^[a-z0-9-]{1,40}$'), is_public boolean default false, views int default 0, created_at timestamptz default now(), updated_at timestamptz default now(), unique(username,slug), check (not is_public or slug is not null));
create table announcements(id bigint generated always as identity primary key, message text not null, active boolean default true, created_at timestamptz default now());
create table admins(user_id uuid primary key references auth.users on delete cascade);
alter table profiles enable row level security; alter table projects enable row level security; alter table announcements enable row level security; alter table admins enable row level security;

create function is_admin() returns boolean language sql security definer stable set search_path=public as $$ select exists(select 1 from admins where user_id=auth.uid()) $$;
create function username_free(u text) returns boolean language sql security definer set search_path=public as $$ select not exists(select 1 from profiles where username=u) $$;
create function increment_views(u text, s text) returns void language sql security definer set search_path=public as $$ update projects set views=views+1 where username=u and slug=s and is_public $$;
create function admin_users() returns table(id uuid,username text,created_at timestamptz,last_sign_in timestamptz,total bigint) language plpgsql security definer set search_path=public as $$ begin if not is_admin() then raise exception 'forbidden'; end if; return query select p.id,p.username,p.created_at,u.last_sign_in_at,(select count(*) from projects j where j.user_id=p.id) from profiles p join auth.users u on u.id=p.id order by u.last_sign_in_at desc nulls last; end $$;
create function admin_stats() returns json language plpgsql security definer set search_path=public as $$ begin if not is_admin() then raise exception 'forbidden'; end if; return json_build_object('users',(select count(*) from profiles),'projects',(select count(*) from projects),'public',(select count(*) from projects where is_public),'views',(select coalesce(sum(views),0) from projects),'db_bytes',pg_database_size(current_database()),'now',now()); end $$;
create function admin_delete_user(uid uuid) returns void language plpgsql security definer set search_path=public as $$ begin if not is_admin() then raise exception 'forbidden'; end if; delete from auth.users where id=uid; end $$;

create policy "profil sendiri" on profiles for select using (id=auth.uid() or is_admin());
create policy "buat profil" on profiles for insert with check (id=auth.uid());
create policy "milik sendiri" on projects for all using (user_id=auth.uid()) with check (user_id=auth.uid() and username=(select username from profiles where id=auth.uid()));
create policy "publik bisa dibaca" on projects for select using (is_public);
create policy "developer kelola" on projects for all using (is_admin()) with check (is_admin());
create policy "info aktif" on announcements for select using (active);
create policy "developer info" on announcements for all using (is_admin()) with check (is_admin());
