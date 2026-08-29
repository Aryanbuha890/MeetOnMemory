import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import TaskCard from "../TaskCard.jsx";
import SnoozeAlertModal from "../SnoozeAlertModal.jsx";

const mockTask = {
  id: "task-1",
  title: "Finish quarterly security audit",
  priority: "high",
  status: "open",
  dueDate: "2026-08-30T00:00:00.000Z",
  owner: "Alice Uploader",
  organization: "CyberDyne Systems",
  meetingId: "meeting-123",
  remindersEnabled: true,
  snoozedUntil: null,
  customWarningOffsets: [180],
};

describe("TaskCard Snooze Integration (#2589)", () => {
  it("renders the snooze & alert settings button", () => {
    render(<TaskCard task={mockTask} setSelectedTask={vi.fn()} />);

    const snoozeButton = screen.getByRole("button", {
      name: /configure snooze and alert options/i,
    });
    expect(snoozeButton).toBeInTheDocument();
  });

  it("renders the Snoozed badge when action item has a future snoozedUntil value", () => {
    const snoozedTask = {
      ...mockTask,
      snoozedUntil: new Date(Date.now() + 50000).toISOString(),
    };
    render(<TaskCard task={snoozedTask} setSelectedTask={vi.fn()} />);

    const badge = screen.getByText(/snoozed/i);
    expect(badge).toBeInTheDocument();
  });
});

describe("SnoozeAlertModal Features (#2589)", () => {
  it("allows selecting preset snooze options and triggers onSave", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    render(
      <SnoozeAlertModal task={mockTask} onClose={onClose} onSave={onSave} />,
    );

    // Click select option
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "2h" } });

    // Click Save
    const saveButton = screen.getByRole("button", { name: /save settings/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("task-1", {
        snoozedUntil: expect.any(String),
        customWarningOffsets: [180],
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("permits customizing SLA warning offsets and triggers onSave with numeric arrays", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    render(
      <SnoozeAlertModal task={mockTask} onClose={onClose} onSave={onSave} />,
    );

    // Input custom warning offsets
    const input = screen.getByPlaceholderText(/e\.g\. 180, 60/i);
    fireEvent.change(input, { target: { value: "360, 120" } });

    // Click Save
    const saveButton = screen.getByRole("button", { name: /save settings/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("task-1", {
        snoozedUntil: null,
        customWarningOffsets: [360, 120],
      });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
