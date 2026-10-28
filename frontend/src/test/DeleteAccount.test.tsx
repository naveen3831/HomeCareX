import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LOGIN_PATH } from "@/routes/authPaths";

const logout = vi.fn(() => Promise.resolve());
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "c1", name: "Asha", role: "customer" }, logout }),
}));

const del = vi.fn();
vi.mock("@/lib/http", () => ({
  default: {
    delete: (u: string) => del(u),
    get: vi.fn(),
  },
}));

const mockListBookings = vi.fn();
vi.mock("@/services/bookingApi", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    bookingApi: {
      ...((actual.bookingApi as Record<string, unknown>) || {}),
      listBookings: (...args: unknown[]) => mockListBookings(...args),
    },
  };
});

import DeleteAccount from "@/components/customer/DeleteAccount";

const renderIt = (variant: "card" | "sidebar" | "inline" = "card", activeBookingsCount?: number | null) => {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/customer/profile"]}>
        <Routes>
          <Route
            path="/customer/profile"
            element={<DeleteAccount variant={variant} activeBookingsCount={activeBookingsCount} />}
          />
          <Route path="/customer/tracking" element={<p>Active Bookings Page</p>} />
          <Route path={LOGIN_PATH} element={<p>Login page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  del.mockReset();
  logout.mockClear();
  mockListBookings.mockReset();
  mockListBookings.mockResolvedValue({
    items: [],
    meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
  });
});

describe("Delete account", () => {
  it("asks first, and 'No' deletes nothing", async () => {
    renderIt();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /delete account/i }));
    expect(screen.getByRole("alertdialog", { name: /delete your account/i })).toBeInTheDocument();
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    // The safe choice has focus first.
    await waitFor(() => expect(screen.getByRole("button", { name: /no, keep it/i })).toHaveFocus());

    await userEvent.click(screen.getByRole("button", { name: /no, keep it/i }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(del).not.toHaveBeenCalled();
  });

  it("Escape also keeps the account", async () => {
    renderIt("sidebar");
    await userEvent.click(screen.getByRole("button", { name: /delete account/i }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(del).not.toHaveBeenCalled();
  });

  it("'Yes' deletes the account, ends the session and goes to login", async () => {
    del.mockResolvedValue({ data: { success: true, data: { deleted: true } } });
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: /delete account/i }));
    await userEvent.click(screen.getByRole("button", { name: /yes, delete/i }));
    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(del).toHaveBeenCalledWith("/customer/profile");
    expect(logout).toHaveBeenCalled();
  });

  it("a refusal (open booking) is explained and the pop-up stays open", async () => {
    del.mockRejectedValue({
      status: 409,
      code: "ACCOUNT_HAS_OPEN_BOOKINGS",
      message: "You still have a booking in progress. Finish or cancel it, then delete your account.",
    });
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: /delete account/i }));
    await userEvent.click(screen.getByRole("button", { name: /yes, delete/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/booking in progress/i);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });
});

describe("Delete Account: Conditional States & Business Logic", () => {
  it("Scenario 1: Customer has two active bookings — show warning and disable 'Yes, delete'", async () => {
    mockListBookings.mockResolvedValue({
      items: [
        { id: "b1", status: "in_progress", serviceName: "Deep Cleaning" },
        { id: "b2", status: "en_route", serviceName: "Plumbing" },
      ],
      meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });

    renderIt();
    await userEvent.click(screen.getByRole("button", { name: /delete account/i }));

    // Heading must state deletion is unavailable
    expect(
      await screen.findByRole("heading", { name: "Account deletion unavailable", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/You have active bookings or ongoing services/i),
    ).toBeInTheDocument();

    // Warning card must show exact count
    expect(screen.getByText(/2 active bookings/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Complete or cancel your active services to delete your account/i),
    ).toBeInTheDocument();

    // Consequence rows must still be visible
    expect(screen.getByText(/Your profile, photo and sign-in are removed/i)).toBeInTheDocument();
    expect(screen.getByText(/Saved addresses, notifications and wallet are erased/i)).toBeInTheDocument();
    expect(screen.getByText(/Past booking and payment records are kept for accounting/i)).toBeInTheDocument();

    // 'No, keep it' button enabled
    expect(screen.getByRole("button", { name: /no, keep it/i })).toBeEnabled();

    // 'Yes, delete' button MUST BE DISABLED
    const deleteBtn = screen.getByRole("button", { name: /yes, delete/i });
    expect(deleteBtn).toBeDisabled();

    // Warning card displays active bookings without expand/collapse or interactive button
    const warningCard = screen.getByLabelText(/You have 2 active bookings/i);
    expect(warningCard).toBeInTheDocument();
    expect(warningCard).not.toHaveAttribute("role", "button");
  });

  it("Scenario 2: Customer has one active booking — show warning and disable deletion", async () => {
    mockListBookings.mockResolvedValue({
      items: [{ id: "b1", status: "assigned", serviceName: "Electrician" }],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    renderIt();
    await userEvent.click(screen.getByRole("button", { name: /delete account/i }));

    expect(
      await screen.findByRole("heading", { name: "Account deletion unavailable", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 active booking/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yes, delete/i })).toBeDisabled();
  });

  it("Scenario 3: All bookings are completed — enable deletion", async () => {
    mockListBookings.mockResolvedValue({
      items: [
        { id: "b1", status: "completed", serviceName: "Cleaning" },
        { id: "b2", status: "rated", serviceName: "Electrician" },
      ],
      meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });

    renderIt();
    await userEvent.click(screen.getByRole("button", { name: /delete account/i }));

    // Standard confirmation dialog
    expect(
      await screen.findByRole("heading", { name: "Delete your account?", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure\? This action is permanent and can't be undone\./i),
    ).toBeInTheDocument();

    // No warning card
    expect(screen.queryByText(/active bookings/i)).not.toBeInTheDocument();

    // Both buttons enabled
    expect(screen.getByRole("button", { name: /no, keep it/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /yes, delete/i })).toBeEnabled();
  });

  it("Scenario 4: All bookings are cancelled — enable deletion", async () => {
    mockListBookings.mockResolvedValue({
      items: [
        { id: "b1", status: "cancelled_by_customer" },
        { id: "b2", status: "cancelled_by_partner" },
        { id: "b3", status: "no_show" },
      ],
      meta: { page: 1, limit: 10, total: 3, totalPages: 1 },
    });

    renderIt();
    await userEvent.click(screen.getByRole("button", { name: /delete account/i }));

    expect(
      await screen.findByRole("heading", { name: "Delete your account?", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yes, delete/i })).toBeEnabled();
  });

  it("Scenario 5: Booking API fails — prevent deletion until eligibility can be reliably established", async () => {
    mockListBookings.mockRejectedValue(new Error("Network Error"));

    renderIt();
    await userEvent.click(screen.getByRole("button", { name: /delete account/i }));

    // Verify error banner is shown
    expect(await screen.findByRole("alert")).toHaveTextContent(/Unable to verify booking status/i);

    // Deletion MUST BE DISABLED when eligibility cannot be confirmed
    expect(screen.getByRole("button", { name: /yes, delete/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /no, keep it/i })).toBeEnabled();
  });

  it("Scenario 6: Customer attempts to bypass the disabled button — backend rejects deletion", async () => {
    // Backend rejects with 409
    del.mockRejectedValue({
      status: 409,
      code: "ACCOUNT_HAS_OPEN_BOOKINGS",
      message: "You still have a booking in progress. Finish or cancel it, then delete your account.",
    });

    // Assume 0 on frontend initially but backend catches the active booking
    mockListBookings.mockResolvedValue({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } });

    renderIt();
    await userEvent.click(screen.getByRole("button", { name: /delete account/i }));
    await userEvent.click(screen.getByRole("button", { name: /yes, delete/i }));

    // Server error is shown in the alert
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/You still have a booking in progress/i);

    // Pop-up stays open and customer is NOT logged out
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });

  it("Scenario 7: Customer completes or cancels the last blocking booking — refresh eligibility and enable deletion", async () => {
    // 1. Initial state: 1 active booking
    mockListBookings.mockResolvedValue({
      items: [{ id: "b1", status: "in_progress" }],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    const { unmount } = renderIt();
    await userEvent.click(screen.getByRole("button", { name: /delete account/i }));

    expect(await screen.findByText(/1 active booking/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yes, delete/i })).toBeDisabled();

    // Close dialog
    await userEvent.click(screen.getByRole("button", { name: /no, keep it/i }));
    unmount();

    // 2. Booking completed: re-check returns completed booking
    mockListBookings.mockResolvedValue({
      items: [{ id: "b1", status: "completed" }],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    renderIt();
    await userEvent.click(screen.getByRole("button", { name: /delete account/i }));

    // Deletion is now unlocked!
    expect(await screen.findByRole("heading", { name: "Delete your account?", level: 2 })).toBeInTheDocument();
    expect(screen.queryByText(/1 active booking/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yes, delete/i })).toBeEnabled();
  });
});
