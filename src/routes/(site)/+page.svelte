<script lang="ts">
import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { prefersReducedMotion } from "svelte/motion";
import { Search } from "lucide-svelte";
import FindPlace from "$components/explore/FindPlace.svelte";
import ImageSlot from "$components/site/ImageSlot.svelte";
import QueryFields from "$components/site/QueryFields.svelte";
import SiteFooter from "$components/site/SiteFooter.svelte";
import { DEFAULT_QUERY, formatAt, whereOf, writeQuery, type TypeKey } from "$lib/explore/model";

// The bar is a plain GET to /explore; From/To/Type carry over in the URL. A place chosen from the list
// goes there at once, as the Focus (ADR-0003); Explore derives the Selection a city or address lacks.
let from = $state(DEFAULT_QUERY.from);
let to = $state(DEFAULT_QUERY.to);
let type = $state<TypeKey>(DEFAULT_QUERY.type);
let finder = $state<ReturnType<typeof FindPlace>>();

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

const wrap = "mx-auto max-w-[1400px] px-5 lg:px-[60px]";
const h2 = "font-serif text-[30px] leading-[1.15] text-ink";
const tag =
  "pointer-events-none absolute rounded-[2px] bg-white px-[7px] py-1 text-[8.5px] font-bold tracking-[.12em] text-ink uppercase";

// Content stays visible without JavaScript; each group settles into place once it enters view.
function reveal(node: HTMLElement) {
  if (prefersReducedMotion.current) return;
  let animation: Animation | undefined;
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      animation = node.animate(
        [
          { opacity: 0, transform: "translateY(14px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 480, easing: "cubic-bezier(.2,.8,.2,1)" }
      );
      observer.disconnect();
    },
    { threshold: 0.08 }
  );
  observer.observe(node);
  return () => {
    observer.disconnect();
    animation?.cancel();
  };
}
</script>

<svelte:head>
  <title>Where are places of worship closing? · Yale School of Public Health</title>
  <meta
    name="description"
    content="A Yale School of Public Health research project tracking where places of worship have closed across the U.S., and what that means for neighborhood health."
  />
</svelte:head>

<main id="main-content" tabindex="-1">
  <!-- Hero band -->
  <section class="bg-yale-blue">
    <div
      class="{wrap} grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-end gap-14 pt-10 pb-16"
    >
      <div class="pb-2.5" {@attach reveal}>
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
        class="border-rule relative aspect-[2.15] w-full min-w-0 overflow-hidden rounded border bg-white"
        {@attach reveal}
      >
        <ImageSlot label="Hero image — a place of worship, then and now" />
      </div>
    </div>
  </section>

  <!-- Search: the round button searches the typed place, or opens the whole U.S. when it is empty. -->
  <section class="{wrap} relative z-[2] -mt-9">
    <form
      method="get"
      action={resolve("/explore")}
      class="home-search search-bar"
      onsubmit={(event) => {
        if (finder?.go()) event.preventDefault();
      }}
    >
      <FindPlace
        bind:this={finder}
        icon={false}
        value=""
        label="Where"
        class="search-where min-h-14 min-w-0 items-center bg-white px-5"
        onpick={({ at, level = DEFAULT_QUERY.level, geoid, near, address }) =>
          goto(
            resolve("/explore") +
              "?" +
              writeQuery(new URLSearchParams(), {
                from,
                to,
                type,
                level,
                at,
                near,
                where: whereOf(level, geoid),
              }),
            {
              state: {
                exploreAddress:
                  address === undefined ? undefined : { at: formatAt(at), text: address },
              },
            }
          )}
      />
      <QueryFields bind:from bind:to bind:type />
      <button
        type="submit"
        aria-label="Search"
        class="search-go bg-yale-blue focus-visible:outline-offset-[-5px] flex min-h-14 w-14 items-center justify-center text-white transition-[filter] hover:brightness-[.92] focus-visible:outline-2 focus-visible:outline-white active:brightness-[.85]"
      >
        <Search size={20} strokeWidth={2.25} aria-hidden="true" />
      </button>
    </form>
    <p class="text-faint px-[21px] pt-2.5 text-[11.5px] text-pretty">
      Preliminary reported closure counts · published windows include both endpoint years.
    </p>
  </section>

  <!-- Then and now -->
  <section class="{wrap} pt-24">
    <div class="mb-[30px] flex flex-col gap-3.5" {@attach reveal}>
      <h2 class={h2}>Then and now</h2>
      <p class="text-muted max-w-[640px] text-[15px] leading-[1.55] text-pretty">
        Each pair is the same address a few years apart — a congregation in use, then the building
        after it closed. [Paragraph placeholder; the research team supplies final wording.]
      </p>
    </div>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-10">
      {#each pairs as pair (pair.name)}
        <figure {@attach reveal}>
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
    <div class="mb-7 flex items-baseline justify-between gap-6" {@attach reveal}>
      <h2 class={h2}>From our research</h2>
    </div>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-6">
      {#each papers as paper (paper.title)}
        <article
          class="border-rule flex flex-col gap-2.5 rounded border bg-white px-[22px] pt-[22px] pb-5"
          {@attach reveal}
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
        </article>
      {/each}
    </div>
  </section>

  <!-- Stories -->
  <section id="stories" class="{wrap} pt-24">
    <h2 class="{h2} mb-7" {@attach reveal}>Stories</h2>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] items-start gap-6">
      {#each stories as story (story.quote)}
        <article class="border-yale-blue flex flex-col gap-3 border-t pt-[22px]" {@attach reveal}>
          <blockquote class="text-ink font-serif text-[23px] leading-[1.3] text-pretty">
            “{story.quote}”
          </blockquote>
          <div class="text-muted text-[12px]">{story.who}</div>
        </article>
      {/each}
    </div>
  </section>
</main>

<SiteFooter />

<style>
/* Home search. Phones stack the fields with the search button beside Where; from 640px the dates
   and type share a row; from 1024px it is one bar. Hairlines come from .search-bar (app.css). */
.home-search {
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    "where go"
    "dates dates"
    "type type";
  border: 1px solid var(--color-rule);
  box-shadow:
    0 1px 2px rgb(0 0 0 / 5%),
    0 14px 34px -18px rgb(0 0 0 / 22%);
}
.search-go {
  grid-area: go;
}
@media (min-width: 640px) {
  .home-search {
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas:
      "where where go"
      "dates type type";
  }
}
@media (min-width: 1024px) {
  .home-search {
    grid-template-columns: minmax(0, 1fr) auto 16rem auto;
    grid-template-areas: "where dates type go";
  }
}
#stories {
  scroll-margin-top: 8rem;
}
</style>
