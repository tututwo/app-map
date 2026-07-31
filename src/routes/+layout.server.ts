import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ locals }) => ({
  accessProtectionEnabled: locals.accessProtectionEnabled,
  accessAuthenticated: locals.accessAuthenticated,
});
