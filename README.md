# WappBlaster CRM v2

A browser-based sales CRM starter for small teams. It includes separate company workspaces, admin/employee roles, lead claiming, CSV import/export, round-robin assignment, status tracking, remarks, follow-up reminders, activity history, team management, password changes and basic performance reports.

## Features

- **Company workspaces:** self-service registration creates a company workspace and its first admin. Lead/user/report queries are scoped to the signed-in company.
- **Roles:** admins manage employees, import/export leads, view reports, release leads and configure assignment mode; employees work their own claimed leads.
- **Lead workflow:** create, claim, change status, save call remarks, schedule follow-ups, click phone numbers to initiate a phone call on supported devices, and view history.
- **Import/export:** CSV import (up to 2 MB) and export. Required CSV column: `Customer Name` or `Name`; optional: `Phone`, `Source`, `Message`.
- **Assignment:** manual claiming and admin-triggered round-robin assignment to the next active employee.
- **Security basics:** password hashes with bcrypt, session regeneration on login, SQLite-backed session storage, company scoping, same-origin mutation checks, login attempt throttling, Helmet, parameterized SQL, input limits and secure cookies behind a trusted proxy.

## Local run

Requires Node.js 20 or newer.

1. Copy `.env.example` to `.env` and replace secrets/passwords. Never commit `.env`.
2. Install dependencies: `npm install`
3. Start: `npm start`
4. Open `http://localhost:3000` and create a workspace, or use the seeded demo account on an empty database:
   - Admin: `admin@wappblaster.local` / `ChangeMe123!`
   - Employee: `tarun@wappblaster.local` / `Staff123!`

Change/delete demo credentials before using real customer information. A fresh database seeds demo leads; remove them before a production launch.

## Smoke tests

After installing dependencies, run `npm test`. The test suite starts an isolated local server and checks health, workspace registration/session, lead creation, CSV import, tenant isolation and anonymous access. It requires no live third-party credentials.

## Render deployment

- Build command: `npm install`
- Start command: `npm start`
- Root directory: `wappblaster-lead-claiming` (if this folder is the repository root's child)
- Set `NODE_ENV=production` and `SESSION_SECRET` to a unique random secret of 32+ characters.
- Attach a **persistent disk** and set `DATA_DIR` to its mount path (for example `/var/data`). Both SQLite business data and sessions live under this directory. Without persistent storage, data can be lost when the service is recreated or redeployed.
- Keep database files private; take regular encrypted backups and test restores.
- Do not deploy a public demo with known default credentials. Configure initial admin env vars before first database creation, then rotate credentials and remove demo users/leads.

## Important product limitations before commercial sale

This is a functional CRM baseline, not a certified or fully audited enterprise SaaS. Test it with a staging database and synthetic data before production. For larger multi-tenant commercial deployments, migrate the database to managed PostgreSQL, use a managed session store, add automated backups/restore drills, centralized audit/monitoring, stronger automated tests, privacy/terms pages and a formal security review. SQLite is appropriate for a small single-instance deployment with a persistent disk, not horizontal scaling.

- **Google Sheets sync** needs Google OAuth/service-account credentials and a configured integration; it is not active out of the box.
- **WhatsApp lead capture** needs an approved WhatsApp/Meta API webhook and credentials; not active out of the box.
- **Automated dialing/call-end detection** needs a supported telephony/Android provider. This build provides click-to-call (`tel:`), but cannot detect a call ending from an ordinary browser tab.
- **Subscriptions/billing, password reset email, team invitations, custom domains and client support workflows** are not included.
- The CSV parser supports standard quoted CSV fields; validate unusual exports before bulk import.

## Operational checks

Before launch: register two test companies and verify neither can see the other's users/leads/reports; test admin and employee permissions; test CSV import/export; test session persistence across restart; test backup restore; confirm HTTPS; rotate secrets; remove demo data; and test on mobile browsers.
