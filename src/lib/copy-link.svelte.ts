/** "Copy link" state shared by the footer chip and the Explore Share button. */
export class CopyLink {
  copied = $state(false);

  async copy() {
    await navigator.clipboard.writeText(location.href);
    this.copied = true;
    setTimeout(() => (this.copied = false), 1600);
  }
}
