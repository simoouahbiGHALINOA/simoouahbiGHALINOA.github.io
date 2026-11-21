# ECO API

The API serves the static GitHub Pages frontend and stores data with Prisma. MongoDB is the default provider; PostgreSQL remains supported.

## Local setup

1. Copy `api/.env.example` to `api/.env` and set `DATABASE_URL` to your MongoDB connection string.
2. Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_CALLBACK_URL` using a GitHub OAuth App. For local development, set the callback URL to `http://localhost:8787/auth/github/callback`.
3. Set `FRONTEND_URL=http://localhost:5173` and `ALLOWED_ORIGINS=http://localhost:5173`.
4. From the repository root, install the API dependencies if needed, then create the MongoDB collections and indexes:

   ```sh
   npm --prefix api install
   npm --prefix api run db:push:mongodb
   npm --prefix api run dev
   ```

5. In the root `.env` file, set `VITE_API_BASE_URL=http://localhost:8787`, then run the frontend with `npm run dev`.

The OAuth callback URL in the GitHub OAuth App must exactly match `GITHUB_CALLBACK_URL`. Use a separate OAuth App for production if its callback URL differs.

## GitHub registration and sign-in

Open the **Protected users** link in the frontend and choose **Continue with GitHub**. The first successful sign-in creates a user record; subsequent sign-ins update that same record. There is no separate password or registration form.

The API stores the GitHub account ID, username, available profile name/email, avatar URL, and profile URL in MongoDB's `protected_users` collection. It does not store GitHub access tokens. Login sessions are stored in `protected_user_sessions`; only a SHA-256 hash of each random session token is persisted. The browser receives the opaque token in an HTTP-only cookie.

To see a registered user in MongoDB Atlas, open the cluster's **Browse Collections** view, select the database named in `DATABASE_URL`, and open `protected_users`. A record appears after that user's first successful sign-in. Session hashes are in the separate `protected_user_sessions` collection.

The protected-users HTML/JavaScript is necessarily public because the frontend is static. User data is protected by the API session check, not by hiding the page or its source files.

## Production setup

- Host the API on a Node.js service; GitHub Pages only hosts the frontend.
- Configure the API host's `DATABASE_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, `FRONTEND_URL`, and `ALLOWED_ORIGINS` environment variables. Do not put database credentials or the GitHub client secret in frontend variables or source control.
- Set the frontend build variable `VITE_API_BASE_URL` to the API's HTTPS origin.
- Set the GitHub OAuth App callback URL to the API callback endpoint, for example `https://api.example.com/auth/github/callback`.
- For PostgreSQL, set `DATABASE_URL` to a PostgreSQL connection string and run `npm --prefix api run db:migrate:postgres`. MongoDB uses `npm --prefix api run db:push:mongodb`.

Production sign-in uses secure cross-site cookies when the frontend and API are on different sites. Some browsers restrict third-party cookies, so a custom frontend/API domain arrangement under the same site is more reliable than unrelated domains.

## Endpoints

- `GET /healthz` — API health.
- `GET /auth/github` — starts GitHub OAuth.
- `GET /auth/github/callback` — validates OAuth state, upserts the user, and creates a session.
- `GET /api/auth/me` — returns the signed-in profile or `401`.
- `POST /api/auth/logout` — deletes the current session.
- `GET /api/profile-clicks` — returns the existing profile-click counter.
- `POST /api/profile-clicks` — increments the existing profile-click counter.

The browser must make `/api/auth/me` and `/api/auth/logout` requests with credentials enabled. Configure `ALLOWED_ORIGINS` with the exact frontend origin so the API can allow credentialed CORS requests.
