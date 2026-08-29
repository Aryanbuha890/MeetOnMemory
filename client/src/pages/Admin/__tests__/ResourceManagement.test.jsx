import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ResourceManagement from "../ResourceManagement.jsx";
import AppContent from "../../../context/AppContent.js";
import resourceBookingApi from "../../../services/resourceBookingApi.js";

vi.mock("../../../services/resourceBookingApi.js", () => ({
  default: {
    getPhysicalResources: vi.fn(),
    createPhysicalResource: vi.fn(),
    deletePhysicalResource: vi.fn(),
    getAvailableResources: vi.fn(),
    getResourceBookings: vi.fn(),
    getOrganizationBookings: vi.fn(),
    createBooking: vi.fn(),
    cancelBooking: vi.fn(),
  },
  resourceBookingApi: {
    getPhysicalResources: vi.fn(),
    createPhysicalResource: vi.fn(),
    deletePhysicalResource: vi.fn(),
    getAvailableResources: vi.fn(),
    getResourceBookings: vi.fn(),
    getOrganizationBookings: vi.fn(),
    createBooking: vi.fn(),
    cancelBooking: vi.fn(),
  },
}));

const mockUserData = {
  _id: "user-1",
  id: "user-1",
  name: "Milan Admin",
  email: "milan@test.com",
  role: "admin",
  organization: { _id: "org-1", name: "Acme Corp" },
};

const mockResources = [
  {
    _id: "res-1",
    name: "Boardroom Alpha",
    type: "room",
    capacity: 12,
    location: "Floor 2",
    organization: "org-1",
  },
  {
    _id: "res-2",
    name: "4K Projector Rig",
    type: "equipment",
    capacity: 0,
    location: "Storage A",
    organization: "org-1",
  },
];

const mockBookings = [
  {
    _id: "book-1",
    resourceId: "res-1",
    title: "Quarterly Review",
    startTime: "2026-10-01T10:00:00.000Z",
    endTime: "2026-10-01T11:00:00.000Z",
    status: "CONFIRMED",
    userId: "user-1",
  },
];

const renderComponent = (props = {}) => {
  return render(
    <AppContent.Provider value={{ userData: mockUserData }}>
      <ResourceManagement {...props} />
    </AppContent.Provider>,
  );
};

describe("ResourceManagement Component (#2462)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resourceBookingApi.getPhysicalResources.mockResolvedValue(mockResources);
    resourceBookingApi.getResourceBookings.mockResolvedValue(mockBookings);
    resourceBookingApi.createBooking.mockResolvedValue({
      _id: "book-new",
      title: "Design Sync",
      status: "CONFIRMED",
    });
    resourceBookingApi.cancelBooking.mockResolvedValue({
      message: "Booking cancelled successfully",
    });
  });

  it("renders the facility resource timeline, calendar, and resources list", async () => {
    renderComponent();

    expect(
      screen.getByText(/Facility Resource Timeline & Calendar/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Boardroom Alpha")).toBeInTheDocument();
      expect(screen.getByText("4K Projector Rig")).toBeInTheDocument();
      expect(screen.getByText("Quarterly Review")).toBeInTheDocument();
      expect(screen.getByText("CONFIRMED")).toBeInTheDocument();
    });
  });

  it("books a new timeslot successfully", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Boardroom Alpha")).toBeInTheDocument();
    });

    const titleInput = screen.getByTestId("booking-title-input");
    const startInput = screen.getByTestId("booking-start-input");
    const endInput = screen.getByTestId("booking-end-input");

    fireEvent.change(titleInput, { target: { value: "Sprint Kickoff" } });
    fireEvent.change(startInput, {
      target: { value: "2026-10-01T14:00" },
    });
    fireEvent.change(endInput, {
      target: { value: "2026-10-01T15:00" },
    });

    const form = screen.getByTestId("booking-form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(resourceBookingApi.createBooking).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({
          resourceId: "res-1",
          title: "Sprint Kickoff",
          startTime: new Date("2026-10-01T14:00").toISOString(),
          endTime: new Date("2026-10-01T15:00").toISOString(),
        }),
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Slot successfully reserved!/i),
      ).toBeInTheDocument();
    });
  });

  it("displays conflict warning banner with alternative slot suggestions on 409 collision", async () => {
    const conflictError = {
      response: {
        status: 409,
        data: {
          error: "CONFLICT",
          message:
            "The requested resource is already reserved during this specific interval.",
          suggestions: [
            {
              startTime: "2026-10-01T11:15:00.000Z",
              endTime: "2026-10-01T12:15:00.000Z",
            },
          ],
        },
      },
    };

    resourceBookingApi.createBooking.mockRejectedValueOnce(conflictError);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Boardroom Alpha")).toBeInTheDocument();
    });

    const startInput = screen.getByTestId("booking-start-input");
    const endInput = screen.getByTestId("booking-end-input");

    fireEvent.change(startInput, {
      target: { value: "2026-10-01T10:30" },
    });
    fireEvent.change(endInput, {
      target: { value: "2026-10-01T11:30" },
    });

    const form = screen.getByTestId("booking-form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByTestId("conflict-warning-banner")).toBeInTheDocument();
      expect(
        screen.getByText(/Allocation Collision Triggered/i),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Suggested Alternative Free Slots:/i),
    ).toBeInTheDocument();

    const acceptSlotBtn = screen.getByRole("button", {
      name: /Accept Alternative Slot:/i,
    });
    expect(acceptSlotBtn).toBeInTheDocument();

    // Clicking alternative slot triggers auto-booking
    fireEvent.click(acceptSlotBtn);

    await waitFor(() => {
      expect(resourceBookingApi.createBooking).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({
          startTime: "2026-10-01T11:15:00.000Z",
          endTime: "2026-10-01T12:15:00.000Z",
        }),
      );
    });
  });

  it("revokes / cancels an existing booking", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("revoke-btn-book-1")).toBeInTheDocument();
    });

    const revokeBtn = screen.getByTestId("revoke-btn-book-1");
    fireEvent.click(revokeBtn);

    await waitFor(() => {
      expect(resourceBookingApi.cancelBooking).toHaveBeenCalledWith("book-1");
    });
  });

  it("creates a new physical resource", async () => {
    resourceBookingApi.createPhysicalResource.mockResolvedValueOnce({
      _id: "res-3",
      name: "Podcast Room",
      type: "room",
      capacity: 4,
    });

    renderComponent();

    const addResourceBtn = screen.getByRole("button", {
      name: /Add Resource/i,
    });
    fireEvent.click(addResourceBtn);

    expect(
      screen.getByText(/Create Physical Facility Resource/i),
    ).toBeInTheDocument();

    const nameInput = screen.getByTestId("new-resource-name-input");
    fireEvent.change(nameInput, { target: { value: "Podcast Room" } });

    const createForm = screen.getByTestId("create-resource-form");
    fireEvent.submit(createForm);

    await waitFor(() => {
      expect(resourceBookingApi.createPhysicalResource).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({
          name: "Podcast Room",
          type: "room",
        }),
      );
    });
  });
});
