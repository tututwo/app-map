<script lang="ts">
let { label = "", value = "" } = $props<{ label: string; value: string | number }>();
</script>

<div class="text-center">
  <p class="text-sm text-gray-600">{label}</p>
  <p class="text-4xl font-bold text-black">{value}</p>
</div>
