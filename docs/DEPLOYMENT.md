# 🚀 CodeNest Production Deployment Guide

This guide documents the live production hosting architecture, cloud configurations, environment variables, and deployment procedures for **CodeNest – Free Coding Academy**.

---

## 1. Production Architecture Overview

The live deployment of CodeNest utilizes a modern, decoupled cloud architecture designed for high availability, security, and low operational overhead:

- **Frontend:** Hosted on **[Vercel](https://vercel.com/)**  
  🌐 **Production URL:** [https://code-nest-ashy-ten.vercel.app/](https://code-nest-ashy-ten.vercel.app/)
- **Backend API:** Hosted on **[Render](https://render.com/)** as a Web Service  
  ⚡ **Production API Base:** [https://codenest-pt6j.onrender.com](https://codenest-pt6j.onrender.com)  
  🩺 **Health Check Endpoint:** [https://codenest-pt6j.onrender.com/api/health](https://codenest-pt6j.onrender.com/api/health)
- **Database:** Hosted on **[TiDB Cloud](https://tidbcloud.com/)**  
  🗄️ **Engine:** TiDB Serverless Cluster (AWS `ap-southeast-1` region, MySQL 8.0 protocol, TLS 1.2+ mandatory)
- **File Storage:** Local filesystem mode with Cloudflare R2 adapter ready  
  📁 **Current Status:** Running `STORAGE_PROVIDER=local` on Render's ephemeral disk (Cloudflare R2 planned for persistent storage)

---

## 2. Frontend Deployment on Vercel

The frontend is deployed directly from the GitHub `main` branch.

### 2.1 Vercel Project Settings
| Setting | Configured Value |
|---|---|
| **Framework Preset** | Vite |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` (or `vite build`) |
| **Output Directory** | `dist` |
| **Node.js Version** | 20.x or 22.x |

### 2.2 SPA Routing Configuration
To prevent 404 errors when users refresh deep links (such as `/courses/1` or `/my-learning`), `frontend/vercel.json` routes all incoming requests to `index.html`:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 2.3 Frontend Environment Variables
Configure the following variable under **Project Settings > Environment Variables** on Vercel:

| Variable Name | Environment | Value | Description |
|---|---|---|---|
| `VITE_API_URL` | Production | `https://codenest-pt6j.onrender.com/api` | Base URL for backend REST API |

---

## 3. Backend Deployment on Render

The backend is deployed as a Node.js Web Service on Render using either the web dashboard or [`render.yaml`](file:///c:/CodeNest/render.yaml).

### 3.1 Render Web Service Settings
| Setting | Configured Value |
|---|---|
| **Environment** | Node |
| **Root Directory** | `backend` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` (executes `node server.js`) |
| **Health Check Path** | `/api/health` |
| **Auto-Deploy** | Enabled on branch `main` |

### 3.2 Render Environment Variables Checklist
Configure these environment variables in your Render service dashboard:

| Variable Name | Required | Example Production Value | Purpose |
|---|:---:|---|---|
| `NODE_ENV` | Yes | `production` | Enables production security guards, error masking, and disables stack trace leakage |
| `PORT` | Yes | `5000` | Port automatically assigned by Render (server binds to `0.0.0.0:$PORT`) |
| `TRUST_PROXY` | Yes | `1` | Enables Express proxy trust for Render load balancer headers |
| `DB_HOST` | Yes | `gateway01.ap-southeast-1.prod.aws.tidbcloud.com` | TiDB Cloud cluster host |
| `DB_PORT` | Yes | `4000` | TiDB Cloud serverless port |
| `DB_USER` | Yes | `<tidb-user-string>` | TiDB database user |
| `DB_PASSWORD` | Yes | `<strong-database-password>` | TiDB database password |
| `DB_NAME` | Yes | `codenest_free_academy` | Target relational database name |
| `DB_SSL` | Yes | `true` | Enforces TLS 1.2+ encryption for all database queries |
| `JWT_SECRET` | Yes | `<64-hex-character-secret>` | Secret key used for signing HS256 auth tokens |
| `OWNER_EMAIL` | Yes | `anshbhatnagara@gmail.com` | Verified email address granted Owner administration access |
| `FRONTEND_URL` | Yes | `https://code-nest-ashy-ten.vercel.app` | Allowed CORS origin for web app |
| `CORS_ORIGIN` | Yes | `https://code-nest-ashy-ten.vercel.app` | Explicit allowed origin header |
| `STORAGE_PROVIDER` | Yes | `local` | Current file storage adapter (`local` or `r2`) |
| `MAX_NOTE_FILE_SIZE_MB` | No | `25` | Maximum attachment upload limit in megabytes |

---

## 4. Current Storage Architecture & Cloudflare R2 Migration Plan

### Current Status: Ephemeral Local Storage
Currently, Render runs with `STORAGE_PROVIDER=local`. Uploaded attachments are saved to `backend/uploads/notes` on Render's disk.
> [!WARNING] Render Ephemeral Filesystem Limitation
> Render's Free tier operates on an ephemeral container filesystem. Whenever the Render service sleeps after inactivity, restarts, or deploys a new commit, any physical files written to `backend/uploads/notes` are wiped clean. The database retains the metadata record with `file_url = '/uploads/notes/...'`, but attempting to download the file returns `HTTP 404 File not found on server.`.

### Planned Migration: Cloudflare R2 Object Storage
CodeNest's backend contains a complete, battle-tested `StorageAdapter` ([`backend/config/storage.js`](file:///c:/CodeNest/backend/config/storage.js)) ready to connect to Cloudflare R2 (S3-compatible object storage).

Once a Cloudflare R2 bucket is provisioned, set the following environment variables in Render to activate permanent storage:
```env
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<cloudflare-r2-access-key>
R2_SECRET_ACCESS_KEY=<cloudflare-r2-secret-key>
R2_BUCKET_NAME=codenest-attachments
```
When active, uploads stream directly to Cloudflare R2, and student downloads redirect to short-lived (300-second TTL) secure presigned URLs.

---

## 5. Deployment Troubleshooting & Verification

### 5.1 Verification Checklist
1. **Health Probe:**
   ```bash
   curl -s https://codenest-pt6j.onrender.com/api/health
   # Expected: {"success":true,"status":"CodeNest Backend is running ✅","database":"connected",...}
   ```
2. **CORS Preflight Test:**
   ```bash
   curl -ILs -H "Origin: https://code-nest-ashy-ten.vercel.app" -H "Access-Control-Request-Method: GET" -X OPTIONS https://codenest-pt6j.onrender.com/api/courses
   # Expected: HTTP/1.1 204 No Content with access-control-allow-origin: https://code-nest-ashy-ten.vercel.app
   ```
3. **Frontend Connectivity Test:**
   - Open [https://code-nest-ashy-ten.vercel.app/courses](https://code-nest-ashy-ten.vercel.app/courses) in your browser.
   - Verify that all published courses appear with their respective modules and enrollment counters.

### 5.2 Common Issues & Resolutions
- **Issue: `Not allowed by CORS` on frontend requests:**
  - Verify that `FRONTEND_URL` and `CORS_ORIGIN` in Render match your exact Vercel production domain without trailing slashes.
- **Issue: `503 Service Degraded` on `/api/health`:**
  - TiDB connection timed out or credentials are misconfigured. Check `DB_HOST`, `DB_PORT=4000`, and verify `DB_SSL=true`.
- **Issue: `404 File not found on server` during note download:**
  - The local note attachment was wiped during a Render container restart. The note attachment must be re-uploaded by the owner through `/owner-notes`, or Cloudflare R2 credentials must be configured.
