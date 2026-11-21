# IJOD EDU Live Classroom — Step 1: student sessions

## Implemented API

- `POST /api/edu-live/sessions` creates a guided or voice session.
- `GET /api/edu-live/sessions` lists up to 30 sessions owned by the student.
- `GET /api/edu-live/sessions/:sessionId` reads one owned session.
- `PATCH /api/edu-live/sessions/:sessionId` pauses, resumes, completes, or abandons an owned session.

## Security guarantees

- Supabase access token is verified on the server.
- Student role and grade come from the saved `edu_user_roles` row.
- A request cannot set or impersonate another student's grade or user ID.
- All session reads/updates filter by both session ID and authenticated user ID.
- Creating a lesson session does not reserve or deduct credits.

## Not part of this step

No Live Classroom UI, AI generation, voice transport, or whiteboard renderer is connected yet. Those will be added in separate build-checked steps.
