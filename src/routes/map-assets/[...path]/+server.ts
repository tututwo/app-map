import type { RequestHandler } from "@sveltejs/kit";

// Release-hashed, immutable data files: Metric cube Shards and community-context Shards. rows.bin is
// read by byte range (scripts/build-rows.py), so it is stored as it is.
const metricPath =
  /^(?:metrics\/(?:state|county|zcta|tract|blockgroup)\/[a-f0-9]{12}\/(?:us|\d{2})\/(?:(?:geoids\.json|[a-z_]+\.bin)\.gz|rows\.bin)|sdoh\/(?:state|county|zcta|tract|blockgroup)\/[a-f0-9]{12}\/(?:us|\d{2})\.json\.gz)$/;
const archivePath = /^(?:county-2010|(?:zcta|tract|bg)-2010(?:-v2)?)\.pmtiles$/;
const mapPath =
  /^map\/(?:zcta|tract|blockgroup)\/[a-f0-9]{12}\/(?:geoids\.json|[a-z_]+\/\d{1,3}\.bin)\.gz$/;

function hasBody(object: R2Object): object is R2ObjectBody {
  return "body" in object;
}

function precondition(headers: Headers, etag: string, uploaded: Date) {
  const matches = (value: string, weak = false) =>
    value.trim() === "*" ||
    value.split(",").some((tag) => (weak ? tag.trim().replace(/^W\//, "") : tag.trim()) === etag);
  const match = headers.get("if-match");
  const noneMatch = headers.get("if-none-match");
  const modified = Math.floor(uploaded.getTime() / 1000) * 1000;
  if (
    match !== null
      ? !matches(match)
      : modified > Date.parse(headers.get("if-unmodified-since") ?? "")
  )
    return 412;
  if (
    noneMatch !== null
      ? matches(noneMatch, true)
      : modified <= Date.parse(headers.get("if-modified-since") ?? "")
  )
    return 304;
}

function byteRange(value: string | null): R2Range | undefined {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value ?? "");
  if (!match || (!match[1] && !match[2])) return;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return;
  if (!match[1]) return { suffix: end };
  if (!match[2]) return { offset: start };
  if (end >= start) return { offset: start, length: end - start + 1 };
}

export const GET: RequestHandler = async ({ params, request, url, platform }) => {
  const key = params.path ?? "";
  const immutable = metricPath.test(key) || mapPath.test(key);
  if (!immutable && !archivePath.test(key)) return new Response(null, { status: 404 });
  if (!platform?.env.TILES) return new Response(null, { status: 503 });

  const bucket = platform.env.TILES;
  const head = request.method === "HEAD";
  // A browser that holds part of an archive asks for the next part with If-Range. R2 has no If-Range, so
  // the validator is checked here: a match gets its range, anything else the whole object (RFC 9110).
  // Without this every such request was answered with the full archive, which the PMTiles reader aborts.
  const ifRange = request.headers.get("if-range");
  let fresh = true;
  if (ifRange !== null && !head) {
    const current = await bucket.head(key);
    fresh =
      !!current &&
      (ifRange.startsWith('"')
        ? ifRange === current.httpEtag
        : Math.floor(current.uploaded.getTime() / 1000) * 1000 <= Date.parse(ifRange));
  }
  const range = head || !fresh ? undefined : byteRange(request.headers.get("range"));

  const cacheKey = new Request(`${url.origin}${url.pathname}`);
  const cacheable =
    immutable &&
    !head &&
    !request.headers.has("range") &&
    !["if-match", "if-none-match", "if-modified-since", "if-unmodified-since"].some((name) =>
      request.headers.has(name)
    );
  const cache = cacheable ? await platform.caches.open("metrics") : undefined;
  if (cacheable && cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  let object: R2Object | R2ObjectBody | null;
  // R2's strict date comparison differs from HTTP; check this header against metadata below.
  const conditions = new Headers(request.headers);
  conditions.delete("if-unmodified-since");
  try {
    object = head ? await bucket.head(key) : await bucket.get(key, { range, onlyIf: conditions });
  } catch (cause) {
    // R2's InvalidRange is 10039; do not turn an outage into a client range error.
    if (
      !range ||
      !(cause instanceof Error) ||
      !(("code" in cause && cause.code === 10039) || /\(10039\)$/.test(cause.message))
    )
      throw cause;
    const metadata = await bucket.head(key);
    return new Response(null, {
      status: metadata ? 416 : 404,
      headers: metadata ? { "Content-Range": `bytes */${metadata.size}` } : undefined,
    });
  }
  if (!object) return new Response(null, { status: 404 });

  const headers = new Headers({
    "Content-Type": immutable ? "application/octet-stream" : "application/vnd.pmtiles",
    "Accept-Ranges": "bytes",
    ETag: object.httpEtag,
    "Last-Modified": object.uploaded.toUTCString(),
    "Cache-Control": immutable
      ? "public, max-age=31536000, immutable"
      : "public, max-age=300, must-revalidate",
    "X-Content-Type-Options": "nosniff",
  });
  const status = precondition(request.headers, object.httpEtag, object.uploaded);
  if (status || (!head && !hasBody(object))) {
    if (hasBody(object)) await object.body.cancel();
    return new Response(null, { status: status ?? 412, headers });
  }

  let length = object.size;
  if (range) {
    const offset =
      "suffix" in range ? Math.max(0, object.size - range.suffix) : (range.offset ?? 0);
    length =
      "suffix" in range
        ? object.size - offset
        : Math.min(range.length ?? object.size, object.size - offset);
    if (length <= 0) {
      if (hasBody(object)) await object.body.cancel();
      headers.set("Content-Range", `bytes */${object.size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
  }
  headers.set("Content-Length", String(length));
  const response = new Response(hasBody(object) && !head ? object.body : null, {
    status: range ? 206 : 200,
    headers,
  });
  // Cache only small, immutable metric objects; PMTiles archives stay streamed from R2.
  if (cacheable && cache)
    platform.ctx.waitUntil(
      cache.put(cacheKey, response.clone()).catch((cause) => {
        console.error("Failed to cache metric asset", key, cause);
      })
    );
  return response;
};

export const HEAD = GET;
