# Re-Wiser: Handoff

This document lets a new chat continue the project without the old conversation. It covers what the product is, the decisions made and why, what is built, what is not, and how the user likes to work.

## 1. Product

Students write notes in Notion and never open them again, so they forget. Re-Wiser connects to a student's Notion, lets them pick which notes to revise, and quizzes them on those notes at growing intervals (spaced repetition) with rising difficulty. Students answer by voice (or by typing).

Flow:

1. The student logs in with Notion (OAuth) and syncs their workspace.
2. They see their Notion folder structure and tick the note pages they want to revise.
3. When a note is due, the app fetches its text from Notion and asks a separate FastAPI server for questions.
4. The student answers by voice or text. The FastAPI server returns scores and feedback.
5. Finishing a quiz moves the note to the next round (later due date, harder questions).

## 2. How the user wants to work

- **The user leads, one step at a time.** Do not generate whole setups or several files unprompted. Ask or wait for the next instruction. They once said: "you will not build the entire setup".
- Prefers short answers, runnable commands, and being told what to look for in test output.
- New to TypeScript on the server. Explain why when asked, but keep it brief.
- Tests with `curl` from the terminal. Dev machine runs **Arch Linux**. Phone is **Android**, running **Expo Go**.
- Wants the shared utils (`ApiError`, `ApiResponse`, `asyncHandler`) used in controllers and middleware.
- `app.ts` holds middleware and routes. `index.ts` checks the database and calls `listen`.
- Ask before assuming. Several earlier assumptions were corrected by the user.

## 3. Stack

| Part | Choice |
|---|---|
| Backend | Node.js, TypeScript, Express 5 |
| Database | Postgres 16 in Docker Compose, Drizzle ORM (`pg` driver) |
| Auth | Notion public OAuth, then our own session JWT (`jose`) |
| Dev runner | `nodemon --watch src --watch .env --ext ts,json --exec tsx src/index.ts` (`npm run dev`) |
| App | React Native with Expo (TypeScript), tested in Expo Go on Android. **Not started.** |
| AI server | A separate FastAPI server (question generation plus fluency model). **Not built; mock it first.** |

## 4. Decisions made (and why)

### Login and security

- **Notion-only login.** No usernames or passwords. Notion's user id is the identity (`users.notionUserId`, unique).
- **Public integration "Re-Wiser"**, installation scope **Any workspace** (cannot be changed after creation). Capabilities: read content, plus read user information (without it, name and email may be missing).
- **Two kinds of token, on purpose.** Notion's access token lets our backend call Notion. It is stored encrypted and never leaves the backend. Our own session JWT (HS256, 30 days, `purpose: 'session'`, `sub` = user id) is what the app sends in `Authorization: Bearer ...`. Verifying it needs no database or Notion call.
- **Encryption:** AES-256-GCM via Node `crypto`, stored as `iv:tag:ciphertext` (base64). `ENCRYPTION_KEY` must decode to exactly 32 bytes. If it is lost or changed, all stored Notion tokens become unreadable.
- **OAuth `state` is a signed, 10-minute JWT**, stateless (nothing stored), and carries the app's return address in an `app_redirect` claim. It proves the state came from our server recently. It is not bound to the browser, so it is weaker than a cookie-bound state (accepted for v1).
- **Return address allow-list** (`src/lib/redirect.ts`): `rewiser://` (value of `APP_SCHEME`) is always allowed. `exp://` (Expo Go) is allowed only outside production and only for localhost or private network hosts. This stops a crafted login link from sending the token to an attacker.
- **Expo Go ignores custom schemes** and uses `exp://<host>:<port>/--/path`, so the app passes its own return URL (`Linking.createURL('login')`) to `/auth/notion?redirect=...`.
- **`requireAuth` is mounted once in `app.ts`.** Routes registered above it (`/health`, `/auth`) are public. Everything below needs a token. Order is the whole rule.
- The token-exchange request was checked against Notion's reference: `POST /v1/oauth/token`, HTTP Basic (`client_id:client_secret`), JSON body with `grant_type`, `code`, `redirect_uri`, header `Notion-Version: 2026-03-11`. `redirect_uri` must be sent because the authorize URL also includes one.
- `owner.user` can be a partial user (only `id`). Only `owner.user.id` is guaranteed, so name, email and avatar default to null.

### Notion data model and sync

- **Notion gives a flat list with parent links, not a folder tree.** We rebuild the tree from parents.
- **Gallery/table/board = a "data source".** Stored as a `notion_items` row with `type = 'database'` and `notionId` = the data source id. Cards have `parent.type = data_source_id`. A gallery's own location comes from `database_parent` (a page, a block, or the workspace). Verified against the user's test workspace.
- **Parent blocks:** when an item's parent is a block (for example content inside a toggle), sync looks the block up and keeps walking up. Cap 10 hops, cached per run, falls back to top level if it fails. (In the test workspace, "Example sub-page" ended up under "Click me to see even more detail" this way.)
- **Sync is manual only.** The student presses a Sync button. There is no automatic sync. Sync uses search only, with no content reads. Pass 1 upserts items, pass 2 sets `parentId` (only where it changed). Trash and archived items are skipped. Items missing from search are deleted only if no revision plan points at them (`staleKept` counts the ones kept). An empty search result deletes nothing. One sync per user at a time (in-memory lock, single process).
- **Gallery titles:** often `(untitled)` in search. Fallbacks are "Untitled" (page) and "Untitled database". The real name ("New database") is on the parent's `child_database` block; reading it costs an extra call and was skipped.
- **Note text is never stored.** Content is fetched from Notion when a quiz is made.
- **Selectable = leaf pages only.** A page with no children in our table. Computed in the tree query, not stored. Galleries and pages with children are folders.
- **"Selected" = has an active `revision_plans` row.** There is no `isSelected` column on items, because sync overwrites that table. Unselecting sets `isActive = false` and keeps the round, so re-selecting resumes. On re-select, `dueAt` is reset only if it already passed.
- **Tree is stored as an adjacency list** (`parentId`) and nested in memory per request. This is intentional. Postgres recursive queries can cover "all descendants" later if needed.

### Quiz and AI server (decided, not built)

- **Difficulty is the single knob.** 1 = recall + explain, 2 = compare, 3 = apply. The FastAPI server picks the styles from difficulty. There is no `type` field.
- **Higher difficulty may go beyond the notes** (but stay within the note's topic). The UI could label such questions "Beyond your notes" (derived from difficulty, no column).
- **Questions must be self-contained** (spoken aloud, student has no text in front of them): one idea, no "in the passage above", topic named in the question. The server may return fewer questions than asked (thin note) or none, and the app must handle that ("not enough content").
- **No `sourceSnippet` and no `expectedAnswer`.** The evaluator judges correctness from general LLM knowledge. Note quality is the student's responsibility. No title or path is sent as extra context.
- **Rounds config** (`src/config/rounds.ts`) holds placeholder values: round 1 after 7 days (difficulty 1), round 2 after 21 days (2), round 3 after 45 days (3). Final intervals will be set from research. Kept in code, not the database.
- **Two evaluation endpoints** on the FastAPI server:
  - `POST /evaluate/audio` (multipart: `audio`, `question`) returns `{ transcript, fluencyScore, correctnessScore, feedback }`. The fluency model needs raw audio (pace, pauses), so the app uploads audio, not a transcript.
  - `POST /evaluate/text` (JSON: `question`, `answer`) returns `{ correctnessScore, feedback }`. No fluency score.
  - Keep fluency and correctness as separate numbers in the UI. Scores are `real`. Suggested range 0 to 1 on both servers (not enforced).
- **Generate contract (proposed):** request `{ noteId, title, content, difficulty, count }`, response `{ questions: [{ id, question, difficulty }] }`. For large notes, send `content` as a list of heading sections instead of one string. Each quiz can cover different sections over the rounds.
- **No audio storage in v1.** Audio goes to the evaluator and is discarded. Only the transcript and scores are saved. An `audioUrl` column can be added later.
- **Regenerating questions:** no hashing. If `notion_items.lastEditedTime` is newer than `quizzes.sourceEditedTime`, the app shows a "Note changed" badge and a Sync button. Pressing it regenerates questions, but only for a quiz with no answers yet. Edits never reset the round.
- **Pre-generate vs on-open:** start with generating a quiz when the student opens it. Pre-generating can come later.
- **Large pages and RAG:** chunk by headings first (no AI needed). RAG fits evaluation better than generation and would need pgvector (the current `postgres:16-alpine` image does not have it). Deferred.

## 5. Database schema (Drizzle, `src/db/schemas/`)

All ids are uuid. Applied with `npx drizzle-kit push` (no migration history; switch to `generate` and `migrate` before production). **Confirm `quizzes`, `questions` and `answers` have been pushed.** Only the first three have been exercised through the API.

| Table | Columns |
|---|---|
| `users` | id, notionUserId (unique), name, email, avatarUrl, notionWorkspaceId, notionWorkspaceName, notionBotId, notionAccessToken (encrypted), notionRefreshToken (encrypted, nullable), createdAt, updatedAt |
| `notion_items` | id, userId, notionId, type (`page` or `database`), title, parentId (self-reference, set null on delete), notionUrl, lastEditedTime, createdAt, updatedAt. Unique (userId, notionId). Index on parentId |
| `revision_plans` | id, userId, itemId (cascade), currentRound (default 1), dueAt, isActive (default true), createdAt, updatedAt. Unique (userId, itemId). Index (userId, isActive, dueAt) |
| `quizzes` | id, planId (cascade), round, difficulty, status (`pending`, `in_progress`, `completed`), sourceEditedTime, createdAt, completedAt. Unique (planId, round) |
| `questions` | id, quizId (cascade), position, question, createdAt. Unique (quizId, position) |
| `answers` | id, questionId (unique, cascade), mode (`audio` or `text`), transcript, correctnessScore, fluencyScore (nullable), feedback (nullable), createdAt |

## 6. Backend structure

```
src/
  index.ts                  db check (select 1), then app.listen
  app.ts                    middleware, routes, central error handler
  config/rounds.ts          round, afterDays, difficulty (placeholders)
  controllers/              auth, items, plans
  routes/                   auth, items, plans
  services/
    auth.service.ts         authorize URL, callback, session JWT
    notion.service.ts       the only file that calls Notion
    sync.service.ts         search, upsert, parents
    tree.service.ts         builds the nested tree from our table
    plan.service.ts         select, unselect, due list
  middleware/auth.middleware.ts
  lib/                      env.ts, crypto.ts, redirect.ts
  utils/                    apiErrors.ts, apiResponse.ts, asynchandler.ts
  types/express.d.ts        adds req.userId
  db/                       index.ts, schemas/
scripts/explore-notion.ts   throwaway script: search, blocks <id>, block <id>, ds <id>
```

Rule: services never know about HTTP. `auth.service` calls `notion.service`, never the reverse. Controllers are thin.

`notion.service` currently has: `buildAuthorizeUrl`, `exchangeCodeForToken`, `searchAll`, `getBlock`, `getTitle`. All read calls take the decrypted access token as an argument and retry on 429 using `Retry-After`.

## 7. HTTP API (all JSON unless noted)

Success: `{ data, message, statusCode, success }`. Errors: `{ success: false, message, errors }`. Protected routes need `Authorization: Bearer <sessionToken>`.

| Route | Auth | Result |
|---|---|---|
| `GET /health` | no | `{ ok: true }` (not wrapped) |
| `GET /auth/notion?redirect=<app url>` | no | 302 to Notion. 400 if the redirect is not allowed |
| `GET /auth/notion/callback` | no | 302 to the app with `?token=<session>` or `?error=access_denied`, `invalid_request` or `login_failed`. No valid `state` gives a plain-text 400 |
| `POST /items/sync` | yes | `{ total, removed, staleKept }`. 409 if already running |
| `GET /items/tree` | yes | `{ tree, totalItems, lastSyncedAt }` |
| `PUT /plans/:itemId` | yes | `{ itemId, isSelected, currentRound, dueAt }`. 400 if not a leaf page |
| `DELETE /plans/:itemId` | yes | same shape, `isSelected: false`. 404 if never selected |
| `GET /plans/due` | yes | `{ plans: [{ planId, itemId, title, notionUrl, currentRound, dueAt, difficulty }] }`, most overdue first |

Tree node: `{ id, title, type, notionUrl, isLeaf, isSelectable, isSelected, children[] }`. `id` is our uuid (use it in `/plans/:itemId`). Siblings are sorted alphabetically. `lastSyncedAt` is null before the first sync (a good signal to show "Sync your notes").

## 8. Environment variables

```
POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_PORT
DATABASE_URL               must use the same user, password and db as above
NOTION_CLIENT_ID
NOTION_CLIENT_SECRET       from the connection's Configuration tab; never commit
NOTION_REDIRECT_URI        http://localhost:3000/auth/notion/callback
ENCRYPTION_KEY             openssl rand -base64 32   (must decode to 32 bytes)
JWT_SECRET                 openssl rand -base64 48
APP_SCHEME                 rewiser
PORT                       3000
```

`.env` is git-ignored (also ignore `tmp/`, which holds raw Notion JSON from the explore script). Keep a `.env.example` with empty values.

## 9. Running it locally

1. `docker compose up -d`, then `npm run dev`.
2. Notion's redirect URI field must contain **only** the URL: `http://localhost:3000/auth/notion/callback`. (An earlier failure came from pasting the whole `.env` line into it.)
3. **Notion rejects IP addresses as redirect URIs**, so a LAN address (`192.168.x.x`) does not work. `localhost` over `http` is accepted.
4. To make the phone's `localhost:3000` reach the laptop, use USB debugging and run `adb reverse tcp:3000 tcp:3000`. Re-run it after unplugging or restarting the phone or adb. On Arch: `sudo pacman -S android-tools`. Check with `adb devices` and `adb reverse --list`. An alternative is a tunnel (ngrok or similar) with an HTTPS redirect URI registered in Notion.
5. The app's backend base URL on the phone is therefore `http://localhost:3000`. This has not yet been exercised from the real app.
6. Login was confirmed working on the phone through this setup. Returning into Expo Go via the `exp://` redirect has not been tested, because the app does not exist yet.

Test workspace (Notion): "Test" with a gallery containing "test 2", a "To Do List" template with a database and cards, and a "People" database. The test user's plan for "test 2" may be left active with a past due date.

## 10. Status

**Done and tested:** Postgres in Docker, all six schemas written, Notion OAuth login, session JWT and `requireAuth`, deep-link redirect with allow-list, sync, tree, select and unselect, due list.

**Not built yet:**

- Reading note content from Notion (`GET /v1/blocks/{id}/children`, paginated at 100, recursive through `has_children`, text from `rich_text[].plain_text`, skip `unsupported`, flatten headings and bullets, possibly into sections). Add to `notion.service`.
- A FastAPI client plus a **mock** of `/generate-questions`, `/evaluate/audio` and `/evaluate/text`.
- Quiz creation (`quizzes` and `questions`), starting or resuming a quiz, submitting answers (audio upload is multipart, so Express needs a parser such as multer), completing a quiz and advancing `currentRound` and `dueAt` per `rounds.ts`, the Sync-and-regenerate button logic.
- `GET /me` (profile for the app; the callback deliberately sends only the token).
- The whole Expo app.

**Proposed app plan (not started):**

1. Expo project, navigation, and an API client that adds the bearer token and handles 401 by logging out.
2. Login screen: `WebBrowser.openAuthSessionAsync(<backend>/auth/notion?redirect=<encoded Linking.createURL('login')>, <same return url>)`, read `token` from the returned URL, store it in `expo-secure-store`.
3. Notes screen: Sync button, folder tree, checkbox only where `isSelectable`, calling PUT and DELETE `/plans/:itemId`.
4. Due list (`GET /plans/due`), then quiz and voice screens.

## 11. Known gaps and risks

- **Notion token refresh is not implemented.** The refresh token is stored. If an access token expires, calls return 401 and the client sees a generic 500. Refresh uses `POST /v1/oauth/token` with `grant_type: 'refresh_token'`.
- **Session JWTs last 30 days and cannot be revoked** one by one (changing `JWT_SECRET` invalidates all). `requireAuth` does not check that the user still exists. The callback puts the token in a URL (a one-time code exchange would be safer).
- **A first-time double select** can race and hit the unique index (500, harmless).
- An invalid or expired OAuth `state` returns a plain 400 page, not an app redirect.
- The in-memory sync lock covers a single server process only.
- A selected page that later gains children stays selected but becomes unselectable (flag it in the UI, do not delete). What quiz it gets is undecided.
- The tree has no pagination (one response). Fine for hundreds of notes.
- `notion_items.type` uses the value `database` for data sources (slightly off naming, kept on purpose).
- Facts taken from Notion's docs may change. The version header is pinned to `2026-03-11`.

## 12. Open decisions

- Final round intervals and difficulty progression (research pending).
- Whether low correctness should repeat a round instead of advancing.
- Pre-generate quizzes vs generate when opened.
- Whether to read gallery names from `child_database` blocks.
- Notification or reminder approach when a note is due.
- When to move from `drizzle-kit push` to migrations, and how to host the backend for real (HTTPS redirect URI, production `NODE_ENV`).
