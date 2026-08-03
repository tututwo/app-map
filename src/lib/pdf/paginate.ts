/**
 * Y-offsets for drawing one tall image across successive PDF pages: draw the
 * full image at each offset and let the page clip to its band. Every page
 * advances by the usable height (page minus top+bottom margins), so no strip
 * of content is skipped at a page break.
 */
export function pageImageOffsets(
  imageHeight: number,
  pageHeight: number,
  margin: number
): number[] {
  const usableHeight = pageHeight - margin * 2;
  if (usableHeight <= 0 || imageHeight <= 0) return [margin];

  const offsets: number[] = [];
  for (let rendered = 0; rendered === 0 || rendered < imageHeight; rendered += usableHeight) {
    offsets.push(margin - rendered);
  }
  return offsets;
}
