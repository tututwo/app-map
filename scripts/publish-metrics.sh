#!/usr/bin/env bash
# Upload the data files built by scripts/build-metrics.py (metrics/) and scripts/build-sdoh.py (sdoh/) to
# the Cloudflare R2 bucket the site reads through PUBLIC_TILES_URL. Maintainer-side only: needs
# `wrangler login` on the owning account.
#
# Usage: scripts/publish-metrics.sh [dir ...]     dirs under static/tiles, e.g. metrics/zcta or sdoh
#                                                 (default: metrics sdoh)
#
# Paths carry the release hash, so an upload never replaces a file a deployed site still reads, every
# object may be cached for good, and running this again is harmless. Publish before deploying the
# manifest that names the new release.
set -uo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root/static/tiles"
dirs=("$@")
[ ${#dirs[@]} -gt 0 ] || dirs=(metrics sdoh)

# IPv4 first: over IPv6, uploads beyond a few MB were reset mid-request (seen 2026-09-18). Even so a
# few requests in a thousand fail on a home connection, hence the retries.
export NODE_OPTIONS="--dns-result-order=ipv4first"
put() {
  for _ in 1 2 3 4; do
    npx --yes wrangler@4 r2 object put "worship-closures-tiles/$1" --file "$1" --remote \
      --content-type application/octet-stream --cache-control "public, max-age=31536000, immutable" \
      >/dev/null 2>&1 && return 0
    sleep 3
  done
  echo "FAILED $1"
}
export -f put

failed=0
for dir in "${dirs[@]}"; do
  misses=$(find "$dir" -type f -name '*.gz' -print0 | xargs -0 -P 4 -n 1 bash -c 'put "$0"')
  echo "$dir: $(find "$dir" -type f -name '*.gz' | wc -l | tr -d ' ') files, $(printf '%s' "$misses" | grep -c FAILED) failed"
  [ -z "$misses" ] || { echo "$misses"; failed=1; }
done
exit $failed
