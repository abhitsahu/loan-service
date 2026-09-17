# Loan Repayment Service

A full-stack loan repayment management system built with Next.js 15, PostgreSQL (Supabase), Prisma 6, and Firebase Authentication.

---

## Quick Start

```bash
git clone <repo-url>
cd loan-service
npm install

# Copy .env.example, fill in values (see "Environment Variables" below)
cp .env.example .env

# Apply migrations and seed the demo loan
npm run db:setup

# Start the dev server
npm run dev
```

Then open:
```
http://localhost:3000/app
```
This redirects automatically to the seeded demo loan. You can also open `http://localhost:3000/app/docs` to browse the interactive API docs.

---

## Test Command

```bash
npm test
```

Runs **12 unit tests** (no DB required) + **6 integration tests** (require `TEST_DATABASE_URL`).

---

## Database

- **Provider**: Supabase-hosted PostgreSQL
- **Schema ownership**: Prisma (`prisma migrate deploy` — never manual DDL)
- **Two connection strings required**:
  - `DATABASE_URL` — pooled via PgBouncer (port 6543) for runtime
  - `DIRECT_URL` — direct (port 5432) for migrations

---

## API Endpoints

### POST `/api/loans` — Create a loan
```
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{
  "principal": "200000.00",
  "annualInterestRate": "18",
  "tenureMonths": 24,
  "disbursementDate": "2025-09-01"
}
```
→ `201` — returns loan object with `installmentCount`.

### GET `/api/loans/:loanId` — Get schedule + position
```
Authorization: Bearer <firebase-id-token>
?asOf=YYYY-MM-DD   (optional, defaults to today)
```
→ `200` — returns `{ loan, schedule[], position, payments[] }`.

### POST `/api/loans/:loanId/payments` — Record a payment
```
Authorization: Bearer <firebase-id-token>
Idempotency-Key: <uuid>        (optional — server derives one if absent)
Content-Type: application/json

{
  "amount": "9985.99",
  "paymentDate": "2025-10-01",
  "reference": "UPI/1234"       (optional)
}
```
→ `201` — returns `{ payment, allocations[], position }`.

All monetary values are **strings with exactly 2 decimal places** (`"9985.99"`). All dates are `YYYY-MM-DD`.

---

## Money Type

| Layer | Type |
|---|---|
| PostgreSQL | `NUMERIC(14,2)` — exact base-10, no binary rounding |
| Prisma | `Prisma.Decimal` (decimal.js under the hood) |
| JSON over the wire | `string` — e.g. `"9985.99"` — **never a JS number** |

No `float`, `double`, or `real` anywhere in the system.

---

## Allocation & Rounding Decisions

| # | Decision | Choice |
|---|---|---|
| J1 | Money storage | `NUMERIC(14,2)` + `Prisma.Decimal`, JSON as string |
| J2 | Rounding | HALF_UP, 2 dp, rounding remainder on final installment |
| J3 | Due date on short months | Clamp to end of month |
| J4 | Allocation order | Oldest-due-first, then interest → principal |
| J5 | Overpayment | Rolls forward to next installments; no re-amortisation |
| J6 | Surplus beyond full settlement | Held as `unallocatedAmount`, loan CLOSED, no refund |
| J7 | Late payment | No penalty; surfaced as `overdueAmount + daysPastDue + isLate` |
| J8 | Duplicate payments | `Idempotency-Key` header, DB UNIQUE constraint, replay 200 |
| J9 | Zero-interest loan | `EMI = round2(P / n)` |
| J10 | Money over the wire | Strings, not JSON numbers |
| J11 | Payment on closed loan | `409 LOAN_ALREADY_CLOSED` |

---

## Environment Variables

Copy `.env.example` → `.env` and fill in:

```env
# Supabase connection strings
DATABASE_URL="postgresql://...@host:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://...@host:5432/postgres"

# Firebase Web SDK (public — goes to browser)
NEXT_PUBLIC_FIREBASE_API_KEY=""
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=""
NEXT_PUBLIC_FIREBASE_PROJECT_ID=""
NEXT_PUBLIC_FIREBASE_APP_ID=""

# Firebase Admin SDK (server only — NEVER expose)
FIREBASE_PROJECT_ID=""
FIREBASE_CLIENT_EMAIL=""
FIREBASE_PRIVATE_KEY=""   # literal \n for newlines, wrap in quotes

# Integration test DB (direct connection)
TEST_DATABASE_URL=""
```

### Firebase Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → create project
2. **Authentication** → Sign-in methods → enable Email/Password + Google
3. **Project Settings** → Your Apps → Add Web App → copy the 4 `NEXT_PUBLIC_*` values
4. **Project Settings** → Service Accounts → Generate new private key → open the JSON file, copy:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` (whole string including `-----BEGIN...-----END-----`) → `FIREBASE_PRIVATE_KEY` (replace real newlines with `\n`)

---

## Commit History

| # | Commit |
|---|---|
| 1 | `chore: bootstrap Next.js + TypeScript + Vitest` |
| 2 | `feat(db): prisma schema, enums, money as NUMERIC(14,2)` |
| 3 | `feat(db): constraints, indexes, db:setup script, seed` |
| 4 | `feat(service): EMI + schedule generation with final-installment remainder` |
| 5 | `test(unit): schedule generation against the ₹9,986 reference` |
| 6 | `feat(service): payment allocation, oldest-due-first, interest→principal` |
| 7 | `test(unit): underpayment, overpayment, late ordering, invalid input` |
| 8 | `feat(service): loan position, overdue and days-past-due` |
| 9 | `feat(api): model layer — enums, Zod requests, response DTOs, envelope` |
| 10 | `feat(api): POST /api/loans + GET /api/loans/:id` |
| 11 | `feat(auth): Firebase Admin verification guard on all routes` |
| 12 | `feat(api): POST payments with idempotency key` |
| 13 | `test(integration): success, validation failure, unauthenticated` |
| 14 | `feat(ui): auth provider, sign-in/sign-out, schedule table, payment form` |
| 15 | `docs: README with setup, endpoints, allocation and rounding decisions` |
