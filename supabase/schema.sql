-- ShopTill database. Run this once in Supabase: SQL Editor > New query > paste > Run.
create table if not exists shops(id uuid primary key default gen_random_uuid(), name text, created_at timestamptz default now());
create table if not exists members(shop_id uuid references shops(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, role text not null check (role in ('owner','viewer')), primary key(shop_id,user_id));
create table if not exists shop_data(shop_id uuid primary key references shops(id) on delete cascade, data jsonb not null, updated_at timestamptz default now());
create table if not exists sales(u uuid primary key, shop_id uuid not null references shops(id) on delete cascade, t bigint not null, m text, total numeric, profit numeric, lines jsonb);
create index if not exists sales_shop_t on sales(shop_id,t);

create or replace function is_member(s uuid) returns boolean language sql security definer stable set search_path=public as $$ select exists(select 1 from members where shop_id=s and user_id=auth.uid()) $$;
create or replace function is_owner(s uuid) returns boolean language sql security definer stable set search_path=public as $$ select exists(select 1 from members where shop_id=s and user_id=auth.uid() and role='owner') $$;

alter table shops enable row level security;
alter table members enable row level security;
alter table shop_data enable row level security;
alter table sales enable row level security;

create policy "see own membership" on members for select using (user_id = auth.uid());
create policy "members see shop" on shops for select using (is_member(id));
create policy "members read shop_data" on shop_data for select using (is_member(shop_id));
create policy "owner writes shop_data" on shop_data for all using (is_owner(shop_id)) with check (is_owner(shop_id));
create policy "members read sales" on sales for select using (is_member(shop_id));
create policy "owner writes sales" on sales for all using (is_owner(shop_id)) with check (is_owner(shop_id));

-- Supabase (new projects since 30 May 2026) no longer exposes tables to the Data API automatically,
-- so the access is granted explicitly. Row rules above still decide who can see or change which rows.
grant usage on schema public to anon, authenticated;
grant select on members, shops to authenticated;
grant select, insert, update, delete on shop_data, sales to authenticated;
revoke execute on function is_member(uuid), is_owner(uuid) from public, anon;
grant execute on function is_member(uuid), is_owner(uuid) to authenticated;

-- A harmless function the keep-alive job calls so the free project is not paused.
create or replace function ping() returns integer language sql stable as $$ select 1 $$;
grant execute on function ping() to anon, authenticated;
