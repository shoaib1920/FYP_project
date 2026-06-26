# Final Year Project Documentation
## FYP Management Portal — A Web-Based System for Final Year Project Lifecycle Management

---

## 1. Introduction

### 1.1 Background

Final Year Projects (FYPs) in academic institutions typically involve a long, multi-stage process: proposal submission, supervisor assignment, periodic progress reporting, evaluation, and grading. In most departments this process is still handled manually — through email threads, spreadsheets, physical forms, and in-person meetings — which makes it difficult for students, supervisors, and administrators to track status, maintain accountability, and keep a clear audit trail of decisions and feedback.

This project, the **FYP Management Portal**, was built to digitize and centralize this entire workflow into a single web application, with dedicated interfaces for the three primary stakeholders in the process: **students**, **supervisors**, and **administrators**.

### 1.2 Problem Statement

Departments currently lack a unified system where:
- Students can submit and track the status of their project proposals in real time.
- Supervisors can review proposals, provide feedback, monitor progress, and evaluate completed work.
- Administrators can oversee departments, approve proposals, assign supervisors, and manage the overall academic calendar.

Without such a system, communication is fragmented, feedback is often undocumented, and there is no single source of truth for a project's current status.

### 1.3 Objectives

The system was designed to achieve the following objectives:

1. Provide a secure, role-based portal for students, supervisors, and administrators.
2. Digitize the full proposal lifecycle — submission, review, revision, and approval.
3. Allow supervisors to be assigned to approved proposals and manage their assigned projects.
4. Enable structured, ongoing communication between students and supervisors through weekly progress reports and real-time chat.
5. Provide a mechanism for supervisors to visually review a team's deployed/live project and report specific issues back to the team.
6. Support project evaluation and grading, with administrative oversight before grades are released to students.
7. Maintain a notification system so all parties are kept informed of relevant status changes.

### 1.4 Scope

The system covers the complete academic FYP cycle: account registration (via department join codes), proposal submission and approval, supervisor assignment, team and task management, progress tracking, live-project review, final report submission, grading, and grade release — along with supporting features such as chat, notifications, feedback collection, and a project-template repository.

---

## 2. System Architecture

### 2.1 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (Create React App), React Router |
| Backend | Node.js, Express.js |
| Database | MongoDB (via Mongoose ODM) |
| Real-time communication | Socket.IO |
| Authentication | JSON Web Tokens (JWT), bcryptjs for password hashing |
| File storage | Cloudinary (cloud-based media/document storage) |
| Email | Nodemailer |
| AI integration | Google Gemini API (in-app coding assistant for students) |
| Frontend hosting | Vercel |
| Backend hosting | Render |

The application follows the conventional **MERN stack** architecture (MongoDB, Express, React, Node), structured as two independent deployable units — a React single-page application for the client, and an Express REST API with an embedded Socket.IO server for the backend — communicating over HTTPS.

### 2.2 High-Level Architecture

```
┌─────────────────────┐        HTTPS / WebSocket        ┌──────────────────────┐
│   React Frontend     │ ───────────────────────────────▶│   Express Backend    │
│   (Vercel)            │◀─────────────────────────────── │   (Render)            │
└─────────────────────┘                                  └──────────┬───────────┘
                                                                      │
                                              ┌───────────────────────┼───────────────────────┐
                                              ▼                       ▼                       ▼
                                    ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
                                    │  MongoDB Atlas    │   │   Cloudinary      │   │   Gemini API      │
                                    │  (data storage)    │   │  (file storage)   │   │  (AI assistant)   │
                                    └──────────────────┘   └──────────────────┘   └──────────────────┘
```

### 2.3 Folder Structure

```
PROJECT01/
├── backend/
│   ├── Controllers/      → business logic per domain (Auth, Proposal, Project, Task, etc.)
│   ├── Models/            → Mongoose schemas
│   ├── Routes/            → Express route definitions
│   ├── Middlewares/       → JWT authentication, role authorization, validation
│   ├── utils/              → shared helpers (Cloudinary config, rate limiting, etc.)
│   └── index.js            → application entry point, Socket.IO server setup
└── frontend/
    └── src/
        ├── components/    → one folder per UI feature, each with index.jsx + styles
        └── utils/          → shared frontend helpers
```

### 2.4 Authentication and Authorization

Each of the three roles authenticates independently using a join-code-based registration system:
- Students and supervisors register using a department-issued join code (format: `DEPT-STU-XXXX` / `DEPT-SUP-XXXX`), which automatically associates them with the correct department.
- Administrators register directly, without a join code, and are responsible for department setup.

On login, the server issues a signed JWT (24-hour expiry) which the client stores and attaches to subsequent requests via the `Authorization: Bearer` header. Passwords are hashed using bcryptjs before storage. Supporting flows — forgot-password/reset-password and email verification — are implemented for all three roles using time-limited tokens delivered by email.

---

## 3. Database Design

The system's data model is centered around the following core entities:

| Model | Purpose |
|---|---|
| `Users` | Student accounts |
| `supervisorModel` | Supervisor accounts |
| `Admin_Auth` | Administrator accounts |
| `Department` | Department records, including student/supervisor join codes |
| `Team` | Student teams formed for a project |
| `Proposal` | Project proposal and its review workflow state |
| `Project` | The active project once a proposal is approved and assigned |
| `Task` / `TaskAssignment` | Tasks created within a project and their assignment to team members |
| `ProgressLog` | Weekly progress reports submitted by the team and reviewed by the supervisor |
| `ProjectReviewNote` | Supervisor's annotated screenshots and remarks from reviewing a team's live deployment |
| `MeetingLog` | Scheduled supervisor–team meetings and minutes |
| `Message` / `GroupMessage` | One-to-one and team group chat messages |
| `Notification` | Cross-role notification feed |
| `Template` | Downloadable document templates (proposal formats, report formats, etc.) |
| `Feedback` | General platform feedback submitted by users |
| `AcademicTerm` | Semester/deadline configuration |
| `AIChatMessage` | History for the AI coding-assistant feature |

The **Proposal** model is the entry point of the academic workflow and progresses through a well-defined set of states:

```
PENDING_ADMIN_REVIEW → APPROVED_BY_ADMIN → SUPERVISOR_ASSIGNED →
SUPERVISOR_ACCEPTED  (or)  REVISION_REQUESTED  (or)  REJECTED
```

Once a proposal is accepted by a supervisor, a corresponding **Project** record is created, which then carries its own lifecycle (`ACTIVE` → `IN_PROGRESS` → `UNDER_REVIEW` → `COMPLETED`), independent grading fields, and a final report submission.

---

## 4. Modules and Features

### 4.1 Student Module

- **Dashboard** — overview of task summary, progress charts, and team leaderboard.
- **Proposal Management** — submit a new proposal, track its status, and revise it if the admin or supervisor requests changes.
- **Project & Task Manager** — view assigned projects, create and assign tasks within the team, track per-task completion, and submit the final project report.
- **Weekly Progress Updates** — the team leader submits a structured weekly report (work completed, planned next steps, challenges); the supervisor responds with feedback against each entry.
- **Live Review Notes** — students can view screenshots and pinned issue annotations sent by their supervisor after a live review of the deployed project, and mark them resolved once addressed.
- **Team Chat** — one-to-one messaging with supervisors/admins and group chat with the student's own team, including file/image/video sharing, typing indicators, and read receipts (Socket.IO-based, real time).
- **AI Coding Assistant** — an in-app chat assistant (powered by the Gemini API) for general coding help.
- **Template Library** — download proposal/report templates published by the department or supervisor.
- **Feedback** — submit platform feedback and view aggregated ratings from other users.
- **Notifications** — a real-time notification feed for proposal decisions, progress feedback, and review updates.

### 4.2 Supervisor Module

- **Dashboard** — summary of assigned projects, proposals awaiting decision, and department snapshot.
- **Proposal Review** — accept or request revisions on proposals assigned by the administrator.
- **FYP Projects** — full table of assigned projects with status, progress, GitHub repository and live-deployment links, and final report access.
- **Live Project Review Tool** — a purpose-built feature allowing the supervisor to:
  1. Open a team's live deployment within the portal,
  2. Capture a screenshot of the current view,
  3. Select a specific region of interest,
  4. Pin and annotate exact problem areas with written remarks,
  5. Repeat this across multiple screenshots while continuing to browse the live project,
  6. Submit the entire collected batch — together with an overall revision remark — to the team in a single review session.
- **Weekly Progress Review** — read each team's submitted progress logs and respond with feedback.
- **Grading** — grade and complete a project once its final report has been submitted, with support for administrator-requested re-grading.
- **Review History** — a record of every live-review batch sent for a project, with its resolution status.
- **Department, Template, and Chat tools** — equivalent supervisor-side versions of the department, template, and chat features available to students.

### 4.3 Administrator Module

- **Dashboard** — institution-wide statistics: proposal pipeline, project status breakdown, and items needing attention.
- **Department Management** — create departments and manage their student/supervisor join codes.
- **Proposal Approvals** — first-stage review of all submitted proposals, with the ability to approve, reject, or request revisions, and to assign a supervisor to approved proposals.
- **Grade Approval** — review completed projects' grades before they are released to students, with the ability to flag a project for re-grading.
- **Supervisor and Student Management** — oversight of all registered accounts.
- **Academic Calendar** — configure semester deadlines that drive deadline banners shown to students.
- **Template Manager** — publish global document templates.

---

## 5. Real-Time Communication

The chat system (both one-to-one and team group chat) is implemented using **Socket.IO**, authenticated via the same JWT used for REST requests. The backend maintains a per-user socket registry to support:

- Instant message delivery without polling,
- Online/offline presence and "last seen" timestamps,
- Typing indicators,
- Delivery and read-receipt status,
- Real-time unread-count updates for team group chats.

---

## 6. File Storage

All user-uploaded content — proposal reports, final project reports, project templates, chat attachments, and supervisor review screenshots — is stored on **Cloudinary** rather than the application server's local disk. This was a deliberate architectural decision: local-disk storage does not persist across deployments or restarts on most modern hosting platforms, whereas Cloudinary provides durable, CDN-backed storage independent of the application server's lifecycle.

---

## 7. Security Considerations

- Passwords are never stored in plaintext; bcryptjs is used for one-way hashing.
- All protected API routes require a valid JWT, verified server-side on every request.
- File upload endpoints enforce MIME-type and file-size restrictions appropriate to their purpose (e.g., proposal/report uploads are restricted to PDF).
- Sensitive configuration (database credentials, JWT signing secret, third-party API keys) is supplied through environment variables and is never committed to source control.
- Rate limiting is applied to the AI assistant endpoint to prevent quota exhaustion from a single user.

---

## 8. Deployment

The system is deployed as two independently hosted services:

- **Frontend**: deployed on **Vercel**, built from the `frontend/` directory of the repository. Client-side routing is supported via a static rewrite configuration so that direct navigation to any application route resolves correctly.
- **Backend**: deployed on **Render** as a persistent Node.js web service (required for maintaining open Socket.IO connections, which is not supported on serverless platforms), built from the `backend/` directory.
- **Database**: hosted on **MongoDB Atlas**.
- **File storage**: hosted on **Cloudinary**.

Configuration differences between environments (database connection string, mail credentials, API keys, and the deployed frontend URL for CORS) are managed entirely through environment variables, with no environment-specific code paths.

---

## 9. Testing and Quality Assurance

Testing during development was carried out through manual, scenario-based verification of each workflow — proposal submission through to approval and supervisor assignment, task creation and assignment, progress-log submission and review, the live-review capture-and-annotate flow, and the grading-to-release pipeline — across all three roles, using the running application in a development environment.

---

## 10. Conclusion

The FYP Management Portal consolidates a process that is traditionally scattered across email, spreadsheets, and in-person meetings into a single, role-aware platform. By giving each stakeholder — student, supervisor, and administrator — a dedicated, purpose-built interface, the system creates a clear, traceable record of every decision and piece of feedback exchanged throughout a project's lifecycle, from initial proposal to final grade.

### 10.1 Future Work

Potential extensions to the system include: automated test coverage for backend API behavior, support for multiple co-supervisors per project, and finer-grained role-based authorization across all administrative routes.

---

*Document prepared as part of the Final Year Project submission.*
