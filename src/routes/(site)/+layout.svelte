<script lang="ts">
import { afterNavigate } from "$app/navigation";
import { resolve } from "$app/paths";
import { page } from "$app/state";
import { onDestroy } from "svelte";
import { prefersReducedMotion } from "svelte/motion";

let { children } = $props();
const links = [
  { label: "Explore", href: resolve("/explore") },
  { label: "Stories", href: `${resolve("/")}#stories` },
  { label: "Health Impacts", href: resolve("/health-impacts") },
  { label: "Download Data", href: resolve("/request-data") },
  { label: "About", href: resolve("/about") },
];
let pageAnimation: Animation | undefined;

afterNavigate(({ from, to }) => {
  pageAnimation?.cancel();
  // Query changes update the map in place; only a different page gets an entrance.
  if (!from || from.url.pathname === to?.url.pathname || prefersReducedMotion.current) return;
  pageAnimation = document.getElementById("main-content")?.animate(
    [
      { opacity: 0.5, transform: "translateY(6px)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" }
  );
});
$effect(() => {
  if (prefersReducedMotion.current) pageAnimation?.cancel();
});
onDestroy(() => pageAnimation?.cancel());
</script>

<div class="site-shell text-body bg-white font-sans text-[15px] leading-normal">
  <a
    href="#main-content"
    class="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:rounded focus-visible:bg-white focus-visible:px-4 focus-visible:py-3 focus-visible:text-yale-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yale-blue print:hidden"
    >Skip to main content</a
  >
  <header class="site-header print:hidden">
    <a href={resolve("/")} aria-label="Church Closures — SOCAH Lab home" class="site-brand">
      <span class="brand-title">Church Closures</span>
      <span class="brand-lab">SOCAH Lab</span>
    </a>
    <nav class="site-nav" aria-label="Main navigation">
      {#each links as link (link.label)}
        <a
          href={link.href}
          aria-current={link.href.includes("#")
            ? page.url.pathname === resolve("/") && page.url.hash === "#stories"
              ? "location"
              : undefined
            : page.url.pathname === link.href
              ? "page"
              : undefined}>{link.label}</a
        >
      {/each}
    </nav>
  </header>
  {@render children()}
</div>

<style>
.site-header {
  position: sticky;
  top: 0;
  z-index: 10;
  padding-inline: 1.25rem;
  background: rgb(255 255 255 / 94%);
  backdrop-filter: blur(18px) saturate(140%);
  box-shadow: 0 1px 0 rgb(0 30 70 / 10%);
}
.site-brand {
  display: inline-flex;
  align-items: center;
  min-height: 4rem;
  gap: 0.875rem;
  white-space: nowrap;
  color: var(--color-yale-blue);
}
.brand-title {
  font-family: var(--font-serif);
  font-size: clamp(1.125rem, 2vw, 1.375rem);
  line-height: 1.2;
  letter-spacing: -0.035em;
}
.brand-lab {
  border-left: 1px solid var(--color-rule);
  padding-left: 0.875rem;
  color: var(--color-muted);
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.015em;
}
.site-nav {
  display: flex;
  align-items: stretch;
  gap: 1.75rem;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}
.site-nav a {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  min-height: 2.75rem;
  padding-inline: 0.125rem;
  color: var(--color-ink);
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  transition: color 150ms ease-out;
}
.site-nav a::after {
  content: "";
  position: absolute;
  inset: auto 0 0;
  height: 2px;
  background: var(--color-yale-blue);
  transform: scaleX(0);
  transform-origin: center;
  transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.site-nav a[aria-current],
.site-nav a:focus-visible {
  color: var(--color-yale-blue);
}
.site-nav a[aria-current]::after,
.site-nav a:focus-visible::after {
  transform: scaleX(1);
}
.site-nav a:active,
.site-brand:active {
  opacity: 0.65;
}
.site-brand:focus-visible,
.site-nav a:focus-visible {
  outline: 2px solid var(--color-yale-blue);
  outline-offset: -3px;
  border-radius: 2px;
}
@media (hover: hover) {
  .site-nav a:hover {
    color: var(--color-yale-blue);
  }
  .site-nav a:hover::after {
    transform: scaleX(1);
  }
  .site-brand:hover .brand-lab {
    color: var(--color-yale-blue);
  }
}
@media (min-width: 1024px) {
  .site-header {
    display: flex;
    justify-content: space-between;
    gap: 2rem;
    padding-inline: 3.75rem;
  }
  .site-brand {
    flex-shrink: 0;
  }
  .site-nav a {
    min-height: 4rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .site-nav a,
  .site-nav a::after {
    transition: none;
  }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .site-header {
    background: white;
    backdrop-filter: none;
    border-bottom: 1px solid var(--color-rule);
  }
}
@media print {
  .site-header {
    display: none;
  }
}
</style>
