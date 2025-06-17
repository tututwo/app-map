<script lang="ts">
import { onMount } from "svelte";
import { Popover } from "bits-ui";
import {
  ExternalLink,
  Link,
  Mail,
  Facebook,
  Twitter,
  Linkedin,
  MessageSquare,
} from "lucide-svelte";
import type { ComponentType } from "svelte";

// Props for the component
interface Props {
  url?: string;
  title?: string;
  text?: string;
  hashtags?: string;
  via?: string;
  media?: string;
  fbAppId?: string;
  className?: string;
}

let {
  url = "",
  title = "",
  text = "",
  hashtags = "",
  via = "",
  media = "",
  fbAppId = "",
  className = "",
}: Props = $props();

// Reactive state for URL and title
let currentUrl = $state(url);
let currentTitle = $state(title);

type ShareOption = {
  label: string;
  icon: ComponentType;
  shareonClass: string;
  action?: () => void;
};

const shareOptions: ShareOption[] = [
  {
    label: "Copy link",
    icon: Link,
    shareonClass: "copy-url",
    action: async () => {
      try {
        await navigator.clipboard.writeText(currentUrl);
        console.log("Link copied to clipboard!");
      } catch (err) {
        console.error("Failed to copy link:", err);
      }
    },
  },
  {
    label: "Email",
    icon: Mail,
    shareonClass: "email",
  },
  {
    label: "Facebook",
    icon: Facebook,
    shareonClass: "facebook",
  },
  {
    label: "Bluesky",
    icon: MessageSquare,
    shareonClass: "bluesky",
  },
  {
    label: "X",
    icon: Twitter,
    shareonClass: "twitter",
  },
  {
    label: "LinkedIn",
    icon: Linkedin,
    shareonClass: "linkedin",
  },
];

let open = $state(false);
let shareContainer: HTMLDivElement = $state(undefined);
let shareonModule: any = null;

// Set default values on mount
onMount(() => {
  currentUrl = url || window.location.href;
  currentTitle = title || document.title;

  // Preload Shareon module
  import("shareon").then((module) => {
    shareonModule = module;
    import("shareon/css");
  });
});

// Update reactive values when props change
$effect(() => {
  if (url) currentUrl = url;
  if (title) currentTitle = title;
});

// Initialize Shareon each time the popover opens
$effect(() => {
  if (open && shareContainer && shareonModule && typeof window !== "undefined") {
    // Ensure the container has the latest data attributes
    shareContainer.setAttribute("data-url", currentUrl);
    shareContainer.setAttribute("data-title", currentTitle);
    if (text) shareContainer.setAttribute("data-text", text);
    if (media) shareContainer.setAttribute("data-media", media);
    if (fbAppId) shareContainer.setAttribute("data-fb-app-id", fbAppId);

    // Set platform-specific attributes on the buttons
    const buttons = shareContainer.querySelectorAll("a");
    buttons.forEach((button) => {
      const className = button.className;

      if (className === "facebook" && hashtags) {
        button.setAttribute("data-hashtags", hashtags.split(",")[0]);
      }

      if (className === "bluesky" && text) {
        button.setAttribute("data-text", text);
      }

      if (className === "twitter") {
        if (via) button.setAttribute("data-via", via);
        if (hashtags) button.setAttribute("data-hashtags", hashtags);
      }

      if ((className === "mastodon" || className === "tumblr") && via) {
        button.setAttribute("data-via", via);
      }

      if ((className === "telegram" || className === "whatsapp" || className === "viber") && text) {
        button.setAttribute("data-text", text);
      }
    });

    // Initialize Shareon with a small delay to ensure DOM is ready
    setTimeout(() => {
      shareonModule.init();
    }, 100);
  }
});

// Handle button clicks
function handleShareClick(option: ShareOption) {
  if (option.action) {
    // Custom action (copy link)
    option.action();
    open = false;
  } else if (typeof window !== "undefined" && shareContainer) {
    // Trigger the corresponding hidden Shareon button
    const shareonButton = shareContainer.querySelector(`.${option.shareonClass}`);
    if (shareonButton instanceof HTMLElement) {
      shareonButton.click();
      setTimeout(() => (open = false), 100);
    }
  }
}
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    class="flex w-full cursor-pointer items-center gap-3 font-light text-white opacity-90 transition-opacity hover:opacity-100 {className}"
  >
    <i class="flex size-6 items-center justify-center">
      <ExternalLink color="white" strokeWidth={1.5} size={22} />
    </i>
    Share to social media
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content
      class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 w-[min(200px,max(18vw,200px))] border-none bg-[#286DC0] p-0 text-white shadow-xl"
      sideOffset={0}
      align="start"
    >
      <Popover.Arrow class="fill-[#286DC0]" width={16} height={8} />
      <div class="p-2">
        <!-- Hidden Shareon container -->
        {#if typeof window !== "undefined"}
          <div bind:this={shareContainer} class="shareon hidden">
            {#each shareOptions as option (option.label)}
              <a class={option.shareonClass}></a>
            {/each}
          </div>
        {/if}

        <!-- YOUR ORIGINAL UI - UNCHANGED -->
        {#each shareOptions as option (option.label)}
          <button
            onclick={() => handleShareClick(option)}
            class="flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-[#01356B] focus:outline-none"
          >
            <option.icon class="h-5 w-5" />
            <span>{option.label}</span>
          </button>
        {/each}
      </div>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>

<style>
/* Hide the actual Shareon buttons but keep them functional */
:global(.shareon) {
  position: absolute;
  left: -9999px;
}

/* Override Shareon's default styles to ensure functionality without visibility */
:global(.shareon > *) {
  display: inline-block !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
:global(#bits-37 > svg > polygon) {
  fill: #286dc0 !important;
}
</style>
