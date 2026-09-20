import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * The Geocoder (ADR-0003): the Census Bureau's service sends no CORS header, so the browser asks through
 * here. The address arrives in a POST body because the Worker's sampled request logs record URLs, and
 * nothing in this file logs it either.
 * ponytail: no rate limit; add a Cloudflare rate-limiting rule on this path if it is ever abused.
 */
const CENSUS = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const headers = { "cache-control": "no-store" };

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json().catch(() => null)) as { address?: unknown } | null;
  const address = typeof body?.address === "string" ? body.address.trim() : "";
  if (address.length < 5 || address.length > 200)
    return json({ error: "invalid" }, { status: 400, headers });
  const query = new URLSearchParams({ address, benchmark: "Public_AR_Current", format: "json" });
  try {
    const response = await fetch(`${CENSUS}?${query}`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(String(response.status));
    const reply = (await response.json()) as {
      result: {
        addressMatches: { matchedAddress: string; coordinates: { x: number; y: number } }[];
      };
    };
    const [first] = reply.result.addressMatches;
    return json(
      {
        match: first
          ? { at: [first.coordinates.x, first.coordinates.y], label: first.matchedAddress }
          : null,
      },
      { headers }
    );
  } catch {
    // An outage, a timeout or an unexpected reply: the search box offers a city or a ZIP instead.
    return json({ error: "unavailable" }, { status: 502, headers });
  }
};
