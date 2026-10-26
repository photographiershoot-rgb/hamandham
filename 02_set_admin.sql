-- 1. In Supabase Dashboard > Authentication > Users > Add user,
--    create YOUR ONE user with a strong password (and confirm email).
-- 2. Copy the UUID / User ID of that new Auth user.
-- 3. REPLACE the placeholder UUID below with your user's UUID.
-- 4. Run the SQL in Supabase SQL Editor.
-- This script requires a real UUID; never upload a password or service_role key.

insert into public.shop_admins(user_id)
values ('00000000-0000-0000-0000-000000000000'::uuid)
on conflict (user_id) do nothing;

-- IMPORTANT: 0000... is ONLY A PLACEHOLDER and must be replaced!
-- Optional verification:
-- select count(*) from public.shop_admins;
