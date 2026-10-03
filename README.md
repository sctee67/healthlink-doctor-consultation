# HealthLink — Book a Doctor Consultation

Full-stack take-home: browse doctors, book a chat or video consultation, and see upcoming and past consultations.

| Part | Stack |
| --- | --- |
| `frontend/` | Angular 22 (standalone components, signals, reactive forms), SCSS, Vitest |
| `backend/` | Node 20+ · Express 5 · TypeScript · Zod validation · JSON-file storage · Vitest + Supertest |

## Quick start

Requires **Node.js 20+** and npm.

```bash
# 1. API  →  http://localhost:3000/api
cd backend
npm install
npm run dev

# 2. Web app  →  http://localhost:4200  (in a second terminal)
cd frontend
npm install
npm start
```

The Angular dev server proxies `/api` to `localhost:3000` (`frontend/proxy.conf.json`), so no CORS setup is needed.
On first run the API seeds `backend/data/db.json` with doctors and sample consultations. Run `npm run seed:reset` in `backend/` to start fresh.

### Tests

```bash
cd backend  && npm test          # API + domain tests
cd frontend && npx ng test --watch=false
```

## API

All responses use `{ "data": ... }`. Errors use RFC 9457 problem details (`title`, `code`, `status`, `requestId`, and per-field `errors` for validation).

| Method | Route | Notes |
| --- | --- | --- |
| GET | `/api/doctors` | Doctors with live availability (`available_now` / `available_later` / `unavailable`) |
| GET | `/api/doctors/:id` | Single doctor |
| GET | `/api/doctors/:id/slots?date=YYYY-MM-DD` | 30-minute slots within the doctor's hours, marked booked or past |
| POST | `/api/consultations` | Book. Needs an `Idempotency-Key` header (UUID); a retry with the same key replays the original booking and never double-books |
| GET | `/api/consultations?scope=upcoming\|past\|all` | The signed-in patient's consultations |
| GET | `/api/consultations/:id` | Single consultation |
| POST | `/api/consultations/:id/cancel` | Cancel a scheduled consultation |
| GET | `/api/me`, `/api/config`, `/api/health` | Current patient, clinic settings, health check |

The server enforces these booking rules: the slot must be inside the doctor's hours, in the future, within 14 days, and not already taken (`409 SLOT_TAKEN`), and the patient can't hold two consultations at the same time. Consultation status (`scheduled` → `completed`) comes from the clock, so past sessions move to the past tab on their own.

Configuration (environment variables): `PORT` (3000), `CORS_ORIGINS` (`http://localhost:4200`), `DATA_FILE` (`data/db.json`), `STORAGE=memory` (used by tests), `DEFAULT_PATIENT_ID`.

## Design decisions

- **Clinic time zone.** All times are stored in UTC and shown in Malaysia time (UTC+8), so a patient on a device set to another zone still sees the doctor's real schedule.
- **Safe retries.** The booking form creates one idempotency key per attempt, so a double-click or a network retry can't create duplicate bookings.
- **Errors shown where they happen.** A slot conflict clears the chosen time and reloads the slots. Validation errors appear next to their fields. Unexpected errors show a reference ID that can be matched to the server log.
- **Accessibility.** The booking drawer is a focus-trapped dialog that closes with Esc and returns focus to the button that opened it. The page has a skip link, ARIA live toasts and visible focus rings, and animations respect `prefers-reduced-motion`.
- **Authentication is out of scope.** A middleware resolves the patient (`pat_john`). A real auth layer would replace that one place.
- **File storage** writes atomically (temp file, then rename) and serialises writes, which is enough for a single-instance demo. Production would use a database with a unique index on `(doctorId, scheduledAt)`.

## Project layout

```
backend/src
  domain/        models, clinic-time rules, typed errors
  services/      availability, doctor & consultation use-cases
  repositories/  data access over the store
  storage/       JSON file / in-memory store + seed
  http/          routes, Zod schemas, middleware (request id, errors, patient context)
frontend/src/app
  core/          API client, error interceptor, models, time helpers, toasts
  features/consult/  page, store (signals), doctor list, booking drawer, consultation list
  shared/ layout/    icon, avatar, toast outlet, header
```
