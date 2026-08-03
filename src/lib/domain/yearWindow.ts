import bounds from "$lib/generated/year-window-bounds.json";

/**
 * A Year Window is a contiguous span of calendar years [from, to]. Legality is
 * data-driven: the bounds below are derived by scripts/prebuild-data.mjs from
 * the windows the source data actually provides (the prebuild fails if the
 * generated set ever stops being exactly "everything within bounds meeting the
 * minimum gap"). Product intent is to allow 5-calendar-year windows; that
 * loosens automatically here once upstream data ships gap-4 columns.
 */
export interface YearWindow {
  from: number;
  to: number;
}

/** Which edge of the window the caller was changing, if any. */
export type AdjustedEdge = "from" | "to" | null;

export const YEAR_WINDOW_BOUNDS: Readonly<{
  minYear: number;
  maxYear: number;
  minGap: number;
}> = bounds;

/**
 * Clamp any integer pair onto the nearest legal Year Window. Total: every
 * input lands on a window the data pipeline actually generated. When the
 * caller was dragging one edge (the brush), that edge yields first; otherwise
 * an under-sized window widens from its center.
 */
export function clampYearWindow(
  from: number,
  to: number,
  adjusted: AdjustedEdge = null
): YearWindow {
  const { minYear, maxYear, minGap } = YEAR_WINDOW_BOUNDS;

  if (to - from < minGap) {
    if (adjusted === "to") {
      to = from + minGap;
      if (to > maxYear) {
        to = maxYear;
        from = to - minGap;
      }
    } else if (adjusted === "from") {
      from = to - minGap;
      if (from < minYear) {
        from = minYear;
        to = from + minGap;
      }
    } else {
      const center = (from + to) / 2;
      from = Math.max(minYear, Math.floor(center - minGap / 2));
      to = Math.min(maxYear, from + minGap);
      if (to > maxYear) {
        to = maxYear;
        from = to - minGap;
      }
      if (from < minYear) {
        from = minYear;
        to = from + minGap;
      }
    }
  }

  return {
    from: Math.max(minYear, Math.min(maxYear - minGap, from)),
    to: Math.min(maxYear, Math.max(minYear + minGap, to)),
  };
}

/**
 * Why a window is illegal, as a human-readable message — or null when it is
 * legal. Serves the API validators; UI code wanting a cheap predicate can
 * compare spans against YEAR_WINDOW_BOUNDS.minGap directly.
 */
export function yearWindowViolation(from: number, to: number): string | null {
  const { minYear, maxYear, minGap } = YEAR_WINDOW_BOUNDS;

  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    return "from and to must be valid integers";
  }
  if (from < minYear || from > maxYear || to < minYear || to > maxYear) {
    return `Year range must be within ${minYear}-${maxYear}`;
  }
  if (from > to) {
    return "Start year must be before or equal to end year";
  }
  if (to - from < minGap) {
    return `Year range must span at least ${minGap + 1} calendar years`;
  }
  return null;
}
