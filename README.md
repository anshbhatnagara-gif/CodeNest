# 🎓 CodeNest Free Academy

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](#)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](#)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](#)
[![MySQL](https://img.shields.io/badge/MySQL-00000F?style=for-the-badge&logo=mysql&logoColor=white)](#)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](#)
[![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](#)
[![JWT Security](https://img.shields.io/badge/JWT-black?style=for-the-badge&logo=JSON%20web%20tokens)](#)

**CodeNest Free Academy** is a modern, premium learning platform designed to provide 100% free programming courses. It features a private, highly secure architecture with a unique horror-themed landing experience, comprehensive course tracking, and an exclusive owner dashboard.

---

## Live Deployment

- **Live Website:** [https://coding-academy-pro-free-course.vercel.app](https://coding-academy-pro-free-course.vercel.app)
- **Backend API:** [https://coding-academy-pro-free-coursecodenest-idle.onrender.com](https://coding-academy-pro-free-coursecodenest-idle.onrender.com)
- **Health Check:** [https://coding-academy-pro-free-coursecodenest-idle.onrender.com/api/health](https://coding-academy-pro-free-coursecodenest-idle.onrender.com/api/health)
- **Courses API:** [https://coding-academy-pro-free-coursecodenest-idle.onrender.com/api/courses](https://coding-academy-pro-free-coursecodenest-idle.onrender.com/api/courses)
- **Deployment Documentation:** [DEPLOYMENT_AND_HOSTING.md](DEPLOYMENT_AND_HOSTING.md)

**Architecture Flow:**
User → Vercel Frontend → Render Backend → TiDB Cloud

---

## ✨ Features

- **Private Platform Architecture:** Unauthenticated users are met with a premium, restricted Welcome page and are required to register.
- **Dynamic Theming:** Custom horror-style aesthetic for public-facing authentication routes, contrasting with a clean, distraction-free environment for learning.
- **Secure JWT Authentication:** Token-based authentication with Bcrypt password hashing.
- **Role-Based Access Control (RBAC):** Distinct `student` and `owner` roles. The Owner Dashboard is strictly protected via environment variable matching and middleware.
- **Interactive Dashboards:** Track learning progress and module completion.
- **Responsive UI:** Fully mobile-responsive interface utilizing modern Tailwind CSS patterns (Glassmorphism, Gradients, Shadows).

---

## 🏗 Architecture Diagram

```mermaid
graph TD
    A[Visitor] -->|Loads Site| B(Welcome Page)
    B --> C{Authenticated?}
    C -->|No| D[Login / Register]
    D -->|Authenticates| E[JWT Generated]
    E --> C
    C -->|Yes| F{Role Check}
    
    F -->|Student| G[Student Home]
    G --> H[Courses]
    H --> I[Course Details]
    I --> J[Enroll & Learn]
    J --> K[Update Progress]
    K --> L[Student Dashboard]
    
    F -->|Owner| M[Owner Dashboard]
    M --> N[Student Monitoring]
    N --> O[Delete / Deactivate Student]
```

---

## ⚙️ Backend Data Flow

```mermaid
graph LR
    A[React Frontend] -->|Axios HTTP Request| B(Express Routes)
    B --> C{Owner Middleware?}
    C -->|Pass| D[Controllers]
    D --> E[MySQL Queries]
    E -->|Database Data| F(JSON Response)
    F --> A
```

---

## 🗄 Database Design (ER Diagram)

```mermaid
erDiagram
    USERS {
        int id PK
        string name
        string email
        string phone
        string password_hash
        string role "student/owner"
        int xp
        int level
        datetime created_at
    }
    
    COURSES {
        int id PK
        string title
        string description
        string category
        string image_url
        int enrolled_count
    }
    
    MODULES {
        int id PK
        int course_id FK
        string title
        string content
        int duration_minutes
    }
    
    ENROLLMENTS {
        int id PK
        int user_id FK
        int course_id FK
        datetime enrolled_at
    }
    
    PROGRESS {
        int id PK
        int user_id FK
        int course_id FK
        int module_id FK
        boolean completed
        datetime completed_at
    }

    USERS ||--o{ ENROLLMENTS : "has"
    COURSES ||--o{ ENROLLMENTS : "has"
    COURSES ||--o{ MODULES : "contains"
    USERS ||--o{ PROGRESS : "tracks"
```

---

## 📂 Folder Structure

```text
codenest/
├── backend/
│   ├── config/          # MySQL DB configuration
│   ├── controllers/     # Express route controllers
│   ├── middleware/      # JWT & Owner auth middlewares
│   ├── routes/          # Express API routes
│   ├── .env.example     # Environment variables schema
│   └── server.js        # Backend entry point
│
├── frontend/
│   ├── public/          # Static assets (Images, SVGs)
│   ├── src/
│   │   ├── components/  # Reusable React components (Navbar, Cards)
│   │   ├── context/     # AuthContext (Global state)
│   │   ├── pages/       # React Router page views
│   │   ├── App.jsx      # Main application router
│   │   └── index.css    # Tailwind & global styles
│   ├── .env.example     # Frontend variables schema
│   ├── tailwind.config.js
│   └── vite.config.js
│
└── README.md
```

---

## 🚀 Installation & Local Development

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/codenest.git
cd codenest
```

### 2. Setup Database (MySQL)
Create a new MySQL database named `codenest`.
Run the SQL table creation queries found in the documentation to setup tables.

### 3. Configure Environment Variables
Copy the `.env.example` files to `.env` in both frontend and backend directories, then populate them.
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 4. Start the Backend
```bash
cd backend
npm install
npm start
```

### 5. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 📡 API Routes

| Method | Route | Description | Auth Required |
|--------|-------|-------------|---------------|
| `GET`  | `/api/health` | System health & DB connection probe | No |
| `POST` | `/api/auth/register` | Register new user | No |
| `POST` | `/api/auth/login` | Authenticate & get JWT | No |
| `GET`  | `/api/auth/profile` | Get current user data | Yes |
| `POST` | `/api/auth/logout` | Revoke user session | Yes |
| `GET`  | `/api/courses` | Fetch published courses (includes enrollment if logged in) | No (Optional) |
| `GET`  | `/api/courses/:id` | Fetch course details & modules | No (Optional) |
| `POST` | `/api/courses/:id/enroll` | Enroll in course | Yes |
| `POST` | `/api/progress/module-complete`| Mark module complete & award XP | Yes |
| `GET`  | `/api/notes` | Fetch published course study notes | No |
| `GET`  | `/api/notes/:id` | Fetch single note details | No (Drafts: Owner) |
| `GET`  | `/api/notes/:id/download` | Download note attachment via signed URL / stream | Yes |
| `GET`  | `/api/owner/dashboard` | Fetch academy overview metrics & analytics | Yes (Owner) |
| `GET`  | `/api/owner/students` | Fetch all registered student users | Yes (Owner) |
| `GET`  | `/api/owner/courses` | List all courses (draft & published) | Yes (Owner) |
| `GET`  | `/api/owner/notes` | List and manage all notes & attachments | Yes (Owner) |

---

## 🖼 Project Screenshots

### Public Landing (Horror Theme)
*(Screenshot coming soon)*

### Authentication
*(Screenshot coming soon)*

### Student Dashboard
*(Screenshot coming soon)*

### Course Discovery
*(Screenshot coming soon)*

### Secure Owner Dashboard
*(Screenshot coming soon)*

---

## 🌍 Deployment Guide

Detailed deployment documentation, backup strategies, and operational runbooks can be found in our comprehensive [DEPLOYMENT.md](DEPLOYMENT.md) guide.

### Hosting Stack
- **Frontend (Vercel Hobby):** The React static application is deployed from the `frontend` root directory.
- **Backend (Render Free):** The Node.js API server is deployed from the `backend` root directory.
- **Database (TiDB Cloud):** The MySQL database runs on a secure **TiDB Serverless** cluster requiring SSL TLS 1.2 connections.
- **File Storage (Cloudflare R2):** S3-compatible cloud object storage for note attachments with local fallback.

### Quick Deployment Steps
1. Connect the existing repository to Render and Vercel.
2. Set Render root directory to `backend`, build command to `npm install`, and start command to `npm start`.
3. Configure the required Render environment variables:
   - Database: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true`
   - Authentication & Roles: `JWT_SECRET`, `OWNER_EMAIL`
   - CORS & Domains: `FRONTEND_URL`, `CORS_ORIGIN`
   - Storage: `STORAGE_PROVIDER=r2`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
4. Set Vercel root directory to `frontend`, build command to `npm run build`, output directory to `dist`, and `VITE_API_URL` to the Render backend URL.
5. Deploy the backend first, then redeploy the frontend, then update final CORS URLs on Render.

---

## 🔮 Future Improvements

- Add robust email verification & password reset flows.
- Implement rich-text markdown rendering for course modules.
- Create automated quizzes at the end of each module.
- Add an AI Chat mentor using Gemini API.

---

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

Built by **Ansh Bhatnagar**.
