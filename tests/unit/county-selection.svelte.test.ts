import { describe, expect, it, vi } from "vitest";

import { CountySelection } from "$lib/dashboard/county-selection.svelte";

function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createSelection(initialGeoid = "00000") {
  const settledRef = { geoid: initialGeoid };
  const navigations: Array<ReturnType<typeof deferred>> = [];
  const navigate = vi.fn(() => {
    const navigation = deferred();
    navigations.push(navigation);
    return navigation.promise;
  });
  const selection = new CountySelection({ navigate, settled: () => settledRef.geoid });
  return { selection, navigate, navigations, settledRef };
}

describe("county selection", () => {
  it("shows the pending geoid optimistically and clears it when its navigation settles", async () => {
    const { selection, navigations, settledRef } = createSelection();

    const navigation = selection.select("01001");
    expect(selection.geoid).toBe("01001");

    settledRef.geoid = "01001";
    navigations[0].resolve();
    await navigation;

    expect(selection.geoid).toBe("01001");
  });

  it("an older navigation settling cannot clear a newer pending selection", async () => {
    const { selection, navigations } = createSelection();

    const older = selection.select("01001");
    const newer = selection.select("09009");
    expect(selection.geoid).toBe("09009");

    navigations[0].reject(new Error("superseded"));
    await expect(older).rejects.toThrow("superseded");
    expect(selection.geoid).toBe("09009");

    navigations[1].resolve();
    await newer;
  });

  it("select aborts an outstanding intent and fires its onAbort", () => {
    const { selection } = createSelection();
    const onAbort = vi.fn();
    const signal = selection.newIntent(onAbort);

    void selection.select("01001").catch(() => {});

    expect(signal.aborted).toBe(true);
    expect(onAbort).toHaveBeenCalledOnce();
  });

  it("a select committed from an intent keeps that intent alive", () => {
    const { selection } = createSelection();
    const onAbort = vi.fn();
    const signal = selection.newIntent(onAbort);

    void selection.select("01001", { fromIntent: signal }).catch(() => {});

    expect(signal.aborted).toBe(false);
    expect(onAbort).not.toHaveBeenCalled();
  });

  it("a new intent aborts the previous one", () => {
    const { selection } = createSelection();
    const first = selection.newIntent();
    const second = selection.newIntent();

    expect(first.aborted).toBe(true);
    expect(second.aborted).toBe(false);
  });

  it("an unexpected settled geoid aborts the intent; an expected one does not", async () => {
    const { selection, navigations, settledRef } = createSelection();

    const signal = selection.newIntent();
    const navigation = selection.select("01001", { fromIntent: signal });
    settledRef.geoid = "01001";
    selection.observeSettled("01001");
    expect(signal.aborted).toBe(false);

    settledRef.geoid = "09009";
    selection.observeSettled("09009");
    expect(signal.aborted).toBe(true);

    navigations[0].resolve();
    await navigation;
  });

  it("display-name override applies only while its geoid is current", async () => {
    const { selection, navigations, settledRef } = createSelection();

    const navigation = selection.select("01001");
    selection.setDisplayName("Autauga County, AL");
    expect(selection.nameOverride).toBe("Autauga County, AL");

    settledRef.geoid = "01001";
    navigations[0].resolve();
    await navigation;
    expect(selection.nameOverride).toBe("Autauga County, AL");

    void selection.select("09009").catch(() => {});
    expect(selection.nameOverride).toBeUndefined();
  });
});
