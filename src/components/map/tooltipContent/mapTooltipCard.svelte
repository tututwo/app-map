<script lang="ts">
interface Props {
  data?: Record<string, any>;
  excludeFields?: string[];
  selectedMapColorKey?: string;
  selectedMapColorKeyBackgroundColor?: string;
}

let {
  data,
  excludeFields = ["geoid", "name"], // Fields to exclude from the generated stats
  selectedMapColorKey = "closure",
  selectedMapColorKeyBackgroundColor = "#00C288",
}: Props = $props();

const reportLink = "#";
const reportLinkText = "Click to zoom and download report from the bottom right button";

// Helper function to format field names into readable labels
function formatLabel(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Helper function to format numeric values
function formatValue(value: any): string | number {
  if (typeof value === "number") {
    // If it's a small decimal (likely a rate), convert to percentage
    if (value > 0 && value < 1) {
      return (value * 100).toFixed(0);
    }
    // Otherwise, round to 2 decimal places
    return value.toFixed(0);
  }
  return value;
}

// Stats generated from the numeric fields of the hovered county
const stats = $derived(
  data
    ? Object.entries(data)
        .filter(([key, value]) => typeof value === "number" && !excludeFields.includes(key))
        .map(([key, value]) => ({
          label: formatLabel(key),
          value: formatValue(value),
          actualDataKey: key,
        }))
    : []
);
</script>

<div class="">
  <h2 class="mb-4 text-center text-xl font-bold text-black">{data?.name || "Not Enough Data"}</h2>

  <div class="mb-4 grid grid-cols-3">
    {#each stats as stat (stat.label)}
      {#if stat.actualDataKey === selectedMapColorKey}
        <div class="text-center">
          <p class="text-xs text-gray-600">{stat.label}</p>
          <p
            class="text-2xl font-bold text-white"
            style="background-color: {selectedMapColorKeyBackgroundColor};"
          >
            {stat.value}
          </p>
        </div>
      {:else}
        <div class="text-center">
          <p class="text-xs text-gray-600">{stat.label}</p>
          <p class="text-2xl font-bold text-black">{stat.value}</p>
        </div>
      {/if}
    {/each}
  </div>

  <hr class="mb-3 border-gray-300" />

  <a href={reportLink} class="block text-center text-xs text-gray-500 hover:text-gray-700">
    {reportLinkText}
  </a>
</div>
