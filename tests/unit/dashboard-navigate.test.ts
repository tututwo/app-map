import { describe, expect, it, vi } from "vitest";

import { createDashboardParamsWriter, type DashboardGoto } from "../../src/lib/dashboard/navigate";

function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe("dashboard parameter navigation", () => {
  it("updates supplied dashboard parameters without disturbing the rest of the URL", async () => {
    const goto = vi.fn<DashboardGoto>().mockResolvedValue(undefined);
    const setDashboardParams = createDashboardParamsWriter({
      getCurrentUrl: () =>
        new URL("https://example.test/dashboard?from=2003&to=2011&geoid=00000&theme=dark#map"),
      goto,
    });

    await setDashboardParams({ from: 2004, geoid: "01001" });

    expect(goto).toHaveBeenCalledOnce();
    expect(goto).toHaveBeenCalledWith(
      new URL("https://example.test/dashboard?from=2004&to=2011&geoid=01001&theme=dark#map"),
      { replaceState: true, noScroll: true, keepFocus: true }
    );
  });

  it("leaves explicitly undefined dashboard parameters untouched", async () => {
    const goto = vi.fn<DashboardGoto>().mockResolvedValue(undefined);
    const setDashboardParams = createDashboardParamsWriter({
      getCurrentUrl: () =>
        new URL("https://example.test/?from=2003&to=2011&geoid=00000&theme=dark"),
      goto,
    });

    await setDashboardParams({ from: undefined, to: 2012, geoid: undefined });

    expect(goto.mock.calls[0][0]).toEqual(
      new URL("https://example.test/?from=2003&to=2012&geoid=00000&theme=dark")
    );
  });

  it("merges concurrent partial writes against the newest pending target", async () => {
    const navigations = [deferred(), deferred(), deferred()];
    const goto = vi.fn((_url: URL) => navigations[goto.mock.calls.length - 1].promise);
    const setDashboardParams = createDashboardParamsWriter({
      getCurrentUrl: () =>
        new URL("https://example.test/dashboard?from=2003&to=2011&geoid=00000&theme=dark"),
      goto,
    });

    const brushNavigation = setDashboardParams({ from: 2004, to: 2012 });
    const searchNavigation = setDashboardParams({ geoid: "01001" });

    expect(goto.mock.calls[1][0]).toEqual(
      new URL("https://example.test/dashboard?from=2004&to=2012&geoid=01001&theme=dark")
    );

    navigations[0].resolve();
    await brushNavigation;

    const newerBrushNavigation = setDashboardParams({ to: 2013 });

    expect(goto.mock.calls[2][0]).toEqual(
      new URL("https://example.test/dashboard?from=2004&to=2013&geoid=01001&theme=dark")
    );

    navigations[1].resolve();
    navigations[2].resolve();
    await Promise.all([searchNavigation, newerBrushNavigation]);
  });

  it("does not let an older failed navigation clear a newer pending target", async () => {
    const navigations = [deferred(), deferred(), deferred()];
    const goto = vi.fn((_url: URL) => navigations[goto.mock.calls.length - 1].promise);
    const setDashboardParams = createDashboardParamsWriter({
      getCurrentUrl: () =>
        new URL("https://example.test/?from=2003&to=2011&geoid=00000&theme=dark"),
      goto,
    });

    const olderNavigation = setDashboardParams({ from: 2004 });
    const searchNavigation = setDashboardParams({ geoid: "01001" });

    navigations[0].reject(new Error("superseded"));
    await expect(olderNavigation).rejects.toThrow("superseded");

    const brushNavigation = setDashboardParams({ to: 2013 });
    expect(goto.mock.calls[2][0]).toEqual(
      new URL("https://example.test/?from=2004&to=2013&geoid=01001&theme=dark")
    );

    navigations[1].resolve();
    navigations[2].resolve();
    await Promise.all([searchNavigation, brushNavigation]);
  });

  it("discards the failed target after the latest navigation settles", async () => {
    const failedNavigation = deferred();
    const goto = vi
      .fn<(url: URL) => Promise<void>>()
      .mockImplementationOnce(() => failedNavigation.promise)
      .mockResolvedValueOnce(undefined);
    const setDashboardParams = createDashboardParamsWriter({
      getCurrentUrl: () =>
        new URL("https://example.test/?from=2003&to=2011&geoid=00000&theme=dark"),
      goto,
    });

    const failure = setDashboardParams({ from: 2004 });
    failedNavigation.reject(new Error("navigation failed"));
    await expect(failure).rejects.toThrow("navigation failed");

    await setDashboardParams({ geoid: "01001" });
    expect(goto.mock.calls[1][0]).toEqual(
      new URL("https://example.test/?from=2003&to=2011&geoid=01001&theme=dark")
    );
  });
});
