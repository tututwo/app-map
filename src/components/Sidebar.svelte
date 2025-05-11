<script lang="ts">
import { ArrowRight, Download } from "lucide-svelte";

// Define props with $props rune
let { children } = $props();
</script>

<aside class="bg-yale-blue flex w-[max(250px,min(15vw,250px))] flex-col text-white">
  <div class="flex h-full flex-col p-6">
    <!-- Yale Logo -->
    <div class="mb-14">
      <h1 class="font-serif text-4xl tracking-wide">Yale</h1>
    </div>

    <!-- Main Title -->
    <div class="mb-14">
      <h2 class="text-3xl leading-tight font-semibold">
        Closed<br />Churches<br />in the US
      </h2>
    </div>

    <!-- Location Section -->
    <div class="mb-auto">
      <h3 class="mb-2 text-lg font-normal">Location of interest</h3>
      <p class="mb-3 text-[15px] leading-snug font-light opacity-90">
        Input name or zipcode of a location, leave it blank for the entire country
      </p>

      {@render children()}
    </div>

    <!-- About Section -->
    <div class="mt-auto">
      <h3 class="mb-2 text-lg font-normal">About this project</h3>
      <p class="mb-6 text-[15px] leading-snug font-light opacity-90">
        This project is a collaboration between Yale Center for Geospatial Solutions and Yale School
        of Public Health.
      </p>

      <!-- Divider -->
      <div class="mb-6 h-px w-full bg-white/30"></div>

      <!-- Action Buttons -->
      <div class="flex flex-col gap-4">
        <button
          class="flex items-center gap-3 text-[15px] font-light opacity-90 transition-opacity hover:opacity-100"
        >
          <ArrowRight color="white" strokeWidth={1.5} />
          Share to social media
        </button>
        <button
          class="flex items-center gap-3 text-[15px] font-light opacity-90 transition-opacity hover:opacity-100"
        >
          <Download size={24} strokeWidth={1.5} color="white" />
          Download data
        </button>
      </div>
    </div>
  </div>
</aside>
