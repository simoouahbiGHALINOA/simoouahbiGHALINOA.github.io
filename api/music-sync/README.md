# Shared music on Cloudflare

The site remains available at `https://simoouahbighalinoa.github.io`. GitHub
Pages hosts the static site; the music relay runs separately as a Cloudflare Worker at:

`https://simoouahbighalinoa-github-io.simoouahbi-483.workers.dev`

The Worker serves the `/v1/*` relay API. A SQLite-backed Durable Object stores
room metadata and coordinates live updates. R2 stores uploaded audio files.
Music sharing does **not** use Prisma or MongoDB.

## One-time Cloudflare setup

1. In Cloudflare, create an R2 bucket named `simoouahbi-music-sync` (or run
   `npx wrangler r2 bucket create simoouahbi-music-sync` after logging in).
2. From the repository root, run `npx wrangler login` once, then
   `npm run deploy:music`. Wrangler deploys the relay from `wrangler.jsonc`,
   provisions the `MUSIC_ROOMS` Durable Object binding, and connects the
   `MUSIC_FILES` R2 bucket. GitHub Pages continues to deploy the frontend.
3. Check
   `https://simoouahbighalinoa-github-io.simoouahbi-483.workers.dev/healthz`.
   The relay is ready when this returns HTTP 200 with `{"status":"ok"}`.

The configured `ALLOWED_ORIGINS` contains the exact GitHub Pages origins for
the current music clients. Add any additional client origin there before
deploying. Do not put database credentials in `wrangler.jsonc`.

## GitHub Pages clients

For each other GitHub Pages repository with the music player, add this public
Actions repository variable:

`VITE_MUSIC_SYNC_URL=https://simoouahbighalinoa-github-io.simoouahbi-483.workers.dev`

Then rerun its Pages deployment. The main site defaults to this Worker URL.

## Pairing

On the source site, open **Music library** and select **Create a private code**.
On the other site, paste that code into the field under **Sync music across
clients**, select **Connect this site**, and approve the prompt. Wait for
**Private pairing · connected**. Saved audio URLs and imported audio files then
appear in the shared room. Public playlist tracks are not copied.

Pairing codes are bearer credentials: anyone with a code can listen to or
remove tracks in its room. Share them only with trusted people.

## Free-plan notes

Workers, SQLite-backed Durable Objects, and standard R2 storage have free
allocations, not unlimited usage. Stay within Cloudflare's current limits;
usage over included R2 storage/operations may incur charges. Individual audio
uploads are limited to 100 MB. See the [Workers](https://developers.cloudflare.com/workers/platform/pricing/),
[Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/),
and [R2](https://developers.cloudflare.com/r2/pricing/) pricing pages.

## MongoDB and the Prisma API

The MongoDB/Prisma API is separate from music sync. `api/.env.example` is the
tracked template; `api/.env` is local-only and ignored by Git. The existing
Prisma API is a Node.js server, not a static Pages function. Its private
`DATABASE_URL` belongs in that Node API host's secret settings, never in the
Pages workflow, `VITE_*` variables, or this Worker. Use the MongoDB Prisma
schema and `npm --prefix api run db:push:mongodb`; PostgreSQL is an alternative,
not an additional provider.

The MongoDB password that was pasted into chat must be rotated before use. Do
not paste the replacement into source control or chat. Enter it directly into
the private API host settings after rotation.

For local API development only, `api/.env` has been created as an ignored
template. Fill in the GitHub OAuth values and the rotated MongoDB URI locally.
The tracked template is `api/.env.example`. The music Worker does not read this
file. Do not add a MongoDB URI to GitHub Pages or Cloudflare Worker variables.

To let another GitHub Pages repository build its player against this Worker,
add the public repository Actions variable `VITE_MUSIC_SYNC_URL` with the URL
above. The main repository already defaults to this Worker URL, so this
variable is optional here.
