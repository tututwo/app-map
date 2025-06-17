<script lang="ts">
type Stat = {
  label: string;
  value: string | number;
};

type StatConfig = {
  key: string;
  label: string;
  format?: (value: any) => string | number;
  condition?: (data: any) => boolean;
};

interface Props {
  data?: Record<string, any>;
  reportLinkText?: string;
  reportLink?: string;
  statConfigs?: StatConfig[];
  excludeFields?: string[];
  autoGenerate?: boolean;
  selectedMapColorKey?: string;
  selectedMapColorKeyBackgroundColor?: string;
}

let {
  data,
  reportLinkText = "Click to zoom and download report from the bottom right button",
  reportLink = "#",
  excludeFields = ["geoid", "name"], // Fields to exclude from auto-generation
  autoGenerate = false, // Set to true to auto-generate from all numeric fields
  selectedMapColorKey = "closure",
  selectedMapColorKeyBackgroundColor = "#00C288",
  statConfigs = [
    {
      key: "closure",
      label: "Closure Rate",
      format: (value) => (value * 100).toFixed(1) + "%",
      condition: (data) => data.closure !== undefined,
    },
    {
      key: "closure_rate_per_10000",
      label: "Per 10,000",
      format: (value) => value.toFixed(2),
      condition: (data) => data.closure_rate_per_10000 !== undefined,
    },
    {
      key: "persistence",
      label: "Persistence",
      format: (value) => (value * 100).toFixed(1) + "%",
      condition: (data) => data.persistence !== undefined,
    },
    {
      key: "reopening",
      label: "Reopening",
      format: (value) => (value * 100).toFixed(1) + "%",
      condition: (data) => data.reopening !== undefined,
    },
  ],
}: Props = $props();

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
      return (value * 100).toFixed(1) + "%";
    }
    // Otherwise, round to 2 decimal places
    return value.toFixed(2);
  }
  return value;
}

// Main stats derivation - supports both configured and auto-generated modes
const stats = $derived.by(() => {
  if (!data) return [];

  if (autoGenerate) {
    // Auto-generate stats from all numeric fields
    return Object.entries(data)
      .filter(([key, value]) => typeof value === "number" && !excludeFields.includes(key))
      .map(([key, value]) => ({
        label: formatLabel(key),
        value: formatValue(value),
        actualDataKey: key,
      }));
  } else {
    // Use configured stats
    return statConfigs
      .filter((config) => !config.condition || config.condition(data))
      .map((config) => ({
        label: config.label,
        value: config.format ? config.format(data[config.key]) : data[config.key] || "N/A",
        actualDataKey: config.key,
      }))
      .filter((stat) => stat.value !== "N/A" && stat.value !== undefined);
  }
});
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
