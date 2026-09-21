<script lang="ts">
import { resolve } from "$app/paths";
import { page } from "$app/state";
import { CopyLink } from "$lib/copy-link.svelte";
import { Check } from "lucide-svelte";
import { fade } from "svelte/transition";

const copy = new CopyLink();
let url = $derived(encodeURIComponent(page.url.href));
const subject = encodeURIComponent(
  "Where are places of worship closing? · Yale School of Public Health"
);

const chip =
  "motion-control inline-flex h-[30px] items-center gap-2 rounded-full border border-rule bg-white pr-3.5 pl-3 text-[11.5px] font-semibold whitespace-nowrap text-ink hover:border-ink";
</script>

{#snippet dot()}
  <span class="bg-yale-blue size-[9px] rounded-full"></span>
{/snippet}

<footer class="border-rule bg-footer mt-24 border-t">
  <div class="mx-auto max-w-[1400px] px-5 pt-[52px] pb-10 lg:px-[60px]">
    <div class="flex flex-wrap items-start justify-between gap-x-[60px] gap-y-10">
      <nav
        aria-label="Project information"
        class="text-ink flex flex-col gap-3 text-[13px] font-semibold"
      >
        <a href={resolve("/(site)/[info]", { info: "methodology" })} class="motion-link self-start"
          >Methodology</a
        >
        <a href={resolve("/(site)/[info]", { info: "request-data" })} class="motion-link self-start"
          >Get the data</a
        >
        <a href={resolve("/(site)/[info]", { info: "contact" })} class="motion-link self-start"
          >Contact</a
        >
      </nav>

      <div class="flex flex-col gap-3">
        <span class="label-caps">Share</span>
        <div class="flex flex-wrap gap-2.5">
          <a
            class={chip}
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.linkedin.com/sharing/share-offsite/?url={url}"
          >
            {@render dot()}LinkedIn
          </a>
          <a
            class={chip}
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.facebook.com/sharer/sharer.php?u={url}"
          >
            {@render dot()}Facebook
          </a>
          <a class={chip} href="mailto:?subject={subject}&body={url}">{@render dot()}Email</a>
          <button
            type="button"
            class="{chip} min-w-[104px] justify-center"
            onclick={() => copy.copy()}
          >
            <span class="inline-grid">
              {#key copy.copied}
                <span
                  class="col-start-1 row-start-1 inline-flex items-center gap-2"
                  transition:fade={{ duration: 120 }}
                >
                  {#if copy.copied}
                    <Check class="text-yale-blue size-3" aria-hidden="true" />
                  {:else}
                    {@render dot()}
                  {/if}
                  {copy.copied ? "Copied" : "Copy link"}
                </span>
              {/key}
            </span>
          </button>
          <span class="sr-only" role="status">{copy.copied ? "Link copied" : ""}</span>
          <!-- The research team's Substack replaces this once it exists. -->
          <a class={chip} target="_blank" rel="noopener noreferrer" href="https://substack.com">
            {@render dot()}Substack
          </a>
        </div>
      </div>

      <div class="flex flex-wrap gap-4">
        {#each ["YSPH logo", "YCGS logo", "YDS logo"] as logo (logo)}
          <div
            class="hatch border-rule text-muted flex h-10 w-28 items-center justify-center rounded-[2px] border font-mono text-[10px]"
          >
            <span class="bg-footer px-[5px] py-0.5">{logo}</span>
          </div>
        {/each}
      </div>
    </div>

    <p class="text-faint mt-11 text-[11.5px] leading-normal text-pretty">
      Data and estimates are for research purposes and may contain errors; they do not constitute
      medical, legal or financial advice. © Yale School of Public Health.
    </p>
  </div>
</footer>
