-- Create properties and related tables for per-city lots

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  name text,
  x numeric,
  z numeric,
  tile text,
  owner_id uuid references users(id) on delete set null,
  price numeric not null default 0,
  is_available boolean not null default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists properties_city_idx on properties(city);
create index if not exists properties_owner_idx on properties(owner_id);

create table if not exists price_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  price numeric not null,
  changed_at timestamptz not null default now(),
  source text
);
create index if not exists price_history_property_idx on price_history(property_id);

create table if not exists property_transactions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  buyer_id uuid not null references users(id) on delete cascade,
  seller_id uuid references users(id) on delete set null,
  price numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists prop_tx_property_idx on property_transactions(property_id);

-- Atomic purchase function: buyer purchases property for its current price.
-- This function performs balance checks and updates atomically.

create or replace function buy_property_atomic(buyer uuid, prop_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  prop record;
  buyer_row record;
  seller_row record;
begin
  -- Lock property row
  select * into prop from properties where id = prop_id for update;
  if not found then
    return jsonb_build_object('status','error','message','Property not found');
  end if;

  if not prop.is_available then
    return jsonb_build_object('status','error','message','Property not available');
  end if;

  select * into buyer_row from users where id = buyer for update;
  if not found then
    return jsonb_build_object('status','error','message','Buyer not found');
  end if;

  if buyer_row.balance < prop.price then
    return jsonb_build_object('status','error','message','Insufficient funds');
  end if;

  if prop.owner_id is not null then
    select * into seller_row from users where id = prop.owner_id for update;
  else
    seller_row := null;
  end if;

  -- debit buyer
  update users set balance = balance - prop.price, updated_at = now() where id = buyer;

  -- credit seller if present
  if prop.owner_id is not null then
    update users set balance = balance + prop.price, updated_at = now() where id = prop.owner_id;
  end if;

  -- transfer property
  update properties set owner_id = buyer, is_available = false, updated_at = now() where id = prop_id;

  -- record price history and transaction
  insert into price_history(property_id, price, changed_at, source) values(prop_id, prop.price, now(), 'purchase');
  insert into property_transactions(property_id, buyer_id, seller_id, price, created_at) values(prop_id, buyer, prop.owner_id, prop.price, now());

  return jsonb_build_object('status','ok','property_id', prop_id, 'price', prop.price);
exception when others then
  return jsonb_build_object('status','error','message', sqlerrm);
end;
$$;

-- Trigger to update updated_at timestamp on properties
create or replace function properties_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_properties_updated_at before update on properties for each row execute procedure properties_updated_at();

-- Notes: This migration assumes a users table with id and balance exists. The function is SECURITY DEFINER
-- so be careful to restrict rpc/buy_property_atomic access via Postgres policies or call from server-side using service role key.
