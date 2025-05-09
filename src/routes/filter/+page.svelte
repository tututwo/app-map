<script lang="ts">
import counties from "$data/counties_geoid.csv";
import LocationInput from "$components/LocationInput.svelte";

let selectedCounty = $state<{ name: string; geoid: string } | null>(null);
</script>

<div class="container">
  <h1>County Filter</h1>

  <LocationInput data={counties} onSelect={(county) => (selectedCounty = county)} />

  {#if selectedCounty}
    <div class="selected-info">
      <h2>Selected County</h2>
      <p>Name: {selectedCounty.name}</p>
      <p>GEOID: {selectedCounty.geoid}</p>
    </div>
  {/if}
</div>

<style>
.container {
  max-width: 600px;
  margin: 2rem auto;
  padding: 0 1rem;
}

h1 {
  margin-bottom: 2rem;
  color: #333;
}

.selected-info {
  margin-top: 2rem;
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #f8f9fa;
}

.selected-info h2 {
  margin-top: 0;
  color: #333;
  font-size: 1.2rem;
}

.selected-info p {
  margin: 0.5rem 0;
  color: #666;
}
</style>
