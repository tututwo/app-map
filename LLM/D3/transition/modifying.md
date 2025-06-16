# Modifying elements

After selecting elements and creating a transition with [_selection_.transition](./selecting.md#selection_transition), use the transition’s transformation methods to affect document content.

## _transition_.attr(_name_, _value_) {#transition_attr}

[Source](https://github.com/d3/d3-transition/blob/main/src/transition/attr.js) · For each selected element, assigns the [attribute tween](#transition_attrTween) for the attribute with the specified _name_ to the specified target _value_. The starting value of the tween is the attribute’s value when the transition starts. The target _value_ may be specified either as a constant or a function. If a function, it is immediately evaluated for each selected element, in order, being passed the current datum (_d_), the current index (_i_), and the current group (_nodes_), with _this_ as the current DOM element.

If the target value is null, the attribute is removed when the transition starts. Otherwise, an interpolator is chosen based on the type of the target value, using the following algorithm:

1. If _value_ is a number, use [interpolateNumber](../d3-interpolate/value.md#interpolateNumber).
2. If _value_ is a [color](../d3-color.md) or a string coercible to a color, use [interpolateRgb](../d3-interpolate/color.md#interpolateRgb).
3. Use [interpolateString](../d3-interpolate/value.md#interpolateString).

To apply a different interpolator, use [_transition_.attrTween](#transition_attrTween).

## _transition_.attrTween(_name_, _factory_) {#transition_attrTween}

[Source](https://github.com/d3/d3-transition/blob/main/src/transition/attrTween.js) · If _factory_ is specified and not null, assigns the attribute [tween](#transition_tween) for the attribute with the specified _name_ to the specified interpolator _factory_. An interpolator factory is a function that returns an [interpolator](../d3-interpolate.md); when the transition starts, the _factory_ is evaluated for each selected element, in order, being passed the current datum (_d_), the current index (_i_), and the current group (_nodes_), with _this_ as the current DOM element. The returned interpolator will then be invoked for each frame of the transition, in order, being passed the [eased](./timing.md#transition_ease) time _t_, typically in the range [0, 1]. Lastly, the return value of the interpolator will be used to set the attribute value. The interpolator must return a string. (To remove an attribute at the start of a transition, use [_transition_.attr](#transition_attr); to remove an attribute at the end of a transition, use [_transition_.on](./control-flow.md#transition_on) to listen for the _end_ event.)

If the specified _factory_ is null, removes the previously-assigned attribute tween of the specified _name_, if any. If _factory_ is not specified, returns the current interpolator factory for attribute with the specified _name_, or undefined if no such tween exists.

For example, to interpolate the fill attribute from red to blue:

```js
transition.attrTween("fill", () => d3.interpolateRgb("red", "blue"));
```

Or to interpolate from the current fill to blue, like [_transition_.attr](#transition_attr):

```js
transition.attrTween("fill", function () {
  return d3.interpolateRgb(this.getAttribute("fill"), "blue");
});
```

Or to apply a custom rainbow interpolator:

```js
transition.attrTween("fill", () => (t) => `hsl(${t * 360},100%,50%)`);
```

This method is useful to specify a custom interpolator, such as one that understands [SVG paths](https://observablehq.com/@d3/path-tween). A useful technique is _data interpolation_, where [interpolateObject](../d3-interpolate/value.md#interpolateObject) is used to interpolate two data values, and the resulting value is then used (say, with a [shape](../d3-shape.md)) to compute the new attribute value.

## _transition_.style(_name_, _value_, _priority_) {#transition_style}

[Source](https://github.com/d3/d3-transition/blob/main/src/transition/style.js) · For each selected element, assigns the [style tween](#transition_styleTween) for the style with the specified _name_ to the specified target _value_ with the specified _priority_. The starting value of the tween is the style’s inline value if present, and otherwise its computed value, when the transition starts. The target _value_ may be specified either as a constant or a function. If a function, it is immediately evaluated for each selected element, in order, being passed the current datum (_d_), the current index (_i_), and the current group (_nodes_), with _this_ as the current DOM element.

If the target value is null, the style is removed when the transition starts. Otherwise, an interpolator is chosen based on the type of the target value, using the following algorithm:

1. If _value_ is a number, use [interpolateNumber](../d3-interpolate/value.md#interpolateNumber).
2. If _value_ is a [color](../d3-color.md) or a string coercible to a color, use [interpolateRgb](../d3-interpolate/color.md#interpolateRgb).
3. Use [interpolateString](../d3-interpolate/value.md#interpolateString).

To apply a different interpolator, use [_transition_.styleTween](#transition_styleTween).

## _transition_.styleTween(_name_, _factory_, _priority_) {#transition_styleTween}

[Source](https://github.com/d3/d3-transition/blob/main/src/transition/styleTween.js) · If _factory_ is specified and not null, assigns the style [tween](#transition_tween) for the style with the specified _name_ to the specified interpolator _factory_. An interpolator factory is a function that returns an [interpolator](../d3-interpolate.md); when the transition starts, the _factory_ is evaluated for each selected element, in order, being passed the current datum (_d_), the current index (_i_), and the current group (_nodes_), with _this_ as the current DOM element. The returned interpolator will then be invoked for each frame of the transition, in order, being passed the [eased](./timing.md#transition_ease) time _t_, typically in the range [0, 1]. Lastly, the return value of the interpolator will be used to set the style value with the specified _priority_. The interpolator must return a string. (To remove an style at the start of a transition, use [_transition_.style](#transition_style); to remove an style at the end of a transition, use [_transition_.on](./control-flow.md#transition_on) to listen for the _end_ event.)

If the specified _factory_ is null, removes the previously-assigned style tween of the specified _name_, if any. If _factory_ is not specified, returns the current interpolator factory for style with the specified _name_, or undefined if no such tween exists.

For example, to interpolate the fill style from red to blue:

```js
transition.styleTween("fill", () => d3.interpolateRgb("red", "blue"));
```

Or to interpolate from the current fill to blue, like [_transition_.style](#transition_style):

```js
transition.styleTween("fill", function () {
  return d3.interpolateRgb(this.style.fill, "blue");
});
```

Or to apply a custom rainbow interpolator:

```js
transition.styleTween("fill", () => (t) => `hsl(${t * 360},100%,50%)`);
```

This method is useful to specify a custom interpolator, such as with _data interpolation_, where [interpolateObject](../d3-interpolate/value.md#interpolateObject) is used to interpolate two data values, and the resulting value is then used to compute the new style value.

## _transition_.text(_value_) {#transition_text}

[Source](https://github.com/d3/d3-transition/blob/main/src/transition/text.js) · For each selected element, sets the [text content](http://www.w3.org/TR/DOM-Level-3-Core/core.html#Node3-textContent) to the specified target _value_ when the transition starts. The _value_ may be specified either as a constant or a function. If a function, it is immediately evaluated for each selected element, in order, being passed the current datum (_d_), the current index (_i_), and the current group (_nodes_), with _this_ as the current DOM element. The function’s return value is then used to set each element’s text content. A null value will clear the content.

To interpolate text rather than to set it on start, use [_transition_.textTween](#transition_textTween) or append a replacement element and cross-fade opacity. Text is not interpolated by default because it is usually undesirable.

## _transition_.textTween(_factory_) {#transition_textTween}

[Source](https://github.com/d3/d3-transition/blob/main/src/transition/textTween.js), [Examples](https://observablehq.com/@d3/transition-texttween)

If _factory_ is specified and not null, assigns the text [tween](#transition_tween) to the specified interpolator _factory_. An interpolator factory is a function that returns an [interpolator](../d3-interpolate.md); when the transition starts, the _factory_ is evaluated for each selected element, in order, being passed the current datum `d` and index `i`, with the `this` context as the current DOM element. The returned interpolator will then be invoked for each frame of the transition, in order, being passed the [eased](./timing.md#transition_ease) time _t_, typically in the range [0, 1]. Lastly, the return value of the interpolator will be used to set the text. The interpolator must return a string.

For example, to interpolate the text with integers from 0 to 100:

```js
transition.textTween(() => d3.interpolateRound(0, 100));
```

If the specified _factory_ is null, removes the previously-assigned text tween, if any. If _factory_ is not specified, returns the current interpolator factory for text, or undefined if no such tween exists.

## _transition_.remove() {#transition_remove}

[Source](https://github.com/d3/d3-transition/blob/main/src/transition/remove.js) · For each selected element, [removes](../d3-selection/modifying.md#selection_remove) the element when the transition ends, as long as the element has no other active or pending transitions. If the element has other active or pending transitions, does nothing.

## _transition_.tween(name, value) {#transition_tween}

[Source](https://github.com/d3/d3-transition/blob/main/src/transition/tween.js) · For each selected element, assigns the tween with the specified _name_ with the specified _value_ function. The _value_ must be specified as a function that returns a function. When the transition starts, the _value_ function is evaluated for each selected element, in order, being passed the current datum (_d_), the current index (_i_), and the current group (_nodes_), with _this_ as the current DOM element. The returned function is then invoked for each frame of the transition, in order, being passed the [eased](./timing.md#transition_ease) time _t_, typically in the range [0, 1]. If the specified _value_ is null, removes the previously-assigned tween of the specified _name_, if any.

For example, to interpolate the fill attribute to blue, like [_transition_.attr](#transition_attr):

```js
transition.tween("attr.fill", function () {
  const i = d3.interpolateRgb(this.getAttribute("fill"), "blue");
  return function (t) {
    this.setAttribute("fill", i(t));
  };
});
```

<!-- This method is useful to specify a custom interpolator, or to perform side-effects, say to animate the [scroll offset](https://bl.ocks.org/mbostock/1649463). -->
