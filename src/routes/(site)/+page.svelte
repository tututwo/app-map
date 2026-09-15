<script lang="ts">
import { resolve } from "$app/paths";
import ImageSlot from "$components/site/ImageSlot.svelte";
import QueryFields from "$components/site/QueryFields.svelte";
import SiteFooter from "$components/site/SiteFooter.svelte";
import { DEFAULT_QUERY, type TypeKey } from "$lib/explore/model";

// The bar is a plain GET to /explore; From/To/Type carry over in the URL.
let from = $state(DEFAULT_QUERY.from);
let to = $state(DEFAULT_QUERY.to);
let type = $state<TypeKey>(DEFAULT_QUERY.type);

// Copy is final (design handoff); photos are slots the content team fills.
const pairs = [
  { name: "1485 Gates Ave", place: "Brooklyn, NY", open: 2012, closed: 2023 },
  { name: "St. Casimir", place: "Gary, IN", open: 2004, closed: 2019 },
  { name: "Mt. Zion AME", place: "Milwaukee, WI", open: 2006, closed: 2018 },
];
const papers = [
  {
    tag: "Neighborhood health",
    title: "Closures of places of worship and neighborhood mortality, 2000–2020",
    journal: "American Journal of Public Health",
    year: 2024,
    image: "Photo — a church behind bare trees",
  },
  {
    tag: "Data & methods",
    title: "Mapping places of worship at the census-tract level: a national dataset",
    journal: "Health & Place",
    year: 2023,
    image: "Figure — national dot map of places of worship",
  },
  {
    tag: "Social cohesion",
    title: "Loss of religious infrastructure and social cohesion in U.S. counties",
    journal: "Social Science & Medicine",
    year: 2025,
    image: "Photo — inscription on a stone facade",
  },
];
const stories = [
  {
    quote: "The building is a dollar store now. The food pantry moved twice, then stopped.",
    who: "A former member · Gary, IN · placeholder",
  },
  {
    quote: "We still meet — in a living room, eleven of us.",
    who: "A congregant · Brooklyn, NY · placeholder",
  },
];

const wrap = "mx-auto max-w-[1400px] px-[60px]";
const h2 = "font-serif text-[30px] leading-[1.15] text-ink";
const link = "text-[13px] font-semibold text-medium-blue hover:underline";
const tag =
  "pointer-events-none absolute rounded-[2px] bg-white px-[7px] py-1 text-[8.5px] font-bold tracking-[.12em] text-ink uppercase";
</script>

<svelte:head>
  <title>Where are places of worship closing? · Yale School of Public Health</title>
  <meta
    name="description"
    content="A Yale School of Public Health research project tracking where places of worship have closed across the U.S., and what that means for neighborhood health."
  />
</svelte:head>

<main>
  <!-- Hero band -->
  <section class="bg-yale-blue">
    <div
      class="{wrap} grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] items-end gap-14 pt-10 pb-16"
    >
      <div class="pb-2.5">
        <div class="text-kicker mb-7 text-[10.5px] font-bold tracking-[.14em] uppercase">
          Yale School of Public Health · Research project
        </div>
        <h1
          class="mb-[26px] font-serif text-[46px] leading-[1.12] tracking-[-0.012em] text-pretty text-white"
        >
          Where are places of worship closing?
        </h1>
        <p class="text-hero-text max-w-[520px] text-[16px] leading-[1.6] text-pretty">
          A research project from the Yale School of Public Health tracking where places of worship
          have closed across the U.S. — and what that means for the health of the neighborhoods
          around them.
        </p>
      </div>
      <div
        class="border-rule relative aspect-[2.15] min-h-60 overflow-hidden rounded border bg-white"
      >
        <ImageSlot label="Hero image — a place of worship, then and now" />
      </div>
    </div>
  </section>

  <!-- Search bar -->
  <section class="{wrap} relative z-[2] -mt-9">
    <form
      method="get"
      action={resolve("/explore")}
      class="border-rule flex flex-wrap rounded border bg-white shadow-[0_1px_2px_rgba(0,0,0,.05),0_14px_34px_-18px_rgba(0,0,0,.22)]"
    >
      <label
        class="border-rule flex min-w-0 flex-[1_1_320px] flex-col gap-1.5 border-r px-5 pt-3.5 pb-[13px]"
      >
        <span class="label-caps">Where</span>
        <input
          name="where"
          type="text"
          placeholder="ZIP, city, county or state — or leave empty for the whole U.S."
          class="text-ink placeholder:text-faint focus-visible:outline-yale-blue w-full text-[14px] focus-visible:outline-2 focus-visible:outline-offset-4"
        />
      </label>
      <QueryFields bind:from bind:to bind:type />
      <div class="flex items-stretch p-2">
        <button
          type="submit"
          class="bg-yale-blue min-h-12 rounded-[3px] px-6 text-[14px] font-semibold whitespace-nowrap text-white hover:brightness-[.92]"
        >
          Explore →
        </button>
      </div>
    </form>
    <div class="text-faint px-[18px] pt-2.5 text-[11.5px]">
      Rates are calculated over the whole period · minimum 5 years.
    </div>
  </section>

  <!-- Then and now -->
  <section class="{wrap} pt-24">
    <div class="mb-[30px] flex flex-col gap-3.5">
      <h2 class={h2}>Then and now</h2>
      <p class="text-muted max-w-[640px] text-[15px] leading-[1.55] text-pretty">
        Each pair is the same address a few years apart — a congregation in use, then the building
        after it closed. [Paragraph placeholder; the research team supplies final wording.]
      </p>
    </div>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-10">
      {#each pairs as pair (pair.name)}
        <figure>
          <div class="grid aspect-[2.68] grid-cols-2 gap-0.5 overflow-hidden rounded-[3px]">
            <div class="bg-nodata relative">
              <ImageSlot label="photo — open {pair.open}" />
              <span class="{tag} top-2.5 left-2.5">Then · {pair.open}</span>
            </div>
            <div class="bg-nodata relative">
              <ImageSlot label="photo — closed {pair.closed}" />
              <span class="{tag} top-2.5 right-2.5">Now · {pair.closed}</span>
            </div>
          </div>
          <figcaption class="text-body mt-3 text-[12.5px] leading-normal">
            <strong class="text-ink font-bold">{pair.name}</strong> · open {pair.open} → closed {pair.closed}
            · {pair.place}
          </figcaption>
        </figure>
      {/each}
    </div>
  </section>

  <!-- From our research -->
  <section class="{wrap} pt-[104px]">
    <div class="mb-7 flex items-baseline justify-between gap-6">
      <h2 class={h2}>From our research</h2>
      <a href="/health-impacts" class="{link} whitespace-nowrap">See all research →</a>
    </div>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6">
      {#each papers as paper (paper.title)}
        <article
          class="border-rule flex flex-col gap-2.5 rounded border bg-white px-[22px] pt-[22px] pb-5"
        >
          <span
            class="bg-scale-1 text-yale-blue self-start rounded-[2px] px-2 py-1 text-[9px] font-bold tracking-[.12em] uppercase"
          >
            {paper.tag}
          </span>
          <h3 class="text-ink mt-0.5 font-serif text-[20px] leading-[1.3] text-pretty">
            {paper.title}
          </h3>
          <div class="text-muted -mt-1 text-[12.5px]">{paper.journal} · {paper.year}</div>
          <div class="bg-nodata relative mt-1.5 aspect-[1.9] overflow-hidden rounded-[3px]">
            <ImageSlot label={paper.image} />
          </div>
          <a href="/health-impacts" class="{link} mt-auto pt-2">Read the paper →</a>
        </article>
      {/each}
    </div>
  </section>

  <!-- Stories -->
  <section id="stories" class="{wrap} scroll-mt-6 pt-24">
    <h2 class="{h2} mb-7">Stories</h2>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-start gap-6">
      {#each stories as story (story.quote)}
        <article class="border-yale-blue flex flex-col gap-3 border-t pt-[22px]">
          <blockquote class="text-ink font-serif text-[23px] leading-[1.3] text-pretty">
            “{story.quote}”
          </blockquote>
          <div class="text-muted text-[12px]">{story.who}</div>
          <a href="/stories" class={link}>Read the story →</a>
        </article>
      {/each}
      <aside class="border-rule flex flex-col gap-[18px] rounded border bg-white p-6">
        <p class="text-ink text-[15px] leading-normal text-pretty">
          Did a place of worship near you close? Tell us what changed.
        </p>
        <a
          href="/stories"
          class="border-yale-blue text-yale-blue hover:bg-yale-blue flex h-[42px] items-center justify-center rounded-full border-[1.5px] text-[13.5px] font-semibold hover:text-white"
        >
          Share your story
        </a>
      </aside>
    </div>
  </section>
</main>

<SiteFooter />
