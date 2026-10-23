import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

/**
 * The header and footer link to these anchors, and external pages use
 * `/#privacy`. Render the real page so a renamed section cannot silently break
 * those deep links.
 */
const ANCHORS = ["the-problem", "how-it-works", "features", "life-abroad", "privacy", "faq"];

describe("landing page anchors", () => {
  const html = renderToStaticMarkup(createElement(HomePage));

  it.each(ANCHORS)("renders #%s", (anchor) => {
    expect(html).toContain(`id="${anchor}"`);
  });

  it("keeps the primary sign-in call to action", () => {
    expect(html).toContain('href="/login"');
    expect(html).toContain("Start tracking");
  });

  it("marks illustrative currency figures as illustrative", () => {
    expect(html).toContain("Illustrative");
  });
});
