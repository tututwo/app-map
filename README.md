# Worship Closures

SvelteKit dashboard deployed to Cloudflare Workers. Map archives and metric cubes remain in the
`worship-closures-tiles` R2 bucket, served through the same-origin `/map-assets` route.

## Develop

Use Node.js 22:

```sh
npm ci
npm run dev
```

`npm ci` generates Cloudflare binding types; `predev` compiles the dashboard CSVs. For Vite development, set `PUBLIC_TILES_URL=/tiles` in `.env` and use archives built into
`static/tiles`. Builds do not need Cloudflare credentials. To read the existing R2 data instead,
sign in with `npx wrangler login` and use `npm run preview:worker` after building. The preview
uses a remote, read-only R2 binding; it does not write to the bucket.

## Verify

```sh
npm run check
npm run test:unit
npm run test:contract
```

To run the built app in the actual Workers runtime:

```sh
npm run build
npm run preview:worker
```

## Deploy

```sh
npx wrangler login
npm run deploy
```

The Worker name, account, R2 binding and public settings live in `wrangler.jsonc`. The deployment
command uses `.env.example`, which contains only the public tile path; local secrets are not needed
by this application. Rerun `npm run cf:types` after changing bindings.

`static/.assetsignore` keeps large local map archives out of Workers Static Assets. Publish new R2
data with `scripts/publish-tiles.sh` and `scripts/publish-metrics.sh` before deploying the manifest
that references it. Metrics use release hashes; never overwrite an existing release.

Vercel production hosting is paused and its Git connection is disconnected. The previous project
is retained for reference; future deployments use Cloudflare.
