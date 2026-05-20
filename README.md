# Ideation ELO Ranking

**Stack:** React + TypeScript (Vite) · Node.js + Express · Supabase

---

## Setup

### 1. Supabase keys
Go to your Supabase project → **Settings → API** and grab:
| Value | Where to find it |
|---|---|
| Project URL | "Project URL" |
| `anon public` key | "Project API keys" → anon public |
| `service_role` key | "Project API keys" → service_role (click Reveal) |

### 2. Frontend env
Edit `frontend/.env`:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
```

### 3. Backend env
Edit `backend/.env`:
```
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

---

## Running locally

**Frontend** (http://localhost:5173):
```bash
cd frontend
npm install
npm run dev
```

**Backend** (http://localhost:3001):
```bash
cd backend
npm run dev
```

---

## Project structure
```
.
├── frontend/          # React + TypeScript + Vite
│   └── src/
│       └── lib/
│           └── supabase.ts   # Supabase anon client
└── backend/           # Node.js + Express + TypeScript
    └── src/
        ├── index.ts          # Server entry point
        ├── lib/
        │   └── supabase.ts   # Supabase service-role client
        └── routes/
            └── index.ts      # API routes
```
