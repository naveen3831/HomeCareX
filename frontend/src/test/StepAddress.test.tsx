import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// Stand-in for the Leaflet map: reports one fixed spot when "Pick on map" is pressed.
vi.mock("@/components/customer/maps/MapAddressPicker", () => ({
  default: ({ onPick }: { onPick: (p: { lat: number; lng: number; formatted: string; line1: string; area: string; city: string; state: string; pincode: string }) => void }) => (
    <button
      type="button"
      onClick={() =>
        onPick({ lat: 17.49, lng: 78.39, formatted: "JNTU Road, Kukatpally", line1: "JNTU Road", area: "Kukatpally", city: "Hyderabad", state: "Telangana", pincode: "500081" })
      }
    >
      Pick on map
    </button>
  ),
}));

const listMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/services/addressApi", () => ({
  addressApi: {
    list: () => listMock(),
    create: (payload: unknown) => createMock(payload),
    checkServiceability: async (pincode: string) => ({ serviceable: true, pincode, city: "Hyderabad", state: "Telangana" }),
    update: (id: string, payload: unknown) => updateMock(id, payload),
    delete: (id: string) => deleteMock(id),
  },
}));

import StepAddress from "../pages/customer/Book/StepAddress";

beforeEach(() => {
  listMock.mockReset().mockResolvedValue([]);
  createMock.mockReset().mockImplementation(async (payload: Record<string, unknown>) => ({
    id: "new1", line1: "Flat 9, JNTU Road", isDefault: true, serviceable: true, ...payload,
  }));
  updateMock.mockReset().mockImplementation(async (id: string, payload: Record<string, unknown>) => ({
    id, line1: "WeWork, JNtu road", isDefault: true, serviceable: true, ...payload,
  }));
  deleteMock.mockReset().mockResolvedValue(undefined);
});

const renderStep = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <StepAddress />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("StepAddress CRUD operations", () => {
  it("fills street, area, city, state and pincode from the map and saves them as separate fields", async () => {
    renderStep();
    await userEvent.click(await screen.findByRole("button", { name: /pick on map/i }));

    expect(screen.getByLabelText(/street \/ road/i)).toHaveValue("JNTU Road");
    expect(screen.getByLabelText(/area \/ locality/i)).toHaveValue("Kukatpally");
    expect(screen.getByLabelText(/^city/i)).toHaveValue("Hyderabad");
    expect(screen.getByLabelText(/^state/i)).toHaveValue("Telangana");
    expect(screen.getByLabelText(/^pincode/i)).toHaveValue("500081");
    expect(screen.getByLabelText(/house \/ flat no/i)).toHaveValue("");

    await userEvent.type(screen.getByLabelText(/house \/ flat no/i), "Flat 9");
    const form = document.getElementById("address-form") as HTMLFormElement;
    await act(async () => form.requestSubmit());

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Home", house: "Flat 9", street: "JNTU Road", area: "Kukatpally", city: "Hyderabad", state: "Telangana", pincode: "500081" }),
    );
  });

  it("edits an address cleanly without false unserviceable warning and updates via addressApi.update", async () => {
    const mockAddress = {
      id: "addr-123",
      label: "Other",
      house: "WeWork",
      street: "JNtu road",
      area: "Hitech City",
      line1: "WeWork, JNtu road",
      line2: "Hitech City",
      landmark: "Near City Centre",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500081",
      isDefault: true,
      serviceable: true,
      location: { lat: 17.385, lng: 78.4867 },
    };
    listMock.mockResolvedValue([mockAddress]);

    renderStep();
    await waitFor(() => expect(screen.getByText("WeWork, JNtu road")).toBeInTheDocument());

    // Click edit button
    const editBtn = screen.getByRole("button", { name: /edit other address/i });
    await userEvent.click(editBtn);

    // Verify form opened in edit mode
    expect(screen.getByText("Edit address")).toBeInTheDocument();
    // Ensure false unserviceable banner is NOT shown
    expect(screen.queryByText(/Sorry, we don't currently service that area/i)).not.toBeInTheDocument();

    // Verify input fields are pre-populated
    expect(screen.getByLabelText(/house \/ flat no/i)).toHaveValue("WeWork");
    expect(screen.getByLabelText(/street \/ road/i)).toHaveValue("JNtu road");
    expect(screen.getByLabelText(/^pincode/i)).toHaveValue("500081");

    // Modify house number
    await userEvent.clear(screen.getByLabelText(/house \/ flat no/i));
    await userEvent.type(screen.getByLabelText(/house \/ flat no/i), "WeWork Building 2");

    // Submit form
    const form = document.getElementById("address-form") as HTMLFormElement;
    await act(async () => form.requestSubmit());

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock).toHaveBeenCalledWith(
      "addr-123",
      expect.objectContaining({
        house: "WeWork Building 2",
        street: "JNtu road",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500081",
      }),
    );
    expect(await screen.findByText(/address updated successfully/i)).toBeInTheDocument();
  });

  it("shows in-app confirmation dialog when deleting and shows success message", async () => {
    const mockAddress = {
      id: "addr-456",
      label: "Other",
      house: "WeWork",
      street: "JNtu road",
      line1: "WeWork, JNtu road",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500081",
      isDefault: false,
      serviceable: true,
    };
    listMock.mockResolvedValue([mockAddress]);

    renderStep();
    await waitFor(() => expect(screen.getByText("WeWork, JNtu road")).toBeInTheDocument());

    const deleteBtn = screen.getByRole("button", { name: /delete other address/i });
    await userEvent.click(deleteBtn);

    // Dialog must be present with role="alertdialog"
    const dialog = screen.getByRole("alertdialog", { name: /delete address\?/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete this address\? This action cannot be undone/i)).toBeInTheDocument();

    // Clicking "Yes, delete" executes deletion
    const confirmBtn = screen.getByRole("button", { name: /yes, delete/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith("addr-456"));
    expect(await screen.findByText(/address deleted successfully/i)).toBeInTheDocument();
  });

  it("cancels deletion when user clicks 'Keep address'", async () => {
    const mockAddress = {
      id: "addr-456",
      label: "Other",
      house: "WeWork",
      street: "JNtu road",
      line1: "WeWork, JNtu road",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500081",
      isDefault: false,
      serviceable: true,
    };
    listMock.mockResolvedValue([mockAddress]);

    renderStep();
    await waitFor(() => expect(screen.getByText("WeWork, JNtu road")).toBeInTheDocument());

    const deleteBtn = screen.getByRole("button", { name: /delete other address/i });
    await userEvent.click(deleteBtn);

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: /keep address/i });
    await userEvent.click(cancelBtn);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
