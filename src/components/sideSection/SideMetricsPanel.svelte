<script lang="ts">
import PercentageBar from "$components/sideSection/percentageBar.svelte";
import type { SideMetricStatistic } from "$lib/utils/sideMetricTransformation";

let {
  statistics,
  demographicStatistics,
  forceStatic = false,
}: {
  statistics: SideMetricStatistic[];
  demographicStatistics: SideMetricStatistic[];
  forceStatic?: boolean;
} = $props();
</script>

<h4 class="text-lg font-semibold">Social Determinants</h4>
{#if statistics.length === 0 && demographicStatistics.length === 0}
  <p class="mt-2 text-sm text-gray-600">
    Community and demographic data are unavailable for this location.
  </p>
{:else}
  {#each statistics as stat (stat.id)}
    <PercentageBar
      title={stat.title}
      currentValueDisplay={stat.currentValueDisplay}
      currentValue={stat.currentValue}
      minValue={stat.minValue}
      maxValue={stat.maxValue}
      minLabel={stat.minLabel}
      maxLabel={stat.maxLabel}
      averageValue={stat.averageValue}
      averageLabel={stat.averageLabel}
      uniqueIdBase={stat.id}
      {forceStatic}
    />
  {/each}
  <h4 class="mt-8 text-lg font-semibold">Demographics</h4>
  {#each demographicStatistics as stat (stat.id)}
    <PercentageBar
      title={stat.title}
      currentValueDisplay={stat.currentValueDisplay}
      currentValue={stat.currentValue}
      minValue={stat.minValue}
      maxValue={stat.maxValue}
      minLabel={stat.minLabel}
      maxLabel={stat.maxLabel}
      averageValue={stat.averageValue}
      averageLabel={stat.averageLabel}
      uniqueIdBase={stat.id}
      {forceStatic}
    />
  {/each}
{/if}
