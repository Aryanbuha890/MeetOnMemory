import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import RecapPreferences from "../RecapPreferences.jsx";
import {
  getRecapPreferences,
  previewRecapEmail,
} from "../../services/recapApi";

vi.mock("../../services/recapApi", () => ({
  getRecapPreferences: vi.fn(),
  updateRecapPreferences: vi.fn(),
  previewRecapEmail: vi.fn(),
}));

vi.mock("../../services/notificationApi", () => ({
  notificationApi: {
    getPreferences: vi.fn().mockResolvedValue({ data: { preferences: {} } }),
    updatePreferences: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@headlessui/react", () => {
  const Dialog = ({ open, children }) => (open ? <div>{children}</div> : null);
  Dialog.Title = ({ children, ...props }) => <h3 {...props}>{children}</h3>;
  return { Dialog };
});

const defaultPreferences = {
  deliveryTiming: "immediate",
  includeSummary: true,
  includeActionItems: true,
  includeTranscript: true,
  quietHoursStart: "",
  quietHoursEnd: "",
  timezone: "UTC",
};

const openPreview = async (html) => {
  previewRecapEmail.mockResolvedValueOnce(html);
  render(<RecapPreferences />);

  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: /preview email/i }),
    ).toBeEnabled();
  });

  fireEvent.click(screen.getByRole("button", { name: /preview email/i }));

  await waitFor(() => {
    expect(screen.getByTestId("sandboxed-html-preview")).toBeInTheDocument();
    expect(screen.getByTitle("Email Preview")).toBeInTheDocument();
  });

  return screen.getByTitle("Email Preview");
};

describe("RecapPreferences HTML preview sanitization (#1391, #2451)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRecapPreferences.mockResolvedValue(defaultPreferences);
  });

  it("renders API HTML through a sandboxed iframe", async () => {
    const iframe = await openPreview(
      `<div><h2>Meeting Recap: Project Alpha Kickoff</h2><p>We discussed the roadmap.</p></div>`,
    );

    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe.getAttribute("sandbox")).toBe("");
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-scripts");
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(iframe.getAttribute("srcdoc")).toContain(
      "Meeting Recap: Project Alpha Kickoff",
    );
    expect(iframe.getAttribute("srcdoc")).toContain(
      "We discussed the roadmap.",
    );
  });

  it("does not inject script tags from the API HTML into the preview", async () => {
    const iframe = await openPreview(
      `<p>Safe recap</p><script>alert("xss")</script>`,
    );

    const srcDoc = iframe.getAttribute("srcdoc") || "";
    expect(srcDoc).toContain("Safe recap");
    expect(srcDoc).not.toMatch(/<script/i);
    expect(srcDoc).not.toContain("alert(");
    expect(document.body.innerHTML).not.toMatch(/<script>alert/i);
  });

  it("strips event handlers from the API HTML", async () => {
    const iframe = await openPreview(
      `<img src="x" onerror="alert(1)" /><div onclick="alert(2)">Summary</div>`,
    );

    const srcDoc = iframe.getAttribute("srcdoc") || "";
    expect(srcDoc).toContain("Summary");
    expect(srcDoc).not.toMatch(/onerror/i);
    expect(srcDoc).not.toMatch(/onclick/i);
  });

  it("blocks javascript: URLs from the API HTML", async () => {
    const iframe = await openPreview(
      `<a href="javascript:alert(1)">Open recap</a>`,
    );

    const srcDoc = iframe.getAttribute("srcdoc") || "";
    expect(srcDoc).toContain("Open recap");
    expect(srcDoc).not.toMatch(/javascript:/i);
  });

  it("shows recovery UI when recap preview generation fails", async () => {
    previewRecapEmail.mockRejectedValueOnce(new Error("Preview failed"));
    render(<RecapPreferences />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /preview email/i }),
      ).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /preview email/i }));

    expect(
      await screen.findByTestId("sandboxed-html-preview-error"),
    ).toHaveTextContent("Failed to generate preview");
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });
});
