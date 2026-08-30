import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RiskRegister from "../RiskRegister.jsx";
import { RBACProvider } from "../../context/RBACContext.jsx";
import meetingRiskApi from "../../services/meetingRiskApi";

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ orgId: "org_123" }),
}));
vi.mock("../../services/meetingRiskApi");

// Setup Clerk
const VITE_CLERK_PUBLISHABLE_KEY = "pk_test_12345";

describe("RiskRegister RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meetingRiskApi.getRisksByOrganization.mockResolvedValue({
      success: true,
      data: [
        {
          _id: "risk1",
          title: "Test Risk",
          category: "Technical",
          probability: 3,
          impact: 3,
          riskScore: 9,
          status: "Open",
        },
      ],
    });
  });

  const renderWithRBAC = (role) => {
    return render(
      <MemoryRouter initialEntries={["/risks"]}>
        <RBACProvider userRole={role}>
          <Routes>
            <Route path="/risks" element={<RiskRegister />} />
          </Routes>
        </RBACProvider>
      </MemoryRouter>,
    );
  };

  it("should show mitigation controls for admin", async () => {
    await act(async () => {
      renderWithRBAC("admin");
    });

    await waitFor(() => {
      expect(screen.getByText("Test Risk")).toBeInTheDocument();
    });

    const mitigateButton = screen.getByRole("button", { name: /Mitigate/i });
    expect(mitigateButton).toBeInTheDocument();
  });

  it("should show mitigation controls for owner", async () => {
    await act(async () => {
      renderWithRBAC("owner");
    });

    await waitFor(() => {
      expect(screen.getByText("Test Risk")).toBeInTheDocument();
    });

    const mitigateButton = screen.getByRole("button", { name: /Mitigate/i });
    expect(mitigateButton).toBeInTheDocument();
  });

  it("should hide mitigation controls for members", async () => {
    await act(async () => {
      renderWithRBAC("member");
    });

    await waitFor(() => {
      expect(screen.getByText("Test Risk")).toBeInTheDocument();
    });

    const mitigateButton = screen.queryByRole("button", { name: /Mitigate/i });
    expect(mitigateButton).not.toBeInTheDocument();
  });

  it("should hide mitigation controls for guests", async () => {
    await act(async () => {
      renderWithRBAC("guest");
    });

    await waitFor(() => {
      expect(screen.getByText("Test Risk")).toBeInTheDocument();
    });

    const mitigateButton = screen.queryByRole("button", { name: /Mitigate/i });
    expect(mitigateButton).not.toBeInTheDocument();
  });
});
