<script lang="ts">
import { resolve } from "$app/paths";
import SiteFooter from "$components/site/SiteFooter.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.title} · Church Closures · SOCAH Lab</title>
</svelte:head>

<main
  id="main-content"
  tabindex="-1"
  class="mx-auto min-h-[55vh] max-w-[1400px] px-5 py-20 lg:px-[60px]"
>
  <p class="label-caps mb-5">Church Closures · SOCAH Lab</p>
  <h1
    class="text-yale-blue font-serif text-[clamp(2rem,5vw,3rem)] leading-tight tracking-[-0.02em]"
  >
    {data.title}
  </h1>
  <p class="text-muted mt-6 text-base">Coming soon.</p>
  <a
    href={resolve("/")}
    class="motion-control border-rule text-yale-blue mt-10 inline-flex min-h-11 items-center rounded border px-4 text-sm font-semibold"
  >
    ← Back to home
  </a>
</main>

<SiteFooter />
