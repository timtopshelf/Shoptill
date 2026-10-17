-- Run AFTER schema.sql and after creating two users in Supabase:
-- Authentication > Users > Add user > "Create new user" (tick Auto Confirm User).
-- Replace the two emails below with the ones you created, then Run.
with s as (insert into shops(name) values ('My shop') returning id)
insert into members(shop_id,user_id,role)
select s.id,u.id,case when u.email='OWNER-EMAIL@example.com' then 'owner' else 'viewer' end
from s, auth.users u where u.email in ('OWNER-EMAIL@example.com','VIEWER-EMAIL@example.com');
