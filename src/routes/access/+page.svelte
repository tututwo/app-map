<script lang="ts">
let { data, form } = $props();
</script>

<svelte:head>
  <title>Interview access | Church Closing Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
  <section class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
    <div class="bg-yale-blue mb-6 h-1 w-12 rounded-full"></div>
    <p class="text-medium-blue mb-2 text-sm font-semibold tracking-wide uppercase">
      Church Closing Dashboard
    </p>
    <h1 class="text-3xl font-semibold text-slate-950">Interview access</h1>
    <p class="mt-3 leading-6 text-slate-600">
      Enter the access code provided by the research team to continue.
    </p>

    {#if form?.incorrect}
      <p role="alert" class="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
        That access code wasn’t accepted. Please try again.
      </p>
    {/if}

    <form method="POST" class="mt-8 space-y-5">
      <input type="hidden" name="next" value={data.next} />
      <label class="block">
        <span class="mb-2 block text-sm font-medium text-slate-800">Access code</span>
        <input
          name="code"
          type="password"
          autocomplete="current-password"
          required
          class="focus:border-medium-blue focus:ring-medium-blue/20 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none focus:ring-2"
        />
      </label>
      <button
        type="submit"
        class="bg-yale-blue hover:bg-medium-blue focus:ring-medium-blue w-full cursor-pointer rounded-lg px-4 py-3 font-semibold text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
      >
        Continue
      </button>
    </form>
  </section>
</main>
