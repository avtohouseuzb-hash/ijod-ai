# IJOD EDU Live Classroom — Phase 0 foundation

## Product contract

- One student lesson session owns all chat turns, whiteboard events, quiz attempts, and uploaded assets.
- The student never chooses an AI model. The server orchestrates model calls.
- Whiteboard output is a versioned, validated command stream. The browser never executes model-provided HTML, JavaScript, or arbitrary SVG.
- Creating a lesson session does not reserve or spend credits.
- Provider usage is logged separately from user credits. No usage value is guessed when the provider omits it.
- Session data is private to the authenticated student. Parent access must be explicitly scoped to an active parent–student relationship and a separate consented summary policy.

## Phase 0 deliverables

1. Typed domain contracts in `src/lib/edu-live/types.ts`.
2. Safe whiteboard command validation in `src/lib/edu-live/whiteboard-dsl.ts`.
3. Server-side authenticated student context in `src/lib/edu-live/server.ts`.
4. Session create/list/load/pause/complete endpoints under `/api/edu-live/sessions`.
5. PostgreSQL schema, indexes, RLS, and private image storage bucket in migration `20261121190000_edu_live_classroom_foundation.sql`.
6. Multimodal token/session fields added to the shared AI usage recorder.

## API contract

- `POST /api/edu-live/sessions`: creates a guided or voice session for the student's saved grade and chosen subject. Returns `creditsCharged: false`.
- `GET /api/edu-live/sessions`: lists the student's last 25 sessions.
- `GET /api/edu-live/sessions/:sessionId`: loads session metadata, ordered turns, whiteboard events, and quiz attempts.
- `PATCH /api/edu-live/sessions/:sessionId`: changes status to active, paused, completed, or abandoned. Completion records `ended_at`.

All routes verify the Supabase access token and the student's saved EDU role on the server. They query with service role only after ownership is established, and every query is additionally filtered by the current user ID.

## Not implemented in Phase 0

- Realtime voice WebRTC transport.
- AI-generated whiteboard command streaming/playback.
- Quiz authoring and server-side answer evaluation.
- Student image upload/signing route.
- Lesson UI replacement.
- Parent progress dashboards.
- Production migration application.

These are later phases and are intentionally not represented as completed.
