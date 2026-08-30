import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SandboxedHtmlPreview, {
  SANDBOX_PREVIEW_POLICY,
  SANDBOX_POLICY_DESCRIPTION,
} from "../SandboxedHtmlPreview.jsx";

const iframeSrcDoc = (title) =>
  screen.getByTitle(title).getAttribute("srcdoc") || "";

describe("SandboxedHtmlPreview (#1391, #2451)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders sanitized HTML inside a maximally restricted iframe", () => {
    render(
      <SandboxedHtmlPreview
        htmlContent="<p>Meeting Recap</p>"
        title="Email Preview"
      />,
    );

    const iframe = screen.getByTitle("Email Preview");
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe.getAttribute("sandbox")).toBe(SANDBOX_PREVIEW_POLICY);
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-scripts");
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(iframe.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(iframeSrcDoc("Email Preview")).toContain("Meeting Recap");
    expect(screen.getByTestId("sandbox-policy-notice")).toHaveTextContent(
      SANDBOX_POLICY_DESCRIPTION,
    );
  });

  it("strips script tags before assigning srcDoc", () => {
    render(
      <SandboxedHtmlPreview
        htmlContent={`<p>Safe recap</p><script>alert("xss")</script>`}
        title="Email Preview"
      />,
    );

    const srcDoc = iframeSrcDoc("Email Preview");
    expect(srcDoc).toContain("Safe recap");
    expect(srcDoc).not.toMatch(/<script/i);
    expect(srcDoc).not.toContain("alert(");
  });

  it("strips event handlers before assigning srcDoc", () => {
    render(
      <SandboxedHtmlPreview
        htmlContent={`<img src="x" onerror="alert(1)" /><p onclick="steal()">Summary</p>`}
        title="Email Preview"
      />,
    );

    const srcDoc = iframeSrcDoc("Email Preview");
    expect(srcDoc).toContain("Summary");
    expect(srcDoc).not.toMatch(/onerror/i);
    expect(srcDoc).not.toMatch(/onclick/i);
    expect(srcDoc).not.toContain("alert(");
    expect(srcDoc).not.toContain("steal(");
  });

  it("blocks javascript: URLs before assigning srcDoc", () => {
    render(
      <SandboxedHtmlPreview
        htmlContent={`<a href="javascript:alert(1)">Open recap</a>`}
        title="Email Preview"
      />,
    );

    const srcDoc = iframeSrcDoc("Email Preview");
    expect(srcDoc).toContain("Open recap");
    expect(srcDoc).not.toMatch(/javascript:/i);
  });

  it("preserves legitimate recap markup", () => {
    render(
      <SandboxedHtmlPreview
        htmlContent={`
          <div style="font-family: sans-serif;">
            <h2>Meeting Recap: Project Alpha Kickoff</h2>
            <p>Date: 1/15/2026</p>
          </div>
        `}
        title="Email Preview"
      />,
    );

    const srcDoc = iframeSrcDoc("Email Preview");
    expect(srcDoc).toContain("Meeting Recap: Project Alpha Kickoff");
    expect(srcDoc).toContain("Date: 1/15/2026");
    expect(srcDoc).toMatch(/<h2/i);
  });

  it("renders nothing when HTML is empty after sanitization", () => {
    const { container } = render(
      <SandboxedHtmlPreview htmlContent="" title="Email Preview" />,
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTitle("Email Preview")).not.toBeInTheDocument();
  });

  it("applies dark theme styles to the preview document", () => {
    render(
      <SandboxedHtmlPreview
        htmlContent="<p>Dark recap</p>"
        title="Email Preview"
        theme="dark"
      />,
    );

    const srcDoc = iframeSrcDoc("Email Preview");
    expect(srcDoc).toContain("background: #0f172a");
    expect(srcDoc).toContain("color: #e2e8f0");
  });

  it("applies light theme styles to the preview document", () => {
    render(
      <SandboxedHtmlPreview
        htmlContent="<p>Light recap</p>"
        title="Email Preview"
        theme="light"
      />,
    );

    const srcDoc = iframeSrcDoc("Email Preview");
    expect(srcDoc).toContain("background: #ffffff");
    expect(srcDoc).toContain("color: #0f172a");
  });

  it("applies size presets to the iframe", () => {
    render(
      <SandboxedHtmlPreview
        htmlContent="<p>Sized recap</p>"
        title="Email Preview"
        size="sm"
      />,
    );

    const iframe = screen.getByTitle("Email Preview");
    expect(iframe.style.minHeight).toBe("240px");
    expect(iframe.style.height).toBe("320px");
  });

  it("injects optional print stylesheet rules", () => {
    render(
      <SandboxedHtmlPreview
        htmlContent="<p>Print recap</p>"
        title="Email Preview"
        printStylesheet="body { font-size: 12pt; }"
      />,
    );

    const srcDoc = iframeSrcDoc("Email Preview");
    expect(srcDoc).toContain("@media print");
    expect(srcDoc).toContain("font-size: 12pt");
  });

  it("shows a loading state while preview content is fetching", () => {
    render(
      <SandboxedHtmlPreview htmlContent="" title="Email Preview" loading />,
    );

    expect(
      screen.getByTestId("sandboxed-html-preview-loading"),
    ).toBeInTheDocument();
    expect(screen.getByText(/loading preview/i)).toBeInTheDocument();
    expect(screen.queryByTitle("Email Preview")).not.toBeInTheDocument();
  });

  it("shows recovery UI when preview loading fails", () => {
    const onRetry = vi.fn();
    render(
      <SandboxedHtmlPreview
        htmlContent=""
        title="Email Preview"
        error="Failed to load digest preview"
        onRetry={onRetry}
      />,
    );

    expect(
      screen.getByTestId("sandboxed-html-preview-error"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Failed to load digest preview"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows an error when the iframe does not load in time", () => {
    render(
      <SandboxedHtmlPreview
        htmlContent="<p>Slow recap</p>"
        title="Email Preview"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(
      screen.getByTestId("sandboxed-html-preview-error"),
    ).toHaveTextContent("Preview failed to load.");
  });

  it("can hide the sandbox policy notice", () => {
    render(
      <SandboxedHtmlPreview
        htmlContent="<p>Recap</p>"
        title="Email Preview"
        showSandboxPolicy={false}
      />,
    );

    expect(
      screen.queryByTestId("sandbox-policy-notice"),
    ).not.toBeInTheDocument();
  });
});
