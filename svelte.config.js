import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  compilerOptions: {
    experimental: {
      // Required for await expressions in components (PDF report page).
      async: true,
    },
  },

  kit: {
    experimental: {
      // Dashboard data flows through remote functions (src/lib/dashboard/data.remote.ts).
      remoteFunctions: true,
    },
    // Builds and Vite dev use local bindings; wrangler dev reads the remote R2 bucket.
    adapter: adapter({ platformProxy: { remoteBindings: false } }),
    alias: {
      $lib: "src/lib",
      $data: "src/data",
      $components: "src/components",
    },
  },
};

export default config;
