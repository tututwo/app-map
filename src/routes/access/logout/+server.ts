import { dev } from "$app/environment";
import { ACCESS_COOKIE_NAME, sessionCookieOptions } from "$lib/server/dashboard-access";
import { redirect, type RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = ({ cookies }) => {
  cookies.delete(ACCESS_COOKIE_NAME, sessionCookieOptions(!dev));

  redirect(303, "/access");
};
