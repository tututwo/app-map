import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import dsv from "@rollup/plugin-dsv";

export default defineConfig({
  plugins: [sveltekit(), tailwindcss(), dsv()],
  ssr: {
    noExternal: ["gsap"],
  },
});
