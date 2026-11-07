# Micro Lending

Office micro-lending console with **local SQL Server** so the team can keep working on the LAN when public internet is down.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind
- Backend: ASP.NET Core 9 Web API
- Database: SQL Server (LocalDB by default)
- Auth: Identity + JWT with role / page permissions

## App menu

- Login
- Dashboard
- Accessibility
  - Roles
  - Page Accessibility
  - Users
- Profile
- Logout

## Run locally

### API

```bash
cd backend
dotnet run --launch-profile http
```

API: `http://localhost:5267` (Swagger in Development)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: `http://localhost:5173` (proxies `/api` to the backend)

### Seed admin

- Email: `admin@micro.local`
- Password: `Admin123!`

## Connection string

Default LocalDB in `backend/appsettings.json`. Point `DefaultConnection` at your office SQL Server for LAN deploy.

## Test deployment

`https://lending.enovasoftware.com` is the test site. Jenkins job
`MicroLending-Staging` builds only the lowercase `staging` branch, checking for
changes every two minutes. There is no production job or `main` deployment trigger.

The pipeline builds the API and frontend, then invokes the administrator-installed
`/usr/local/bin/deploy-microlending-staging` helper from `deploy/deploy-staging.py`.
The helper is root-owned and must be updated separately by an administrator.
SQL credentials and the JWT key remain in `/etc/microlending/appsettings.Production.json`.
Uploads remain in `/var/www/lending/Uploads`; deployments do not restore the repository's database files.
Each deployment backs up the live `MicroLending` database before applying migrations.
Releases live in `/var/www/lending/releases`, with `current` selecting the active release.
Failed startup restores the prior application release; database migrations are not automatically reversed.
