# Mobile App Build Brief — FYP Management Portal

You are starting a **new, separate codebase** (a mobile app) that talks to an **existing, already-deployed backend**. You will not modify the backend or the existing React web frontend unless the user explicitly asks. Your job is to build a mobile client that replicates the same theme, design language, information architecture, and business logic as the existing web app, consuming the same REST API and Socket.IO server.

Read this entire document before writing any code — it is the complete spec. Where this document says a behavior is a "quirk" or "inconsistency" in the existing system, treat that as **intentional information about what the backend actually does today**, not something to silently "fix" by guessing a cleaner behavior — the mobile client must interoperate with the backend as it actually is.

---

## 0. What this system is

The **FYP Management Portal** digitizes a university department's Final Year Project (FYP) lifecycle end-to-end:

```
Proposal submission → Admin review/approval → Supervisor assignment →
Supervisor accepts → Team/task management → Weekly progress logs →
Live-deployment review (supervisor annotates screenshots) →
Final report submission → Grading (phases + viva) → Admin releases grades
```

There are **three independent roles/portals**, each with its own signup/login/forgot-password/email-verification flow and its own dashboard:

1. **Student** — works in teams, submits proposals, manages tasks, submits weekly progress logs, chats with supervisor/team, views live-review feedback, submits final report, views grades/viva schedule.
2. **Supervisor** — reviews/accepts proposals assigned by admin, manages assigned projects, reviews weekly progress logs, performs live-deployment reviews (screenshot + annotate), grades projects (phased + viva), schedules meetings.
3. **Admin** — approves proposals, assigns supervisors, manages departments (with join-code generation), approves/releases/flags grades, manages the academic calendar, oversees all accounts, sees department-wide viva schedule.

Students and supervisors register via a **department-issued join code** (format `DEPT-STU-XXXX` / `DEPT-SUP-XXXX`); admins register directly (gated by an env-var signup code) and set up departments themselves.

**Target mobile stack: Flutter (Dart).** This is decided, not a recommendation to reconsider — scaffold a standard Flutter app (`flutter create`), targeting Android first (iOS only if the user later asks). Suggested core packages, all mainstream/actively maintained:
- `http` or `dio` for REST calls (equivalent to the web app's axios usage — keep it just as simple, no elaborate client abstraction)
- `socket_io_client` (the official-compatible Dart client) for the Socket.IO connection in §1
- `flutter_secure_storage` for per-role token storage (see the token-key note below)
- `font_awesome_flutter` for icons — maps near 1:1 onto the web app's `react-icons/fa` usage (see §3 Icons)
- `provider` (or `riverpod` if the user prefers) for the thin bits of cross-screen state that are unavoidable (e.g. "who's logged in") — see §5 for how much state-management machinery is actually appropriate here
- `image_picker` (for the supervisor's live-review screenshot flow) and `file_picker` (for PDF report/template uploads)
- `go_router` for navigation (see §4) — declarative, plays well with auth-gated route redirection

---

## 1. Backend API — how to talk to it

### Base URL and route mounting
**Everything is mounted under a single `/auth` prefix**, regardless of domain — this is a real quirk of the backend (`backend/Routes/AuthRouter.js`, ~490 lines, is the only router that matters; `ProjectRouter.js` exists but is empty/unused). So proposal, project, task, team, chat, grading, etc. endpoints are ALL at `<BASE_URL>/auth/...`, e.g.:
- `POST /auth/student/signup`
- `GET /auth/proposals/student`
- `GET /auth/admin/analytics`

There is no versioned API prefix (no `/api/v1`), no root health-check route.

### Authentication
- JWT-based. On successful login, the server returns a signed token (`process.env.JWT_SECRET`, `HS256` via `jsonwebtoken`). Attach it to every subsequent request as `Authorization: Bearer <token>`.
- **Token payload differs meaningfully by role — do not assume a uniform shape:**
  - Student token: `{ email, _id, studentJoinCode, studentId, role: "student" }`, expires in 24h. This is the *only* role whose token carries a `role` claim.
  - Supervisor token: `{ email, _id, supervisorJoinCode, employeeId }`, expires in 24h. **No `role` claim.**
  - Admin token: `{ _id }` only, expires in 1 day. **No email, no role claim.**
- **Role is resolved server-side by DB lookup, not by trusting the token.** The `authorize(...roles)` middleware takes the `_id` from the verified JWT and checks, in order: is this `_id` a Student? a Supervisor? an Admin? — whichever collection matches (and is in the allowed list) wins. Implication: don't try to decode "who am I" purely from the JWT payload on the mobile side either — trust the `user`/`admin`/etc. object returned by the login response, and store which role you logged in as alongside the token.
- **Not every state-changing endpoint enforces `authorize(role)` — some only check "is this a valid JWT for *any* account" (`authenticate` with no role check), and a few have no auth middleware at all.** This is an existing backend quirk (relies on the web frontend's UI to gate access), not something the mobile app should try to "correct" — just always send the Bearer token you have available, and expect that the backend's own authorization is inconsistent in a few corners (e.g. `/auth/admin/supervisors*`, `/auth/create-project`, `/auth/task/:id` are effectively under-protected server-side).
- There is **no refresh-token mechanism**. When a token expires, the user must log in again — plan your mobile auth state (e.g. a 401-interceptor that routes to the correct role's login screen) accordingly.
- **Store tokens per-role in separate secure-storage slots** (e.g. `flutter_secure_storage` keys `studentToken` / `supervisorToken` / `adminToken`), even though the *web* frontend actually collides Student and Supervisor onto the same `localStorage` key `"token"` (a real bug/quirk in the web app — do not replicate this collision in the mobile app, since a mobile app is far more likely to have a user switch between roles or reinstall).

### Password/email flows (shared across roles)
`POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/check-verification` — all take a `role` field (`"student"` | `"supervisor"` | `"admin"`) in the body to disambiguate which collection to act on.

### Full route reference by domain

> Legend: 🔓 = no auth middleware · 🔑 = `authenticate` only (valid JWT, any role) · 🔒`role` = `authenticate` + `authorize("role")`.

**Auth / signup / login**
- 🔓 `POST /auth/student/signup`, `POST /auth/login` (student)
- 🔓 `POST /auth/supervisor/signup`, `POST /auth/supervisor/login`
- 🔓 `POST /auth/admin_signup` (requires `signupCode` matching an env var), `POST /auth/admin_login`
- 🔓 `POST /auth/verify-student-join-code`, `POST /auth/verify-supervisor-join-code` (pre-signup join-code validation)
- 🔓 `GET /auth/users` (all students), 🔑 `GET /auth/admins`

**Departments**
- 🔒admin CRUD: `POST/GET /auth/admin/department`, `GET/PUT/DELETE /auth/admin/department/:id`, `POST /auth/admin/department/:id/regenerate-student-code`, `.../regenerate-supervisor-code`, `GET /auth/admin/department/:id/stats`
- 🔑 `GET /auth/department/:departmentId`, `GET /auth/supervisor/departments`, `GET /auth/supervisor/my-department`

**Teams**
- 🔑 `POST /auth/create-team`, `GET /auth/my-teams`, `PUT /auth/teams/:teamId/invites/respond`, `POST /auth/teams/:teamId/invites` (invite more members), `DELETE /auth/teams/:teamId/invites/:studentId`, `DELETE /auth/teams/:teamId/members/:memberId`
- 🔓 `GET /auth/teams` (all teams)
- Team invite flow: a student is added to `pendingInvites` first, and only moves into `members` after they respond via `PUT /invites/respond`.

**Proposals** (state machine — see §2 Models)
- 🔑 `POST /auth/proposals/submit` (multipart, field `proposalReport`, PDF only, 10MB max), `POST /auth/proposals/analyze-quality` (🔒student, AI quality pre-check), `PUT /auth/proposals/:proposalId` (multipart resubmit), `GET /auth/proposals/student`, `GET /auth/proposals/team/:teamId`, `GET /auth/proposals/admin`, `GET /auth/proposals/supervisor`, `GET /auth/proposals/:proposalId`
- 🔒admin: `PUT /auth/proposals/:proposalId/status` (approve/reject/request revision), `PUT /auth/proposals/:proposalId/assign-supervisor`
- 🔒supervisor: `PUT /auth/proposals/:proposalId/decision` (accept / request revision)

**Projects** (spawned when a proposal is accepted)
- 🔑 `GET /auth/my-viva` (student's own viva — also opportunistically fires viva reminder notifications, see §4), 🔒supervisor `GET /auth/supervisor/schedule` (upcoming vivas+meetings), 🔒admin `GET /auth/admin/viva-schedule` (department-wide upcoming vivas)
- 🔑 `GET /auth/projects/team/:teamId` (also opportunistically fires final-submission-deadline reminders, see §4), `GET /auth/projects/supervisor`, `GET /auth/projects/:projectId`, `PUT /auth/projects/:projectId/details`, `PUT /auth/projects/:projectId/progress`
- 🔑 `PUT /auth/projects/:projectId/final-report` (multipart, field `finalReport`, PDF, 20MB max — triggers server-side AI report-quality **and** AI-generated-content analysis, see §2's `reportQualityCheck`; also deletes any previously-uploaded final report file from disk so resubmissions don't leave orphaned files)
- 🔒supervisor: `POST /auth/projects/:projectId/analyze-report` (re-run the AI check on demand), `PUT /auth/projects/:projectId/complete`, `PUT /auth/projects/:projectId/regrade`, `PUT /auth/projects/:projectId/grade-phase`, `PUT /auth/projects/:projectId/grade-draft`
- 🔒supervisor `PUT /auth/projects/:projectId/reject-final-report` — body `{ reason }` (required, free text). Only valid while `status === "UNDER_REVIEW"`. Sends the submission back to the team: resets `status` to `IN_PROGRESS`, clears `finalReportUrl`/`reportQualityCheck` (deleting the old file from disk), records `finalReportRejection: { reason, rejectedAt }`, and notifies the team. This is the only "undo a final report submission" mechanism — there's no student-facing withdraw button.
- 🔑 `PUT /auth/projects/:projectId/request-appeal` (student appeals a released grade)
- 🔒admin grading/viva: `GET /auth/admin/projects`, `GET /auth/admin/projects/grades`, `PUT /auth/admin/projects/:projectId/release-grades`, `.../flag-grades`, `.../resolve-appeal`, `.../schedule-viva`, `.../grade-viva`

**Tasks (in-team task board)** — 🔓 all: `POST/PUT/DELETE /auth/task[/:id]`, `GET /auth/tasks`, `POST /auth/assigntask`, `GET /auth/assigned-tasks`, `GET /auth/Myassigned-tasks`, `GET /auth/Otherassigned-tasks`, `PUT/DELETE /auth/assigntask/:id`, `POST /auth/approve-task/:id`, `POST /auth/reject-task/:id`. 🔑 `GET /auth/student-project/:userId`.

**Dashboard aggregates** — 🔓 `GET /auth/dashboard/task-summary`, `.../task-progress`, `.../leaderboard`, `.../recent-tasks`

**Templates** — 🔑 `POST /auth/templates/global` and `POST /auth/templates/project` (multipart, field `template`, any file type), `GET /auth/templates/global`, `GET /auth/templates/project/:fypProjectId`, `GET /auth/templates/supervisor`, `GET /auth/templates/admin`, `DELETE /auth/templates/:id`

**Notifications** — 🔑 `GET /auth/notifications`, `PUT /auth/notifications/all/read`, `DELETE /auth/notifications/all/clear`, `PUT /auth/notifications/:notificationId/read`, `DELETE /auth/notifications/:notificationId`

**Chat (1:1)** — 🔑 `POST /auth/messages/send`, `GET /auth/messages/:receiverId`, `PUT /auth/messages/read/:senderId`, `POST /auth/messages/upload` (multipart, field `file`, 50MB max), `POST /auth/users/status` (bulk online/offline check). 🔓 `GET /auth/chat-senders/:userId`.
**Chat (team group)** — 🔑 `GET /auth/group-chats`, `GET /auth/group-chats/:teamId/messages`

**Chat (department-wide)** — one all-hands room per department; students/supervisors auto-belong to their own department's room, **admin auto-belongs to every department's room** (the `Admin` model isn't scoped to one department, so admin oversees/moderates all of them). Anyone can post freely by default.
- 🔑 `GET /auth/department-chat/my-departments` — which department chat(s) this user belongs to (one entry for student/supervisor, all departments for admin)
- 🔑 `GET /auth/department-chat/:departmentId/messages`
- 🔒admin `GET /auth/admin/department-chat/:departmentId/members` — every student/supervisor in that department plus their current muted/excluded flags
- 🔒admin `PUT /auth/admin/department-chat/:departmentId/{mute,unmute,exclude,restore}/:userId` — moderation: **muted** = can still read, can't post (enforced server-side on every send, not just hidden client-side); **excluded** = no access at all (403 on history fetch, can't join the socket room)

**Progress logs** — 🔑 `POST /auth/progress-logs`, `GET /auth/progress-logs/:projectId`, `PUT /auth/progress-logs/:logId/review`

**Live review notes** (supervisor screenshot-annotate workflow) — 🔒supervisor `POST /auth/review-notes` (multipart, field `screenshots`, up to 20 images, 8MB/file), 🔑 `GET /auth/review-notes/:projectId`, 🔒student `PUT /auth/review-notes/:noteId/resolve`

**Meetings** — 🔒supervisor `POST /auth/meetings`, `PUT /auth/meetings/:meetingId/minutes`, `PUT /auth/meetings/:meetingId/status`. 🔑 `GET /auth/meetings/:projectId`.

**Academic terms** — 🔑 CRUD at `/auth/admin/academic-terms[/:id]`, `PUT .../:id/activate`, 🔑 `GET /auth/academic-terms/current` (drives deadline banners)

**Audit logs / Analytics (admin only)** — 🔒admin `GET /auth/admin/audit-logs`, `.../audit-logs/actions`, `GET /auth/admin/analytics`

**AI chat assistant** — 🔑 `POST /auth/ai/chat`, `GET /auth/ai/history`, `DELETE /auth/ai/history` (rate-limited server-side)

**Feedback** — 🔓 `POST /auth/Feedback/submit`, `GET /auth/Feedback/list`

### File uploads
All uploads are `multipart/form-data`; the backend stores them on **local disk** (`backend/uploads/...`) and serves them back at `<BASE_URL>/uploads/<path>` via static file serving — despite older project documentation mentioning Cloudinary, the code as it exists today has **no Cloudinary integration at all** (no dependency, no references). Build the mobile app against the real behavior: uploaded file URLs come back as relative paths that need the API origin prefixed, and there's no CDN — availability depends on the backend server's own uptime/disk.

| Field name | Used by | Type restriction | Size limit |
|---|---|---|---|
| `proposalReport` | proposal submit/update | PDF only | 10MB |
| `finalReport` | final report submit | PDF only | 20MB |
| `screenshots` (array, max 20) | live review notes | image/* only | 8MB/file |
| `file` | chat upload | none enforced | 50MB |
| `template` | template upload | none enforced | — |

Pre-validate mime type/size client-side before uploading — server-side rejection surfaces as a generic error, not a clean message.

### Real-time (Socket.IO)
Connect with `io(BASE_URL, { auth: { token: <same JWT as Bearer header> } })`. No custom namespaces; one room per team (`team_${teamId}`) **and one room per department (`dept_${departmentId}`)**, both auto-joined on connect (department rooms: one for student/supervisor, every department's room for admin — see the department-chat routes above).

Emit: `send_message` `{receiverId, message, fileUrl?, fileName?, fileSize?, fileType?, tempId}`, `mark_read` `{senderId}`, `typing`/`stop_typing` `{receiverId}`, `send_group_message` `{teamId, senderName, senderRole, message, ...}`, `mark_group_read` `{teamId}`, `group_typing`/`group_stop_typing` `{teamId, senderName}`, `send_dept_message` `{departmentId, senderName, senderRole, message, fileUrl?, fileName?, fileSize?, fileType?, tempId}`, `mark_dept_read` `{departmentId}`, `dept_typing`/`dept_stop_typing` `{departmentId, senderName}`.

Listen for: `user_status` `{userId, status, lastSeen?}`, `online_users` `[userId...]`, `message_sent`, `receive_message`, `message_status_update`, `messages_read` `{by}`, `user_typing`/`user_stop_typing` `{senderId}`, `receive_group_message`, `group_messages_read` `{teamId, by}`, `group_user_typing`/`group_user_stop_typing`, `receive_dept_message`, `dept_messages_read` `{departmentId, by}`, `dept_user_typing`/`dept_user_stop_typing`, `dept_message_rejected` `{departmentId, tempId, reason}` (fires instead of `receive_dept_message` when the sender is muted/excluded — show `reason` to the user, don't just silently drop it), **and `new_notification`** — the full `Notification` document, pushed the instant any backend action creates one for a currently-connected user (proposal decisions, grade releases, viva/deadline reminders, team invites, final-report rejection, etc.). Notifications are otherwise only fetchable via `GET /auth/notifications` (poll-based) — this socket event is what makes them feel instant instead of "check back after reloading."

Presence (`onlineUsers`) is in-memory on the server — it resets on backend restarts. Use the HTTP fallback (`POST /auth/users/status`, `GET /auth/messages/:receiverId` auto-marks-read, `GET /auth/notifications` poll) for cases where the socket isn't connected (e.g. app backgrounded), matching what the web app does.

---

## 2. Data model — key entities and their state machines

Mirror these exactly; a mobile client that invents its own status strings will desync from the backend.

**Proposal.status** (state machine): `PENDING_ADMIN_REVIEW → APPROVED_BY_ADMIN → SUPERVISOR_ASSIGNED → SUPERVISOR_ACCEPTED` (or `REVISION_REQUESTED_BY_ADMIN` / `REVISION_REQUESTED_BY_SUPERVISOR` / `REJECTED`).

**Project.status**: `ACTIVE | IN_PROGRESS | ON_HOLD | UNDER_REVIEW | COMPLETED | CANCELLED`

**Project.gradesStatus**: `PENDING_RELEASE | RELEASED | FLAGGED`

**Project.gradeAppeal.status**: `NONE | REQUESTED | ACCEPTED | REJECTED`

**Project.evaluationPhases[].phase**: `INTERNAL` (20%) / `MIDTERM` (20%) / `FINAL` (60%), each with its own `status: PENDING | SUBMITTED`, `memberGrades`, `rubricScores`.

**Project.vivaDetails.status**: `SCHEDULED | GRADED`; `mode`: `IN_PERSON | ONLINE`. Overall final mark = `supervisorMarks * 0.6 + vivaMarks * 0.4` (hardcoded weighting).

**Project.reportQualityCheck**: `{ score, issues[], suggestions[], originalityConcerns[], aiGenerated: { likelihoodScore, flaggedPassages: [{text, reason}] }, checkedAt }` — an AI (OpenRouter) second-opinion on the submitted final report, shown to the supervisor. `aiGenerated.likelihoodScore` (0-100) and `flaggedPassages` are a **heuristic judgment call from a general chat model, not a certified plagiarism/AI-detector database** — surface this as an advisory flag ("review before raising it with the student"), never as a verdict or something that auto-blocks a submission.

**Project.finalReportRejection**: `{ reason, rejectedAt }` — set when a supervisor rejects a submitted final report (see the `reject-final-report` route above); a snapshot of only the *most recent* rejection, not a history log.

**`Project.finalDeadlineRemindersSent`** / **`Team.proposalDeadlineRemindersSent`**: `[Number]` arrays tracking which day-thresholds (3, 1) have already fired for the final-submission and proposal deadlines respectively — same lazy piggy-backed pattern as `vivaDetails.remindersSent`, not a cron job.

**`Department.mutedMembers`** / **`excludedMembers`**: `[ObjectId]` (untyped — a member may be in the `users` or `Supervisor` collection) — see the department-chat moderation routes above.

**ProgressLog.status**: `PENDING | REVIEWED` (weekly report awaiting/has supervisor feedback)

**ProjectReviewNote.status**: `OPEN | RESOLVED` — each note has `items[]`, each item a `screenshotUrl` + `annotations[]` of `{x, y, text}` (x/y are 0-100 percentage coordinates over the screenshot, for pin placement)

**MeetingLog.status**: `SCHEDULED | COMPLETED | CANCELLED`

**Supervisor.status**: `Active | Inactive` (inactive supervisors are blocked at login)

**Notification.relatedType**: free-text, observed values `"TeamInvite"`, `"project"`, `"proposal"` — treat as opaque, don't assume exhaustiveness.

**TaskAssignment.role**: `Developer | Moderator | Admin | Tester | Designer`
**TaskAssignment.status**: `Pending | In Progress | Completed | Approved | Rejected`

---

## 3. Design system — replicate this visual language exactly

The web app (React + CSS Modules, no Tailwind — these are hand-copied Tailwind-default hex values) has a very consistent, hand-built design language. Translate these into a Flutter `ThemeData`/`ColorScheme` plus a shared `AppColors`/`AppRadii`/`AppShadows` constants class (a single `theme.dart`), so every widget pulls from the same source instead of hardcoding hex values per screen.

### Color palette

```dart
class AppColors {
  // Primary blue (brand color — hero gradients, primary buttons, links, active nav states)
  static const primary900 = Color(0xFF1E3A8A);
  static const primary800 = Color(0xFF1E40AF); // gradient start
  static const primary700 = Color(0xFF1D4ED8); // badge text on light-blue bg
  static const primary600 = Color(0xFF2563EB); // gradient mid / primary action — THE brand color
  static const primary500 = Color(0xFF3B82F6); // gradient end / focus rings
  static const primary400 = Color(0xFF60A5FA); // active sidebar/tab icon
  static const primary100 = Color(0xFFDBEAFE); // hover/pressed tint
  static const primary50  = Color(0xFFEFF6FF); // chip/badge background

  // Success / green
  static const success800 = Color(0xFF065F46);
  static const success700 = Color(0xFF15803D);
  static const success600 = Color(0xFF059669);
  static const successBg      = Color(0xFFD1FAE5);
  static const successBgAlt   = Color(0xFFDCFCE7);
  static const successBgLight = Color(0xFFF0FDF4);

  // Warning / amber
  static const warning800 = Color(0xFF92400E);
  static const warning700 = Color(0xFFB45309);
  static const warningTextOrange = Color(0xFFC2410C);
  static const warningBg       = Color(0xFFFEF3C7);
  static const warningBgAlt    = Color(0xFFFFFBEB);
  static const warningBgOrange = Color(0xFFFFF7ED);

  // Danger / red
  static const danger800 = Color(0xFF991B1B);
  static const danger700 = Color(0xFFB91C1C);
  static const danger600 = Color(0xFFDC2626);
  static const danger500 = Color(0xFFEF4444);
  static const dangerBg     = Color(0xFFFEE2E2);
  static const dangerBgAlt  = Color(0xFFFEF2F2);
  static const dangerBorder = Color(0xFFFECACA);

  // Neutrals / slate (text, borders, backgrounds)
  static const gray900 = Color(0xFF111827);
  static const gray800 = Color(0xFF1F2937);
  static const gray700 = Color(0xFF374151);
  static const gray600 = Color(0xFF4B5563);
  static const gray500 = Color(0xFF6B7280);
  static const gray400 = Color(0xFF9CA3AF);
  static const gray300 = Color(0xFFD1D5DB);
  static const gray200 = Color(0xFFE5E7EB); // ← most common border color
  static const gray100 = Color(0xFFF3F4F6);
  static const gray50  = Color(0xFFF9FAFB);
  static const slateText        = Color(0xFF475569);
  static const slateMuted       = Color(0xFF64748B);
  static const slatePlaceholder = Color(0xFF94A3B8);
  static const pageBg = Color(0xFFF8FAFC); // ← standard page background (alt: 0xFFF4F7FA)

  static const white = Color(0xFFFFFFFF);

  // Dark navy — sidebar (Admin/Supervisor) and top navbar (Student) chrome, ALL THREE roles
  static const navyStart = Color(0xFF0F1B3D);
  static const navyEnd   = Color(0xFF111827);
}
```

Status badge convention (light tint bg + dark saturated text of the same hue):
```dart
class StatusColors {
  static const pending   = (bg: Color(0xFFFFF7ED), text: Color(0xFFC2410C));
  static const completed = (bg: Color(0xFFEFF6FF), text: Color(0xFF1D4ED8));
  static const approved  = (bg: Color(0xFFF0FDF4), text: Color(0xFF15803D));
  static const rejected  = (bg: Color(0xFFFEF2F2), text: Color(0xFFB91C1C));
}
```

### Typography
Primary stack: `'Segoe UI', Arial, sans-serif`. Code/join-code display: `'Consolas', 'Courier New', monospace`. On mobile, use the platform system font (San Francisco / Roboto) as the closest equivalent, or bundle "Segoe UI"-adjacent (e.g. `Inter`) if exact parity matters.

Font sizes observed: 11-12.5px (badges/meta), 13-14px (body), 15-17px (section titles), 22-24px/weight 800 (hero headings), fractional sizes like `12.5px`/`13.5px` are common (not a strict scale). The web app also applies a sitewide `zoom: 1.08` on `<body>` as a blunt "make everything slightly less cramped" pass (since every module hardcodes its own px values with no root-relative sizing to bump instead) — **don't try to replicate this on mobile**; it's a web-only rendering hack. Just pick comfortably-sized text per the scale above directly in your Flutter theme, and let the OS's own text-scaling/accessibility settings work normally (don't hardcode a multiplier the way the web app had to).

### Spacing & radii
- Page padding: `28px 26px` (or `32px 28px`)
- Card internal padding: `16-22px`
- Gap scale: `8, 10, 12, 14, 16, 18px` (informal, not strict 4/8pt grid)
- Border radius: `9-10px` buttons/inputs · `12-14px` cards/stat-tiles · `16-18px` hero banners/modals · `50%` avatars/icon circles · `999px`/pill badges

### Shadows / elevation
```dart
class AppShadows {
  static const card = [
    BoxShadow(color: Color(0x0D000000), blurRadius: 10, offset: Offset(0, 3)),
  ];
  static const cardHover = [
    BoxShadow(color: Color(0x14000000), blurRadius: 16, offset: Offset(0, 6)),
  ];
  static const hero = [ // colored, matches brand blue
    BoxShadow(color: Color(0x472563EB), blurRadius: 32, offset: Offset(0, 8)),
  ];
  static const modal = [
    BoxShadow(color: Color(0x33000000), blurRadius: 25, offset: Offset(0, 10)),
  ];
  static const sidebar = [
    BoxShadow(color: Color(0x2E000000), blurRadius: 16, offset: Offset(3, 0)),
  ];
}
```
Use these as `BoxDecoration(boxShadow: ...)` on `Container`s rather than Material `elevation` where you need the exact colored/soft look above — plain `elevation` on `Card`/`Material` gives a flatter, grayer default shadow that won't match the brand-blue-tinted hero shadow. Keep the same relative hierarchy (page cards lightest, hero/nav chrome heaviest).

### Icons
**react-icons/fa (Font Awesome) is used exclusively** everywhere except the 3 `Feedbacks` screens, which use `lucide-react`. For mobile, use the `font_awesome_flutter` package's `FontAwesomeIcons` set to match icon-for-icon (e.g. `FaHome`→`FontAwesomeIcons.house`, `FaUserGraduate`→`FontAwesomeIcons.userGraduate`, `FaSignOutAlt`→`FontAwesomeIcons.rightFromBracket`, `FaComments`→`FontAwesomeIcons.comments`, `FaBell`/`FaBellSlash`→`FontAwesomeIcons.bell`/`FontAwesomeIcons.bellSlash`, `FaCalendarCheck`→`FontAwesomeIcons.calendarCheck`, `FaClock`→`FontAwesomeIcons.clock`, `FaMapMarkerAlt`→`FontAwesomeIcons.locationDot`, `FaVideo`→`FontAwesomeIcons.video`, `FaUserTie`→`FontAwesomeIcons.userTie`, `FaProjectDiagram`→`FontAwesomeIcons.diagramProject`, `FaStar`→`FontAwesomeIcons.star`, `FaClipboardCheck`→`FontAwesomeIcons.clipboardCheck`, `FaBuilding`→`FontAwesomeIcons.building`, `FaShieldAlt`→`FontAwesomeIcons.shield`). Note Font Awesome 6 (which this package ships) renamed several icons from the `react-icons/fa` (FA4/5-based) names above — double check each one against the package's icon browser rather than assuming the name maps literally.

### Recurring components to rebuild as shared mobile primitives

1. **Hero banner** — top-of-screen card with the blue gradient (`135deg, #1e40af 0%, #2563eb 60%, #3b82f6 100%`), rounded `18px`, white heading (22-24px/800) + translucent white subheading, an avatar/icon chip on the left, and (where applicable) a notification bell in the top-right corner (absolute-positioned over the gradient, see below).
2. **Stat card grid** — white rounded (`14px`) cards in a wrap/grid, each with a colored icon chip (semantic color per stat), a small gray label, and a large bold number. Translate the CSS grid (`repeat(auto-fit, minmax(200px,1fr))`) into a `Wrap`/`GridView` that wraps responsively.
3. **Status badge/pill** — small pill (`border-radius: 20px` or `999px`), tinted background + saturated text per the status-color map above.
4. **"View All" modal pattern** — a compact inline list (top N items or items within a day/count window) plus a dashed "View All (N)" button that opens a full modal/bottom-sheet reusing the *exact same item row widget* as the inline list — this pattern is used for schedules (viva/meetings) and should carry over as a `showModalBottomSheet` on mobile.
5. **Notification bell** — circular translucent button (only meaningful over the colored hero gradient) with a small red badge showing unread count, opening a dropdown/panel; unread rows tinted `#eff6ff` with a small blue dot indicator. On mobile this likely becomes an `AppBar` action icon opening a `showModalBottomSheet` or a slide-over panel.
6. **Sidebar/tab navigation** — **all three roles share the same navy gradient chrome** (`#0f1b3d → #111827`), just oriented differently on web (vertical sidebar for Admin/Supervisor, horizontal top navbar for Student). Active nav item: `rgba(37,99,235,0.18)` background + a blue accent border + `#60a5fa` icon tint; inactive: `#cbd5e1` muted text. On mobile, this maps naturally to a **bottom `NavigationBar`/`BottomNavigationBar` per role** (or a `Drawer` for roles with many modules, e.g. Admin) using the same navy background + blue-accent-active styling — this is a strong, literal cross-role brand element worth preserving pixel-for-pixel in spirit.
7. **Loading state** — spinning ring (`border-top-color: #3b82f6` on a `#e5e7eb` ring) + 3 staggered bouncing dots + "Loading…" gray text; reusable as a shared `<Loader />`.
8. **Form inputs** — rounded (`10px`), light gray background (`#fafafa`) that turns white + gets a blue focus ring (`box-shadow: 0 0 0 3px rgba(37,99,235,0.15)`, border `#3b82f6`) on focus; left-aligned icon inside the field; error banners `#fee2e2` bg / `#991b1b` text.
9. **Buttons** — primary = blue gradient (`135deg, #2563eb, #1e40af`) with white text and a soft blue shadow; secondary = flat gray (`#f3f4f6`/`#374151`); "tinted" light-action buttons per semantic color (view=blue tint, approve=green tint, reject=red tint); disabled = `opacity: 0.55-0.6`.

---

## 4. Screen/navigation map (per role)

Translate the web app's flat, state-driven "module switching within one shell" pattern into proper mobile navigation (`go_router` with a `StatefulShellRoute` per role — bottom-tab or drawer branches, each with its own nested `Navigator` stack for detail screens/modals) — do not literally replicate the web's ad-hoc `activeModule` state switching; that was a web-specific shortcut, not something to preserve for its own sake. Gate the three role-specific route branches behind a `redirect` that checks the relevant secure-storage token, mirroring (but centralizing, unlike the web app — see §5) the per-role auth check.

**Student** modules → Dashboard (stats, team, leaderboard), Proposal (submit/track), Project & Tasks (task board, progress logs, live-review notes, final report, deployment links), Team Chat + Department Chat + 1:1 chat (all under one "Chats" section — department chat shows as an entry in the "Groups" list, named after the department, not a separate tab, see below), AI Assistant, Templates, Feedback, Notifications, Viva banner (shown contextually on Dashboard/Project when a viva is scheduled).

**Supervisor** modules → Dashboard, Proposal Review, FYP Projects (table with status/progress/links; a "Reject Submission" action with a required-reason modal appears on any project currently `UNDER_REVIEW`, next to the AI report-quality/AI-generated-content badges), Live Project Review tool (open live deployment → screenshot → select region → annotate → repeat → submit batch), Weekly Progress Review, Grading (phased + viva), Upcoming Schedule (vivas + meetings, 3-day inline window + "View All"), Department Chat (in the Groups list), Templates/1:1 Chat.

**Admin** modules → Dashboard (institution stats + "needs attention" queue), Department Management (create + join-code regeneration), Proposal Approvals, Grade Approval (release/flag), Supervisor/Student management, Academic Calendar, Template Manager, Upcoming Vivas (department-wide, same 3-day-window + "View All" pattern as Supervisor's widget), Department Chat for every department (admin's "Groups" list — not a separate "Departments" tab) with a **member-moderation panel** (mute/unmute, exclude/restore) opened from within each department's chat.

**Auth screens** (×3 roles, same shape each time): Login, Signup (join-code field for student/supervisor), Forgot Password, Reset Password, Verify Email, Verify-Pending ("check your inbox").

**UI convention worth copying exactly**: don't give department chat its own separate tab — the web app tried that, and it looked bolted-on/unpolished. It now lives as just another entry inside the existing "Groups" tab (listed above team groups), labeled with the department's own name. Do the same on mobile — one unified "Groups" list mixing team groups and the department-wide chat, not a 3rd tab.

**Notable feature — advance-warning reminders**: the backend fires reminder notifications at 3-days-out and 1-day-out thresholds for three different deadlines, all piggy-backed lazily on whichever relevant endpoint loads first (no server cron job) — the mobile app doesn't need to implement any of this logic, just render the resulting `Notification` documents (which now also arrive in real time over the socket, see §1):
- **Viva Reminder** — to the student team + supervisor + all admins, via `GET /my-viva` / `GET /supervisor/schedule` / `GET /admin/viva-schedule`.
- **Proposal Deadline Reminder** — to any team without an accepted proposal yet, via `GET /proposals/student`.
- **Final Submission Deadline Reminder** — to the team + supervisor for any project not yet submitted, via `GET /projects/team/:teamId`.

---

## 5. Explicit non-goals / things NOT to replicate

- Don't collide Student and Supervisor tokens onto one storage key — that's a bug in the web app, not a design decision.
- Don't reach for `bloc`/heavy `riverpod` code-generation setups just because "that's more standard for Flutter" — match the existing app's simplicity (`StatefulWidget` + local `setState`, plain `http`/`dio` calls per screen, no repository/DI framework) unless the user asks for more architecture. A thin `provider` for "current logged-in user/role" is the one piece of shared state that's actually justified, per §0.
- Don't assume Cloudinary — uploaded files are plain disk-backed URLs relative to the API origin.
- Don't try to "fix" the inconsistent server-side route authorization (some mutating routes lack `authorize()` or any auth at all) from the mobile side beyond always sending the token you have; that's a backend-side concern out of scope for this app.
- Don't add a versioned `/api/v1` prefix or assume one exists — it's `/auth/*` for everything, flat.

---

## 6. What to do first in the new session

1. `flutter create` the project, add the packages listed in §0, and confirm the backend's live base URL with the user (get the actual API origin — do not guess a domain).
2. Scaffold navigation: a role-selector landing screen → three auth flows (Student/Supervisor/Admin) → three post-login `StatefulShellRoute` navigators matching §4.
3. Build the shared design-system primitives from §3 first (`theme.dart` with `AppColors`/`AppShadows`, a `Loader` widget, `StatusBadge`, `HeroBanner`, `StatCard`, `PrimaryButton`) before building individual screens, so every screen after that stays visually consistent by construction.
4. Implement auth (login/signup/token storage per §1) before any data screens, since virtually everything requires a Bearer token.
5. Build one role fully (recommend Student first, since it's the most feature-complete on web) before starting the other two, reusing the shared primitives.
