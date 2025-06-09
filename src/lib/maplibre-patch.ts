/**
 * Patch MapLibre GL to force preserveDrawingBuffer: true
 * This ensures WebGL contexts can be captured for PDF export
 */
export function patchMapLibreGL() {
  if (typeof window === "undefined") return;

  // Store original getContext
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  // Override getContext
  HTMLCanvasElement.prototype.getContext = function (
    contextType: string,
    contextAttributes?: any
  ): RenderingContext | null {
    // Only patch WebGL contexts for MapLibre canvases
    if (
      (contextType === "webgl" ||
        contextType === "webgl2" ||
        contextType === "experimental-webgl") &&
      (this.className?.includes("maplibregl") || this.closest(".maplibregl-map"))
    ) {
      // console.log("🔧 Patching MapLibre WebGL context creation");

      // Force preserveDrawingBuffer to true
      const patchedAttributes = {
        ...contextAttributes,
        preserveDrawingBuffer: true,
        alpha: true,
        antialias: true,
        stencil: true,
      };

      // console.log("📝 WebGL context attributes:", patchedAttributes);

      // Call original with patched attributes
      const context = originalGetContext.call(this, contextType, patchedAttributes);

      if (context) {
        const attrs = (context as WebGLRenderingContext).getContextAttributes();
        // console.log("✅ Context created with preserveDrawingBuffer:", attrs?.preserveDrawingBuffer);
      }

      return context;
    }

    // For non-WebGL contexts, use original
    return originalGetContext.call(this, contextType, contextAttributes);
  };
}

// Apply the patch immediately when this module is imported
patchMapLibreGL();
