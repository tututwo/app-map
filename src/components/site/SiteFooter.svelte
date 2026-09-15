<script lang="ts">
import { page } from "$app/state";
import { CopyLink } from "$lib/copy-link.svelte";

const copy = new CopyLink();
let url = $derived(encodeURIComponent(page.url.href));
const subject = encodeURIComponent(
  "Where are places of worship closing? · Yale School of Public Health"
);

const chip =
  "inline-flex h-[30px] items-center gap-2 rounded-full border border-rule bg-white pr-3.5 pl-3 text-[11.5px] font-semibold whitespace-nowrap text-ink hover:border-ink";
</script>

{#snippet dot()}
  <span class="bg-yale-blue size-[9px] rounded-full"></span>
{/snippet}

<footer class="border-rule bg-footer mt-24 border-t">
  <div class="mx-auto max-w-[1400px] px-[60px] pt-[52px] pb-10">
    <div class="flex flex-wrap items-start justify-between gap-x-[60px] gap-y-10">
      <nav class="text-ink flex flex-col gap-3 text-[13px] font-semibold">
        <a href="/methodology" class="hover:underline">Methodology</a>
        <a href="/request-data" class="hover:underline">Get the data</a>
        <a href="/contact" class="hover:underline">Contact</a>
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
          <button type="button" class={chip} onclick={() => copy.copy()}>
            {@render dot()}{copy.copied ? "Copied" : "Copy link"}
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
