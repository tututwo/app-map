# Timing

The [easing](#transition_ease), [delay](#transition_delay) and [duration](#transition_duration) of a transition is configurable. For example, a per-element delay can be used to [stagger the reordering](https://observablehq.com/@d3/sortable-bar-chart) of elements, improving perception. See [Animated Transitions in Statistical Data Graphics](http://vis.berkeley.edu/papers/animated_transitions/) for recommendations.

## _transition_.delay(_value_) {#transition_delay}

[Source](https://github.com/d3/d3-transition/blob/main/src/transition/delay.js) · For each selected element, sets the transition delay to the specified _value_ in milliseconds.

```js
transition.delay(250);
```

The _value_ may be specified either as a constant or a function. If a function, it is immediately evaluated for each selected element, in order, being passed the current datum (_d_), the current index (_i_), and the current group (_nodes_), with _this_ as the current DOM element. The function’s return value is then used to set each element’s transition delay. If a delay is not specified, it defaults to zero.

If a _value_ is not specified, returns the current value of the delay for the first (non-null) element in the transition. This is generally useful only if you know that the transition contains exactly one element.

```js
transition.delay(); // 250
```

Setting the delay to a multiple of the index `i` is a convenient way to stagger transitions across a set of elements. For example:

```js
transition.delay((d, i) => i * 10);
```

Of course, you can also compute the delay as a function of the data, or [sort the selection](../d3-selection/modifying.md#selection_sort) before computed an index-based delay.

## _transition_.duration(_value_) {#transition_duration}

[Source](https://github.com/d3/d3-transition/blob/main/src/transition/duration.js) · For each selected element, sets the transition duration to the specified _value_ in milliseconds.

```js
transition.duration(750);
```

The _value_ may be specified either as a constant or a function. If a function, it is immediately evaluated for each selected element, in order, being passed the current datum (_d_), the current index (_i_), and the current group (_nodes_), with _this_ as the current DOM element. The function’s return value is then used to set each element’s transition duration. If a duration is not specified, it defaults to 250ms.

If a _value_ is not specified, returns the current value of the duration for the first (non-null) element in the transition. This is generally useful only if you know that the transition contains exactly one element.

```js
transition.duration(); // 750
```

## _transition_.ease(_value_) {#transition_ease}

[Source](https://github.com/d3/d3-transition/blob/main/src/transition/ease.js) · Specifies the transition [easing function](../d3-ease.md) for all selected elements.

```js
transition.ease(d3.easeCubic);
```

The _value_ must be specified as a function. The easing function is invoked for each frame of the animation, being passed the normalized time _t_ in the range [0, 1]; it must then return the eased time _tʹ_ which is typically also in the range [0, 1]. A good easing function should return 0 if _t_ = 0 and 1 if _t_ = 1. If an easing function is not specified, it defaults to [easeCubic](../d3-ease.md#easeCubic).

If a _value_ is not specified, returns the current easing function for the first (non-null) element in the transition. This is generally useful only if you know that the transition contains exactly one element.

```js
transition.ease(); // d3.easeCubic
```

## _transition_.easeVarying(_factory_) {#transition_easeVarying}

[Examples](https://observablehq.com/@d3/transition-easevarying) · [Source](https://github.com/d3/d3-transition/blob/main/src/transition/easeVarying.js) · Specifies a factory for the transition [easing function](../d3-ease.md).

```js
transition.easeVarying((d) => d3.easePolyIn.exponent(d.exponent));
```

The _factory_ must be a function. It is invoked for each node of the selection, being passed the current datum (_d_), the current index (_i_), and the current group (_nodes_), with _this_ as the current DOM element. It must return an easing function.
