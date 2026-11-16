# 🛠️ CodeNest Local Development & Setup Guide

This guide walks you through setting up and running **CodeNest – Free Coding Academy** on your local machine for development, testing, and contribution.

---

## 1. Prerequisites

Ensure the following tools are installed on your computer:

- **Node.js:** `v18.0.0` or higher (`node -v`)
- **npm:** `v9.0.0` or higher (`npm -v`)
- **Git:** Latest version (`git --version`)
- **Database:** A local MySQL 8.0+ server OR a free [TiDB Cloud Serverless](https://tidbcloud.com/) cluster.

---

## 2. Clone the Repository

```bash
git clone https://github.com/anshbhatnagara-gif/CodeNest.git
cd CodeNest
```

---

## 3. Backend Setup

The backend is built with Express.js and connects to MySQL / TiDB.

### 3.1 Install Dependencies
Navigate into the `backend` directory and install packages:
```bash
cd backend
npm install
```

### 3.2 Configure Environment Variables
Create a `.env` file in the `backend/` directory by copying `.env.example`:
```bash
cp .env.example .env
```

Open `backend/.env` and configure the following variables:

```env
# Server Port & Mode
PORT=5000
NODE_ENV=development

# Database Connection (MySQL or TiDB Cloud Serverless)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_local_password
DB_NAME=codenest_free_academy
DB_SSL=false

# Authentication Secret (Minimum 32 random characters)
JWT_SECRET=super_secret_jwt_key_for_local_development_only

# Academy Owner Administration
OWNER_EMAIL=your_email@example.com

# CORS Configuration (Matching frontend dev server)
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173

# Storage Adapter Configuration
STORAGE_PROVIDER=local
MAX_NOTE_FILE_SIZE_MB=25
```

> [!NOTE] Connecting to TiDB Cloud
> If using TiDB Cloud Serverless, set `DB_PORT=4000`, provide your cluster host, user, and password, and set `DB_SSL=true`.

### 3.3 Initialize & Seed the Database
Execute the automated migration and seed script:
```bash
node scripts/migrate.js
```
This script connects to your database, executes `backend/sql/schema.sql` to construct all tables and keys, and populates initial courses and modules from `backend/sql/seed.sql`.

### 3.4 Start the Backend Server
```bash
# Start in development mode with auto-reload:
npm run dev

# Or start in standard mode:
npm start
```
Your backend will start listening at `http://localhost:5000`.  
Verify health by visiting: `http://localhost:5000/api/health`

---

## 4. Frontend Setup

The frontend is a single-page React 19 application built with Vite and Tailwind CSS v4.

### 4.1 Install Dependencies
Open a new terminal window, navigate into the `frontend` directory, and install packages:
```bash
cd frontend
npm install
```

### 4.2 Configure Environment Variables
Create a `.env` file in the `frontend/` directory by copying `.env.example`:
```bash
cp .env.example .env
```

Set the backend API endpoint:
```env
# Point to your local backend API
VITE_API_URL=http://localhost:5000/api
```

### 4.3 Start the Frontend Dev Server
```bash
npm run dev
```
Vite will start the dev server at: `http://localhost:5173`  
Open your browser and navigate to `http://localhost:5173` to explore the CodeNest platform!

---

## 5. Provisioning an Owner Account

To test administrative features (course creation, module reordering, notes management, student analytics):

1. Start both backend and frontend servers.
2. Open `http://localhost:5173/register` and register an account using the exact email specified in your `backend/.env` under `OWNER_EMAIL`.
3. In your terminal, run the owner promotion script from the `backend/` folder:
   ```bash
   cd backend
   node scripts/promoteOwner.js your_email@example.com
   ```
4. Log out and log back in on the website. You will be automatically redirected to `/owner-dashboard` with full owner privileges!

---

## 6. Running Automated Tests & Builds

### 6.1 Backend Unit & Integration Tests
The backend uses the native Node.js test runner (`node --test`). Run the complete test suite:
```bash
cd backend
npm test
```
**Expected Result:** **186 / 186 tests passing** across 24 test suites (`health.test.js`, `ownerCourses.test.js`, `ownerModules.test.js`, `security.test.js`, `storage.test.js`, etc.).

### 6.2 Frontend Production Build Verification
To ensure all JSX syntax, Tailwind classes, and Rollup bundles compile without errors:
```bash
cd frontend
npm run build
```
**Expected Result:** Builds cleanly into `frontend/dist/` in ~8 seconds with 0 errors.

### 6.3 Verifying Full API Flow (Manual Script)
You can test the entire registration, login, course fetch, module completion, and note download flow using:
```bash
cd backend
node scripts/verify_full_flow.js
```
