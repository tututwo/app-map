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
// Below 834px the links fold into a menu under the header (Apple's global nav breakpoint).
let menuOpen = $state(false);

afterNavigate(({ from, to }) => {
  menuOpen = false;
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

<svelte:window
  onkeydown={(event) => {
    if (event.key === "Escape" && menuOpen) {
      menuOpen = false;
      document.getElementById("menu-toggle")?.focus();
    }
  }}
/>

<div class="site-shell text-body bg-white font-sans text-[15px] leading-normal">
  <a
    href="#main-content"
    class="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:rounded focus-visible:bg-white focus-visible:px-4 focus-visible:py-3 focus-visible:text-yale-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yale-blue print:hidden"
    >Skip to main content</a
  >
  <header
    class="site-header print:hidden"
    data-open={menuOpen || undefined}
    onfocusout={(event) => {
      // Tabbing past the last link leaves the menu, so it folds away behind the focus.
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node))
        menuOpen = false;
    }}
  >
    <a href={resolve("/")} aria-label="Church Closures — SOCAH Lab home" class="site-brand">
      <span class="brand-title">Church Closures</span>
      <span class="brand-lab">SOCAH Lab</span>
    </a>
    <button
      id="menu-toggle"
      type="button"
      class="menu-toggle"
      aria-label="Menu"
      aria-expanded={menuOpen}
      aria-controls="site-nav"
      onclick={() => (menuOpen = !menuOpen)}
    >
      <span class="menu-bar"></span>
      <span class="menu-bar"></span>
    </button>
    <nav id="site-nav" class="site-nav" aria-label="Main navigation">
      {#each links as link, index (link.label)}
        <a
          style:--i={index}
          onclick={() => (menuOpen = false)}
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding-inline: 1.25rem;
  background: rgb(255 255 255 / 94%);
  backdrop-filter: blur(18px) saturate(140%);
  box-shadow: 0 1px 0 rgb(0 30 70 / 10%);
  transition:
    background-color 200ms ease-out,
    box-shadow 200ms ease-out;
}
.site-brand {
  display: inline-flex;
  flex-shrink: 0;
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
/* Two lines that meet, then turn into a cross; closing runs the same path backwards. */
.menu-toggle {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  margin-right: -0.75rem;
  color: var(--color-ink);
  cursor: pointer;
  transition: color 150ms ease-out;
}
.menu-bar {
  grid-area: 1 / 1;
  width: 1.125rem;
  height: 1.5px;
  border-radius: 1px;
  background: currentColor;
  transition:
    rotate 160ms cubic-bezier(0.2, 0.8, 0.2, 1),
    translate 160ms cubic-bezier(0.2, 0.8, 0.2, 1) 140ms;
}
.menu-bar:first-child {
  translate: 0 -3.5px;
}
.menu-bar:last-child {
  translate: 0 3.5px;
}
.site-header[data-open] .menu-bar {
  translate: none;
  transition:
    translate 160ms cubic-bezier(0.2, 0.8, 0.2, 1),
    rotate 200ms cubic-bezier(0.2, 0.8, 0.2, 1) 140ms;
}
.site-header[data-open] .menu-bar:first-child {
  rotate: 45deg;
}
.site-header[data-open] .menu-bar:last-child {
  rotate: -45deg;
}
.menu-toggle:active {
  opacity: 0.65;
}
.menu-toggle:focus-visible {
  outline: 2px solid var(--color-yale-blue);
  outline-offset: -3px;
  border-radius: 2px;
}
@media (hover: hover) {
  .menu-toggle:hover {
    color: var(--color-yale-blue);
  }
}

/* The menu is the header's own sheet rolling down from it, links settling in one after another. */
@media (max-width: 833.98px) {
  .site-header[data-open] {
    background: white;
    box-shadow: none;
  }
  .site-nav {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    height: calc(100vh - 4rem);
    height: calc(100dvh - 4rem);
    flex-direction: column;
    gap: 0;
    padding: 0.75rem 1.25rem 2.5rem;
    overflow: hidden auto;
    overscroll-behavior: contain;
    background: white;
    visibility: hidden;
    clip-path: inset(0 0 100% 0);
    transition:
      clip-path 280ms cubic-bezier(0.4, 0, 0.2, 1) 60ms,
      visibility 0s linear 340ms;
  }
  .site-header[data-open] .site-nav {
    visibility: visible;
    clip-path: inset(0);
    transition:
      clip-path 380ms cubic-bezier(0.2, 0.8, 0.2, 1),
      visibility 0s;
  }
  .site-nav a {
    min-height: 3.25rem;
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.015em;
    opacity: 0;
    translate: 0 -0.5rem;
    transition:
      opacity 100ms ease-in,
      translate 100ms ease-in,
      color 150ms ease-out;
  }
  .site-header[data-open] .site-nav a {
    opacity: 1;
    translate: none;
    transition:
      opacity 300ms ease-out calc(90ms + var(--i) * 35ms),
      translate 380ms cubic-bezier(0.2, 0.8, 0.2, 1) calc(90ms + var(--i) * 35ms),
      color 150ms ease-out;
  }
  .site-nav a::after {
    display: none;
  }
  :global(html:has(.site-header[data-open])) {
    overflow: hidden;
  }
}
@media (min-width: 834px) {
  .menu-toggle {
    display: none;
  }
  .site-nav a {
    min-height: 4rem;
  }
}
@media (min-width: 1024px) {
  .site-header {
    padding-inline: 3.75rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .site-nav a,
  .site-nav a::after,
  .menu-bar,
  .site-header[data-open] .menu-bar,
  .site-header[data-open] .site-nav a {
    transition: none;
  }
}
/* Without motion the menu simply fades. */
@media (max-width: 833.98px) and (prefers-reduced-motion: reduce) {
  .site-nav {
    clip-path: none;
    opacity: 0;
    transition:
      opacity 150ms ease-out,
      visibility 0s linear 150ms;
  }
  .site-header[data-open] .site-nav {
    clip-path: none;
    opacity: 1;
    transition: opacity 150ms ease-out;
  }
  .site-nav a {
    translate: none;
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
