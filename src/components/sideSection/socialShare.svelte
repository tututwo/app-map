<script lang="ts">
import { Popover, Button } from "bits-ui";
import {
  Share2, // Changed back to Share2 to match the button's purpose
  Link,
  Mail,
  Facebook,
  Twitter,
  Linkedin,
  MessageSquare,
  ArrowRight,
} from "lucide-svelte";
import type { ComponentType } from "svelte";

type ShareOption = {
  label: string;
  icon: ComponentType;
  action?: () => void;
};

const shareOptions = [
  { label: "Copy link", icon: Link, action: () => console.log("Copy link clicked") },
  { label: "Email", icon: Mail, action: () => console.log("Email clicked") },
  { label: "Facebook", icon: Facebook, action: () => console.log("Facebook clicked") },
  { label: "Bluesky", icon: MessageSquare, action: () => console.log("Bluesky clicked") },
  { label: "X", icon: Twitter, action: () => console.log("X clicked") },
  { label: "LinkedIn", icon: Linkedin, action: () => console.log("LinkedIn clicked") },
];

let open = $state(false);
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    class="flex cursor-pointer items-center gap-2 text-[15px] font-light text-white opacity-90 transition-opacity hover:opacity-100"
  >
    <ArrowRight color="white" strokeWidth={1.5} />
    Share to social media
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content
      class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 w-64 rounded-lg border-none bg-[#286DC0] p-0 text-white shadow-xl"
      sideOffset={5}
      align="center"
    >
      <Popover.Arrow class="fill-[#286DC0]" width={16} height={8} />
      <div class="p-2">
        {#each shareOptions as option (option.label)}
          <button
            onclick={() => {
              option.action?.();
              open = false;
            }}
            class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-[#01356B] focus:bg-[#01356B] focus:outline-none"
          >
            <option.icon class="h-5 w-5" />
            <span>{option.label}</span>
          </button>
        {/each}
      </div>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
