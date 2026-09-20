<script lang="ts">
import { resolve } from "$app/paths";
import { page } from "$app/state";

let { children } = $props();

// Health Impacts / Download Data / About point at the handoff's planned routes;
// those pages land in later tickets.
const link =
  "-mb-px flex items-center border-b-2 text-[14px] font-medium whitespace-nowrap text-ink";
let exploreActive = $derived(page.url.pathname.startsWith("/explore"));
</script>

<div class="text-body bg-white font-sans text-[15px] leading-normal">
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
      <a href="/#stories" class="{link} border-transparent">Stories</a>
      <a href="/health-impacts" class="{link} border-transparent">Health Impacts</a>
      <a href="/request-data" class="{link} border-transparent">Download Data</a>
      <a href="/about" class="{link} border-transparent">About</a>
    </nav>
  </header>
  {@render children()}
</div>
