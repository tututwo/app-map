<script>
let { children, data } = $props();
import "../app.css";
</script>

{@render children()}

{#if data.accessProtectionEnabled && data.accessAuthenticated}
  <form method="POST" action="/access/logout" class="fixed right-4 bottom-4 z-[9999]">
    <button
      type="submit"
      class="focus:ring-medium-blue cursor-pointer rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-slate-100 focus:ring-2 focus:ring-offset-2 focus:outline-none"
    >
      Sign out
    </button>
  </form>
{/if}
