# Worship Closures

SvelteKit dashboard deployed to Cloudflare Workers. Map archives and metric cubes remain in the
`worship-closures-tiles` R2 bucket, served through the same-origin `/map-assets` route.

[Wrangler](https://developers.cloudflare.com/workers/wrangler/) is Cloudflare's command-line tool,
used here by the SvelteKit adapter, deployments, R2 uploads and binding type generation. Keep it as
a development dependency; day-to-day development uses Vite (`npm run dev`).

## Develop

Use Node.js 22:

```sh
npm ci
npm run dev
```

`npm ci` generates Cloudflare binding types; `predev` compiles the dashboard CSVs. For Vite development,
set `PUBLIC_TILES_URL=/tiles` in `.env` and use archives built into `static/tiles`.
Builds and `npm run preview` do not need Cloudflare credentials. To read the existing R2 data instead,
sign in with `npx wrangler login` and use `npm run preview:worker` after building. The preview
uses a remote, read-only R2 binding; it does not write to the bucket.

## Verify

```sh
npm run check
npm run test:unit
npm run test:contract
```

Contract tests use Vite preview and local `static/tiles` data by default. The real R2 delivery test is
skipped in this mode. To run all contracts against the Workers runtime and the existing R2 bucket,
sign in with Wrangler and run `PLAYWRIGHT_WORKER=1 npm run test:contract`. Set
`PLAYWRIGHT_BASE_URL=https://your-site` to target an existing deployment instead.

To inspect the built app in the actual Workers runtime:

```sh
npm run build
npm run preview:worker
```

Add `-- --local` for a runtime smoke test without Cloudflare credentials; its simulated R2 bucket is
empty. Use the npm script so the file-watcher polling workaround is applied: direct `wrangler dev`
can fail with `spawn EBADF` on macOS when watching the generated static payloads.

## Deploy

Cloudflare Workers Builds is configured for `tututwo/app-map`, production branch `main`.
Push commits to `origin/main` to build and deploy; a local commit alone does not trigger a build.
The Cloudflare Workers and Pages GitHub App must have access to this repository.

Build settings: Node.js 22 (`NODE_VERSION=22`), root `/`, build command `npm run build`,
deploy command `npx wrangler deploy --env-file .env.example`. Non-production branch builds
are disabled. Check build status and logs in the Worker's **Deployments** tab.

For a manual deployment:

```sh
npx wrangler login
npm run deploy
```

The Worker name, account, R2 binding and public settings live in `wrangler.jsonc`. The deployment
command uses `.env.example`, which contains only the public tile path; local secrets are not needed
by this application. Rerun `npm run cf:types` after changing bindings.

`static/.assetsignore` keeps large local map archives out of Workers Static Assets. Publish new R2
data with `scripts/publish-tiles.sh` and `scripts/publish-metrics.sh` before deploying the manifest
that references it. These scripts reuse the installed Wrangler version. Metrics use release hashes;
never overwrite an existing release.

After rebuilding metrics with `scripts/build-metrics.py`, generate the place rows and county legends
before publishing or building the app:

```sh
python3 scripts/build-rows.py
python3 scripts/build-county-breaks.py
scripts/publish-metrics.sh
npm run build
```

`rows.bin` is required for place panels; the publisher rejects metric shards missing it. The county
legend fixture in `tests/fixtures` must also be regenerated when its source release changes; see
`tests/unit/county-breaks.test.ts` for its format and provenance.

Vercel production hosting is paused and its Git connection is disconnected. The previous project
is retained for reference; future deployments use Cloudflare.
