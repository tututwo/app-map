<!--
	@component
	Canvas layout component
 -->
<script>
// @ts-nocheck

export let canvasElement;
export let chartWidth;
export let chartHeight;
export let gapSize;
export let yKey = "population_name";
export let startingHeight;

export let opacity = 0.86;
export let strokeColor;
export let strokeWidth;
export let roughness = 0.5;
export let bowing = 0.05;
export let hachureGap = 1;
export let fillWeight = 1.2;
export let fillStyle = "hach";

import rough from "roughjs";
import gsap from "gsap";

import { writable, get } from "svelte/store";
import { getContext } from "svelte";
import { scaleCanvas } from "layercake";

import { findClosestPoint, isEqualRect } from "$lib/utility";

import { hoveredTooltipStore } from "$lib/data/data";
import Tooltip from "$components/chart/Tooltip.svelte";
const { data, width, height, xRange, xScale, yScale, zScale, zDomain, flatData, padding } =
  getContext("LayerCake");
const { ctx } = getContext("canvas");
export let hoverableGapSize = $yScale.padding() / 2;
let rectangles = [];
let closestData, mouseX, mouseY;
// $: console.log($yScale.padding()*$yScale.bandwidth())
let roughCanvas;
$: if (canvasElement) {
  roughCanvas = rough.canvas(canvasElement);

  canvasElement.addEventListener("mousemove", (e) => {
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;
    const closestRect = findClosestPoint([mouseX, mouseY], rectangles);
  });
}

function createGSAPStore(initialData, options) {
  const { subscribe, set } = writable(initialData);
  let animations = [];
  return {
    subscribe,
    animate: (listOfNewValues) => {
      listOfNewValues.forEach((newValues, rowIndex) => {
        if (!animations[rowIndex]) animations[rowIndex] = [];
        animations[rowIndex].forEach((anim) => anim.kill()); // Kill previous animations
        animations[rowIndex] = newValues.map((newValue, index) => {
          return gsap.to(initialData[rowIndex][index], {
            ...options,
            ...newValue,
            onUpdate: () => set(initialData),
          });
        });
      });
    },
  };
}

const animatedStore = createGSAPStore(
  get(data).map((comfortLevel) => {
    let key = comfortLevel.key;
    return comfortLevel.map((d) => {
      // this controls the initial position of the bars
      // aka, the intro animation's initial position
      let population_y_coord = $yScale.range([0, startingHeight])(d.data[yKey]);

      return [0, 0, population_y_coord, key, d.data];
    });
  }),
  {
    duration: 0.8,
    ease: "power2.inOut",
  }
);
$: dataset = $data.map((comfortLevel) => {
  let key = comfortLevel.key;

  return comfortLevel.map((d) => {
    let population_y_coord = $yScale(d.data[yKey]);

    return [...d, population_y_coord, key, d.data];
  });
});
// the form, shape, and variables of dataset, aka, the data we are animating to, must be the same as the initial data, aka, animatedStore
$: animatedStore.animate(dataset);

$: {
  if (ctx && canvasElement) {
    scaleCanvas($ctx, $width, $height);
    $ctx.clearRect(0, 0, $width, $height);

    $animatedStore.forEach((comfortLevel, i) => {
      // let comfortLevelName = comfortLevel.key;
      let cumulativeGap = 0;
      comfortLevel.forEach((d, j) => {
        // const y = $yScale(d.data[yKey]);
        const x = $xScale(d[0]) + gapSize / 2;
        const height = $yScale.bandwidth();

        const widthValue = $xScale(d[1]) - $xScale(d[0]);
        const adjustedGapSize = Math.min(gapSize, widthValue / 2);
        const width = widthValue - adjustedGapSize;

        // Retrieve the parent's data for the color
        // const parentData = /* logic to get parentData */;
        const fillColor = $zScale(d[3]);
        // // Draw the rectangle
        const stroke = strokeColor ?? fillColor;
        // tooltip rectangle
        $ctx.save();
        if (closestData) {
          if (d[4].population_name == closestData?.population_name) {
            $ctx.globalAlpha = `${opacity}`;
          } else {
            $ctx.globalAlpha = 0.2; // or any default value you need
          }
        }

        // Check if the current bar is "College Graduate" and adjust the gap
        if (
          d[4].population_name === "College Graduate" ||
          d[4].population_name === "Households with Children" ||
          d[4].population_name === "Asian"
        ) {
          // Add a defined additional gap for "College Graduate" bars
          cumulativeGap += 0 /* some additional gap value */;
        }
        const y = d[2] + cumulativeGap;
        roughCanvas.rectangle(x, y, width, height, {
          roughness: `${roughness}`,
          fill: fillColor,
          stroke: `${stroke}`,
          strokeWidth: `${strokeWidth}`,
          hachureGap: `${hachureGap}`,
          hachureAngle: -30,
          fillWeight: `${fillWeight}`,
          fillStyle: `${fillStyle}`,
          bowing: `${bowing}`,
          disableMultiStroke: false,
          disableMultiStrokeFill: true,
          seed: 20,
        });

        $ctx.restore();
      });
    });
  }
}

function handleMouseMove(e) {
  mouseX = e.offsetX;
  mouseY = e.offsetY;
  if ($xRange[0] < mouseX && mouseX < $xRange[1]) {
    closestData = $animatedStore
      .flat()
      .filter(
        (d) =>
          mouseY - d[2] < $yScale.bandwidth() + hoverableGapSize &&
          mouseY - d[2] > -hoverableGapSize
      )[0][4];
  }
  hoveredTooltipStore.set(closestData);
}

// mouse position
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<!-- svelte-ignore a11y-mouse-events-have-key-events -->
<div
  class="z-50"
  style="position: absolute; inset: {$padding.top}px {$padding.right}px {$padding.bottom}px {$padding.left}px;"
  on:mousemove={handleMouseMove}
  on:mouseout={() => {
    closestData = null;
    hoveredTooltipStore.set(closestData);
  }}
></div>

{#if closestData}
  <Tooltip {chartWidth} {chartHeight}></Tooltip>
{/if}
