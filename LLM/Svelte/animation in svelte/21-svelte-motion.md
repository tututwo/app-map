Tween
Available since 5.8.0

A wrapper for a value that tweens smoothly to its target value. Changes to tween.target will cause tween.current to move towards it over time, taking account of the delay, duration and easing options.

<script>
	import { Tween } from 'svelte/motion';

	const tween = new Tween(0);
</script>

<input type="range" bind:value={tween.target} />
<input type="range" bind:value={tween.current} disabled />
class Tween<T> {…}
static of<U>(fn: () => U, options?: TweenedOptions<U> | undefined): Tween<U>;
Create a tween whose value is bound to the return value of fn. This must be called inside an effect root (for example, during component initialisation).

<script>
	import { Tween } from 'svelte/motion';

	let { number } = $props();

	const tween = Tween.of(() => number);
</script>

constructor(value: T, options?: TweenedOptions<T>);
set(value: T, options?: TweenedOptions<T> | undefined): Promise<void>;
Sets tween.target to value and returns a Promise that resolves if and when tween.current catches up to it.

If options are provided, they will override the tween’s defaults.

get current(): T;
set target(v: T);
get target(): T;
prefersReducedMotion
Available since 5.7.0

A media query that matches if the user prefers reduced motion.

<script>
	import { prefersReducedMotion } from 'svelte/motion';
	import { fly } from 'svelte/transition';

	let visible = $state(false);
</script>

<button onclick={() => visible = !visible}>
toggle
</button>

{#if visible}
<p transition:fly={{ y: prefersReducedMotion.current ? 0 : 200 }}>
flies in, unless the user prefers reduced motion
</p>
{/if}
const prefersReducedMotion: MediaQuery;
spring
Use Spring instead

The spring function in Svelte creates a store whose value is animated, with a motion that simulates the behavior of a spring. This means when the value changes, instead of transitioning at a steady rate, it “bounces” like a spring would, depending on the physics parameters provided. This adds a level of realism to the transitions and can enhance the user experience.

function spring<T = any>(
value?: T | undefined,
opts?: SpringOpts | undefined
): Spring<T>;
tweened
Use Tween instead

A tweened store in Svelte is a special type of store that provides smooth transitions between state values over time.

function tweened<T>(
value?: T | undefined,
defaults?: TweenedOptions<T> | undefined
): Tweened<T>;
Spring
interface Spring<T> extends Readable<T> {…}
set(new_value: T, opts?: SpringUpdateOpts): Promise<void>;
update: (fn: Updater<T>, opts?: SpringUpdateOpts) => Promise<void>;
deprecated Only exists on the legacy spring store, not the Spring class
subscribe(fn: (value: T) => void): Unsubscriber;
deprecated Only exists on the legacy spring store, not the Spring class
precision: number;
damping: number;
stiffness: number;
Tweened
interface Tweened<T> extends Readable<T> {…}
set(value: T, opts?: TweenedOptions<T>): Promise<void>;
update(updater: Updater<T>, opts?: TweenedOptions<T>): Promise<void>;
