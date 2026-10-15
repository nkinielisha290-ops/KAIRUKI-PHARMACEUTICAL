-- Kairuki Pharmaceutical POS schema.
-- Applied to Supabase project ghqqkiukhydjlynidwjw as migration "pos_schema".

-- Staff allowlist: only these emails may use the POS.
create table public.staff (
  email text primary key check (email = lower(email)),
  role text not null default 'cashier' check (role in ('admin', 'cashier')),
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price numeric(12,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now()
);

create sequence public.receipt_seq;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  created_at timestamptz not null default now(),
  cashier_id uuid references auth.users(id) on delete set null,
  cashier_email text,
  subtotal numeric(12,2) not null,
  discount_pct numeric(5,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  payment text not null check (payment in ('Cash', 'M-Pesa', 'Card', 'Insurance')),
  paid numeric(12,2) not null,
  change numeric(12,2) not null default 0
);
create index sales_created_at_idx on public.sales (created_at);
create index sales_cashier_id_idx on public.sales (cashier_id);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  code text not null,
  name text not null,
  price numeric(12,2) not null,
  qty integer not null check (qty > 0)
);
create index sale_items_sale_id_idx on public.sale_items (sale_id);
create index sale_items_product_id_idx on public.sale_items (product_id);

-- Role helpers used by RLS.
create function public.staff_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.staff where email = lower(auth.jwt() ->> 'email')
$$;
create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.staff_role() is not null
$$;
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.staff_role() = 'admin', false)
$$;

alter table public.staff enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

create policy "staff read self or admin" on public.staff for select to authenticated
  using (email = lower((select auth.jwt()) ->> 'email') or (select public.is_admin()));
create policy "admin insert staff" on public.staff for insert to authenticated
  with check ((select public.is_admin()));
create policy "admin update staff" on public.staff for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin delete staff" on public.staff for delete to authenticated
  using ((select public.is_admin()) and email <> lower((select auth.jwt()) ->> 'email'));

create policy "staff read products" on public.products for select to authenticated
  using ((select public.is_staff()));
create policy "admin insert products" on public.products for insert to authenticated
  with check ((select public.is_admin()));
create policy "admin update products" on public.products for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin delete products" on public.products for delete to authenticated
  using ((select public.is_admin()));

-- Sales are written only through complete_sale().
create policy "staff read sales" on public.sales for select to authenticated
  using ((select public.is_staff()));
create policy "staff read sale items" on public.sale_items for select to authenticated
  using ((select public.is_staff()));

-- Atomic checkout: prices come from the database, stock is locked and checked.
create function public.complete_sale(
  p_items jsonb, p_discount_pct numeric, p_payment text, p_paid numeric
) returns public.sales
language plpgsql security definer set search_path = '' as $$
declare
  v_sale public.sales;
  v_item record;
  v_product public.products;
  v_subtotal numeric(12,2) := 0;
  v_pct numeric := least(100, greatest(0, coalesce(p_discount_pct, 0)));
  v_discount numeric(12,2);
  v_total numeric(12,2);
  v_paid numeric(12,2);
begin
  if not public.is_staff() then
    raise exception 'Not authorized';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  -- Lock products in a stable order to avoid deadlocks; validate stock.
  for v_item in
    select (e->>'product_id')::uuid as product_id, sum((e->>'qty')::int) as qty
    from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    if v_item.qty <= 0 then raise exception 'Invalid quantity'; end if;
    select * into v_product from public.products where id = v_item.product_id for update;
    if not found then raise exception 'Product not found'; end if;
    if v_product.stock < v_item.qty then
      raise exception 'Not enough stock for % (only % left)', v_product.name, v_product.stock;
    end if;
    v_subtotal := v_subtotal + v_product.price * v_item.qty;
  end loop;

  v_discount := round(v_subtotal * v_pct / 100, 2);
  v_total := v_subtotal - v_discount;
  v_paid := coalesce(p_paid, v_total);
  if p_payment = 'Cash' and v_paid < v_total then
    raise exception 'Amount paid is less than the total';
  end if;

  insert into public.sales (receipt_no, cashier_id, cashier_email, subtotal, discount_pct,
                            discount, total, payment, paid, change)
  values ('KP-' || lpad(nextval('public.receipt_seq')::text, 5, '0'), auth.uid(),
          auth.jwt() ->> 'email', v_subtotal, v_pct, v_discount, v_total, p_payment,
          v_paid, greatest(0, v_paid - v_total))
  returning * into v_sale;

  insert into public.sale_items (sale_id, product_id, code, name, price, qty)
  select v_sale.id, p.id, p.code, p.name, p.price, q.qty
  from (select (e->>'product_id')::uuid as product_id, sum((e->>'qty')::int) as qty
        from jsonb_array_elements(p_items) e group by 1) q
  join public.products p on p.id = q.product_id;

  update public.products p set stock = p.stock - q.qty
  from (select (e->>'product_id')::uuid as product_id, sum((e->>'qty')::int) as qty
        from jsonb_array_elements(p_items) e group by 1) q
  where p.id = q.product_id;

  return v_sale;
end;
$$;

revoke execute on function public.staff_role(), public.is_staff(), public.is_admin(),
  public.complete_sale(jsonb, numeric, text, numeric) from public, anon;
grant execute on function public.staff_role(), public.is_staff(), public.is_admin(),
  public.complete_sale(jsonb, numeric, text, numeric) to authenticated;

-- First admin and starter catalog.
insert into public.staff (email, role) values ('nkinielisha290@gmail.com', 'admin');

insert into public.products (code, name, price, stock) values
  ('PAR500', 'Paracetamol 500mg (10 tabs)', 1000, 200),
  ('AMX250', 'Amoxicillin 250mg (10 caps)', 3000, 120),
  ('ALU20', 'Artemether/Lumefantrine (ALu) 20/120', 6500, 80),
  ('IBU400', 'Ibuprofen 400mg (10 tabs)', 1500, 150),
  ('ORS01', 'ORS sachet', 500, 300),
  ('MET500', 'Metformin 500mg (30 tabs)', 4500, 60),
  ('CTZ10', 'Cetirizine 10mg (10 tabs)', 2000, 90),
  ('VITC', 'Vitamin C 500mg (20 tabs)', 2500, 8);
