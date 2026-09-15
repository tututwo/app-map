<script lang="ts">
import { Image } from "lucide-svelte";

// A drop-in photo slot: the content team supplies `src` later; until then the
// slot shows its brief, like the design mockup.
let { src, alt = "", label }: { src?: string; alt?: string; label: string } = $props();
</script>

{#if src}
  <img {src} {alt} class="size-full object-cover" />
{:else}
  <div
    role="img"
    aria-label={label}
    class="border-hatch bg-nodata text-muted flex size-full flex-col items-center justify-center gap-2 border border-dashed px-4 text-center text-[12px]"
  >
    <Image size={22} strokeWidth={1.5} class="text-faint" />
    <span>{label}</span>
  </div>
{/if}
