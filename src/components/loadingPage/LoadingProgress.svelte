<script lang="ts">
import { fade } from "svelte/transition";

interface LoadingItem {
  name: string;
  isLoading: boolean;
}

let { items, show = true }: { items: LoadingItem[]; show?: boolean } = $props();

let completedCount = $derived(items.filter((item) => !item.isLoading).length);
let totalCount = $derived(items.length);
let progress = $derived((completedCount / totalCount) * 100);
</script>

{#if show}
  <div class="loading-progress" transition:fade={{ duration: 300 }}>
    <div class="progress-content">
      <h3 class="progress-title">Loading Church Data</h3>

      <div class="progress-bar-container">
        <div class="progress-bar" style="width: {progress}%"></div>
      </div>

      <div class="progress-details">
        {#each items as item}
          <div class="progress-item">
            {#if item.isLoading}
              <div class="spinner-small"></div>
            {:else}
              <svg class="checkmark" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"
                />
              </svg>
            {/if}
            <span class="progress-item-name" class:completed={!item.isLoading}>
              {item.name}
            </span>
          </div>
        {/each}
      </div>

      <p class="progress-status">
        {completedCount} of {totalCount} data sources loaded
      </p>
    </div>
  </div>
{/if}

<style>
.loading-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.98);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.progress-content {
  background: white;
  padding: 2rem 3rem;
  border-radius: 12px;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 400px;
  width: 90%;
}

.progress-title {
  margin: 0 0 1.5rem 0;
  font-size: 1.5rem;
  font-weight: 600;
  text-align: center;
  color: #1a202c;
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  background-color: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #00356b 0%, #286dc0 30%, #00a651 70%, #00356b 100%);
  background-size: 200% 100%;
  transition: width 0.3s ease;
  border-radius: 4px;
  position: relative;
  animation: gradientShift 3s ease-in-out infinite;
}

.progress-bar::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 45%,
    rgba(255, 255, 255, 0.6) 50%,
    rgba(255, 255, 255, 0.3) 55%,
    transparent 100%
  );
  border-radius: 4px;
  animation: prestigeShine 2.5s ease-in-out infinite;
}

@keyframes gradientShift {
  0% {
    background-position: 0% 0%;
  }
  50% {
    background-position: 100% 0%;
  }
  100% {
    background-position: 0% 0%;
  }
}

@keyframes prestigeShine {
  0% {
    transform: translateX(-120%);
  }
  50% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(120%);
  }
}

.progress-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.progress-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid #e2e8f0;
  border-top-color: #00356b;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.checkmark {
  width: 16px;
  height: 16px;
  color: #00a651;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.progress-item-name {
  font-size: 0.875rem;
  color: #718096;
  transition: color 0.2s;
}

.progress-item-name.completed {
  color: #2d3748;
  font-weight: 500;
}

.progress-status {
  margin: 0;
  text-align: center;
  font-size: 0.875rem;
  color: #718096;
}
</style>
