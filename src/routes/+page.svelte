<script>
  import { onMount } from 'svelte';
  
  // State management using Svelte 5 runes
  let selectedMetric = $state('Number of closed church');
  let timeRange = $state({ from: 2003, to: 2011 });
  let selectedLocation = $state('All locations');
  let highlightedGroup = $state(null);
  
  // Data ranges for the legend with corrected colors
  const dataRanges = [
    { label: '1-12', color: '#cfe2f3' },
    { label: '13-24', color: '#9fc5e8' },
    { label: '25-36', color: '#6fa8dc' },
    { label: '37-48', color: '#b4a7d6' },
    { label: '49-60', color: '#d5a6bd' }
  ];
  
  // Mock function to handle location input change
  function handleLocationChange(e) {
    selectedLocation = e.target.value;
  }
  
  // Mock function to highlight a group
  function highlightGroup(range) {
    highlightedGroup = range;
  }
  
  // Initialize any components on mount
  onMount(() => {
    // This would initialize charts, maps, etc.
    console.log('Dashboard mounted');
  });
</script>

<div class="flex h-screen">
  <!-- Sidebar -->
  <aside class="w-[230px] bg-[#002654] text-white p-6 flex flex-col">
    <div class="mb-12">
      <h1 class="text-4xl font-medium tracking-wide">Yale</h1>
    </div>
    
    <div class="flex flex-col flex-1">
      <h2 class="text-3xl font-bold leading-tight tracking-wide mb-10">
        Closed<br>Churches<br>in the US
      </h2>
      
      <div class="mb-10">
        <h3 class="text-base font-semibold mb-2">Location of interest</h3>
        <p class="text-sm leading-relaxed opacity-90 mb-3">
          Input name or zipcode of a location, leave it blank for the entire country
        </p>
        
        <input 
          type="text" 
          placeholder="All locations" 
          value={selectedLocation}
          on:input={handleLocationChange}
          class="w-full p-2.5 rounded border-none text-sm shadow-sm"
        />
      </div>
      
      <div class="mt-auto">
        <div class="mb-6">
          <h3 class="text-base font-semibold mb-2">About this project</h3>
          <p class="text-sm leading-relaxed opacity-90">
            This project is a collaboration between Yale Center for Geospatial Solutions and Yale School of Public Health.
          </p>
        </div>
        
        <div class="flex flex-col gap-3">
          <button class="flex items-center gap-2 text-sm opacity-90 hover:opacity-100 transition-opacity">
            <span class="inline-flex items-center justify-center">↗</span> Share to social media
          </button>
          <button class="flex items-center gap-2 text-sm opacity-90 hover:opacity-100 transition-opacity">
            <span class="inline-flex items-center justify-center">⬇</span> Download data
          </button>
        </div>
      </div>
    </div>
  </aside>
  
  <!-- Main Content -->
  <main class="flex-1 p-5 flex flex-col h-screen overflow-hidden">
    <!-- Line chart section - 1/5 of height -->
    <section aria-label="Line chart" class="border border-gray-200 rounded h-[20vh] mb-5">
      <header class="flex justify-between items-center px-5 py-2.5 border-b border-gray-200">
        <h2 class="text-base">
          Number of <span class="font-bold">closed churches</span> in <span class="font-bold">all locations</span> over time
        </h2>
        <span class="text-xs text-gray-500">Data source: research center data port</span>
      </header>
      <div class="flex justify-center items-center h-[calc(20vh-50px)]">
        <h1 class="text-5xl text-black opacity-80">Line chart</h1>
      </div>
    </section>
    
    <!-- Controls and charts section - takes remaining height -->
    <div class="flex-1 grid grid-cols-[2fr_1fr] gap-5">
      <!-- Left column - controls and map -->
      <div class="flex flex-col h-full">
        <!-- Time range and controls -->
        <div class="mb-5">
          <!-- Time range -->
          <h3 class="text-lg text-[#00a651] font-medium mb-4">From {timeRange.from} to {timeRange.to}</h3>
          
          <!-- Controls grid with radio buttons and legend -->
          <div class="grid grid-cols-2 gap-4 mb-2">
            <!-- Radio buttons for metrics -->
            <section aria-label="Metrics" class="flex flex-col gap-2.5">
              <label class="flex items-center gap-2 text-sm">
                <div class="relative flex items-center">
                  <input 
                    type="radio" 
                    name="metric" 
                    value="Number of closed church" 
                    checked={selectedMetric === 'Number of closed church'} 
                    on:change={() => selectedMetric = 'Number of closed church'}
                    class="appearance-none w-4 h-4 rounded-full border border-gray-300 checked:border-4 checked:border-black"
                  />
                </div>
                Number of closed church
              </label>
              
              <label class="flex items-center gap-2 text-sm">
                <div class="relative flex items-center">
                  <input 
                    type="radio" 
                    name="metric" 
                    value="Density of closed church: per 100k population" 
                    checked={selectedMetric === 'Density of closed church: per 100k population'} 
                    on:change={() => selectedMetric = 'Density of closed church: per 100k population'}
                    class="appearance-none w-4 h-4 rounded-full border border-gray-300 checked:border-4 checked:border-black"
                  />
                </div>
                Density of closed church: per 100k population
                <span class="inline-flex justify-center items-center w-4 h-4 rounded-full bg-gray-200 text-xs ml-1">?</span>
              </label>
              
              <label class="flex items-center gap-2 text-sm">
                <div class="relative flex items-center">
                  <input 
                    type="radio" 
                    name="metric" 
                    value="Density of closed church: per sqkm" 
                    checked={selectedMetric === 'Density of closed church: per sqkm'} 
                    on:change={() => selectedMetric = 'Density of closed church: per sqkm'}
                    class="appearance-none w-4 h-4 rounded-full border border-gray-300 checked:border-4 checked:border-black"
                  />
                </div>
                Density of closed church: per sqkm
                <span class="inline-flex justify-center items-center w-4 h-4 rounded-full bg-gray-200 text-xs ml-1">?</span>
              </label>
            </section>
            
            <!-- Legend section -->
            <section aria-label="Legend" class="flex flex-col items-end">
              <div class="flex gap-1 mb-1">
                <button 
                  class="px-3 py-1 text-sm rounded"
                  style="background-color: #cfe2f3;" 
                  on:click={() => highlightGroup('1-12')}
                  class:ring-2={highlightedGroup === '1-12'}
                  class:ring-black={highlightedGroup === '1-12'}
                >
                  1-12
                </button>
                <button 
                  class="px-3 py-1 text-sm rounded"
                  style="background-color: #9fc5e8;" 
                  on:click={() => highlightGroup('13-24')}
                  class:ring-2={highlightedGroup === '13-24'}
                  class:ring-black={highlightedGroup === '13-24'}
                >
                  13-24
                </button>
                <button 
                  class="px-3 py-1 text-sm rounded"
                  style="background-color: #6fa8dc;" 
                  on:click={() => highlightGroup('25-36')}
                  class:ring-2={highlightedGroup === '25-36'}
                  class:ring-black={highlightedGroup === '25-36'}
                >
                  25-36
                </button>
                <button 
                  class="px-3 py-1 text-sm rounded"
                  style="background-color: #b4a7d6;" 
                  on:click={() => highlightGroup('37-48')}
                  class:ring-2={highlightedGroup === '37-48'}
                  class:ring-black={highlightedGroup === '37-48'}
                >
                  37-48
                </button>
                <button 
                  class="px-3 py-1 text-sm rounded"
                  style="background-color: #d5a6bd;" 
                  on:click={() => highlightGroup('49-60')}
                  class:ring-2={highlightedGroup === '49-60'}
                  class:ring-black={highlightedGroup === '49-60'}
                >
                  49-60
                </button>
              </div>
              
              <div class="text-xs flex items-center">
                <span class="inline-flex items-center justify-center mr-1">⬆</span> Select a group to highlight
              </div>
            </section>
          </div>
        </div>
        
        <!-- Map section - takes all remaining height -->
        <section aria-label="Map" class="border border-gray-200 rounded flex-1 flex justify-center items-center">
          <h1 class="text-5xl text-black opacity-80">Map</h1>
        </section>
      </div>
      
      <!-- Right column - stacked bar and small line charts -->
      <div class="flex flex-col h-full">
        <!-- Stacked bar chart -->
        <section aria-label="Stacked bar chart" class="border border-gray-200 rounded min-h-[185px] mb-5 flex justify-center items-center">
          <h1 class="text-4xl text-black opacity-80">stacked bar</h1>
        </section>
        
        <!-- Small line charts - fixed height container with scrolling -->
        <div class="h-[calc(100%-185px-1.25rem)] relative">
          <!-- Scrollable container -->
          <div class="absolute inset-0 overflow-y-auto pr-1">
            <!-- Multiple small line charts to demonstrate scrolling -->
            <section aria-label="Small line chart 1" class="border border-gray-200 rounded h-[150px] mb-5 flex justify-center items-center">
              <h1 class="text-2xl text-black opacity-80">small line chart 1</h1>
            </section>
            
            <section aria-label="Small line chart 2" class="border border-gray-200 rounded h-[150px] mb-5 flex justify-center items-center">
              <h1 class="text-2xl text-black opacity-80">small line chart 2</h1>
            </section>
            
            <section aria-label="Small line chart 3" class="border border-gray-200 rounded h-[150px] mb-5 flex justify-center items-center">
              <h1 class="text-2xl text-black opacity-80">small line chart 3</h1>
            </section>
            
            <section aria-label="Small line chart 4" class="border border-gray-200 rounded h-[150px] mb-5 flex justify-center items-center">
              <h1 class="text-2xl text-black opacity-80">small line chart 4</h1>
            </section>
            
            <section aria-label="Small line chart 5" class="border border-gray-200 rounded h-[150px] flex justify-center items-center">
              <h1 class="text-2xl text-black opacity-80">small line chart 5</h1>
            </section>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>

<!-- Add Tailwind directives for custom styling -->
<style global>
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  
  /* Custom scrollbar styling */
  ::-webkit-scrollbar {
    width: 6px;
  }
  
  ::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }
  
  ::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: #a1a1a1;
  }
</style>