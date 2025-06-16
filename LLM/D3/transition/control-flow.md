# Control flow

For advanced usage, transitions provide methods for custom control flow.

## The life of a transition

Immediately after creating a transition, such as by [_selection_.transition](./selecting.md#selection_transition) or [_transition_.transition](./selecting.md#transition_transition), you may configure the transition using methods such as [_transition_.delay](./timing.md#transition_delay), [_transition_.duration](./timing.md#transition_duration), [_transition_.attr](./modifying.md#transition_attr) and [_transition_.style](./modifying.md#transition_style). Methods that specify target values (such as _transition_.attr) are evaluated synchronously; however, methods that require the starting value for interpolation, such as [_transition_.attrTween](./modifying.md#transition_attrTween) and [_transition_.styleTween](./modifying.md#transition_styleTween), must be deferred until the transition starts.

Shortly after creation, either at the end of the current frame or during the next frame, the transition is scheduled. At this point, the delay and `start` event listeners may no longer be changed; attempting to do so throws an error with the message “too late: already scheduled” (or if the transition has ended, “transition not found”).

When the transition subsequently starts, it interrupts the active transition of the same name on the same element, if any, dispatching an `interrupt` event to registered listeners. (Note that interrupts happen on start, not creation, and thus even a zero-delay transition will not immediately interrupt the active transition: the old transition is given a final frame. Use [_selection_.interrupt](#selection_interrupt) to interrupt immediately.) The starting transition also cancels any pending transitions of the same name on the same element that were created before the starting transition. The transition then dispatches a `start` event to registered listeners. This is the last moment at which the transition may be modified: the transition’s timing, tweens, and listeners may not be changed when it is running; attempting to do so throws an error with the message “too late: already running” (or if the transition has ended, “transition not found”). The transition initializes its tweens immediately after starting.

During the frame the transition starts, but _after_ all transitions starting this frame have been started, the transition invokes its tweens for the first time. Batching tween initialization, which typically involves reading from the DOM, improves performance by avoiding interleaved DOM reads and writes.

For each frame that a transition is active, it invokes its tweens with an [eased](./timing.md#transition_ease) _t_-value ranging from 0 to 1. Within each frame, the transition invokes its tweens in the order they were registered.

When a transition ends, it invokes its tweens a final time with a (non-eased) _t_-value of 1. It then dispatches an `end` event to registered listeners. This is the last moment at which the transition may be inspected: after ending, the transition is deleted from the element, and its configuration is destroyed. (A transition’s configuration is also destroyed on interrupt or cancel.) Attempting to inspect a transition after it is destroyed throws an error with the message “transition not found”.

## _selection_.interrupt(_name_) {#selection_interrupt}

[Source](https://github.com/d3/d3-transition/blob/main/src/selection/interrupt.js) · Interrupts the active transition of the specified _name_ on the selected elements, and cancels any pending transitions with the specified _name_, if any. If a name is not specified, null is used.

Interrupting a transition on an element has no effect on any transitions on any descendant elements. For example, an [axis transition](../d3-axis.md) consists of multiple independent, synchronized transitions on the descendants of the axis [G element](https://www.w3.org/TR/SVG/struct.html#Groups) (the tick lines, the tick labels, the domain path, _etc._). To interrupt the axis transition, you must therefore interrupt the descendants:

```js
selection.selectAll("*").interrupt();
```

The [universal selector](https://developer.mozilla.org/en-US/docs/Web/CSS/Universal_selectors), `*`, selects all descendant elements. If you also want to interrupt the G element itself:

```js
selection.interrupt().selectAll("*").interrupt();
```

## interrupt(_node_, _name_) {#interrupt}

[Source](https://github.com/d3/d3-transition/blob/main/src/interrupt.js) · Interrupts the active transition of the specified _name_ on the specified _node_, and cancels any pending transitions with the specified _name_, if any. If a name is not specified, null is used. See also [_selection_.interrupt](#selection_interrupt).

## _transition_.end() {#transition_end}

[Source](https://github.com/d3/d3-transition/blob/main/src/transition/end.js) · Returns a promise that resolves when every selected element finishes transitioning. If any element’s transition is cancelled or interrupted, the promise rejects.

## _transition_.on(_typenames_, _listener_) {#transition_on}

[Source](https://github.com/d3/d3-transition/blob/main/src/transition/on.js) · Adds or removes a _listener_ to each selected element for the specified event _typenames_. The _typenames_ is one of the following string event types:

- `start` - when the transition starts.
- `end` - when the transition ends.
- `interrupt` - when the transition is interrupted.
- `cancel` - when the transition is cancelled.

See [The Life of a Transition](#the-life-of-a-transition) for more. Note that these are _not_ native DOM events as implemented by [_selection_.on](../d3-selection/events.md#selection_on) and [_selection_.dispatch](../d3-selection/events.md#selection_dispatch), but transition events!

The type may be optionally followed by a period (`.`) and a name; the optional name allows multiple callbacks to be registered to receive events of the same type, such as `start.foo` and `start.bar`. To specify multiple typenames, separate typenames with spaces, such as `interrupt end` or `start.foo start.bar`.

When a specified transition event is dispatched on a selected node, the specified _listener_ will be invoked for the transitioning element, being passed the current datum (_d_), the current index (_i_), and the current group (_nodes_), with _this_ as the current DOM element. Listeners always see the latest datum for their element, but the index is a property of the selection and is fixed when the listener is assigned; to update the index, re-assign the listener.

If an event listener was previously registered for the same _typename_ on a selected element, the old listener is removed before the new listener is added. To remove a listener, pass null as the _listener_. To remove all listeners for a given name, pass null as the _listener_ and `.foo` as the _typename_, where `foo` is the name; to remove all listeners with no name, specify `.` as the _typename_.

If a _listener_ is not specified, returns the currently-assigned listener for the specified event _typename_ on the first (non-null) selected element, if any. If multiple typenames are specified, the first matching listener is returned.

## _transition_.each(_function_) {#transition_each}

[Source](https://github.com/d3/d3-selection/blob/main/src/selection/each.js) · Invokes the specified _function_ for each selected element, passing in the current datum (_d_), the current index (_i_), and the current group (_nodes_), with _this_ as the current DOM element. This method can be used to invoke arbitrary code for each selected element, and is useful for creating a context to access parent and child data simultaneously. Equivalent to [_selection_.each](../d3-selection/control-flow.md#selection_each).

## _transition_.call(_function_, ..._arguments_) {#transition_call}

[Source](https://github.com/d3/d3-selection/blob/main/src/selection/call.js) · Invokes the specified _function_ exactly once, passing in this transition along with any optional _arguments_. Returns this transition. This is equivalent to invoking the function by hand but facilitates method chaining. For example, to set several attributes in a reusable function:

```js
function color(transition, fill, stroke) {
  transition.style("fill", fill).style("stroke", stroke);
}
```

Now say:

```js
d3.selectAll("div").transition().call(color, "red", "blue");
```

This is equivalent to:

```js
color(d3.selectAll("div").transition(), "red", "blue");
```

Equivalent to [_selection_.call](../d3-selection/control-flow.md#selection_call).

## _transition_.empty() {#transition_empty}

[Source](https://github.com/d3/d3-selection/blob/main/src/selection/empty.js) · Returns true if this transition contains no (non-null) elements. Equivalent to [_selection_.empty](../d3-selection/control-flow.md#selection_empty).

## _transition_.nodes() {#transition_nodes}

[Source](https://github.com/d3/d3-selection/blob/main/src/selection/nodes.js) · Returns an array of all (non-null) elements in this transition. Equivalent to [_selection_.nodes](../d3-selection/control-flow.md#selection_nodes).

## _transition_.node() {#transition_node}

[Source](https://github.com/d3/d3-selection/blob/main/src/selection/node.js) · Returns the first (non-null) element in this transition. If the transition is empty, returns null. Equivalent to [_selection_.node](../d3-selection/control-flow.md#selection_node).

## _transition_.size() {#transition_size}

[Source](https://github.com/d3/d3-selection/blob/main/src/selection/size.js) · Returns the total number of elements in this transition. Equivalent to [_selection_.size](../d3-selection/control-flow.md#selection_size).
