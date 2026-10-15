-- Kairuki Clinic schema.
-- Applied to Supabase project ghqqkiukhydjlynidwjw as migration "clinic_schema".
-- Reuses public.staff, is_staff() and is_admin() from schema.sql.

create table public.clinic_services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  fee numeric(12,2) not null default 0 check (fee >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text not null default 'General',
  work_days smallint[] not null default '{1,2,3,4,5}', -- 0 = Sunday … 6 = Saturday
  start_time time not null default '08:00',
  end_time time not null default '17:00',
  slot_minutes integer not null default 30 check (slot_minutes between 5 and 240),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null unique,
  email text,
  gender text check (gender in ('Male', 'Female')),
  birth_date date,
  notes text,
  created_at timestamptz not null default now()
);

create sequence public.appointment_seq;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  ref_no text not null unique,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  service_id uuid references public.clinic_services(id) on delete set null,
  appt_date date not null,
  start_time time not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  reason text,
  notes text,
  source text not null default 'online' check (source in ('online', 'staff')),
  created_at timestamptz not null default now()
);
-- A doctor cannot have two live appointments in the same slot.
create unique index appointments_slot_uniq on public.appointments (doctor_id, appt_date, start_time)
  where status <> 'cancelled';
create index appointments_date_idx on public.appointments (appt_date);
create index appointments_patient_idx on public.appointments (patient_id);
create index appointments_service_idx on public.appointments (service_id);

alter table public.clinic_services enable row level security;
alter table public.doctors enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;

-- Services and doctors: the public booking form sees active ones; staff see all.
create policy "public read active services" on public.clinic_services for select to anon
  using (active);
create policy "read services" on public.clinic_services for select to authenticated
  using (active or (select public.is_staff()));
create policy "admin insert services" on public.clinic_services for insert to authenticated
  with check ((select public.is_admin()));
create policy "admin update services" on public.clinic_services for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin delete services" on public.clinic_services for delete to authenticated
  using ((select public.is_admin()));

create policy "public read active doctors" on public.doctors for select to anon
  using (active);
create policy "read doctors" on public.doctors for select to authenticated
  using (active or (select public.is_staff()));
create policy "admin insert doctors" on public.doctors for insert to authenticated
  with check ((select public.is_admin()));
create policy "admin update doctors" on public.doctors for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin delete doctors" on public.doctors for delete to authenticated
  using ((select public.is_admin()));

-- Patients and appointments are private to staff. New bookings go through book_appointment().
create policy "staff read patients" on public.patients for select to authenticated
  using ((select public.is_staff()));
create policy "staff update patients" on public.patients for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "admin delete patients" on public.patients for delete to authenticated
  using ((select public.is_admin()));

create policy "staff read appointments" on public.appointments for select to authenticated
  using ((select public.is_staff()));
create policy "staff update appointments" on public.appointments for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "admin delete appointments" on public.appointments for delete to authenticated
  using ((select public.is_admin()));

-- Free slots for a doctor on a date, in clinic time. Returns times only, no patient data.
create function public.available_slots(p_doctor uuid, p_date date)
returns table (slot time)
language sql stable security definer set search_path = '' as $$
  select s::time
  from public.doctors d
  cross join lateral generate_series(
    p_date + d.start_time,
    p_date + d.end_time - make_interval(mins => d.slot_minutes),
    make_interval(mins => d.slot_minutes)
  ) s
  where d.id = p_doctor
    and d.active
    and extract(dow from p_date)::smallint = any (d.work_days)
    and p_date <= (now() at time zone 'Africa/Dar_es_Salaam')::date + 90
    and s > now() at time zone 'Africa/Dar_es_Salaam'
    and not exists (
      select 1 from public.appointments a
      where a.doctor_id = d.id and a.appt_date = p_date
        and a.start_time = s::time and a.status <> 'cancelled'
    )
  order by 1
$$;

-- Books a slot for the public form or for staff. Finds or creates the patient by phone.
create function public.book_appointment(
  p_doctor uuid, p_service uuid, p_date date, p_time time,
  p_name text, p_phone text, p_email text default null, p_gender text default null,
  p_birth_date date default null, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_staff boolean := public.is_staff();
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[\s()-]', '', 'g');
  v_name text := btrim(coalesce(p_name, ''));
  v_patient uuid;
  v_appt public.appointments;
  v_doctor text;
begin
  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'Please enter the patient''s full name';
  end if;
  if v_phone !~ '^\+?[0-9]{9,15}$' then
    raise exception 'Please enter a valid phone number';
  end if;
  if p_gender is not null and p_gender not in ('Male', 'Female') then
    raise exception 'Invalid gender';
  end if;
  if length(coalesce(p_reason, '')) > 1000 then
    raise exception 'Reason is too long';
  end if;
  if p_service is not null
     and not exists (select 1 from public.clinic_services where id = p_service and active) then
    raise exception 'Service not found';
  end if;
  if not exists (select 1 from public.available_slots(p_doctor, p_date) where slot = p_time) then
    raise exception 'That time is no longer available. Please pick another slot.';
  end if;

  -- Existing patients keep their details; the form only fills in what is missing.
  insert into public.patients as pt (full_name, phone, email, gender, birth_date)
  values (v_name, v_phone, nullif(btrim(p_email), ''), p_gender, p_birth_date)
  on conflict (phone) do update set
    email = coalesce(pt.email, excluded.email),
    gender = coalesce(pt.gender, excluded.gender),
    birth_date = coalesce(pt.birth_date, excluded.birth_date)
  returning id into v_patient;

  -- Limit open online bookings per phone to curb spam.
  if not v_staff and (
    select count(*) from public.appointments
    where patient_id = v_patient and status in ('pending', 'confirmed')
      and appt_date >= (now() at time zone 'Africa/Dar_es_Salaam')::date
  ) >= 3 then
    raise exception 'This phone number already has 3 upcoming appointments. Please call the clinic.';
  end if;

  begin
    insert into public.appointments (ref_no, patient_id, doctor_id, service_id, appt_date,
                                     start_time, status, reason, source)
    values ('KC-' || lpad(nextval('public.appointment_seq')::text, 5, '0'), v_patient, p_doctor,
            p_service, p_date, p_time, case when v_staff then 'confirmed' else 'pending' end,
            nullif(btrim(p_reason), ''), case when v_staff then 'staff' else 'online' end)
    returning * into v_appt;
  exception when unique_violation then
    raise exception 'That time is no longer available. Please pick another slot.';
  end;

  select name into v_doctor from public.doctors where id = p_doctor;
  return jsonb_build_object(
    'ref_no', v_appt.ref_no, 'appt_date', v_appt.appt_date, 'start_time', v_appt.start_time,
    'doctor', v_doctor, 'status', v_appt.status
  );
end;
$$;

revoke execute on function public.available_slots(uuid, date),
  public.book_appointment(uuid, uuid, date, time, text, text, text, text, date, text) from public;
grant execute on function public.available_slots(uuid, date),
  public.book_appointment(uuid, uuid, date, time, text, text, text, text, date, text)
  to anon, authenticated;

-- Starter data. Admins can edit these in the Doctors & Services page.
insert into public.clinic_services (name, fee) values
  ('General consultation', 10000),
  ('Paediatrics', 15000),
  ('Dental check-up', 20000),
  ('Antenatal care', 10000),
  ('Laboratory tests', 5000);

insert into public.doctors (name, specialty, work_days, start_time, end_time) values
  ('Dr. General Practitioner', 'General', '{1,2,3,4,5,6}', '08:00', '17:00'),
  ('Dr. Paediatrician', 'Paediatrics', '{1,2,3,4,5}', '09:00', '15:00'),
  ('Dr. Dentist', 'Dental', '{1,3,5}', '09:00', '13:00');
