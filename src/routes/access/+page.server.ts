import { env } from "$env/dynamic/private";
import { dev } from "$app/environment";
import { error, fail, redirect } from "@sveltejs/kit";
import {
  ACCESS_COOKIE_NAME,
  createSessionToken,
  matchesAccessCode,
  readAccessConfig,
  sanitizeNextPath,
  sessionCookieOptions,
} from "$lib/server/dashboard-access";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ url }) => ({
  next: sanitizeNextPath(url.searchParams.get("next")),
});

export const actions: Actions = {
  default: async ({ cookies, request }) => {
    const formData = await request.formData();
    const code = formData.get("code");
    const next = sanitizeNextPath(formData.get("next")?.toString());
    const config = readAccessConfig(env);

    if (!config?.enabled) {
      error(503, "Access is temporarily unavailable.");
    }

    if (typeof code !== "string" || !matchesAccessCode(code, config.code)) {
      return fail(400, { incorrect: true, next });
    }

    cookies.set(ACCESS_COOKIE_NAME, createSessionToken(config), sessionCookieOptions(!dev));

    redirect(303, next);
  },
};
