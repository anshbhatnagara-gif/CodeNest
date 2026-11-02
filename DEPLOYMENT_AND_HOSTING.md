# CodeNest Free Academy — Deployment and Hosting

## Live Website

**Production URL:** [https://coding-academy-pro-free-course.vercel.app](https://coding-academy-pro-free-course.vercel.app)

- **Backend Base URL:** `https://coding-academy-pro-free-coursecodenest-idle.onrender.com`
- **Health API URL:** `https://coding-academy-pro-free-coursecodenest-idle.onrender.com/api/health`
- **Courses API URL:** `https://coding-academy-pro-free-coursecodenest-idle.onrender.com/api/courses`
- **GitHub repository name:** `coding-academy-pro-free-course`

## Final Architecture

- React/Vite frontend is hosted on Vercel
- Node.js/Express backend is hosted on Render
- TiDB Cloud stores users, courses, modules, enrollments and progress
- Frontend sends HTTPS API requests to Render
- Render connects securely to TiDB using SSL

- GitHub main branch triggers deployments

## Architecture Flowchart

```mermaid
flowchart LR
    U[User on Mobile or Computer] -->|HTTPS| V[Vercel Frontend]
    V -->|API Requests| R[Render Node.js Backend]
    R -->|SSL Database Connection| T[(TiDB Cloud Database)]

    G[GitHub Repository - main branch] -->|Frontend Deployment| V
    G -->|Backend Deployment| R

    V -->|Public Website| W[https://coding-academy-pro-free-course.vercel.app]
    R --> H[/api/health]
    R --> C[/api/courses]
```
