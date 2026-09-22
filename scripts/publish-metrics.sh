#!/usr/bin/env bash
# Upload files built by build-metrics.py (metrics/), build-sdoh.py (sdoh/) and build-map-slices.py (map/) to
# the Cloudflare R2 bucket the site reads through PUBLIC_TILES_URL. Maintainer-side only: needs
# `wrangler login` on the owning account.
#
# Usage: scripts/publish-metrics.sh [dir ...]     dirs under static/tiles, e.g. metrics/zcta or sdoh
#                                                 (default: metrics sdoh map)
#
# Paths carry the release hash, so an upload never replaces a file a deployed site still reads, every
# object may be cached for good, and running this again is harmless. Publish before deploying the
# manifest that names the new release.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
export PATH="$root/node_modules/.bin:$PATH"
cd "$root/static/tiles"
dirs=("$@")
[ ${#dirs[@]} -gt 0 ] || dirs=(metrics sdoh map)

# IPv4 first: over IPv6, uploads beyond a few MB were reset mid-request (seen 2026-09-18). Even so a
# few requests in a thousand fail on a home connection, hence the retries.
export NODE_OPTIONS="--dns-result-order=ipv4first"
put() {
  for _ in 1 2 3 4; do
    wrangler r2 object put "worship-closures-tiles/$1" --file "$1" --remote \
      --content-type application/octet-stream --cache-control "public, max-age=31536000, immutable" \
      >/dev/null 2>&1 && return 0
    sleep 3
  done
  echo "FAILED $1"
  return 1
}
export -f put

files=$(mktemp)
trap 'rm -f "$files"' EXIT
# Check every input before uploading anything: each metric shard now requires its place rows.
for dir in "${dirs[@]}"; do
  if [ ! -d "$dir" ] || [ ! -r "$dir" ] || [ ! -x "$dir" ]; then
    echo "Cannot read input directory: $dir" >&2
    exit 1
  fi
  # rows.bin (scripts/build-rows.py) is read by byte range, so it is not gzipped.
  find "$dir" -type f \( -name '*.gz' -o -name rows.bin \) -print0 > "$files"
  if [ ! -s "$files" ]; then
    echo "No publishable files in: $dir" >&2
    exit 1
  fi
  while IFS= read -r -d '' file; do
    if [[ "$file" == metrics/* && "$file" == */geoids.json.gz && ! -s "${file%/*}/rows.bin" ]]; then
      echo "Missing rows.bin beside $file; run scripts/build-rows.py first" >&2
      exit 1
    fi
  done < "$files"
done

failed=0
for dir in "${dirs[@]}"; do
  find "$dir" -type f \( -name '*.gz' -o -name rows.bin \) -print0 > "$files"
  count=$(tr -cd '\0' < "$files" | wc -c | tr -d ' ')
  if misses=$(xargs -0 -P 4 -n 1 bash -c 'put "$0"' < "$files"); then
    echo "$dir: $count files uploaded"
  else
    printf '%s\n' "$misses" >&2
    echo "$dir: upload failed" >&2
    failed=1
  fi
done
exit $failed
