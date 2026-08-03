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

interface Props {
  url?: string;
  title?: string;
  className?: string;
}

let { url = "", title = "", className = "" }: Props = $props();

let currentUrl = $state(url);
let currentTitle = $state(title);
let open = $state(false);

onMount(() => {
  currentUrl = url || window.location.href;
  currentTitle = title || document.title;
});

$effect(() => {
  if (url) currentUrl = url;
  if (title) currentTitle = title;
});

function openShare(shareUrl: string) {
  window.open(shareUrl, "_blank", "noopener,noreferrer");
}

type ShareOption = {
  label: string;
  icon: ComponentType;
  action: () => void;
};

const shareOptions: ShareOption[] = [
  {
    label: "Copy link",
    icon: Link,
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
    action: () => {
      window.location.href = `mailto:?subject=${encodeURIComponent(currentTitle)}&body=${encodeURIComponent(currentUrl)}`;
    },
  },
  {
    label: "Facebook",
    icon: Facebook,
    action: () =>
      openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`),
  },
  {
    label: "Bluesky",
    icon: MessageSquare,
    action: () =>
      openShare(
        `https://bsky.app/intent/compose?text=${encodeURIComponent(`${currentTitle} ${currentUrl}`)}`
      ),
  },
  {
    label: "X",
    icon: Twitter,
    action: () =>
      openShare(
        `https://twitter.com/intent/tweet?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(currentTitle)}`
      ),
  },
  {
    label: "LinkedIn",
    icon: Linkedin,
    action: () =>
      openShare(
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(currentUrl)}`
      ),
  },
];

function handleShareClick(option: ShareOption) {
  option.action();
  open = false;
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
