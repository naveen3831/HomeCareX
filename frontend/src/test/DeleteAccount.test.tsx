import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LOGIN_PATH } from "@/routes/authPaths";

const logout = vi.fn(() => Promise.resolve());
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "c1", name: "Asha", role: "customer" }, logout }) }));

const del = vi.fn();
vi.mock("@/lib/http", () => ({ default: { delete: (u: string) => del(u) } }));

import DeleteAccount from "@/components/customer/DeleteAccount";

const renderIt = (variant: "card" | "sidebar" = "card") =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={["/customer/profile"]}>
        <Routes>
          <Route path="/customer/profile" element={<DeleteAccount variant={variant} />} />
          <Route path={LOGIN_PATH} element={<p>Login page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  del.mockReset();
  logout.mockClear();
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
    del.mockRejectedValue({ status: 409, code: "ACCOUNT_HAS_OPEN_BOOKINGS", message: "You still have a booking in progress." });
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: /delete account/i }));
    await userEvent.click(screen.getByRole("button", { name: /yes, delete/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/booking in progress/i);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: /yes, delete/i })).toBeEnabled());
  });
});
