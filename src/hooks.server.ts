import { env } from "$env/dynamic/private";
import { error, json, type Handle } from "@sveltejs/kit";
import {
  ACCESS_COOKIE_NAME,
  isSessionTokenValid,
  readAccessConfig,
} from "$lib/server/dashboard-access";

function preventCaching(response: Response): Response {
  const protectedResponse = new Response(response.body, response);
  protectedResponse.headers.set("Cache-Control", "private, no-store");
  protectedResponse.headers.set("CDN-Cache-Control", "no-store");
  protectedResponse.headers.set("Vercel-CDN-Cache-Control", "no-store");
  return protectedResponse;
}

function protectedRedirect(location: string): Response {
  return preventCaching(
    new Response(null, {
      status: 303,
      headers: { Location: location },
    })
  );
}

export const handle: Handle = async ({ event, resolve }) => {
  const config = readAccessConfig(env);
  if (config?.enabled === false) {
    event.locals.accessProtectionEnabled = false;
    event.locals.accessAuthenticated = false;
    return resolve(event);
  }

  if (!config) {
    error(503, "Access is temporarily unavailable.");
  }

  const authenticated = isSessionTokenValid(event.cookies.get(ACCESS_COOKIE_NAME), config);
  event.locals.accessProtectionEnabled = true;
  event.locals.accessAuthenticated = authenticated;
  const isAccessRoute = event.url.pathname === "/access" || event.url.pathname === "/access/logout";

  if (isAccessRoute) {
    if (authenticated && event.request.method === "GET") {
      return protectedRedirect("/");
    }
    return preventCaching(await resolve(event));
  }

  if (authenticated) {
    return preventCaching(await resolve(event));
  }

  if (event.url.pathname.startsWith("/api/")) {
    return preventCaching(json({ message: "Authentication required" }, { status: 401 }));
  }

  const next = `${event.url.pathname}${event.url.search}`;
  return protectedRedirect(`/access?next=${encodeURIComponent(next)}`);
};
