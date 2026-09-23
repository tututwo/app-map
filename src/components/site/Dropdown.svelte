<script lang="ts">
import { Select } from "bits-ui";
import { Check } from "lucide-svelte";
import type { Snippet } from "svelte";

type Option = { value: string; label: string; meta?: string; group?: string };

// The site's select: the trigger is the whole field, the list is styled like the place search.
let {
  label,
  value,
  options,
  onchange,
  name,
  class: triggerClass = "",
  trigger,
  option,
}: {
  /** Names the list for screen readers. */
  label: string;
  value: string;
  options: Option[];
  onchange: (value: string) => void;
  /** Submits the value with a form. */
  name?: string;
  class?: string;
  /** What the field shows; it is the button's accessible name, so include the label. */
  trigger: Snippet;
  /** Option content before the check mark; the label by default. */
  option?: Snippet<[Option]>;
} = $props();

// Consecutive options that share a group are listed under its heading.
let groups = $derived(
  options.reduce<{ name?: string; options: Option[] }[]>((all, item) => {
    const last = all.at(-1);
    if (last && last.name === item.group) last.options.push(item);
    else all.push({ name: item.group, options: [item] });
    return all;
  }, [])
);
</script>

{#snippet row(item: Option)}
  <Select.Item value={item.value} label={item.label} class="dropdown-option">
    {#snippet children({ selected })}
      {#if option}{@render option(item)}{:else}<span>{item.label}</span>{/if}
      <span class="ml-auto flex items-baseline gap-3 pl-3">
        {#if item.meta}
          <span class="text-muted text-[12px] font-normal whitespace-nowrap tabular-nums"
            >{item.meta}</span
          >
        {/if}
        <Check
          size={14}
          strokeWidth={2.25}
          aria-hidden="true"
          class="shrink-0 self-center {selected ? '' : 'invisible'}"
        />
      </span>
    {/snippet}
  </Select.Item>
{/snippet}

<Select.Root
  type="single"
  {name}
  {value}
  items={options}
  onValueChange={onchange}
  scrollAlignment="center"
>
  <Select.Trigger class={triggerClass}>{@render trigger()}</Select.Trigger>
  <Select.Portal>
    <Select.Content
      aria-label={label}
      align="start"
      collisionPadding={12}
      class="dropdown z-50 max-h-[min(24rem,var(--bits-select-content-available-height))] min-w-[var(--bits-select-anchor-width)]"
    >
      <Select.Viewport>
        {#each groups as group, index (index)}
          {#if group.name}
            <Select.Group class={index ? "border-rule mt-1.5 border-t pt-1.5" : ""}>
              <Select.GroupHeading class="label-caps px-4 pt-2 pb-1.5"
                >{group.name}</Select.GroupHeading
              >
              {#each group.options as item (item.value)}{@render row(item)}{/each}
            </Select.Group>
          {:else}
            {#each group.options as item (item.value)}{@render row(item)}{/each}
          {/if}
        {/each}
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>
