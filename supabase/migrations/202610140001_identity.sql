create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 handle text unique not null check(handle ~ '^[a-z0-9_]{3,30}$'),
 display_name text not null default '' check(length(display_name)<=80),
 bio text not null default '' check(length(bio)<=500),
 verified_student boolean not null default false,
 verified_human boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.follows (
 follower_id uuid references public.profiles on delete cascade,
 followee_id uuid references public.profiles on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,followee_id),check(follower_id<>followee_id)
);
create index follows_reverse on public.follows(followee_id,follower_id);
alter table public.profiles enable row level security;
alter table public.follows enable row level security;
create policy profiles_read on public.profiles for select using(true);
create policy profiles_edit on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
revoke update on public.profiles from authenticated;
grant update(handle,display_name,bio) on public.profiles to authenticated;
create policy follows_read on public.follows for select using(true);
create policy follows_insert on public.follows for insert to authenticated with check(follower_id=auth.uid());
create policy follows_delete on public.follows for delete to authenticated using(follower_id=auth.uid());
create function public.create_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,handle) values(new.id,'u_'||replace(new.id::text,'-','')); return new; end $$;
-- UUID-derived handle uses 30 characters to satisfy the public handle constraint.
create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,handle) values(new.id,'u_'||substr(replace(new.id::text,'-',''),1,28)); return new; end $$;
create trigger auth_profile after insert on auth.users for each row execute function public.create_profile();
