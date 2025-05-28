// Create a file: src/lib/maplibre-preserve-buffer-patch.ts
import maplibregl from "maplibre-gl";

let patched = false;

export function patchMapLibreGL() {
  if (patched) return;

  const OriginalMap = maplibregl.Map;

  // @ts-ignore - We're monkey patching
  maplibregl.Map = class extends OriginalMap {
    constructor(options: maplibregl.MapOptions) {
      // If preserveDrawingBuffer is requested, override getContext before calling super
      if (options.preserveDrawingBuffer) {
        const originalGetContext = HTMLCanvasElement.prototype.getContext;

        HTMLCanvasElement.prototype.getContext = function (
          contextType: string,
          contextAttributes?: any
        ) {
          if (contextType === "webgl" || contextType === "webgl2") {
            contextAttributes = {
              alpha: true,
              antialias: true,
              depth: true,
              stencil: true,
              premultipliedAlpha: false,
              failIfMajorPerformanceCaveat: false,
              ...contextAttributes,
              preserveDrawingBuffer: true,
            };
            console.log("🎯 MapLibre GL patched: forcing preserveDrawingBuffer for", contextType);
          }
          return originalGetContext.call(this, contextType, contextAttributes);
        };

        // Call the original constructor
        super(options);

        // Restore the original getContext after a short delay
        setTimeout(() => {
          HTMLCanvasElement.prototype.getContext = originalGetContext;
        }, 500);

        // Verify it worked
        this.on("load", () => {
          const canvas = this.getCanvas();
          const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
          if (gl) {
            const attrs = gl.getContextAttributes();
            console.log(
              "✅ MapLibre GL preserveDrawingBuffer verified:",
              attrs?.preserveDrawingBuffer
            );
          }
        });
      } else {
        // Normal constructor call
        super(options);
      }
    }
  };

  patched = true;
  console.log("🔧 MapLibre GL patched for preserveDrawingBuffer support");
}

export function unpatchMapLibreGL() {
  // Note: This is difficult to truly unpatch since we've replaced the constructor
  // Best to call this patch early in your app lifecycle
  patched = false;
}
