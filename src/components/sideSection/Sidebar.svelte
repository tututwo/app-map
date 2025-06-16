<script lang="ts">
import { Download, FileChartColumnIncreasing } from "lucide-svelte";
import SocialShare from "$components/sideSection/socialShare.svelte";

let { from, to, geoid, children }: { from: number; to: number; geoid: string; children: any } =
  $props();
</script>

<aside class="bg-yale-blue flex w-[min(230px,max(18vw,230px))] flex-col text-white">
  <div class="flex h-full flex-col px-6 pt-8 pb-5">
    <!-- Yale Logo -->
    <div class="mb-14">
      <h1 class="font-serif text-4xl tracking-wide">Yale</h1>
    </div>

    <!-- Main Title -->
    <div class="mb-14">
      <h2 class="text-2xl leading-tight font-semibold tracking-widest">
        Closed<br />Churches<br />in the US
      </h2>
    </div>

    <!-- Location Section -->
    <div class="mb-auto">
      <h3 class="mb-2 text-[1.1rem] font-medium">Location of interest</h3>
      <p class="mb-3 text-[14px] leading-snug font-light opacity-90">
        Input name or zipcode of a location, leave it blank for the entire country
      </p>

      {@render children()}
    </div>

    <!-- About Section -->
    <div class="mt-auto">
      <h3 class="mb-2 text-lg font-normal">About this project</h3>
      <p class="mb-6 text-sm leading-snug font-light opacity-90">
        This project is a collaboration between Yale Center for Geospatial Solutions and Yale School
        of Public Health.
      </p>

      <!-- Divider -->
      <div class="mb-6 h-px w-full bg-white/30"></div>

      <!-- Action Buttons -->
      <div class="flex flex-col gap-4 text-sm">
        <SocialShare />
        <a
          class="flex w-full items-center gap-3 font-light opacity-90 transition-opacity hover:opacity-100"
          href={`/PDF?from=${from ?? ""}&to=${to ?? ""}&geoid=${geoid ?? "00000"}`}
        >
          <FileChartColumnIncreasing size={24} strokeWidth={1.5} color="white" />
          Export Report
        </a>
        <button
          class="flex w-full items-center gap-3 font-light opacity-90 transition-opacity hover:opacity-100"
        >
          <Download size={24} strokeWidth={1.5} color="white" />
          Download data
        </button>
      </div>
    </div>
  </div>
</aside>
