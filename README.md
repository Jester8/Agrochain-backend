# AgroChain Backend

The NestJS API behind the AgroChain mobile app and website (agrochain.africa): authentication,
the produce marketplace, the journal, market-board prices and the newsletter waitlist.

## Stack

| Piece | Choice |
|---|---|
| Framework | NestJS 10 (TypeScript) |
| Database | PostgreSQL on **Neon**, via Prisma |
| OTP store | Redis (Upstash) |
| Email | **Brevo** (transactional email + newsletter contacts) |
| Hosting | **Render** (`render.yaml` blueprint) |
| Password hashing | argon2id |
| Auth tokens | JWT access + rotating refresh tokens |

## Local development

Prerequisites: Node 20+, a Postgres database (a Neon dev branch, or local Postgres) and Redis
(Upstash, or `brew install redis`).

```bash
cp .env.example .env     # fill in DATABASE_URL, DIRECT_URL, REDIS_URL and the three JWT secrets
npm install              # also runs `prisma generate`
npx prisma migrate dev   # creates the tables from prisma/migrations
npm run db:seed          # optional: sample listings, journal posts and market prices
npm run start:dev        # http://localhost:4000
```

Without `BREVO_API_KEY`, OTP codes and every other email are printed to the console instead of
being sent, so the full signup / verify / reset flow works with no email setup.

## Deploying (Neon + Render + Brevo)

1. **Neon**: create a project in **AWS eu-central-1 (Frankfurt)**. From *Connect*, copy the
   pooled string (host contains `-pooler`) into `DATABASE_URL` and the direct string into
   `DIRECT_URL`.
2. **Brevo**:
   - Under *Senders, domains & dedicated IPs*, authenticate `agrochain.africa` (DKIM, SPF and
     DMARC), so codes don't land in spam.
   - Create an API key for `BREVO_API_KEY`.
   - Optionally create a "Waitlist" contact list and put its ID in `BREVO_WAITLIST_LIST_ID`.
3. **Render**: *New → Blueprint* → this repo.
   - `render.yaml` creates the `agrochain-api` service.
   - It runs `prisma migrate deploy` before every deploy.
   - It generates the JWT secrets for you.
   - Paste in `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL` and `BREVO_API_KEY` when prompted.
   - Add the custom domain `api.agrochain.africa`.
4. Seed once, if you want the sample content: `DATABASE_URL=... DIRECT_URL=... npm run db:seed`.

### Moving existing users off CockroachDB

The live service previously used CockroachDB. Switching `DATABASE_URL` to Neon starts from an
empty database, so existing accounts must be copied across first:

1. Run `npx prisma migrate deploy` against Neon (it creates the tables).
2. Export `User`, `FarmProfile` and `RefreshToken` from CockroachDB, for example with
   `cockroach sql --format=csv` or `\copy` through psql.
3. Import them into Neon. The new `role`, `state` and `lga` columns on `User` can stay at their
   defaults (`farmer` and null).

Existing password hashes (argon2) keep working as-is.

## API

All bodies are JSON. Protected routes need `Authorization: Bearer <accessToken>`.
Errors look like `{ "statusCode": 400, "message": "..." | ["..."] }`.

### Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/signup` | `firstName, lastName, email, phone?, dateOfBirth, password, role?, state, farmName*, farmSizeHectares*, primaryCrop*, lga*` | `role` is `farmer` (default), `cooperative`, `buyer` or `aggregator`. \*Farm fields are required only for farmers and cooperatives. Sends a 4-digit OTP. |
| POST | `/auth/confirm` | `email, code` | Verifies the OTP and returns `{ user, accessToken, refreshToken }`. |
| POST | `/auth/resend-otp` | `email, purpose: "signup" \| "password-reset"` | |
| POST | `/auth/login` | `email, password` | Returns 403 if the email isn't verified yet. |
| POST | `/auth/forgot-password` | `email` | Always `{ success: true }`. |
| POST | `/auth/verify-reset-otp` | `email, code` | Returns a 10-minute, single-use `resetToken`. |
| POST | `/auth/reset-password` | `resetToken, newPassword` | Logs out every device. |
| POST | `/auth/refresh` | `refreshToken` | Rotates the refresh token. |
| POST | `/auth/logout` | `refreshToken` | |
| GET | `/auth/me` | | The user (with `role`, `state`) and farm profile. |

### Marketplace, journal and waitlist

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/listings` | | Query: `q, category, state, verified, sort (newest\|price-asc\|price-desc), page, limit`. |
| GET | `/listings/:slug` | | |
| POST | `/listings` | Bearer | Farmers, cooperatives and aggregators only. |
| POST | `/listings/:id/offers` | Bearer | `quantity, pricePerUnit, message?`. Emails the seller (or `OPS_EMAIL` for sample listings) and the buyer. |
| GET | `/posts`, `/posts/:slug` | | Journal articles. |
| GET | `/market/prices` | | Market-board ticker. |
| POST | `/waitlist` | | `email, source?`. Adds the contact to Brevo and sends a welcome email. |

## Security

Everything here was chosen with "this will get hit by real bots the moment it's public" in mind,
not just happy-path correctness:

- **Rate limiting** on every route (30 req/min default), with much stricter per-route limits on
  the sensitive ones, `login` (5/min), `signup` (3/min), `forgot-password` (3/min), `resend-otp`
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

## Wiring up the Expo app

The mobile app currently accepts "any credentials" and hardcodes `1234` as the confirmation code
(this was intentional, to unblock UI work before the backend existed). Pointing the app at this
API means replacing those stubs in `agrochain/app/components/auth/*.tsx` with real `fetch`/`axios`
calls to the endpoints above, and storing `accessToken`/`refreshToken` with `expo-secure-store`
(already used for the language preference, see `agrochain/i18n.ts`) instead of the current
`data/session.ts` boolean flag. That wiring is a separate, follow-up piece of work.

## Not built yet

- Harvest/batch logging, QR generation, blockchain anchoring
- Accepting and declining offers, orders and payments
- Trust score calculation
- Land mapping (PostGIS)
