# Testing — Clinivo (clinicSys)

This project uses **Vitest** in all three packages. React apps also use **React Testing Library**.

## Quick start (all packages)

From the repository root:

```bash
npm test
```

Or run each package:

```bash
cd backend && npm test
cd frontend && npm test
cd admin && npm test
```

## Backend (`backend/`)

| Script | Description |
|--------|-------------|
| `npm test` | Unit tests (fast; no real MongoDB) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report (`coverage/`) |
| `npm run test:integration` | In-memory MongoDB integration smoke/helpers |

### Test environment

- **`backend/.env.test`** — committed test defaults (`JWT_SECRET`, optional `MONGODB_URI` for a dedicated local DB).
- **`backend/test/setup.js`** — loads `.env.test` before every test run.
- **`backend/test/helpers/db.js`** — `connectTestDatabase`, `disconnectTestDatabase`, `clearTestDatabase` (Memory Server by default).

Integration tests live under `backend/test/integration/` and are excluded from the default `npm test` run.

### Writing tests

- Unit / service tests: `**/*.test.js` anywhere under `backend/` (except `scripts/`).
- DB integration tests: `backend/test/integration/**/*.test.js` — use helpers from `test/helpers/db.js`:

```js
import { beforeAll, afterAll, beforeEach } from 'vitest'
import { connectTestDatabase, disconnectTestDatabase, clearTestDatabase } from '../helpers/db.js'

beforeAll(() => connectTestDatabase({ memory: true }))
afterAll(() => disconnectTestDatabase())
beforeEach(() => clearTestDatabase())
```

## Frontend (`frontend/`)

| Script | Description |
|--------|-------------|
| `npm test` | Run once (jsdom + RTL) |
| `npm run test:watch` | Watch mode |

- Config: `frontend/vitest.config.js` (merged with Vite).
- Setup: `frontend/src/test/setup.js` (jest-dom matchers).
- Tests: `frontend/src/**/*.{test,spec}.{js,jsx}`.

## Admin (`admin/`)

Same layout as frontend (`admin/vitest.config.js`, `admin/src/test/setup.js`).

## CI suggestion

```bash
cd backend && npm test && npm run test:integration
cd ../frontend && npm test
cd ../admin && npm test
```

First backend integration run may download the MongoDB Memory Server binary (one-time).
