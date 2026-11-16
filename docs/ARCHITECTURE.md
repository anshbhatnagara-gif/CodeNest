# 🏗️ CodeNest Architecture Blueprint

This document details the complete end-to-end architecture of **CodeNest – Free Coding Academy**, an open-source, full-stack educational platform built with React, Node.js, Express, and TiDB Cloud.

---

## 1. High-Level System Architecture

CodeNest is architected as a decoupled, multi-tier client-server application optimized for security, performance, and cost-effective cloud deployment.

```mermaid
flowchart TB
    subgraph Client ["Client Tier (Browser)"]
        Browser["User Browser / Mobile Device"]
    end

    subgraph CDN ["Frontend Hosting (Vercel)"]
        VercelEdge["Vercel Edge Network / CDN"]
        ReactApp["React 19 + Vite SPA<br/>(Tailwind CSS v4, React Router v7)"]
        VercelEdge --> ReactApp
    end

    subgraph BackendTier ["Backend API Service (Render)"]
        ExpressServer["Node.js + Express.js API Server<br/>(Port 5000 / $PORT)"]
        SecurityMW["Security & Observability<br/>(Helmet, CORS, RateLimiter, Compression)"]
        AuthMW["Authentication Middleware<br/>(JWT HS256 + token_version verification)"]
        OwnerMW["Owner Verification Middleware<br/>(Role === 'owner' && Email === OWNER_EMAIL)"]
        Controllers["API Controllers<br/>(Auth, Courses, Modules, Progress, Notes, Owner)"]
        StorageAdapter["Storage Adapter<br/>(Local Disk Fallback / Cloudflare R2 Ready)"]

        ExpressServer --> SecurityMW
        SecurityMW --> AuthMW
        AuthMW --> OwnerMW
        AuthMW --> Controllers
        OwnerMW --> Controllers
        Controllers --> StorageAdapter
    end

    subgraph DataTier ["Cloud Database (TiDB Cloud Serverless)"]
        TiDBCluster[("TiDB Distributed Cluster<br/>(MySQL 8.0 Compatible, TLS 1.2 Enforced)")]
        ConnectionPool["mysql2 Connection Pool<br/>(Max 10 connections, auto-reconnect)"]
    end

    subgraph FileStorage ["Storage Layer"]
        LocalDisk["Local Ephemeral Disk<br/>(backend/uploads/notes)"]
        CloudflareR2["Cloudflare R2 Object Storage<br/>(S3-Compatible, Presigned URLs)"]
    end

    Browser -->|HTTPS / DNS| VercelEdge
    Browser -->|HTTPS API Requests / CORS| ExpressServer
    Controllers --> ConnectionPool
    ConnectionPool -->|TLS 1.2 Encrypted Connection| TiDBCluster
    StorageAdapter -->|Current: Local Filesystem| LocalDisk
    StorageAdapter -.->|Planned: S3 Presigned URLs| CloudflareR2
```

---

## 2. Core Architectural Layers

### 2.1 Client & Presentation Layer (Frontend)
- **Framework:** React 19 with Vite 6 build system.
- **Routing:** React Router v7 with single-page application (SPA) client-side routing.
- **Styling:** Modern Tailwind CSS v4 featuring responsive flex/grid layouts and animated UI components.
- **State & Context Management:**
  - `AuthContext`: Centralized React Context managing JWT token persistence (`localStorage.getItem('cn_token')`), user profile state, login, registration, and logout.
  - Axios HTTP Interceptors: Automatically injects `Authorization: Bearer <token>` into outbound requests and catches `401 Unauthorized` responses to purge expired tokens.
- **Security Boundaries:**
  - `ProtectedRoute`: Guards student dashboards and user profiles from unauthenticated visitors.
  - `ProtectedRoute (ownerOnly)`: Restricts administrative tools (`/owner-dashboard`, `/owner-courses`, `/owner-modules`, `/owner-notes`) exclusively to users with `role === 'owner'`.
  - `ErrorBoundary`: Catches unhandled React component rendering exceptions and renders a friendly recovery screen.

### 2.2 Application & Business Logic Layer (Backend)
- **Runtime:** Node.js (v18.0.0+) with Express.js 4.19+.
- **Middleware Pipeline:**
  1. **Proxy Trust:** Configured for cloud load balancers (`app.set('trust proxy', 1)`).
  2. **Security Headers (Helmet):** Sets `Cross-Origin-Resource-Policy: cross-origin`, strict `Content-Security-Policy`, and `HSTS`.
  3. **Request Tracing:** Assigns a unique UUID v4 to incoming requests (`X-Request-Id`) and logs structured JSON telemetry.
  4. **HTTP Response Compression:** Gzip compression with a 1 KB threshold and `x-no-compression` header bypass support.
  5. **CORS Enforcement:** Dynamic origin validation strictly matching configured frontend domains (`FRONTEND_URL`, `CORS_ORIGIN`).
  6. **Rate Limiting:** Protects sensitive authentication endpoints (`/api/auth/login`, `/api/auth/register`) from brute-force attempts.
  7. **Central Error Handler:** Formats unexpected server exceptions into sanitized JSON responses, masking internal database stacks in production.

### 2.3 Data Persistence Layer (TiDB Cloud)
- **Engine:** TiDB Serverless Cloud Cluster on AWS (MySQL 8.0 protocol compatible).
- **Security:** TLS 1.2+ mandatory encryption (`rejectUnauthorized: true`).
- **Connection Management:** Connection pooling via `mysql2/promise` with automatic keep-alive pings and subquery optimization.
- **Data Integrity:** Foreign key constraints with `ON DELETE CASCADE` and unique constraints (`uq_course_title`, `uq_course_module_order`, `unique_enrollment`, `unique_progress`).

### 2.4 File Storage Layer (Storage Adapter Pattern)
- **Adapter Class:** `StorageAdapter` (`backend/config/storage.js`).
- **Modes of Operation:**
  - **Local Storage Mode (Current):** Saves uploads to `backend/uploads/notes` with defensive filename sanitization, path traversal checks, and authenticated streaming via `res.download`.
  - **Cloudflare R2 Mode (Planned Migration):** Connects to Cloudflare R2 bucket via `@aws-sdk/client-s3`, generating 300-second expiring presigned download URLs.

---

## 3. Key Interaction & Sequence Flows

### 3.1 Authentication & Session Revocation Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Student / Owner
    participant FE as React Frontend (AuthContext)
    participant BE as Express API Server
    participant DB as TiDB Cloud Database

    User->>FE: Enters Email & Password
    FE->>BE: POST /api/auth/login
    BE->>DB: SELECT * FROM users WHERE email = ?
    DB-->>BE: User Record (bcrypt hash, role, token_version)
    BE->>BE: bcrypt.compare(password, hash)
    BE->>BE: Generate JWT {id, email, role, token_version}
    BE->>DB: UPDATE users SET last_login_at = NOW()
    BE-->>FE: HTTP 200 {token, user}
    FE->>FE: localStorage.setItem('cn_token', token)
    FE->>User: Redirects to Dashboard (Student) or Owner Dashboard (Owner)

    Note over User, DB: User logs out or resets password
    User->>FE: Clicks "Logout"
    FE->>BE: POST /api/auth/logout (Bearer Token)
    BE->>DB: UPDATE users SET token_version = token_version + 1
    BE-->>FE: HTTP 200 "All active sessions revoked"
    FE->>FE: localStorage.removeItem('cn_token')
```

---

### 3.2 Course Progress & Gamification Flow

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant FE as CourseDetail Page
    participant BE as Progress Controller
    participant DB as TiDB Cloud Database

    Student->>FE: Clicks "Mark as Complete" on Module
    FE->>BE: POST /api/progress/module-complete {module_id}
    BE->>BE: Verify JWT & extract student userId
    BE->>DB: Verify enrollment (SELECT enrollment_id FROM enrollments ...)
    alt Student is NOT enrolled
        BE-->>FE: HTTP 403 "Please enroll in the course first."
    else Student is enrolled
        BE->>DB: Check if already completed (SELECT id FROM progress ...)
        alt Already completed
            BE-->>FE: HTTP 200 {already_done: true}
        else New completion
            BE->>DB: INSERT INTO progress (user_id, module_id)
            BE->>DB: UPDATE users SET xp = xp + 50, level = FLOOR((xp+50)/500) + 1
            BE->>DB: Count remaining modules in course
            alt Course Completed (100%)
                BE->>DB: UPDATE users SET xp = xp + 200, level = FLOOR((xp+200)/500) + 1
                BE-->>FE: HTTP 200 {xp_gained: 50, course_completed: true, bonus_xp: 200}
            else Course in progress
                BE-->>FE: HTTP 200 {xp_gained: 50, course_completed: false}
            end
            FE->>FE: Update animated progress bar & celebrate achievement
        end
    end
```

---

### 3.3 Secure Notes Attachment Download Flow

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant FE as Frontend Download Button
    participant BE as Notes Controller
    participant SA as Storage Adapter
    participant R2 as Cloudflare R2 / Disk

    Student->>FE: Clicks "Download" on Note
    FE->>BE: GET /api/notes/:id/download (Authorization: Bearer)
    BE->>BE: Verify JWT session
    BE->>BE: Check Note status (Draft vs Published)
    alt Note is Draft and requester is NOT Owner
        BE-->>FE: HTTP 403 "Forbidden. Attachment unavailable."
    else Note is Published or requester is Owner
        BE->>SA: getAttachmentDownloadUrl(note.file_url, note.file_name)
        alt Provider is Cloudflare R2
            SA->>R2: Generate S3 GetObject signed URL (TTL 300s)
            SA-->>BE: {type: 'redirect', url: signedUrl}
            BE-->>FE: HTTP 302 Redirect to signed URL
            FE->>R2: Downloads file directly from CDN
        else Provider is Local Disk Fallback
            SA->>SA: Verify path containment & prevent ../ traversal
            alt File missing from local disk
                BE-->>FE: HTTP 404 {message: "File not found on server."}
                FE->>FE: Parse Blob text error & notify student
            else File exists
                BE-->>FE: HTTP 200 Stream attachment binary
                FE->>Student: Saves file to local Downloads folder
            end
        end
    end
```

---

## 4. Security Architecture

1. **Defense-in-Depth Authentication:**
   - Password inputs are checked for length (8–128 characters) and UTF-8 byte size (max 72 bytes) before reaching `bcrypt`.
   - JWT signatures use `HS256` with strong 32-character minimum secrets.
   - Dual-gate Owner validation prevents unauthorized administrative access even if an account is manually altered to role `'owner'`.
2. **SQL Injection Defense:**
   - 100% of dynamic database queries use parameterized prepared statements (`pool.execute(query, [params])`).
3. **MIME Sniffing & Path Traversal Prevention:**
   - Uploaded files have their raw buffers inspected for file magic numbers (`%PDF-`, `PK\x03\x04`, etc.) rather than trusting user-supplied file extensions.
   - File deletion and retrieval routines strictly enforce path containment inside designated upload directories.
4. **Information Disclosure Prevention:**
   - Production error handlers catch exceptions and strip SQL state codes, internal file paths, and environment details.
   - Database health check endpoints verify cluster connectivity with a timeout without returning connection strings.
