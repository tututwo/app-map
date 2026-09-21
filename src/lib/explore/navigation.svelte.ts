import {
  DEFAULT_QUERY,
  formatAt,
  parentOf,
  unitFor,
  whereOf,
  type ExploreQuery,
  type Level,
  type LngLat,
} from "./model";

export type AddressText = { at: string; text: string };
type Target = { query: ExploreQuery; address?: AddressText };

/** Keep the newest location intent while its boundaries or route data are still loading. */
export class ExploreNavigation {
  #pending = $state.raw<Target | null>(null);
  #ticket = 0;
  #resolving = false;
  locating = $state<boolean | "failed">(false);
  notice = $state("");

  constructor(
    private settled: () => Target,
    private navigate: (target: Target) => Promise<void>,
    private locate: (level: Level, at: LngLat) => Promise<string | null>
  ) {}

  get current() {
    return this.#pending ?? this.settled();
  }

  #stage(patch: Partial<ExploreQuery>, address = this.current.address) {
    const query = { ...this.current.query, ...patch };
    // A different map point or named place must never inherit the previous address text.
    if (query.near !== "address" || !query.at || address?.at !== formatAt(query.at))
      address = undefined;
    return (this.#pending = { query, address });
  }

  async update(patch: Partial<ExploreQuery>) {
    const target = this.#stage(patch);
    try {
      await this.navigate(target);
    } finally {
      // A completed route must not clear a newer choice, or a boundary lookup still in progress.
      if (this.#pending === target && !this.#resolving) this.#pending = null;
    }
  }

  async look(next: {
    at?: LngLat;
    level?: Level;
    geoid?: string;
    near?: string;
    address?: string;
    quiet?: boolean;
  }) {
    const mine = ++this.#ticket;
    const current = this.current.query;
    const unit = unitFor(current.where, current.level);
    const level = next.level ?? current.level;
    const at = next.at ?? current.at;
    let id = next.geoid ?? (next.at || !unit ? undefined : parentOf(unit, level));
    this.notice = "";
    if (!at && !id && unit) {
      this.notice =
        "Search for a place or click the map to choose a point before changing this view.";
      return;
    }
    const address = next.at
      ? next.address === undefined
        ? undefined
        : { at: formatAt(next.at), text: next.address }
      : this.current.address;
    // Stage before the first await, so a second action sees this point and label together.
    this.#stage(
      {
        at,
        level,
        near: next.at ? (next.near ?? "") : current.near,
        via:
          next.at || current.near
            ? ""
            : next.level && next.level !== current.level
              ? current.via || (unit?.name ?? "")
              : current.via,
        where: next.quiet ? current.where : whereOf(level, id),
      },
      address
    );
    this.#resolving = !id && !!at;
    this.locating = !next.quiet && this.#resolving;
    let failed = false;
    if (!id && at) {
      try {
        id = (await this.locate(level, at)) ?? undefined;
      } catch {
        failed = true;
      }
    }
    if (mine !== this.#ticket) return;
    this.#resolving = false;
    this.locating = failed ? "failed" : false;
    // Filters may have changed during the lookup; preserve them, resolving only this Location.
    await this.update({ where: whereOf(level, id) });
  }

  reset() {
    this.cancel();
    return this.update(DEFAULT_QUERY);
  }

  /** Leaving Explore invalidates pending lookups; they must not navigate the visitor back. */
  cancel() {
    this.#ticket++;
    this.#pending = null;
    this.#resolving = false;
    this.locating = false;
    this.notice = "";
  }
}
