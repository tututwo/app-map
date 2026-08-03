import { describe, expect, it } from "vitest";

import { pageImageOffsets } from "$lib/pdf/paginate";

describe("pageImageOffsets", () => {
  it("uses a single page when the image fits the usable band", () => {
    expect(pageImageOffsets(500, 842, 20)).toEqual([20]);
    expect(pageImageOffsets(802, 842, 20)).toEqual([20]);
  });

  it("advances by exactly the usable height so no content is skipped", () => {
    // usable band = 842 - 40 = 802; 2000px of image needs ceil(2000/802) = 3 pages
    expect(pageImageOffsets(2000, 842, 20)).toEqual([20, 20 - 802, 20 - 1604]);
  });

  it("covers the whole image: last offset plus image height reaches past the final band", () => {
    const margin = 20;
    const pageHeight = 842;
    const imageHeight = 5000;
    const offsets = pageImageOffsets(imageHeight, pageHeight, margin);
    const usable = pageHeight - margin * 2;

    expect(offsets).toHaveLength(Math.ceil(imageHeight / usable));
    const lastOffset = offsets.at(-1)!;
    expect(lastOffset + imageHeight).toBeGreaterThan(margin);
    expect(margin - offsets.at(-1)! + usable).toBeGreaterThanOrEqual(imageHeight);
  });

  it("degenerate inputs fall back to one page", () => {
    expect(pageImageOffsets(0, 842, 20)).toEqual([20]);
    expect(pageImageOffsets(100, 30, 20)).toEqual([20]);
  });
});
