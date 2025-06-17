<script lang="ts">
import { fade } from "svelte/transition";

let {
  show = false,
  hasTimeout = false,
  onRetry = () => {},
}: {
  show?: boolean;
  hasTimeout?: boolean;
  onRetry?: () => void;
} = $props();
</script>

{#if show}
  <div class="error-overlay" transition:fade={{ duration: 300 }}>
    <div class="error-content">
      <div class="error-icon">
        {#if hasTimeout}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        {/if}
      </div>

      <h3 class="error-title">
        {hasTimeout ? "Loading is taking longer than expected" : "Failed to load some data"}
      </h3>

      <p class="error-message">
        {#if hasTimeout}
          The data is taking an unusually long time to load. This might be due to a slow connection
          or server issues.
        {:else}
          Some data could not be loaded. Please check your connection and try again.
        {/if}
      </p>

      <div class="error-actions">
        <button class="retry-button" onclick={onRetry}>
          <svg
            class="retry-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          Try Again
        </button>

        <button class="continue-button" onclick={() => (show = false)}> Continue Anyway </button>
      </div>
    </div>
  </div>
{/if}

<style>
.error-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.error-content {
  background: white;
  padding: 2.5rem;
  border-radius: 12px;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 450px;
  width: 90%;
  text-align: center;
}

.error-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 1.5rem;
  color: #f56565;
}

.error-title {
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a202c;
}

.error-message {
  margin: 0 0 2rem 0;
  color: #4a5568;
  line-height: 1.5;
}

.error-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.retry-button,
.continue-button {
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.retry-button {
  background-color: #00356b;
  color: white;
}

.retry-button:hover {
  background-color: #002855;
  transform: translateY(-1px);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.continue-button {
  background-color: #e2e8f0;
  color: #2d3748;
}

.continue-button:hover {
  background-color: #cbd5e0;
}

.retry-icon {
  width: 18px;
  height: 18px;
}
</style>
