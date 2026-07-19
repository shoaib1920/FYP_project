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

**Recommended mobile stack**: React Native (Expo) — it lets you reuse the same mental model as the existing React/CSS-Modules web frontend (component-per-screen, plain `useState`/`useEffect`, no Redux) and the same JS/JSON contracts with the backend. This is a recommendation, not a hard requirement — confirm with the user if they want Flutter or native instead before scaffolding.

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
- **Store tokens per-role in separate secure-storage slots** (e.g. `expo-secure-store` keys `studentToken` / `supervisorToken` / `adminToken`), even though the *web* frontend actually collides Student and Supervisor onto the same `localStorage` key `"token"` (a real bug/quirk in the web app — do not replicate this collision in the mobile app, since a mobile app is far more likely to have a user switch between roles or reinstall).

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
- 🔑 `GET /auth/projects/team/:teamId`, `GET /auth/projects/supervisor`, `GET /auth/projects/:projectId`, `PUT /auth/projects/:projectId/details`, `PUT /auth/projects/:projectId/progress`
- 🔑 `PUT /auth/projects/:projectId/final-report` (multipart, field `finalReport`, PDF, 20MB max — triggers server-side AI report-quality analysis)
- 🔒supervisor: `POST /auth/projects/:projectId/analyze-report`, `PUT /auth/projects/:projectId/complete`, `PUT /auth/projects/:projectId/regrade`, `PUT /auth/projects/:projectId/grade-phase`, `PUT /auth/projects/:projectId/grade-draft`
- 🔑 `PUT /auth/projects/:projectId/request-appeal` (student appeals a released grade)
- 🔒admin grading/viva: `GET /auth/admin/projects`, `GET /auth/admin/projects/grades`, `PUT /auth/admin/projects/:projectId/release-grades`, `.../flag-grades`, `.../resolve-appeal`, `.../schedule-viva`, `.../grade-viva`

**Tasks (in-team task board)** — 🔓 all: `POST/PUT/DELETE /auth/task[/:id]`, `GET /auth/tasks`, `POST /auth/assigntask`, `GET /auth/assigned-tasks`, `GET /auth/Myassigned-tasks`, `GET /auth/Otherassigned-tasks`, `PUT/DELETE /auth/assigntask/:id`, `POST /auth/approve-task/:id`, `POST /auth/reject-task/:id`. 🔑 `GET /auth/student-project/:userId`.

**Dashboard aggregates** — 🔓 `GET /auth/dashboard/task-summary`, `.../task-progress`, `.../leaderboard`, `.../recent-tasks`

**Templates** — 🔑 `POST /auth/templates/global` and `POST /auth/templates/project` (multipart, field `template`, any file type), `GET /auth/templates/global`, `GET /auth/templates/project/:fypProjectId`, `GET /auth/templates/supervisor`, `GET /auth/templates/admin`, `DELETE /auth/templates/:id`

**Notifications** — 🔑 `GET /auth/notifications`, `PUT /auth/notifications/all/read`, `DELETE /auth/notifications/all/clear`, `PUT /auth/notifications/:notificationId/read`, `DELETE /auth/notifications/:notificationId`

**Chat (1:1)** — 🔑 `POST /auth/messages/send`, `GET /auth/messages/:receiverId`, `PUT /auth/messages/read/:senderId`, `POST /auth/messages/upload` (multipart, field `file`, 50MB max), `POST /auth/users/status` (bulk online/offline check). 🔓 `GET /auth/chat-senders/:userId`.
**Chat (team group)** — 🔑 `GET /auth/group-chats`, `GET /auth/group-chats/:teamId/messages`

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
Connect with `io(BASE_URL, { auth: { token: <same JWT as Bearer header> } })`. No custom namespaces; one room per team (`team_${teamId}`), auto-joined on connect.

Emit: `send_message` `{receiverId, message, fileUrl?, fileName?, fileSize?, fileType?, tempId}`, `mark_read` `{senderId}`, `typing`/`stop_typing` `{receiverId}`, `send_group_message` `{teamId, senderName, senderRole, message, ...}`, `mark_group_read` `{teamId}`, `group_typing`/`group_stop_typing` `{teamId, senderName}`.

Listen for: `user_status` `{userId, status, lastSeen?}`, `online_users` `[userId...]`, `message_sent`, `receive_message`, `message_status_update`, `messages_read` `{by}`, `user_typing`/`user_stop_typing` `{senderId}`, `receive_group_message`, `group_messages_read` `{teamId, by}`, `group_user_typing`/`group_user_stop_typing`.

Presence (`onlineUsers`) is in-memory on the server — it resets on backend restarts. Use the HTTP fallback (`POST /auth/users/status`, `GET /auth/messages/:receiverId` auto-marks-read) for cases where the socket isn't connected (e.g. app backgrounded), matching what the web app does.

---

## 2. Data model — key entities and their state machines

Mirror these exactly; a mobile client that invents its own status strings will desync from the backend.

**Proposal.status** (state machine): `PENDING_ADMIN_REVIEW → APPROVED_BY_ADMIN → SUPERVISOR_ASSIGNED → SUPERVISOR_ACCEPTED` (or `REVISION_REQUESTED_BY_ADMIN` / `REVISION_REQUESTED_BY_SUPERVISOR` / `REJECTED`).

**Project.status**: `ACTIVE | IN_PROGRESS | ON_HOLD | UNDER_REVIEW | COMPLETED | CANCELLED`

**Project.gradesStatus**: `PENDING_RELEASE | RELEASED | FLAGGED`

**Project.gradeAppeal.status**: `NONE | REQUESTED | ACCEPTED | REJECTED`

**Project.evaluationPhases[].phase**: `INTERNAL` (20%) / `MIDTERM` (20%) / `FINAL` (60%), each with its own `status: PENDING | SUBMITTED`, `memberGrades`, `rubricScores`.

**Project.vivaDetails.status**: `SCHEDULED | GRADED`; `mode`: `IN_PERSON | ONLINE`. Overall final mark = `supervisorMarks * 0.6 + vivaMarks * 0.4` (hardcoded weighting).

**ProgressLog.status**: `PENDING | REVIEWED` (weekly report awaiting/has supervisor feedback)

**ProjectReviewNote.status**: `OPEN | RESOLVED` — each note has `items[]`, each item a `screenshotUrl` + `annotations[]` of `{x, y, text}` (x/y are 0-100 percentage coordinates over the screenshot, for pin placement)

**MeetingLog.status**: `SCHEDULED | COMPLETED | CANCELLED`

**Supervisor.status**: `Active | Inactive` (inactive supervisors are blocked at login)

**Notification.relatedType**: free-text, observed values `"TeamInvite"`, `"project"`, `"proposal"` — treat as opaque, don't assume exhaustiveness.

**TaskAssignment.role**: `Developer | Moderator | Admin | Tester | Designer`
**TaskAssignment.status**: `Pending | In Progress | Completed | Approved | Rejected`

---

## 3. Design system — replicate this visual language exactly

The web app (React + CSS Modules, no Tailwind — these are hand-copied Tailwind-default hex values) has a very consistent, hand-built design language. Translate these into your mobile styling system (e.g. a shared `theme.js`/`theme.ts` constants file, or NativeWind if you want literal Tailwind class parity).

### Color palette

```js
const colors = {
  // Primary blue (brand color — hero gradients, primary buttons, links, active nav states)
  primary900: "#1e3a8a",
  primary800: "#1e40af",   // gradient start
  primary700: "#1d4ed8",   // badge text on light-blue bg
  primary600: "#2563eb",   // gradient mid / primary action color — THE brand color
  primary500: "#3b82f6",   // gradient end / focus rings
  primary400: "#60a5fa",   // active sidebar icon
  primary100: "#dbeafe",   // hover tint
  primary50:  "#eff6ff",   // chip/badge background

  // Success / green
  success800: "#065f46", success700: "#15803d", success600: "#059669",
  successBg:  "#d1fae5", successBgAlt: "#dcfce7", successBgLight: "#f0fdf4",

  // Warning / amber
  warning800: "#92400e", warning700: "#b45309", warningTextOrange: "#c2410c",
  warningBg: "#fef3c7", warningBgAlt: "#fffbeb", warningBgOrange: "#fff7ed",

  // Danger / red
  danger800: "#991b1b", danger700: "#b91c1c", danger600: "#dc2626", danger500: "#ef4444",
  dangerBg: "#fee2e2", dangerBgAlt: "#fef2f2", dangerBorder: "#fecaca",

  // Neutrals / slate (text, borders, backgrounds)
  gray900: "#111827", gray800: "#1f2937", gray700: "#374151",
  gray600: "#4b5563", gray500: "#6b7280", gray400: "#9ca3af",
  gray300: "#d1d5db", gray200: "#e5e7eb",   // ← most common border color
  gray100: "#f3f4f6", gray50:  "#f9fafb",
  slateText: "#475569", slateMuted: "#64748b", slatePlaceholder: "#94a3b8",
  pageBg: "#f8fafc",    // ← standard page background (alt: "#f4f7fa")

  white: "#ffffff",

  // Dark navy — sidebar (Admin/Supervisor) and top navbar (Student) chrome, ALL THREE roles
  navyStart: "#0f1b3d",
  navyEnd:   "#111827",
};
```

Status badge convention (light tint bg + dark saturated text of the same hue):
```js
const statusColors = {
  pending:   { bg: "#fff7ed", text: "#c2410c" },
  completed: { bg: "#eff6ff", text: "#1d4ed8" },
  approved:  { bg: "#f0fdf4", text: "#15803d" },
  rejected:  { bg: "#fef2f2", text: "#b91c1c" },
};
```

### Typography
Primary stack: `'Segoe UI', Arial, sans-serif`. Code/join-code display: `'Consolas', 'Courier New', monospace`. On mobile, use the platform system font (San Francisco / Roboto) as the closest equivalent, or bundle "Segoe UI"-adjacent (e.g. `Inter`) if exact parity matters.

Font sizes observed: 11-12.5px (badges/meta), 13-14px (body), 15-17px (section titles), 22-24px/weight 800 (hero headings), fractional sizes like `12.5px`/`13.5px` are common (not a strict scale).

### Spacing & radii
- Page padding: `28px 26px` (or `32px 28px`)
- Card internal padding: `16-22px`
- Gap scale: `8, 10, 12, 14, 16, 18px` (informal, not strict 4/8pt grid)
- Border radius: `9-10px` buttons/inputs · `12-14px` cards/stat-tiles · `16-18px` hero banners/modals · `50%` avatars/icon circles · `999px`/pill badges

### Shadows / elevation
```js
const shadows = {
  card:       "0 3px 10px rgba(0,0,0,0.05)",
  cardHover:  "0 6px 16px rgba(0,0,0,0.08)",
  hero:       "0 8px 32px rgba(37,99,235,0.28)",   // colored, matches brand blue
  modal:      "0 10px 25px rgba(0,0,0,0.2)",
  sidebar:    "3px 0 16px rgba(0,0,0,0.18)",
};
```
Translate to React Native `elevation` (Android) / `shadowColor`+`shadowOpacity`+`shadowRadius` (iOS), keeping the same relative hierarchy (page cards lightest, hero/nav chrome heaviest).

### Icons
**react-icons/fa (Font Awesome) is used exclusively** everywhere except the 3 `Feedbacks` screens, which use `lucide-react`. For mobile, use `@expo/vector-icons`'s `FontAwesome`/`FontAwesome5` set to match icon-for-icon (e.g. `FaHome`→`home`, `FaUserGraduate`→`user-graduate`, `FaSignOutAlt`→`sign-out-alt`, `FaComments`→`comments`, `FaBell`→`bell`/`bell-slash`, `FaCalendarCheck`→`calendar-check`, `FaClock`→`clock`, `FaMapMarkerAlt`→`map-marker-alt`, `FaVideo`→`video`, `FaUserTie`→`user-tie`, `FaProjectDiagram`→`project-diagram`, `FaStar`→`star`, `FaClipboardCheck`→`clipboard-check`, `FaBuilding`→`building`, `FaShieldAlt`→`shield-alt`).

### Recurring components to rebuild as shared mobile primitives

1. **Hero banner** — top-of-screen card with the blue gradient (`135deg, #1e40af 0%, #2563eb 60%, #3b82f6 100%`), rounded `18px`, white heading (22-24px/800) + translucent white subheading, an avatar/icon chip on the left, and (where applicable) a notification bell in the top-right corner (absolute-positioned over the gradient, see below).
2. **Stat card grid** — white rounded (`14px`) cards in a wrap/grid, each with a colored icon chip (semantic color per stat), a small gray label, and a large bold number. Translate the CSS grid (`repeat(auto-fit, minmax(200px,1fr))`) into a `FlatList`/`flexWrap` row that wraps responsively.
3. **Status badge/pill** — small pill (`border-radius: 20px` or `999px`), tinted background + saturated text per the status-color map above.
4. **"View All" modal pattern** — a compact inline list (top N items or items within a day/count window) plus a dashed "View All (N)" button that opens a full-screen modal/bottom-sheet reusing the *exact same item row component* as the inline list — this pattern is used for schedules (viva/meetings) and should carry over as a bottom-sheet on mobile.
5. **Notification bell** — circular translucent button (only meaningful over the colored hero gradient) with a small red badge showing unread count, opening a dropdown/panel; unread rows tinted `#eff6ff` with a small blue dot indicator. On mobile this likely becomes a header-right icon button opening a modal/sheet.
6. **Sidebar/tab navigation** — **all three roles share the same navy gradient chrome** (`#0f1b3d → #111827`), just oriented differently on web (vertical sidebar for Admin/Supervisor, horizontal top navbar for Student). Active nav item: `rgba(37,99,235,0.18)` background + a blue accent border + `#60a5fa` icon tint; inactive: `#cbd5e1` muted text. On mobile, this maps naturally to a **bottom tab bar per role** (or a drawer for roles with many modules, e.g. Admin) using the same navy background + blue-accent-active styling — this is a strong, literal cross-role brand element worth preserving pixel-for-pixel in spirit.
7. **Loading state** — spinning ring (`border-top-color: #3b82f6` on a `#e5e7eb` ring) + 3 staggered bouncing dots + "Loading…" gray text; reusable as a shared `<Loader />`.
8. **Form inputs** — rounded (`10px`), light gray background (`#fafafa`) that turns white + gets a blue focus ring (`box-shadow: 0 0 0 3px rgba(37,99,235,0.15)`, border `#3b82f6`) on focus; left-aligned icon inside the field; error banners `#fee2e2` bg / `#991b1b` text.
9. **Buttons** — primary = blue gradient (`135deg, #2563eb, #1e40af`) with white text and a soft blue shadow; secondary = flat gray (`#f3f4f6`/`#374151`); "tinted" light-action buttons per semantic color (view=blue tint, approve=green tint, reject=red tint); disabled = `opacity: 0.55-0.6`.

---

## 4. Screen/navigation map (per role)

Translate the web app's flat, state-driven "module switching within one shell" pattern into proper mobile navigation (React Navigation: a bottom-tab or drawer navigator per role, with stack navigators inside each tab for detail screens/modals) — do not literally replicate the web's ad-hoc `activeModule` state switching; that was a web-specific shortcut, not something to preserve for its own sake.

**Student** modules → Dashboard (stats, team, leaderboard), Proposal (submit/track), Project & Tasks (task board, progress logs, live-review notes, final report, deployment links), Team Chat + 1:1 chat, AI Assistant, Templates, Feedback, Notifications, Viva banner (shown contextually on Dashboard/Project when a viva is scheduled).

**Supervisor** modules → Dashboard, Proposal Review, FYP Projects (table with status/progress/links), Live Project Review tool (open live deployment → screenshot → select region → annotate → repeat → submit batch), Weekly Progress Review, Grading (phased + viva), Upcoming Schedule (vivas + meetings, 3-day inline window + "View All"), Department/Templates/Chat.

**Admin** modules → Dashboard (institution stats + "needs attention" queue), Department Management (create + join-code regeneration), Proposal Approvals, Grade Approval (release/flag), Supervisor/Student management, Academic Calendar, Template Manager, Upcoming Vivas (department-wide, same 3-day-window + "View All" pattern as Supervisor's widget).

**Auth screens** (×3 roles, same shape each time): Login, Signup (join-code field for student/supervisor), Forgot Password, Reset Password, Verify Email, Verify-Pending ("check your inbox").

**Notable feature — viva reminders**: the backend fires a "Viva Reminder" notification at 3-days-out and 1-day-out thresholds to the student team + supervisor + all admins, piggy-backed lazily on whichever role's schedule/viva endpoint loads first (no server cron job). The mobile app doesn't need to implement this logic itself — just render `Notification` documents and the `vivaDetails` countdown the same way the web app's `VivaBanner`/`UpcomingSchedule`/`UpcomingVivas` widgets do.

---

## 5. Explicit non-goals / things NOT to replicate

- Don't collide Student and Supervisor tokens onto one storage key — that's a bug in the web app, not a design decision.
- Don't invent a Redux/Context/React-Query state layer just because "that's more standard for mobile" — match the existing app's simplicity (local state + direct axios calls) unless the user asks for more architecture.
- Don't assume Cloudinary — uploaded files are plain disk-backed URLs relative to the API origin.
- Don't try to "fix" the inconsistent server-side route authorization (some mutating routes lack `authorize()` or any auth at all) from the mobile side beyond always sending the token you have; that's a backend-side concern out of scope for this app.
- Don't add a versioned `/api/v1` prefix or assume one exists — it's `/auth/*` for everything, flat.

---

## 6. What to do first in the new session

1. Confirm the target framework (default recommendation: React Native + Expo) and confirm the backend's live base URL with the user (get the actual API origin — do not guess a domain).
2. Scaffold navigation: a role-selector landing screen → three auth stacks (Student/Supervisor/Admin) → three post-login tab/drawer navigators matching §4.
3. Build the shared design-system primitives from §3 first (colors/theme constants, `<Loader>`, `<StatusBadge>`, `<HeroBanner>`, `<StatCard>`, `<PrimaryButton>`) before building individual screens, so every screen after that stays visually consistent by construction.
4. Implement auth (login/signup/token storage per §1) before any data screens, since virtually everything requires a Bearer token.
5. Build one role fully (recommend Student first, since it's the most feature-complete on web) before starting the other two, reusing the shared primitives.
