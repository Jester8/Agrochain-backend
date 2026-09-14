# AgroChain Backend — Authentication (POC)

A NestJS + PostgreSQL + Redis authentication service for the AgroChain app. This is the first
slice of the backend described in the architecture doc — signup, email verification, login,
password reset, and token refresh. Everything runs on free tiers so you can stand it up and test
the app end-to-end without paying for anything.

## Stack

| Piece | Choice | Free tier |
|---|---|---|
| Language | TypeScript / Node.js | — |
| Framework | NestJS | — |
| Database | PostgreSQL (CockroachDB Serverless) | [CockroachDB Cloud](https://cockroachlabs.cloud) — 10 GiB storage, no auto-pause |
| Cache / OTP store | Redis | [Upstash](https://upstash.com) — 10k commands/day |
| Email (OTP codes) | Resend | [Resend](https://resend.com) — 100 emails/day (optional, see below) |
| Password hashing | argon2id | — |
| Auth tokens | JWT (access + refresh) | — |

## 1. Set up the free-tier services

**CockroachDB Serverless (Postgres)**
1. Go to https://cockroachlabs.cloud and sign up.
2. Create a cluster -> choose **Serverless** (the free plan: 10 GiB storage / 50M request units
   per month, no auto-pause — it stays reachable even if you don't touch it for a week).
3. Click **Connect**, select the SQL user it creates for you, and copy the connection string
   shown (it starts with `postgresql://` — CockroachDB is wire-compatible with Postgres, which is
   why Prisma's `cockroachdb` provider can just point at it).
4. Paste it into `DATABASE_URL` in your `.env`.

**Upstash (Redis)**
1. Go to https://upstash.com and sign up.
2. Create a new Redis database (any region, "Regional" type is fine for a POC).
3. On the database page, copy the **ioredis** connection URL (it starts with `rediss://`).
4. Paste it into `REDIS_URL` in your `.env`.

**Resend (email) — optional for local testing**
- You can skip this entirely while developing: if `RESEND_API_KEY` is left blank, OTP codes are
  printed to the server console (`npm run start:dev` logs) instead of being emailed, so signup,
  login, and password reset all work without sending a single email.
- When you're ready to actually receive OTP emails, sign up at https://resend.com, create an API
  key, and paste it into `RESEND_API_KEY`. Their sandbox sender (`onboarding@resend.dev`) works
  without verifying your own domain — it can only send to the email address you signed up with,
  which is fine for testing.

## 2. Configure and install

`backend/.env` already exists with strong, randomly-generated `JWT_*_SECRET` values — you don't
need to touch those. Open it and paste in your `DATABASE_URL` and `REDIS_URL` from step 1 (they
currently say `REPLACE_WITH_YOUR_...`).

```bash
cd backend
npm install
npx prisma migrate dev --name init   # creates the User / FarmProfile / RefreshToken tables
```

(If you ever need to regenerate a secret: `openssl rand -hex 32`.)

## 3. Run it

```bash
npm run start:dev
```

The server listens on `http://localhost:4000` (override with `PORT` in `.env`). Check it's up:

```bash
curl http://localhost:4000/health
```

## API

All request/response bodies are JSON.

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/signup` | `firstName, lastName, email, phone?, dateOfBirth, password, farmName, farmSizeHectares, primaryCrop, state, lga` | Creates the account (unverified) and sends a 4-digit OTP. |
| POST | `/auth/confirm` | `email, code` | Verifies the OTP, marks the account verified, returns `{ user, accessToken, refreshToken }`. |
| POST | `/auth/resend-otp` | `email, purpose: "signup" \| "password-reset"` | Re-sends the OTP for either flow. |
| POST | `/auth/login` | `email, password` | Returns `{ user, accessToken, refreshToken }`. Fails if the account isn't verified yet. |
| POST | `/auth/forgot-password` | `email` | Sends a password-reset OTP. |
| POST | `/auth/verify-reset-otp` | `email, code` | Verifies the OTP, returns a short-lived `resetToken` (10 min). |
| POST | `/auth/reset-password` | `resetToken, newPassword` | Sets the new password and logs the account out of every device. |
| POST | `/auth/refresh` | `refreshToken` | Rotates the refresh token, returns a new `{ accessToken, refreshToken }` pair. |
| POST | `/auth/logout` | `refreshToken` | Revokes that one session. |
| GET | `/auth/me` | — (send `Authorization: Bearer <accessToken>`) | Returns the current user + farm profile. |

### Example: full signup → verify → login flow

```bash
# 1. Sign up
curl -X POST localhost:4000/auth/signup -H "Content-Type: application/json" -d '{
  "firstName": "John", "lastName": "Doe", "email": "john@example.com",
  "dateOfBirth": "1995-04-12", "password": "secret123",
  "farmName": "Green Valley Farm", "farmSizeHectares": 2.5,
  "primaryCrop": "Maize", "state": "Ogun", "lga": "Abeokuta North"
}'

# 2. Look at the server console for: "OTP for john@example.com (signup): 1234"

# 3. Confirm
curl -X POST localhost:4000/auth/confirm -H "Content-Type: application/json" -d '{
  "email": "john@example.com", "code": "1234"
}'
# -> { "user": {...}, "accessToken": "...", "refreshToken": "..." }

# 4. Log in again later
curl -X POST localhost:4000/auth/login -H "Content-Type: application/json" -d '{
  "email": "john@example.com", "password": "secret123"
}'
```

## How tokens work

- **Access token** (15 min): sent as `Authorization: Bearer <token>` on protected routes.
- **Refresh token** (30 days): stored by the client, exchanged at `/auth/refresh` for a new pair.
  Each refresh token is single-use — the server stores a hash of it and revokes it the moment it's
  used, issuing a fresh one. This means a stolen-and-reused old token is detectable.
- Passwords are hashed with **argon2id**, not bcrypt — the modern default for new builds.
- OTP codes live in Redis with a TTL (`OTP_TTL_SECONDS`, default 10 minutes) and are deleted the
  moment they're used, so they can't be replayed.

## Security

Everything here was chosen with "this will get hit by real bots the moment it's public" in mind,
not just happy-path correctness:

- **Rate limiting** on every route (30 req/min default), with much stricter per-route limits on
  the sensitive ones — `login` (5/min), `signup` (3/min), `forgot-password` (3/min), `resend-otp`
  (3/min). `resend-otp` is limited this tightly on purpose: it's the only way to reset an OTP's
  attempt counter, so it can't itself be spammable.
- **OTP brute-force protection**: a 4-digit code only has 10,000 possible values, so both
  `/auth/confirm` and `/auth/verify-reset-otp` lock the code after 5 wrong guesses and require
  requesting a new one, instead of allowing unlimited guesses within the 10-minute TTL.
- **No account enumeration**: `/auth/forgot-password` always responds `{ success: true }` whether
  or not the email is registered, and `/auth/login` returns the same "incorrect email or password"
  message for both a wrong password and a nonexistent account.
- **One-time password-reset tokens**: the short-lived `resetToken` from `/auth/verify-reset-otp`
  is recorded (hashed) in Redis the moment it's used, so an intercepted token can't be replayed to
  reset the password a second time within its 10-minute window.
- **Password policy**: minimum 8 characters, at least one letter and one number, enforced on both
  signup and reset.
- **Email normalization**: every email is lowercased and trimmed before it touches the database,
  so `John@x.com` and `john@x.com` can't become two different accounts.
- **Security headers** via `helmet`, and **CORS** is wide open in development but requires an
  explicit `CORS_ORIGINS` allowlist once `NODE_ENV=production`.
- **Fail-fast config**: the app refuses to boot if a required secret or connection string is
  missing or too short (see `src/config/validation.schema.ts`), instead of failing confusingly
  the first time a route needs it.
- Rate limiting currently uses in-memory storage, which is correct for the single free-tier
  instance this POC targets but resets on restart and won't work if you scale to multiple
  instances. Swap in a Redis-backed `ThrottlerStorage` before doing that.
- **CockroachDB note**: it can occasionally return a `40001` serialization error under concurrent
  writes to the same rows, instead of just blocking like Postgres does — Prisma surfaces this as a
  regular thrown error. At this POC's traffic level (one user signing up or resetting a password
  at a time) it's very unlikely to come up; if you later see it in practice, wrap the affected
  `$transaction` call in a small retry loop.

## Wiring up the Expo app

The mobile app currently accepts "any credentials" and hardcodes `1234` as the confirmation code
(this was intentional, to unblock UI work before the backend existed). Pointing the app at this
API means replacing those stubs in `agrochain/app/components/auth/*.tsx` with real `fetch`/`axios`
calls to the endpoints above, and storing `accessToken`/`refreshToken` with `expo-secure-store`
(already used for the language preference — see `agrochain/i18n.ts`) instead of the current
`data/session.ts` boolean flag. That wiring is a separate, follow-up piece of work.

## What's deliberately not here yet

Scoped out of this first slice on purpose — add them when the corresponding app feature is ready:
- Harvest/batch logging, QR generation, blockchain anchoring (Polygon)
- Marketplace listings and orders
- Trust score calculation
- Land mapping (PostGIS) — the current `FarmProfile.state`/`lga` fields are enough for signup

See the architecture doc for how those layer on top of this same NestJS app as new modules.
