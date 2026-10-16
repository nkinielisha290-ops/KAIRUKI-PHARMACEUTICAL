# Kairuki Pharmaceutical POS

> This repository also holds **Kairuki Clinic**, a React clinic management system with an online booking form. See [`clinic/README.md`](clinic/README.md).

A point-of-sale for a pharmacy, written in plain HTML, CSS and JavaScript. There is no build step. Data is stored in Supabase, so every device shares the same products and sales.

Live: https://kairuki-pharmaceutical-pos.vercel.app

## Features
- **Staff login**: email and password through Supabase Auth. Only emails on the staff list can use the system.
- **Roles**: *cashiers* can sell and view history. *Admins* can also manage products and staff.
- **Sell**: search medicines, build a cart, apply a discount, pick a payment method (Cash, M-Pesa, Card, Insurance), and see the change due.
- **Safe checkout**: the `complete_sale` database function locks stock, recalculates totals from database prices, and records the sale in one step.
- **Receipts**: numbered (KP-00001…), printable, and show who served the customer.
- **Products**: low stock (10 or fewer) is highlighted, and stock goes down with each sale.
- **Sales history**: daily count, revenue and items sold per date, with each receipt available again.

## Files
- `index.html`, `styles.css`, `app.js`: the app.
- `config.js`: the Supabase URL and publishable key. Both are public by design. Access is enforced by row-level security.
- `supabase/schema.sql`: the database schema, security policies and checkout function.
- `supabase/clinic_schema.sql`: the clinic tables and booking functions.
- `clinic/`: the clinic management app.

## Adding staff
1. An admin opens **Staff** and adds the person's email with a role.
2. The person opens the site, clicks **Create an account** with that email, and confirms it from their inbox.

The first admin is `nkinielisha290@gmail.com`.

## Run locally
Serve the folder with any static server, for example `npx serve .`.
