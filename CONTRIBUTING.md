# 🤝 Contributing to CodeNest Free Academy

Thank you for your interest in contributing to **CodeNest – Free Coding Academy**! We are committed to building a transparent, high-quality, open-source educational platform for aspiring developers worldwide.

---

## 1. Code of Conduct

We are dedicated to providing a welcoming, inclusive, and harassment-free environment for everyone. Please be respectful, constructive, and collaborative in all issues, pull requests, and discussions.

---

## 2. Getting Started

### 2.1 Prerequisites
Before starting, ensure you have:
- Node.js (>= 18.0.0)
- npm (>= 9.0.0)
- Git
- Access to a local MySQL 8.0 instance or a free TiDB Cloud Serverless database.

### 2.2 Fork & Clone
1. Fork the repository on GitHub: `https://github.com/anshbhatnagara-gif/CodeNest`
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/CodeNest.git
   cd CodeNest
   ```
3. Set the upstream remote:
   ```bash
   git remote add upstream https://github.com/anshbhatnagara-gif/CodeNest.git
   ```

### 2.3 Environment Setup
Follow the complete instructions in [docs/SETUP.md](docs/SETUP.md) to install dependencies and configure local environment variables for both `frontend/` and `backend/`.

---

## 3. Development Workflow

1. Always create a new branch from `main`:
   ```bash
   git checkout main
   git pull upstream main
   git checkout -b feature/your-feature-name
   ```
2. Make your focused changes.
3. Write clean, readable code with comments explaining non-trivial logic.
4. If modifying database models, create clean SQL migration scripts under `backend/sql/`.

---

## 4. Coding & Security Standards

- **ESModules:** The entire repository uses standard ES module syntax (`import` / `export`). Do not introduce CommonJS `require()`.
- **React Standards:** Use functional components, React hooks (`useState`, `useEffect`, `useCallback`), and Tailwind CSS utility classes.
- **SQL Security:** **NEVER** use string interpolation or concatenation in database queries. Always use parameterized queries:
  ```javascript
  // ✅ Correct:
  await pool.execute('SELECT * FROM users WHERE email = ?', [email]);

  // ❌ Strictly Prohibited:
  await pool.query(`SELECT * FROM users WHERE email = '${email}'`);
  ```
- **Sensitive Data:** **NEVER** commit `.env` files, production credentials, passwords, JWT tokens, or API keys. Ensure secrets remain in `.gitignore`.

---

## 5. Testing & Quality Verification

Before submitting a Pull Request, you **MUST** verify that all tests pass and the frontend compiles cleanly:

```bash
# 1. Run all backend tests (all 186 tests must pass):
cd backend
npm test

# 2. Run the frontend production build:
cd ../frontend
npm run build
```

---

## 6. Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` A new user-facing feature or enhancement.
- `fix:` A bug fix.
- `docs:` Documentation changes only (e.g. updating README or docs/).
- `refactor:` Code changes that neither fix a bug nor add a feature.
- `test:` Adding or updating tests.
- `chore:` Maintenance tasks, dependency updates, or configuration changes.

Example:
```bash
git commit -m "feat(courses): add category filter to course catalog"
```

---

## 7. Submitting a Pull Request

1. Push your branch to your GitHub fork:
   ```bash
   git push origin feature/your-feature-name
   ```
2. Open a Pull Request against the `main` branch of `anshbhatnagara-gif/CodeNest`.
3. Provide a clear description of:
   - What changes were made and why.
   - Any manual or automated tests performed.
   - Screenshots or GIF demos for UI adjustments.
4. A maintainer will review your pull request promptly!
