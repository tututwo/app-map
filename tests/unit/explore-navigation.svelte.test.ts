import { describe, expect, it, vi } from "vitest";
import { ExploreNavigation, type AddressText } from "$lib/explore/navigation.svelte";
import { DEFAULT_QUERY, type ExploreQuery, type LngLat } from "$lib/explore/model";

const dc: LngLat = [-77.03519, 38.8987];
const miami: LngLat = [-80.2, 25.77];
const initial = {
  ...DEFAULT_QUERY,
  at: dc,
  near: "address",
  level: "zcta" as const,
  where: "20006",
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

describe("Explore location navigation", () => {
  it("uses the new ZIP's point and label when its route is still loading", async () => {
    const routes = [deferred<void>(), deferred<void>()];
    const navigate = vi.fn(
      (_target: { query: ExploreQuery; address?: AddressText }) =>
        routes[navigate.mock.calls.length - 1].promise
    );
    const locate = vi.fn().mockResolvedValue("12086003701");
    const navigation = new ExploreNavigation(() => ({ query: initial }), navigate, locate);

    const zip = navigation.look({ at: miami, level: "zcta", geoid: "33101", near: "ZIP 33101" });
    const tract = navigation.look({ level: "tract" });
    routes[0].resolve();
    await zip;
    expect(locate).toHaveBeenCalledWith("tract", miami);
    expect(navigation.current.query).toMatchObject({
      at: miami,
      near: "ZIP 33101",
      level: "tract",
      where: "12086003701",
    });
    expect(navigate.mock.calls[1][0].query).toMatchObject({ at: miami, near: "ZIP 33101" });
    routes[1].resolve();
    await tract;
  });

  it("retains a new address across a second level lookup and a concurrent year change", async () => {
    const first = deferred<string | null>();
    const second = deferred<string | null>();
    const locate = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    let settled: { query: ExploreQuery; address?: AddressText } = { query: initial };
    const navigate = vi.fn(async (target) => {
      settled = target;
    });
    const navigation = new ExploreNavigation(() => settled, navigate, locate);
    const raw = "  1600 Pennsylvania Ave NW, Washington, DC  ";

    const address = navigation.look({ at: dc, near: "address", address: raw });
    const tract = navigation.look({ level: "tract" });
    await navigation.update({ to: 2019 });
    second.resolve("11001006202");
    await tract;
    first.resolve("20006");
    await address;

    expect(navigate).toHaveBeenCalledTimes(2);
    expect(settled.query).toMatchObject({ at: dc, level: "tract", where: "11001006202", to: 2019 });
    expect(settled.address?.text).toBe(raw);
    expect(settled.query.near).toBe("address");
    expect(JSON.stringify(settled.query)).not.toContain(raw);
    await navigation.update({ type: "christian_church" });
    expect(settled.address?.text).toBe(raw);
  });

  it("clears address text when the visitor picks another place or resets", async () => {
    let settled: { query: ExploreQuery; address?: AddressText } = {
      query: initial,
      address: { at: "-77.03519,38.89870", text: "Original address" },
    };
    const navigation = new ExploreNavigation(
      () => settled,
      async (target) => {
        settled = target;
      },
      async () => "20006"
    );
    await navigation.look({ at: dc, level: "zcta", geoid: "20006", near: "ZIP 20006" });
    expect(settled.address).toBeUndefined();
    await navigation.look({ at: dc, near: "address", address: "New address spelling" });
    expect(settled.address?.text).toBe("New address spelling");
    await navigation.reset();
    expect(settled).toEqual({ query: DEFAULT_QUERY, address: undefined });
  });

  it("does not let a lookup navigate after leaving Explore or resetting", async () => {
    const lookup = deferred<string | null>();
    const navigate = vi.fn().mockResolvedValue(undefined);
    const navigation = new ExploreNavigation(
      () => ({ query: initial }),
      navigate,
      () => lookup.promise
    );
    const selection = navigation.look({ at: miami, near: "Miami" });
    navigation.cancel();
    lookup.resolve("33101");
    await selection;
    expect(navigate).not.toHaveBeenCalled();
    expect(navigation.locating).toBe(false);
  });

  it("preserves a shared tract without a Focus when ZIP cannot be inferred", async () => {
    const query = { ...DEFAULT_QUERY, level: "tract" as const, where: "09009141600" };
    const navigate = vi.fn().mockResolvedValue(undefined);
    const navigation = new ExploreNavigation(() => ({ query }), navigate, vi.fn());
    await navigation.look({ level: "zcta" });
    expect(navigate).not.toHaveBeenCalled();
    expect(navigation.current.query).toEqual(query);
    expect(navigation.notice).toContain("choose a point");
    await navigation.look({ level: "county" });
    expect(navigate.mock.calls[0][0].query).toMatchObject({ level: "county", where: "09009" });
  });

  it("quiet link reconciliation retains the panel while a lookup is pending", async () => {
    const lookup = deferred<string | null>();
    const navigation = new ExploreNavigation(
      () => ({ query: initial }),
      async () => {},
      () => lookup.promise
    );
    const checking = navigation.look({ quiet: true });
    expect(navigation.locating).toBe(false);
    expect(navigation.current.query.where).toBe("20006");
    lookup.resolve("20006");
    await checking;
  });
});
