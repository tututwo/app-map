import { describe, expect, test } from "vitest";

import { createLastGood } from "$lib/dashboard/last-good.svelte";

describe("createLastGood", () => {
  test("exposes an initial server-loaded result immediately", () => {
    const state = createLastGood({ ok: true, data: { id: "server" } });

    expect(state.value).toEqual({ id: "server" });
    expect(state.error).toBeUndefined();
  });

  test("exposes the latest successful value without an error", () => {
    const state = createLastGood<{ id: string }>();

    state.update({ ok: true, data: { id: "first" } });

    expect(state.value).toEqual({ id: "first" });
    expect(state.error).toBeUndefined();
  });

  test("retains the last success while exposing the current error", () => {
    const state = createLastGood<{ id: string }>();
    state.update({ ok: true, data: { id: "first" } });

    state.update({ ok: false, kind: "http", message: "HTTP 503" });

    expect(state.value).toEqual({ id: "first" });
    expect(state.error).toEqual({ ok: false, kind: "http", message: "HTTP 503" });
  });

  test("replaces the value and clears the error after recovery", () => {
    const state = createLastGood<{ id: string }>();
    state.update({ ok: true, data: { id: "first" } });
    state.update({ ok: false, kind: "network", message: "offline" });

    state.update({ ok: true, data: { id: "second" } });

    expect(state.value).toEqual({ id: "second" });
    expect(state.error).toBeUndefined();
  });

  test("keeps state isolated between factory instances", () => {
    const mapState = createLastGood<string[]>();
    const lineState = createLastGood<number[]>();

    mapState.update({ ok: true, data: ["map"] });
    lineState.update({ ok: false, kind: "timeout", message: "timed out" });

    expect(mapState.value).toEqual(["map"]);
    expect(mapState.error).toBeUndefined();
    expect(lineState.value).toBeUndefined();
    expect(lineState.error?.kind).toBe("timeout");
  });
});
