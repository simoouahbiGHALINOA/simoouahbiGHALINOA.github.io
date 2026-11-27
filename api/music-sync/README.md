# Shared music on Cloudflare

The site remains available at `https://simoouahbighalinoa.github.io`. GitHub
Pages hosts the static site; the music relay runs separately as a Cloudflare Worker at:

`https://simoouahbighalinoa-github-io.simoouahbi-483.workers.dev`

The Worker serves the `/v1/*` relay API. A SQLite-backed Durable Object stores
room metadata, live updates, and uploaded audio in 4 MiB chunks. It does **not**
use R2, Prisma, or MongoDB.

## Free Cloudflare setup

Do **not** activate R2 or authorize its overage billing for this setup. From
the repository root, run `npx wrangler login` once, then `npm run deploy:music`.
Wrangler provisions the SQLite-backed `MUSIC_ROOMS` Durable Object. There is
no R2 bucket or R2 billing binding. GitHub Pages continues to deploy the
frontend.

Check
   `https://simoouahbighalinoa-github-io.simoouahbi-483.workers.dev/healthz`.
   The relay is ready when this returns HTTP 200 with `{"status":"ok"}`.
The Worker root returns a small JSON status message; it is an API endpoint, not
the music website. Open the GitHub Pages site to use the player.

On Cloudflare's Workers Free plan, Durable Objects have free daily operation
limits and 5 GB of SQLite storage per account. Each audio file is limited to
100 MB; total stored audio shares that 5 GB account allowance. Stay on the
Workers Free plan: when free limits are reached, requests can fail until usage
resets or storage is cleared, rather than automatically using paid R2. See
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/),
and [Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/).

The configured `ALLOWED_ORIGINS` contains the exact GitHub Pages origins for
the current ten music clients, plus the localhost origins used by the local
Vite development servers. Add any additional client origin there before deploying.
Do not put database credentials in `wrangler.jsonc`.
Native browser audio downloads may omit the `Origin` header; the Worker permits
those requests only on the paired audio-file endpoint, which still requires
the room and device IDs from the pairing code.

## GitHub Pages clients

Each music client defaults to this Worker URL. To use a different relay, set
this public Actions repository variable and rerun that repository's Pages
deployment:

`VITE_MUSIC_SYNC_URL=https://simoouahbighalinoa-github-io.simoouahbi-483.workers.dev`

Then rerun its Pages deployment. The main site defaults to this Worker URL.

## Pairing

On the source site, open **Music library** and select **Create a private code**.
On the other site, paste that code into **Sync music across clients**, select
**Connect this site**, then confirm in the in-page prompt. Wait for
**Private pairing · connected**. Saved audio URLs and imported audio files are
shared; imported files appear on other sites only after their upload completes.
Each file can be up to 100 MB. Public playlist tracks are not copied.

Pairing codes are bearer credentials: anyone with a code can listen to or
remove tracks in its room. Share them only with trusted people.

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
