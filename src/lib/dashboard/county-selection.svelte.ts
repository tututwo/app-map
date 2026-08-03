import type { DashboardParamsUpdate } from "./navigate";

interface CountySelectionDependencies {
  navigate: (update: DashboardParamsUpdate) => Promise<void>;
  /** The canonical geoid, settled in the URL. */
  settled: () => string;
}

/**
 * County Selection: the one owner of "which county is selected and why".
 * Selection intents (search, map click, geolocation) race; the newest choice
 * always wins — an older async resolution can never overwrite a newer one.
 *
 * Async selectors (the geolocator) open an intent before resolving and pass
 * its signal back when committing; any newer selection aborts the intent, and
 * the abort tells the opener to stand down.
 */
export class CountySelection {
  #deps: CountySelectionDependencies;
  #pendingGeoid = $state.raw<string | null>(null);
  #override = $state.raw<{ geoid: string; name: string | null } | null>(null);
  #generation = 0;
  #intent: AbortController | null = null;
  #expectedSettled: string | null = null;
  #observedSettled: string | null = null;

  constructor(deps: CountySelectionDependencies) {
    this.#deps = deps;
  }

  /** Optimistic geoid: the pending selection, else the settled URL geoid. */
  get geoid(): string {
    return this.#pendingGeoid ?? this.#deps.settled();
  }

  /** Display-name override for the current geoid, or undefined when none applies. */
  get nameOverride(): string | null | undefined {
    return this.#override?.geoid === this.geoid ? this.#override.name : undefined;
  }

  /** Select a county. Aborts any outstanding intent except `fromIntent`'s own. */
  select(geoid: string, options: { fromIntent?: AbortSignal } = {}): Promise<void> {
    if (!options.fromIntent || this.#intent?.signal !== options.fromIntent) {
      this.#cancelIntent();
    }

    const generation = ++this.#generation;
    this.#pendingGeoid = geoid;
    this.#expectedSettled = geoid;

    return this.#deps.navigate({ geoid }).finally(() => {
      if (generation === this.#generation) this.#pendingGeoid = null;
    });
  }

  /** Attach a display name to the currently selected geoid. */
  setDisplayName(name: string | null): void {
    this.#override = { geoid: this.geoid, name };
  }

  /**
   * Open a new async selection intent, aborting the previous one. The
   * returned signal aborts when a newer selection supersedes this intent.
   */
  newIntent(onAbort?: () => void): AbortSignal {
    this.#cancelIntent();
    this.#intent = new AbortController();
    if (onAbort) this.#intent.signal.addEventListener("abort", onAbort, { once: true });
    return this.#intent.signal;
  }

  /** Report the settled URL geoid; an unexpected external change aborts intents. */
  observeSettled(settledGeoid: string): void {
    if (settledGeoid === this.#observedSettled) return;
    this.#observedSettled = settledGeoid;
    if (settledGeoid !== this.#expectedSettled) this.#cancelIntent();
  }

  #cancelIntent(): void {
    const intent = this.#intent;
    this.#intent = null;
    intent?.abort();
  }
}
