# 🌟 CodeNest Features & Capabilities Guide

This guide details the complete feature set implemented in **CodeNest – Free Coding Academy**, organized by user role. It also clearly outlines planned roadmap items.

---

## 1. Student Experience (Implemented)

### 1.1 Account Registration & Authentication
- **Secure Registration:** Students register with full name, email, optional phone number, and a password.
- **Client & Server Input Validation:** Full validation checks email formatting, name length, and password rules (minimum 8 characters, maximum 128 characters, bounded to 72 bytes UTF-8).
- **Password Strength Indicator:** Visual strength gauge (Weak, Medium, Strong) calculated across length and character variety (capitals, numbers, special symbols).
- **Secure JWT Session Management:** Issues a standard `HS256` token with `token_version` tracking.
- **Session Revocation on Logout:** Calling `POST /api/auth/logout` increments `token_version` on the server, instantly revoking all active sessions for that student across devices.

### 1.2 Course Discovery & Browsing
- **Public Catalog:** Anyone can view published courses without signing in.
- **Filter by Category:** Filter courses by Web Development, Programming, Database, or Computer Science.
- **Filter by Difficulty:** Filter by Beginner, Intermediate, or Advanced levels.
- **Real-Time Search:** Search courses by keyword across title, instructor, and description.
- **Course Metric Cards:** Each course card shows estimated duration, number of modules, total student enrollments, and whether the logged-in student is already enrolled.

### 1.3 Course Enrollment & Curriculum View
- **One-Click Enrollment:** Enrolled in a course with a single click via `POST /api/courses/:id/enroll`.
- **Immediate State Synchronization:** Instant UI update changing "Enroll Now" to "Start Learning" or "Resume Course".
- **Curriculum Outline:** Expands each course into its ordered module list with lesson durations and completion badges.
- **Public & Enrolled Access Separation:** Draft courses are hidden from the public catalog (`404 Not Found`).

### 1.4 Interactive Lesson Learning & Progress Tracking
- **Sequential Curriculum Player:** Lessons are listed in ascending `order_index`.
- **"Mark as Complete" Action:** Students mark lessons as done once finished, triggering instant database recording.
- **Idempotent Progression:** Marking a completed module again returns `{ already_done: true }` without awarding duplicate XP.
- **Animated Progress Bars:** Visual percentage bar showing `(completed_modules / total_modules) * 100%`.

### 1.5 Gamification & Experience Points (XP)
- **Lesson XP:** Awards **+50 XP** immediately upon completing each lesson.
- **Level Scaling:** Level progresses according to the mathematical formula:
  $$\text{Level} = \left\lfloor \frac{\text{XP} + 50}{500} \right\rfloor + 1$$
- **Course Completion Bonus:** When `completed_modules === total_modules`, the platform automatically awards **+200 Bonus XP** with a celebratory milestone notification.

### 1.6 "My Learning" Student Dashboard
- **Active Course Spotlight:** Highlights the student's currently active in-progress course with a primary "Resume Course" action button.
- **Status Filter Tabs:** Filter courses by **All Courses**, **In Progress**, **Completed**, and **Not Started**.
- **Deep-Link Intent:** Clicking "Resume Course" appends `?resume=true`, which automatically smooth-scrolls the student directly to their next incomplete module.
- **Platform Analytics Overview:** Displays total enrolled courses, total completed courses, total lessons completed, and aggregate learning completion rate.

### 1.7 Study Notes & Resource Downloads
- **Course Notes Tab:** Notes attached to a course are displayed in a clean tabbed panel inside the course view.
- **Markdown Viewer Modal:** Read rich-text study notes directly in the browser.
- **Authenticated File Downloads:** Download PDF cheatsheets, PPTX slides, and DOCX notes securely via `/api/notes/:id/download`.
- **Blob Error Handlers:** If an attachment file is missing or corrupted on the server, the frontend safely parses the backend's JSON error response rather than crashing or showing a generic login error.

---

## 2. Academy Owner & Administration (Implemented)

### 2.1 Dual-Gate Owner Authentication
- **Role Guard:** Accounts must have `role === 'owner'` in the TiDB database.
- **Environment Gate:** In addition to role validation, [`ownerMiddleware.js`](../backend/middleware/ownerMiddleware.js) verifies that `req.user.email` strictly equals `process.env.OWNER_EMAIL`.
- **Protected Administrative UI:** Owner routes (`/owner-dashboard`, `/owner-courses`, `/owner-modules`, `/owner-notes`) automatically redirect non-owner accounts to `/dashboard`.

### 2.2 Owner Analytics Dashboard
- **Metric Cards:** Real-time counters for Total Students, Total Enrollments, and Completed Courses.
- **Student Engagement Breakdown:**
  - **Regular:** Active in the last 24 hours.
  - **Less Active:** Active between 1 and 7 days ago.
  - **Inactive:** Inactive for more than 7 days or never logged in.
- **Live Activity Feed:** Streams the 20 most recent student actions across the platform (registrations, logins, course enrollments, module completions).

### 2.3 Student Management Portal
- **Enrolled Students Directory:** View all registered students with their current XP, level, enrolled courses count, and registration date.
- **Student Profile Inspection:** Deep-dive into an individual student's course progression, specific completed modules, and action history.
- **Delete Student Account:** Safeguarded deletion of spam or test accounts via `DELETE /api/owner/students/:id`.

### 2.4 Course Management (CRUD)
- **Course Creation:** Create new courses with title, category, difficulty, duration, description, thumbnail URL, and instructor name. New courses default to `'draft'` status.
- **Course Editing:** Modify any course field with duplicate title prevention.
- **Status Toggle:** Toggle courses between **Draft** and **Published** with instant state reflection.
- **Guarded Course Deletion:** Deletion is strictly blocked if active student enrollments exist (`enrollCount > 0`), ensuring students never lose progress from accidental deletion.

### 2.5 Module Management & Sequence Reordering
- **Add Modules:** Create lessons linked to a course. The system automatically assigns the next sequence number (`COALESCE(MAX(order_index), 0) + 1`).
- **Edit Modules:** Update title and duration while strictly preserving `course_id` and sequence index.
- **Two-Phase Reordering:** Move lessons up or down. The backend executes a two-phase transactional update with negative indexing to avoid unique key collisions (`uq_course_module_order`).
- **Guarded Module Deletion:** If any student has completed a module, deletion is rejected with `HTTP 400` to prevent student progress corruption.

### 2.6 Notes & Resource Management
- **Upload Notes with Attachments:** Upload PDF, DOCX, PPTX, or image files up to 25 MB (or configured `MAX_NOTE_FILE_SIZE_MB`).
- **MIME & Buffer Validation:** File contents are checked for magic numbers before saving.
- **Course & Module Linking:** Link notes to an entire course or associate them with a specific lesson.
- **Draft & Publish Control:** Control note visibility independently from course status.
- **Safe Note Deletion:** Deletes note metadata from the database and cleans up the associated attachment file from storage.

---

## 3. Planned Roadmap Features (Not Yet Implemented)

The following features represent future enhancements and are **not** currently active:

1. **Cloudflare R2 Object Storage Migration:** Transitioning Render backend file attachments from the local ephemeral disk to a dedicated Cloudflare R2 bucket for permanent persistence across restarts.
2. **Interactive In-Browser Code Playground:** Embedded Monaco / CodeMirror editor allowing students to run HTML, CSS, and JavaScript directly in the course page.
3. **Automated Course Completion Certificates:** PDF certificate generation with verification hashes upon completing 100% of a course's curriculum.
4. **Student Community Discussion Forums:** Per-module Q&A thread enabling students to ask questions and receive peer or faculty replies.
5. **Dark Mode UI:** Theme toggle for low-light coding environments.
