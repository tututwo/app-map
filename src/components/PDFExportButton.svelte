<script lang="ts">
import { exportElementToPDF, type PDFExportOptions } from '$lib/utils/pdfExport';
import { Download } from 'lucide-svelte';

interface Props {
  targetSelector?: string;
  targetElement?: HTMLElement | null;
  filename?: string;
  options?: PDFExportOptions;
  class?: string;
  disabled?: boolean;
}

let { 
  targetSelector, 
  targetElement, 
  filename = 'dashboard-export.pdf',
  options = {},
  class: className = '',
  disabled = false
}: Props = $props();

let isExporting = $state(false);
let exportError = $state<string | null>(null);

async function handleExport() {
  try {
    isExporting = true;
    exportError = null;

    // Get the target element
    let element: HTMLElement | null = null;
    
    if (targetElement) {
      element = targetElement;
    } else if (targetSelector) {
      element = document.querySelector(targetSelector) as HTMLElement;
    }

    if (!element) {
      throw new Error('Target element not found');
    }

    const result = await exportElementToPDF(element, {
      filename,
      ...options
    });

    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }
  } catch (error) {
    console.error('PDF export error:', error);
    exportError = error instanceof Error ? error.message : 'Export failed';
  } finally {
    isExporting = false;
  }
}
</script>

<div class="relative">
  <button
    onclick={handleExport}
    disabled={disabled || isExporting}
    class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors {className}"
  >
    {#if isExporting}
      <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Exporting...
    {:else}
      <Download class="h-4 w-4" />
      Export PDF
    {/if}
  </button>

  {#if exportError}
    <div class="absolute top-full left-0 mt-2 z-10 w-64 rounded-lg bg-red-50 border border-red-200 p-3 shadow-lg">
      <div class="flex">
        <svg class="h-5 w-5 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div class="ml-2">
          <h3 class="text-sm font-medium text-red-800">Export Error</h3>
          <p class="mt-1 text-xs text-red-700">{exportError}</p>
          <button 
            onclick={() => exportError = null}
            class="mt-2 text-xs text-red-600 hover:text-red-500 underline"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  {/if}
</div> 