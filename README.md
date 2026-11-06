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
