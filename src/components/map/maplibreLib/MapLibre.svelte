<script lang="ts">
// https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/

import { onDestroy, type Snippet } from "svelte";
import maplibregl from "maplibre-gl";
import { prepareMapContext } from "./contexts.svelte.js";
import { formatLngLat, resetEventListener } from "./utils.js";

type MapEventProps = {
  [K in keyof maplibregl.MapEventType as `on${K}`]?: (ev: maplibregl.MapEventType[K]) => void;
};

interface Props extends Omit<maplibregl.MapOptions, "container">, MapEventProps {
  /**
   * You can access the internal MapLibre GL `Map` instance by binding a variable to this prop.
   *
   * This allows you to directly interact with the underlying Map instance, enabling imperative API calls.
   */
  map?: maplibregl.Map;
  class?: string;
  /** Inline CSS `style` for the map container HTML element. Not to be confused with the map's style settings. */
  inlineStyle?: string;
  /** The padding in pixels around the viewport */
  padding?: maplibregl.PaddingOptions;
  /** Vertical field of view in degrees */
  fov?: number;
  /** Cursor style for the map canvas */
  cursor?: string;
  /** Loads and applies maplibre-gl.css from a CDN. Set to false if you want to include it manually. */
  autoloadGlobalCss?: boolean;

  // Accessors
  // https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#accessors
  /** Whether the map will render an outline around each tile and the tile ID. These tile boundaries are useful for debugging. */
  showTileBoundaries?: boolean;
  /** Whether the map will visualize the padding offsets. */
  showPadding?: boolean;
  /** Whether the map will visualize the padding offsets. */
  showCollisionBoxes?: boolean;
  /** Whether the map will render boxes around all symbols in the data source */
  showOverdrawInspector?: boolean;
  /** Whether the map will continuously repaint. This information is useful for analyzing performance. */
  repaint?: boolean;
  vertices?: boolean;
  preserveDrawingBuffer?: boolean;
  // Snippets
  children?: Snippet<[maplibregl.Map]>;
}

let {
  map = $bindable(undefined),
  class: className = "",
  inlineStyle = "",
  children,
  autoloadGlobalCss: autoloadGlobalCss = true,

  // Events
  // https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/
  onerror,
  onload,
  onidle,
  onremove,
  onrender,
  onresize,
  onwebglcontextlost,
  onwebglcontextrestored,
  ondataloading,
  ondata,
  ontiledataloading,
  onsourcedataloading,
  onstyledataloading,
  onsourcedata,
  onstyledata,
  onstyleimagemissing,
  ondataabort,
  onsourcedataabort,
  onboxzoomcancel,
  onboxzoomstart,
  onboxzoomend,
  ontouchcancel,
  ontouchmove,
  ontouchend,
  ontouchstart,
  onclick,
  oncontextmenu,
  ondblclick,
  onmousemove,
  onmouseup,
  onmousedown,
  onmouseout,
  onmouseover,
  onmovestart,
  onmove,
  onmoveend,
  onzoomstart,
  onzoom,
  onzoomend,
  onrotatestart,
  onrotate,
  onrotateend,
  ondragstart,
  ondrag,
  ondragend,
  onpitchstart,
  onpitch,
  onpitchend,
  onwheel,
  onterrain,
  oncooperativegestureprevented,
  onprojectiontransition,

  // Others
  padding = { top: 0, bottom: 0, left: 0, right: 0 },
  fov,
  cursor,

  // Accessors
  showTileBoundaries,
  showPadding,
  showCollisionBoxes,
  showOverdrawInspector,
  repaint,
  vertices,

  // Map Options (reactive)
  bearing = $bindable(undefined),
  bearingSnap,
  center = $bindable(undefined),
  centerClampedToGround,
  elevation = $bindable(undefined),
  interactive = undefined,
  maxBounds,
  maxPitch,
  maxZoom,
  minPitch,
  minZoom,
  pitch = $bindable(undefined),
  pixelRatio,
  renderWorldCopies,
  roll = $bindable(undefined),
  style = { version: 8, sources: {}, layers: [] },
  transformRequest,
  zoom = $bindable(undefined),

  // Map Options (properties)
  boxZoom,
  cancelPendingTileRequestsWhileZooming,
  cooperativeGestures,
  doubleClickZoom,
  dragPan,
  dragRotate,
  keyboard,
  scrollZoom,
  touchPitch,
  touchZoomRotate,
  transformCameraUpdate,
  preserveDrawingBuffer = true,
  // Map Options (others)
  ...restOptions
}: Props = $props();
let isFlyingProgrammatically = false;
if (
  autoloadGlobalCss &&
  globalThis.window &&
  !document.querySelector('link[href$="/maplibre-gl.css"]')
) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://unpkg.com/maplibre-gl@${maplibregl.getVersion()}/dist/maplibre-gl.css`;
  document.head.appendChild(link);
}

let container: HTMLElement | undefined = $state();

const mapCtx = prepareMapContext();

$effect(() => {
  if (map || !container) {
    return;
  }
  const options: maplibregl.MapOptions = {
    container,
    ...Object.fromEntries(
      Object.entries({
        // Map Options (reactive)
        bearing,
        bearingSnap,
        center,
        centerClampedToGround,
        elevation,
        interactive,
        maxBounds,
        maxPitch,
        maxZoom,
        minPitch,
        minZoom,
        pitch,
        pixelRatio,
        renderWorldCopies,
        roll,
        style,
        transformRequest,
        zoom,
        // Map Options (Map properties)
        boxZoom,
        cancelPendingTileRequestsWhileZooming,
        cooperativeGestures,
        doubleClickZoom,
        dragPan,
        dragRotate,
        keyboard,
        scrollZoom,
        touchPitch,
        touchZoomRotate,
        transformCameraUpdate,
        // Map Options (others)
        ...restOptions,

        // filter out undefined values
      }).filter(([, v]) => v !== undefined)
    ),
  };

  map = new maplibregl.Map(options);
  mapCtx.map = map ?? null;

  if (cursor) {
    map.getCanvas().style.cursor = cursor ?? "";
  }

  map.on("move", () => {
    // If the map is flying due to a command, do not send updates back up.
    if (isFlyingProgrammatically) return;
    if (!map) {
      return;
    }
    const tr = map.transform;
    if (center) {
      const _center = maplibregl.LngLat.convert(center);
      if (_center.lat !== tr.center.lat || _center.lng !== tr.center.lng) {
        center = formatLngLat(center, tr.center);
      }
    } else {
      center = tr.center;
    }
    if (tr.zoom !== zoom) {
      zoom = tr.zoom;
    }
    if (tr.bearing !== bearing) {
      bearing = tr.bearing;
    }
    if (tr.pitch !== pitch) {
      pitch = tr.pitch;
    }
    if (tr.roll !== roll) {
      roll = tr.roll;
    }
    if (tr.elevation !== elevation) {
      elevation = tr.elevation;
    }
  });
});

// Events
$effect(() => resetEventListener(map, "boxzoomcancel", onboxzoomcancel));
$effect(() => resetEventListener(map, "boxzoomend", onboxzoomend));
$effect(() => resetEventListener(map, "boxzoomstart", onboxzoomstart));
$effect(() => resetEventListener(map, "click", onclick));
$effect(() => resetEventListener(map, "contextmenu", oncontextmenu));
$effect(() =>
  resetEventListener(map, "cooperativegestureprevented", oncooperativegestureprevented)
);
$effect(() => resetEventListener(map, "data", ondata));
$effect(() => resetEventListener(map, "dataabort", ondataabort));
$effect(() => resetEventListener(map, "dataloading", ondataloading));
$effect(() => resetEventListener(map, "dblclick", ondblclick));
$effect(() => resetEventListener(map, "drag", ondrag));
$effect(() => resetEventListener(map, "dragend", ondragend));
$effect(() => resetEventListener(map, "dragstart", ondragstart));
$effect(() => resetEventListener(map, "error", onerror));
$effect(() => resetEventListener(map, "idle", onidle));
$effect(() => resetEventListener(map, "load", onload));
$effect(() => resetEventListener(map, "mousedown", onmousedown));
$effect(() => resetEventListener(map, "mousemove", onmousemove));
$effect(() => resetEventListener(map, "mouseout", onmouseout));
$effect(() => resetEventListener(map, "mouseover", onmouseover));
$effect(() => resetEventListener(map, "mouseup", onmouseup));
$effect(() => resetEventListener(map, "move", onmove));
$effect(() => resetEventListener(map, "moveend", onmoveend));
$effect(() => resetEventListener(map, "movestart", onmovestart));
$effect(() => resetEventListener(map, "pitch", onpitch));
$effect(() => resetEventListener(map, "pitchend", onpitchend));
$effect(() => resetEventListener(map, "pitchstart", onpitchstart));
$effect(() => resetEventListener(map, "projectiontransition", onprojectiontransition));
$effect(() => resetEventListener(map, "remove", onremove));
$effect(() => resetEventListener(map, "render", onrender));
$effect(() => resetEventListener(map, "resize", onresize));
$effect(() => resetEventListener(map, "rotate", onrotate));
$effect(() => resetEventListener(map, "rotateend", onrotateend));
$effect(() => resetEventListener(map, "rotatestart", onrotatestart));
$effect(() => resetEventListener(map, "sourcedata", onsourcedata));
$effect(() => resetEventListener(map, "sourcedataabort", onsourcedataabort));
$effect(() => resetEventListener(map, "sourcedataloading", onsourcedataloading));
$effect(() => resetEventListener(map, "styledata", onstyledata));
$effect(() => resetEventListener(map, "styledataloading", onstyledataloading));
$effect(() => resetEventListener(map, "styleimagemissing", onstyleimagemissing));
$effect(() => resetEventListener(map, "terrain", onterrain));
$effect(() => resetEventListener(map, "tiledataloading", ontiledataloading));
$effect(() => resetEventListener(map, "touchcancel", ontouchcancel));
$effect(() => resetEventListener(map, "touchend", ontouchend));
$effect(() => resetEventListener(map, "touchmove", ontouchmove));
$effect(() => resetEventListener(map, "touchstart", ontouchstart));
$effect(() => resetEventListener(map, "webglcontextlost", onwebglcontextlost));
$effect(() => resetEventListener(map, "webglcontextrestored", onwebglcontextrestored));
$effect(() => resetEventListener(map, "wheel", onwheel));
$effect(() => resetEventListener(map, "zoom", onzoom));
$effect(() => resetEventListener(map, "zoomend", onzoomend));
$effect(() => resetEventListener(map, "zoomstart", onzoomstart));

let firstRun = true;

$effect(() => {
  // TODO: differential update ?
  className;
  const classNames = (className ?? "")?.split(/\s/).filter(Boolean);
  if (container && !firstRun) {
    for (const className of classNames) {
      container.classList.add(className);
    }
  }
  return () => {
    if (container) {
      for (const className of classNames) {
        container.classList.remove(className);
      }
    }
  };
});

// Others
$effect(() => {
  if (fov !== undefined) {
    map?.setVerticalFieldOfView(fov);
  }
});
$effect(() => {
  cursor;
  if (map && !firstRun) {
    map.getCanvas().style.cursor = cursor ?? "";
  }
});

// Accessors
$effect(() => {
  if (map && showTileBoundaries !== undefined && !firstRun) {
    map.showTileBoundaries = showTileBoundaries;
  }
});
$effect(() => {
  if (map && showPadding !== undefined && !firstRun) {
    map.showPadding = showPadding;
  }
});
$effect(() => {
  if (map && showCollisionBoxes !== undefined && !firstRun) {
    map.showCollisionBoxes = showCollisionBoxes;
  }
});
$effect(() => {
  if (map && showOverdrawInspector !== undefined && !firstRun) {
    map.showOverdrawInspector = showOverdrawInspector;
  }
});
$effect(() => {
  if (map && repaint !== undefined && !firstRun) {
    map.repaint = repaint;
  }
});
$effect(() => {
  if (map && vertices !== undefined && !firstRun) {
    map.vertices = vertices;
  }
});

// Map Options (reactive)

$effect(() => {
  // Reactive dependencies: props that define the camera's target view
  center;
  zoom;
  bearing;
  pitch;
  padding; // Assuming padding changes should also trigger a view update

  // Ensure the effect only runs after the initial setup and if the map instance exists and its style is loaded
  if (!firstRun && map && map.isStyleLoaded()) {
    // Get the map's current camera state. map.getFreeCameraOptions() is good if available and you use it.
    // Otherwise, get individual properties.
    const currentMapCenter = map.getCenter();
    const currentMapZoom = map.getZoom();
    const currentMapBearing = map.getBearing();
    const currentMapPitch = map.getPitch();
    // You'd need a way to get currentMapPadding if it's part of FreeCameraOptions or a separate getter

    let targetCameraOptions: maplibregl.FlyToOptions = {};
    let needsViewUpdate = false;

    // Helper to compare floating point numbers with a tolerance
    function propsChangedEnough(
      currentVal: number,
      targetVal: number | undefined,
      tolerance = 1e-5
    ) {
      if (targetVal === undefined) return false; // If the target prop isn't set, don't consider it a change
      return Math.abs(currentVal - targetVal) > tolerance;
    }

    // Helper to compare LngLat objects
    function lngLatChangedEnough(
      currentVal: maplibregl.LngLat,
      targetValLngLatLike: maplibregl.LngLatLike | undefined,
      tolerance = 1e-5
    ) {
      if (targetValLngLatLike === undefined) return false;
      const targetVal = maplibregl.LngLat.convert(targetValLngLatLike);
      return (
        Math.abs(currentVal.lng - targetVal.lng) > tolerance ||
        Math.abs(currentVal.lat - targetVal.lat) > tolerance
      );
    }

    // Check if 'center' prop has changed significantly
    if (center && lngLatChangedEnough(currentMapCenter, center)) {
      targetCameraOptions.center = center;
      needsViewUpdate = true;
    }
    // Check if 'zoom' prop has changed significantly
    if (zoom !== undefined && propsChangedEnough(currentMapZoom, zoom)) {
      targetCameraOptions.zoom = zoom;
      needsViewUpdate = true;
    }
    // Check if 'bearing' prop has changed significantly
    if (bearing !== undefined && propsChangedEnough(currentMapBearing, bearing)) {
      targetCameraOptions.bearing = bearing;
      needsViewUpdate = true;
    }
    // Check if 'pitch' prop has changed significantly
    if (pitch !== undefined && propsChangedEnough(currentMapPitch, pitch)) {
      targetCameraOptions.pitch = pitch;
      needsViewUpdate = true;
    }
    // Check for padding changes (simplified check, adapt if you have a more robust currentPadding value)
    if (padding) {
      // This logic might need refinement based on how you track current padding
      targetCameraOptions.padding = padding;
      needsViewUpdate = true; // Assuming any change to padding prop warrants an update
    }

    if (needsViewUpdate && Object.keys(targetCameraOptions).length > 0) {
      // Add default animation options if you defined them as props or have fixed values
      // These can be overridden if targetCameraOptions (derived from props) already contains them.
      const animationDefaults: Partial<maplibregl.AnimationOptions> = {
        // speed: animationSpeed, // from component props or fixed
        // curve: animationCurve, // from component props or fixed
        // maxDuration: animationMaxDuration, // from component props or fixed
        // easing: (t) => t, // example, MapLibre has its own default easing
      };

      const finalFlyToOptions: maplibregl.FlyToOptions = {
        ...animationDefaults, // Apply defaults first
        ...targetCameraOptions, // Then specific targets, which might include their own animation params
      };

      // Call map.flyTo with the consolidated options
      // Check if map is already moving to avoid conflicting animations, though flyTo usually handles this.
      if (!map.isMoving() && !map.isZooming() && !map.isRotating()) {
        map.flyTo(finalFlyToOptions);
      }
    }
  }
});
$effect(() => {
  bearingSnap;
  if (map && bearingSnap && !firstRun) {
    map._bearingSnap = bearingSnap;
  }
});
$effect(() => {
  centerClampedToGround;
  if (!firstRun) {
    map?.setCenterClampedToGround(centerClampedToGround ?? false);
  }
});
$effect(() => {
  maxBounds;
  if (!firstRun) {
    map?.setMaxBounds(maxBounds);
  }
});
$effect(() => {
  maxPitch;
  if (!firstRun) {
    map?.setMaxPitch(maxPitch);
  }
});
$effect(() => {
  maxZoom;
  if (!firstRun) {
    map?.setMaxZoom(maxZoom);
  }
});
$effect(() => {
  minPitch;
  if (!firstRun) {
    map?.setMinPitch(minPitch);
  }
});
$effect(() => {
  minZoom;
  if (!firstRun) {
    map?.setMinZoom(minZoom);
  }
});
$effect(() => {
  pixelRatio;
  if (!firstRun) {
    map?.setPixelRatio(pixelRatio ?? (null as unknown as number));
  }
});
$effect(() => {
  renderWorldCopies;
  if (!firstRun) {
    map?.setRenderWorldCopies(renderWorldCopies ?? null);
  }
});
$effect(() => {
  style;
  if (!firstRun) {
    mapCtx.setStyle(style);
  }
});
$effect(() => {
  transformRequest;
  if (!firstRun) {
    map?.setTransformRequest(transformRequest as maplibregl.RequestTransformFunction);
  }
});

// Map Options (Map properties)
$effect(() => {
  if (boxZoom !== undefined && !firstRun) {
    boxZoom ? map?.boxZoom.enable() : map?.boxZoom.disable();
  }
});
$effect(() => {
  if (map && cancelPendingTileRequestsWhileZooming !== undefined && !firstRun) {
    map.cancelPendingTileRequestsWhileZooming = cancelPendingTileRequestsWhileZooming;
  }
});
$effect(() => {
  if (cooperativeGestures !== undefined && !firstRun) {
    cooperativeGestures ? map?.cooperativeGestures.enable() : map?.cooperativeGestures.disable();
  }
});
$effect(() => {
  if (doubleClickZoom !== undefined && !firstRun) {
    doubleClickZoom ? map?.doubleClickZoom.enable() : map?.doubleClickZoom.disable();
  }
});
$effect(() => {
  if (dragPan !== undefined && !firstRun) {
    dragPan ? map?.dragPan.enable(dragPan) : map?.dragPan.disable();
  }
});
$effect(() => {
  if (dragRotate !== undefined && !firstRun) {
    dragRotate ? map?.dragRotate.enable() : map?.dragRotate.disable();
  }
});
$effect(() => {
  if (keyboard !== undefined && !firstRun) {
    keyboard ? map?.keyboard.enable() : map?.keyboard.disable();
  }
});
$effect(() => {
  if (scrollZoom !== undefined && !firstRun) {
    scrollZoom ? map?.scrollZoom.enable(scrollZoom) : map?.scrollZoom.disable();
  }
});
$effect(() => {
  if (touchPitch !== undefined && !firstRun) {
    touchPitch ? map?.touchPitch.enable(touchPitch) : map?.touchPitch.disable();
  }
});
$effect(() => {
  if (touchZoomRotate !== undefined && !firstRun) {
    touchZoomRotate ? map?.touchZoomRotate.enable(touchZoomRotate) : map?.touchZoomRotate.disable();
  }
});
$effect(() => {
  transformCameraUpdate;
  if (map && !firstRun) {
    map.transformCameraUpdate = transformCameraUpdate ?? null;
  }
});

$effect(() => {
  firstRun = false;
});

onDestroy(() => {
  mapCtx.map = null;
  map?.remove();
  map = undefined;
});
</script>

<div class={className} style={inlineStyle} bind:this={container}>
  {#if map}
    {@render children?.(map)}
  {/if}
</div>
