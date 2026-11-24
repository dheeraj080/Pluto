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

  it("keeps both primary calls to action", () => {
    expect(html).toContain('href="/login"');
    expect(html).toContain("Start on the web");
    expect(html).toContain("Get the Android app");
  });

  it("marks illustrative currency figures as illustrative", () => {
    expect(html).toContain("Illustrative");
  });
});
