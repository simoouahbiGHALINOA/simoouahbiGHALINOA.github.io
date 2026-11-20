# Simoouahbi API

This independently named Node.js API serves the anonymous profile-link click counter. The GitHub Pages frontend stays on its existing domain; GitHub Pages cannot host a running Prisma API, so this service must be deployed to a server host.

## Local development

1. Copy `.env.example` to `.env`. MongoDB is preselected; replace the sample `DATABASE_URL` with your MongoDB connection string. To use PostgreSQL instead, set `DATABASE_PROVIDER=postgresql` and use a PostgreSQL connection string.
2. Install dependencies with `npm ci`.
3. Create the counter table/collection:
   - PostgreSQL: `npm run db:push:postgres` for local development, or `npm run db:migrate:postgres` for a deployment using the checked-in migration.
   - MongoDB: `npm run db:push:mongodb`.
4. Start the API with `npm run dev`. It listens on port `8787` by default.
5. Set the frontend's `VITE_API_BASE_URL` to `http://localhost:8787`.

The API supports both database providers, with MongoDB as the default in `.env.example`; one is selected per deployment with `DATABASE_PROVIDER`. Set `ALLOWED_ORIGINS` to a comma-separated list containing the frontend origin, such as `https://simoouahbighalinoa.github.io`. Keep database credentials only in the API host's environment; never put them in Vite variables or GitHub Pages build settings.

## Deployment

Deploy this directory as a Docker service on a host such as Railway. Use `Dockerfile` as the build source, and configure:

- `DATABASE_PROVIDER`: `postgresql` or `mongodb`
- `DATABASE_URL`: the matching private connection string
- `ALLOWED_ORIGINS`: `https://simoouahbighalinoa.github.io`
- `PORT`: supplied by the host, or `8787`

Apply the PostgreSQL migration or push the MongoDB schema before serving traffic. Set the GitHub repository Actions variable `VITE_API_BASE_URL` to the deployed API's HTTPS URL, then redeploy the Pages site. The frontend remains hosted at its GitHub Pages URL.

## Endpoints

- `GET /healthz` checks database availability.
- `GET /api/profile-clicks` returns `{ "count": number }`.
- `POST /api/profile-clicks` atomically increments and returns the aggregate count.

The API stores no GitHub account identifiers or visitor identity.
