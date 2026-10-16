# Kairuki Clinic

A clinic management system built with React and Vite. It uses the same Supabase project and staff accounts as the pharmacy POS.

## Features
- **Online booking form** (`/`): patients pick a service, a doctor, a date and a free time slot, then enter their details. They get a reference number (KC-00001…). They do not need an account.
- **Safe booking**: the `book_appointment` database function checks that the slot is free, prevents double-booking, finds or creates the patient by phone number, and allows at most 3 upcoming online bookings per phone.
- **Dashboard** (`/staff`): today's schedule, bookings waiting for confirmation, and counts.
- **Appointments**: view any day, filter by doctor or status, search, and confirm, complete, cancel or mark no-show. Staff can book phone or walk-in patients. Those bookings are confirmed straight away.
- **Patients**: search by name or phone, edit details and medical notes, and see visit history.
- **Doctors & services** (admins only): working days, hours, slot length, fees, and whether each is shown on the booking form.

Times use clinic time (Africa/Dar_es_Salaam). Bookings are open up to 90 days ahead.

## Staff access
Staff sign in at `/staff/login`. Access uses the POS `staff` list: admins add emails on the POS **Staff** page. Any staff member can manage appointments and patients. Only admins can edit doctors and services.

## Database
`../supabase/clinic_schema.sql` holds the tables, row-level security policies and booking functions. Patient and appointment data can be read only by signed-in staff.

## Development
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/
```

To deploy on Vercel, create a project with **Root Directory** set to `clinic`. Vercel detects Vite automatically, and `vercel.json` sends every route to the app.
