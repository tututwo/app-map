<script lang="ts">
import { fade, scale } from "svelte/transition";
import { cubicOut } from "svelte/easing";

let { message = "Loading data...", show = true }: { message?: string; show?: boolean } = $props();
</script>

{#if show}
  <div class="loading-overlay" transition:fade={{ duration: 300, easing: cubicOut }}>
    <div class="loading-content" transition:scale={{ duration: 400, easing: cubicOut, start: 0.9 }}>
      <div class="spinner-container">
        <div class="spinner"></div>
        <div class="spinner-inner"></div>
      </div>
      <p class="loading-message">{message}</p>
    </div>
  </div>
{/if}

<style>
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(2px);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.spinner-container {
  position: relative;
  width: 60px;
  height: 60px;
}

.spinner {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 3px solid #e0e0e0;
  border-top-color: #00356b;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner-inner {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  bottom: 8px;
  border: 3px solid transparent;
  border-top-color: #00a651;
  border-right-color: #00a651;
  border-radius: 50%;
  animation: spin 1.5s linear infinite reverse;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-message {
  margin: 0;
  font-size: 1.125rem;
  color: #333;
  font-weight: 500;
  text-align: center;
}
</style>
