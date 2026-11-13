# Shirou Top-Up

Starter MVP for an MLBB top-up storefront using Node.js, Express, and PostgreSQL.

## What works

- Responsive Indonesian storefront with an MLBB package catalog.
- Creates an order after validating the package, player ID, server ID, and optional email.
- Stores order and package price snapshots in PostgreSQL.
- Looks up an order by its public order code.
- Rate limits order creation and adds baseline HTTP security headers.

## Run locally

Requirements: Node.js 20+ and PostgreSQL 14+.

1. Create a PostgreSQL database named `shirou_topup`.
2. Copy `.env.example` to `.env` and set the database credentials.
3. Install packages with `npm install`.
4. Start the app with `npm run dev`.
5. Open `http://localhost:3000`.

The server creates the schema and inserts the demo catalog at startup. Set `DATABASE_URL` for a hosted PostgreSQL database, or configure `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD`. Set `PGSSL=true` when the database provider requires TLS.

## Important before launch

- The listed package prices are demo values. Confirm prices and products with an authorized supplier and update `db/schema.sql` before accepting real orders.
- Payment processing and automatic diamond fulfillment are not connected. Orders remain `pending_payment`; do not present them as paid or fulfilled.
- Add a payment provider webhook with signature verification and idempotent status updates before taking payments.
- Configure trusted proxy and HTTPS settings for the production host.
- Never commit `.env` or production credentials.
