<script lang="ts">
import { resolve } from "$app/paths";
import { page } from "$app/state";

let { children } = $props();

const link =
  "-mb-px flex items-center border-b-2 text-[14px] font-medium whitespace-nowrap text-ink hover:text-yale-blue";
let exploreActive = $derived(page.url.pathname.startsWith("/explore"));
</script>

<div class="text-body bg-white font-sans text-[15px] leading-normal">
  <a
    href="#main-content"
    class="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:rounded focus-visible:bg-white focus-visible:px-4 focus-visible:py-3 focus-visible:text-yale-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yale-blue print:hidden"
    >Skip to main content</a
  >
  <!-- Paper carries the page alone: the Summary prints without the site's navigation. -->
  <header
    class="border-rule relative z-[5] flex h-16 items-center justify-between gap-6 border-b bg-white px-5 lg:px-[60px] print:hidden"
  >
    <a
      href={resolve("/")}
      class="text-yale-blue text-[16px] font-bold tracking-[-0.01em] whitespace-nowrap"
      >[Project name]</a
    >
    <!-- On a phone the links scroll inside the bar; the page never grows wider than the screen. -->
    <nav class="flex h-full min-w-0 items-stretch gap-[30px] overflow-x-auto overflow-y-hidden">
      <a
        href={resolve("/explore")}
        class="{link} {exploreActive ? 'border-yale-blue' : 'border-transparent'}">Explore</a
      >
      <a href="{resolve('/')}#stories" class="{link} border-transparent">Stories</a>
    </nav>
  </header>
  {@render children()}
</div>
