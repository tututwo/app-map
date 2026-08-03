import { gsap } from "gsap";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";

gsap.registerPlugin(MorphSVGPlugin);

type CircleAttrs = { cx: number; cy: number };

/**
 * Instantly place (initial render), or morph-animate, the line path and its
 * data circles. Returns the running timeline so the caller can kill it on the
 * next update.
 */
export function animateLineChart(options: {
  pathElement: SVGPathElement;
  circleElements: Array<SVGCircleElement | undefined>;
  path: string;
  circles: CircleAttrs[];
  isInitial: boolean;
  previousTimeline: gsap.core.Timeline | null;
}): gsap.core.Timeline | null {
  const { pathElement, circleElements, path, circles, isInitial, previousTimeline } = options;

  if (isInitial) {
    gsap.set(pathElement, { attr: { d: path } });
    circles.forEach((attrs, index) => {
      const circleElement = circleElements[index];
      if (circleElement) gsap.set(circleElement, { attr: attrs });
    });
    return null;
  }

  previousTimeline?.kill();
  const timeline = gsap.timeline({ defaults: { duration: 0.8, ease: "power2.inOut" } });
  timeline.to(pathElement, { morphSVG: path });
  circles.forEach((attrs, index) => {
    const circleElement = circleElements[index];
    if (circleElement) timeline.to(circleElement, { attr: attrs }, "<");
  });
  return timeline;
}

/** Flash the brush selection rect to signal an invalid range (yoyo back). */
export function flashSelectionWarning(selectionRect: Element, color: string): void {
  gsap.to(selectionRect, { fill: color, duration: 0.1, yoyo: true, repeat: 1 });
}

/** Fade the drag instruction in on first interaction, then settle to subtle. */
export function fadeInInstruction(element: HTMLElement): void {
  gsap.fromTo(
    element,
    { opacity: 0, y: 10 },
    { opacity: 1, y: 0, duration: 2, delay: 0.5, ease: "power3.out" }
  );
  gsap.to(element, { opacity: 0.6, duration: 1, delay: 4, ease: "power2.inOut" });
}

/** Fade the drag instruction out when the brush selection disappears. */
export function fadeOutInstruction(element: HTMLElement): void {
  gsap.to(element, { opacity: 0, y: 5, duration: 0.3, ease: "power2.in" });
}
