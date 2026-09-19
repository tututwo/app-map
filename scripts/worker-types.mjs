import { readFileSync, writeFileSync } from "node:fs";

// SvelteKit owns the compiled entrypoint. Importing it here makes checkJs type-check build output.
const path = "src/worker-configuration.d.ts";
writeFileSync(
  path,
  readFileSync(path, "utf8").replace(/^\s*mainModule: typeof import\(.*\);\r?\n/gm, "")
);
