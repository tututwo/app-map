# Custom Tooltip Component

A highly configurable, mouse-following tooltip component built with Svelte 5. It provides smooth, tweened positioning and robust collision detection without external dependencies.

This component is ideal for use cases like interactive maps or charts where a tooltip needs to dynamically follow the user's cursor and display contextual information.

## Features

- **Smooth Positioning**: Uses `svelte/motion`'s `Tween` for fluid, non-jittery movement.
- **Smart Collision Detection**: Automatically flips to the side with the most available space to avoid being cut off by its boundary.
- **Configurable Siding & Alignment**: Full control over preferred side (`top`, `bottom`, `left`, `right`) and alignment (`start`, `center`, `end`).
- **Customizable Transitions**: Supports custom `in:` and `out:` transitions. Defaults to a subtle `fade`.
- **Optional Arrow**: Can display a small arrow pointing towards the cursor.
- **Boundary Aware**: Can be constrained within any parent HTML element or the viewport.
- **Performant**: Leverages CSS transforms for positioning, ensuring smooth animations.

## Basic Usage

Import the component and pass it the required props. The tooltip's position is controlled by `x` and `y`, and its visibility by `open`. You must provide a `boundary` element for coordinate conversion and collision detection.

```svelte
<script lang="ts">
import Tooltip from "./Tooltip.svelte";
import MapTooltipCard from "./mapTooltipCard.svelte";

// State from your parent component
let mapContainer = $state<HTMLElement | null>(null);
let isTooltipOpen = $state(false);
let tooltipX = $state(0);
let tooltipY = $state(0);
let hoveredCountyData = $state<any>(null);
</script>

<figure bind:this={mapContainer} class="relative h-full w-full">
  <!-- Your main content, e.g., a map -->
</figure>

<Tooltip x={tooltipX} y={tooltipY} open={isTooltipOpen} boundary={mapContainer}>
  {#if hoveredCountyData}
    <MapTooltipCard {data} />
  {/if}
</Tooltip>
```

## Props API Reference

| Prop                  | Type                                     | Default             | Description                                                                                  |
| --------------------- | ---------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------- |
| `x`                   | `number`                                 | **Required**        | The horizontal coordinate (relative to the `boundary` element) to anchor the tooltip to.     |
| `y`                   | `number`                                 | **Required**        | The vertical coordinate (relative to the `boundary` element) to anchor the tooltip to.       |
| `open`                | `boolean`                                | **Required**        | Controls the visibility of the tooltip.                                                      |
| `boundary`            | `HTMLElement \| null`                    | `null`              | The element the tooltip should not overflow. If `null`, the viewport is used.                |
| `preferredSide`       | `'top' \| 'bottom' \| 'left' \| 'right'` | `'right'`           | The initial side of the cursor on which to display the tooltip.                              |
| `sideOffset`          | `number`                                 | `10`                | The distance in pixels between the tooltip and the cursor.                                   |
| `align`               | `'start' \| 'center' \| 'end'`           | `'center'`          | Alignment of the tooltip along the cross-axis of the cursor.                                 |
| `alignOffset`         | `number`                                 | `0`                 | A fine-tuning offset for the alignment.                                                      |
| `showArrow`           | `boolean`                                | `false`             | If `true`, displays an arrow pointing to the cursor.                                         |
| `arrowPadding`        | `number`                                 | `8`                 | Minimum distance in pixels from the tooltip's corners to the arrow.                          |
| `collisionPadding`    | `number`                                 | `8`                 | The minimum distance in pixels the tooltip should maintain from the edges of the `boundary`. |
| `inTransition`        | `(node, params) => TransitionConfig`     | `fade`              | A Svelte transition function for when the tooltip appears.                                   |
| `inTransitionParams`  | `any`                                    | `{ duration: 150 }` | Parameters to pass to the `inTransition` function.                                           |
| `outTransition`       | `(node, params) => TransitionConfig`     | `fade`              | A Svelte transition function for when the tooltip disappears.                                |
| `outTransitionParams` | `any`                                    | `{ duration: 100 }` | Parameters to pass to the `outTransition` function.                                          |
| `children`            | `Snippet`                                | `undefined`         | The content to be rendered inside the tooltip.                                               |

## Advanced Example

This example shows a tooltip on the left side with a custom `fly` transition, alignment set to `'start'`, and a visible arrow.

```svelte
<script lang="ts">
import Tooltip from "./Tooltip.svelte";
import { fly } from "svelte/transition";
// ... component state
</script>

<Tooltip
  x={tooltipX}
  y={tooltipY}
  open={isTooltipOpen}
  boundary={mapContainer}
  preferredSide="left"
  sideOffset={20}
  align="start"
  showArrow={true}
  inTransition={fly}
  inTransitionParams={{ x: -10, duration: 300 }}
  outTransition={fly}
  outTransitionParams={{ x: -10, duration: 200 }}
>
  <p>Advanced Tooltip!</p>
</Tooltip>
```

## Styling

The component uses `data-*` attributes to enable powerful CSS customizations based on its state.

- `data-state`: `'open' | 'closed'`
- `data-side`: `'top' | 'bottom' | 'left' | 'right'`
- `data-align`: `'start' | 'center' | 'end'`

You can target these in your CSS for side- or alignment-specific styles:

```css
/* Example: Make the border red when on the left side */
[data-side="left"] {
  border-color: red;
}
```
