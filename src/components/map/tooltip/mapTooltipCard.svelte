<script lang="ts">
type Stat = {
  label: string;
  value: string | number;
};

interface Props {
  locationName?: string;
  stats?: Stat[];
  reportLinkText?: string;
  reportLink?: string;
}

let {
  locationName = "",
  stats = [
    { label: "Closed church", value: 25 },
    { label: "per 100k", value: 1.6 },
    { label: "per sqkm", value: 0.3 },
  ],
  reportLinkText = "Click to preview and download report",
  reportLink = "#",
}: Props = $props();
</script>

<div class=" p-2">
  <h2 class="mb-4 text-center text-xl font-bold text-black">{locationName}</h2>

  <div class="mb-4 grid grid-cols-3 gap-2">
    {#each stats as stat (stat.label)}
      <div class="text-center">
        <p class="text-xs text-gray-600">{stat.label}</p>
        <p class="text-2xl font-bold text-black">{stat.value}</p>
      </div>
    {/each}
  </div>

  <hr class="mb-3 border-gray-300" />

  <a href={reportLink} class="block text-center text-xs text-gray-500 hover:text-gray-700">
    {reportLinkText}
  </a>
</div>
