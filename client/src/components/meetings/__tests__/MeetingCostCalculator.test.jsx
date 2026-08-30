// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MeetingCostCalculator from "../MeetingCostCalculator.jsx";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("MeetingCostCalculator Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with default quick estimate mode and calculates initial cost", () => {
    render(<MeetingCostCalculator />);

    expect(screen.getByTestId("meeting-cost-calculator")).toBeInTheDocument();
    expect(screen.getByText("Meeting Cost Calculator")).toBeInTheDocument();

    // 6 participants * 45/60 hrs * $75/hr = $338
    expect(screen.getByTestId("result-meeting-cost")).toHaveTextContent("$338");
    expect(screen.getByTestId("result-cost-per-attendee")).toHaveTextContent(
      "$56",
    );
  });

  it("updates calculation when participant slider is changed", () => {
    render(<MeetingCostCalculator />);

    const slider = screen.getByTestId("slider-participants");
    fireEvent.change(slider, { target: { value: "10" } });

    // 10 participants * 45/60 hrs * $75 = $563
    expect(screen.getByTestId("result-meeting-cost")).toHaveTextContent("$563");
  });

  it("updates calculation when duration slider is changed", () => {
    render(<MeetingCostCalculator />);

    const slider = screen.getByTestId("slider-duration");
    fireEvent.change(slider, { target: { value: "60" } });

    // 6 participants * 1 hr * $75 = $450
    expect(screen.getByTestId("result-meeting-cost")).toHaveTextContent("$450");
  });

  it("updates currency formatting when currency select changes", () => {
    render(<MeetingCostCalculator />);

    const currencySelect = screen.getByTestId("select-currency");
    fireEvent.change(currencySelect, { target: { value: "EUR" } });

    expect(screen.getByTestId("result-meeting-cost")).toHaveTextContent("€338");
  });

  it("applies scenario preset when a preset button is clicked", () => {
    render(<MeetingCostCalculator />);

    const dailyStandupBtn = screen.getByTestId("preset-dailyStandup");
    fireEvent.click(dailyStandupBtn);

    // 8 participants * 15/60 hrs * $70 = $140
    expect(screen.getByTestId("result-meeting-cost")).toHaveTextContent("$140");
  });

  it("switches to Role Tier Breakdown mode and computes tiered cost", () => {
    render(<MeetingCostCalculator />);

    const tieredModeBtn = screen.getByTestId("mode-tiered-btn");
    fireEvent.click(tieredModeBtn);

    expect(
      screen.getByText("Attendee Roles & Salary Tiers:"),
    ).toBeInTheDocument();

    // Default Tiers:
    // Exec: 1 * 160 = 160
    // Lead: 2 * 110 = 220
    // Senior: 4 * 80 = 320
    // Assoc: 3 * 50 = 150
    // Total sum = 850 $/hr * (45/60 hrs) = $638
    expect(screen.getByTestId("result-meeting-cost")).toHaveTextContent("$638");
  });

  it("allows adding a new role tier in tiered mode", () => {
    render(<MeetingCostCalculator />);

    fireEvent.click(screen.getByTestId("mode-tiered-btn"));

    const addTierBtn = screen.getByTestId("add-tier-btn");
    fireEvent.click(addTierBtn);

    expect(screen.getByDisplayValue("New Role Tier")).toBeInTheDocument();
  });

  it("calculates +20% prep overhead when include prep time checkbox is checked", () => {
    render(<MeetingCostCalculator />);

    const prepCheckbox = screen.getByTestId("checkbox-prep-time");
    fireEvent.click(prepCheckbox);

    // 6 * (45/60 * 1.2) * 75 = $405
    expect(screen.getByTestId("result-meeting-cost")).toHaveTextContent("$405");
  });

  it("copies summary report to clipboard when copy button is clicked", () => {
    const writeTextMock = vi.fn();
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(<MeetingCostCalculator />);

    const copyBtn = screen.getByTestId("copy-summary-btn");
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining("MeetOnMemory Cost Calculation Report"),
    );
  });

  it("triggers onApplyToMeeting callback when apply button is clicked", () => {
    const onApply = vi.fn();
    render(<MeetingCostCalculator onApplyToMeeting={onApply} />);

    const applyBtn = screen.getByTestId("apply-to-meeting-btn");
    fireEvent.click(applyBtn);

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        meetingCost: 338,
        effectiveTotalHeadcount: 6,
      }),
    );
  });
});
