import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogTreeThumbnail } from "./section-tree";

describe("CatalogTreeThumbnail", () => {
  it("uses the same stone background for section images and placeholders", () => {
    const { container, rerender } = render(<CatalogTreeThumbnail src="/section.webp" />);

    expect(container.querySelector("[data-catalog-tree-thumbnail] > span")).toHaveClass("bg-stone-100");
    expect(container.querySelector('img[src="/section.webp"]')).toBeInTheDocument();

    rerender(<CatalogTreeThumbnail />);

    expect(container.querySelector("[data-catalog-tree-thumbnail] > span")).toHaveClass("bg-stone-100");
  });

  it("keeps the selected thumbnail frame on the same stone background", () => {
    const { container } = render(<CatalogTreeThumbnail src="/section.webp" selected />);

    expect(container.querySelector("[data-catalog-tree-thumbnail]")).toHaveClass("bg-stone-100");
  });
});
