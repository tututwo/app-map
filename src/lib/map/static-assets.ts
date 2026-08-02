import countiesTopologyUrl from "$data/counties-10m.json?url";
import countyCameraUrl from "$data/county-camera.json?url";

export type CountyCamera = {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
};

export type CountyCameraLookup = Record<string, CountyCamera>;

export type MapStaticAssets = {
  countiesTopology: unknown;
  countyCameras: CountyCameraLookup;
};

type JsonResponse = Pick<Response, "ok" | "status" | "statusText" | "json">;
type AssetFetch = (assetUrl: string) => Promise<JsonResponse>;

type MapAssetUrls = {
  countiesTopology: string;
  countyCameras: string;
};

function createJsonAssetLoader(fetchAsset: AssetFetch) {
  const promises = new Map<string, Promise<unknown>>();

  return function loadJsonAsset<T>(assetUrl: string): Promise<T> {
    const cached = promises.get(assetUrl);
    if (cached) return cached as Promise<T>;

    const pending = fetchAsset(assetUrl).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `Failed to load map asset ${assetUrl}: ${response.status} ${response.statusText}`.trim()
        );
      }

      return response.json() as Promise<T>;
    });

    promises.set(assetUrl, pending);
    void pending.catch(() => {
      if (promises.get(assetUrl) === pending) promises.delete(assetUrl);
    });

    return pending;
  };
}

export function createMapAssetsLoader(fetchAsset: AssetFetch, urls: MapAssetUrls) {
  const loadJsonAsset = createJsonAssetLoader(fetchAsset);
  let assetsPromise: Promise<MapStaticAssets> | undefined;

  return function loadMapAssets(): Promise<MapStaticAssets> {
    if (assetsPromise) return assetsPromise;

    const pending = Promise.all([
      loadJsonAsset<unknown>(urls.countiesTopology),
      loadJsonAsset<CountyCameraLookup>(urls.countyCameras),
    ]).then(([countiesTopology, countyCameras]) => ({ countiesTopology, countyCameras }));

    assetsPromise = pending;
    void pending.catch(() => {
      if (assetsPromise === pending) assetsPromise = undefined;
    });

    return pending;
  };
}

export const loadMapAssets = createMapAssetsLoader((assetUrl) => fetch(assetUrl), {
  countiesTopology: countiesTopologyUrl,
  countyCameras: countyCameraUrl,
});
