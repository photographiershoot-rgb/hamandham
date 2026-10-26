-- Ham & Ham: run once in Supabase SQL Editor.
-- Public visitors can SELECT the menu. Only the user ID listed in shop_admins can UPDATE.
-- Do NOT put any password, private service key, or API secret in GitHub.

create table if not exists public.shop_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.shop_admins enable row level security;
revoke all on public.shop_admins from public, anon, authenticated;

-- PostgreSQL security-definer lets this function see the admins table without
-- granting clients direct access to it. Only server-verified auth.uid() counts.
create or replace function public.is_shop_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shop_admins a
    where a.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_shop_admin() from public, anon;
grant execute on function public.is_shop_admin() to authenticated;

create table if not exists public.shop_state (
  id integer primary key check (id = 1),
  initialized boolean not null default false,
  products jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint products_is_array check (jsonb_typeof(products) = 'array'),
  constraint settings_is_object check (jsonb_typeof(settings) = 'object')
);

insert into public.shop_state (id) values (1) on conflict (id) do nothing;

create or replace function public.bump_shop_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists tr_bump_shop_version on public.shop_state;
create trigger tr_bump_shop_version
before update on public.shop_state
for each row execute function public.bump_shop_version();

alter table public.shop_state enable row level security;
revoke all on public.shop_state from public, anon, authenticated;
grant select on public.shop_state to anon, authenticated;
grant update (initialized, products, settings) on public.shop_state to authenticated;

-- Separate policies for read and write. Row-level protection is server-side.
drop policy if exists "Anyone can view menu" on public.shop_state;
create policy "Anyone can view menu"
on public.shop_state for select to anon, authenticated using (true);

drop policy if exists "Only shop admin can edit menu" on public.shop_state;
create policy "Only shop admin can edit menu"
on public.shop_state for update to authenticated
using ((select public.is_shop_admin()) and id=1)
with check ((select public.is_shop_admin()) and id=1);

-- All uploaded images are PUBLICLY readable, but only the designated admin
-- can upload/change/delete objects. Original 53 product images are bundled in GitHub.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images','menu-images',true, 2097152, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Only shop admin can upload images" on storage.objects;
create policy "Only shop admin can upload images" on storage.objects
for insert to authenticated with check (
  bucket_id='menu-images' and (select public.is_shop_admin())
  and (storage.foldername(name))[1] in ('products','logos')
);

drop policy if exists "Only shop admin can update images" on storage.objects;
create policy "Only shop admin can update images" on storage.objects
for update to authenticated
using (bucket_id='menu-images' and (select public.is_shop_admin()))
with check (bucket_id='menu-images' and (select public.is_shop_admin()));

drop policy if exists "Only shop admin can delete images" on storage.objects;
create policy "Only shop admin can delete images" on storage.objects
for delete to authenticated
using (bucket_id='menu-images' and (select public.is_shop_admin()));
