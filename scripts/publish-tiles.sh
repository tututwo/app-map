#!/usr/bin/env bash
# Upload a boundary archive built by scripts/build-tiles.sh to the Cloudflare R2 bucket the site reads
# through PUBLIC_TILES_URL. Maintainer-side only: needs `wrangler login` on the owning account.
#
# Usage: scripts/publish-tiles.sh [vintage=2010]
#
# One-time bucket setup, already done for worship-closures-tiles on 2026-09-18:
#   wrangler r2 bucket create worship-closures-tiles
#   wrangler r2 bucket cors set worship-closures-tiles --file cors.json   # GET/HEAD from any origin,
#                                         # allowed headers range + if-match, exposed header etag
#   wrangler r2 bucket dev-url enable worship-closures-tiles
set -euo pipefail

vintage=${1:-2010}
root=$(cd "$(dirname "$0")/.." && pwd)
archive="$root/static/tiles/bg-$vintage.pmtiles"

# IPv4 first: over IPv6, uploads beyond a few MB were reset mid-request (seen 2026-09-18).
NODE_OPTIONS="--dns-result-order=ipv4first" npx --yes wrangler@4 r2 object put "worship-closures-tiles/bg-$vintage.pmtiles" \
  --file "$archive" --remote --content-type application/vnd.pmtiles
# R2's ETag is the MD5 of a single-part upload, so this proves the bytes arrived intact.
echo "local md5: $(md5 -q "$archive" 2>/dev/null || md5sum "$archive" | cut -d' ' -f1)"
