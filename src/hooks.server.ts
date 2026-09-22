import type { HandleFetch } from "@sveltejs/kit";

/**
 * In development and preview the data files are static assets (PUBLIC_TILES_URL=/tiles), and SvelteKit
 * answers a load's fetch for one of its own assets by reading the file whole: a Range request for two
 * hundred bytes of rows.bin came back as 1.9 MB, which the page then carried as base64. Vite serves the
 * same file with its Range honoured, so a ranged request goes to Vite. Production reads through
 * /map-assets and never asks for /tiles/.
 */
export const handleFetch: HandleFetch = ({ request, fetch }) =>
  request.headers.has("range") && new URL(request.url).pathname.startsWith("/tiles/")
    ? globalThis.fetch(request)
    : fetch(request);
