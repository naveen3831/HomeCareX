import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LOGIN_PATH } from "@/routes/authPaths";

let failLogout = false;
const logoutCalls = vi.fn();
// A plain function (not a spy) so a deliberate rejection is handled only by the component under test.
const logout = () => {
  logoutCalls();
  return failLogout ? Promise.reject(new Error("network down")) : Promise.resolve();
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "c1", name: "Asha", role: "customer" }, logout }) }));

import LogoutCard from "@/pages/customer/Profile/LogoutCard";

const renderIt = () =>
  render(
    <MemoryRouter initialEntries={["/customer/profile"]}>
      <Routes>
        <Route path="/customer/profile" element={<LogoutCard />} />
        <Route path={LOGIN_PATH} element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  failLogout = false;
  logoutCalls.mockClear();
});

describe("Log out pop-up", () => {
  it("asks first and focuses the safe choice; 'Stay signed in' keeps the session", async () => {
    renderIt();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^log out$/i }));
    expect(screen.getByRole("alertdialog", { name: /log out of homecarex/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /stay signed in/i })).toHaveFocus());
    await userEvent.click(screen.getByRole("button", { name: /stay signed in/i }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(logoutCalls).not.toHaveBeenCalled();
  });

  it("Escape also keeps the session", async () => {
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: /^log out$/i }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(logoutCalls).not.toHaveBeenCalled();
  });

  it("'Yes, log out' ends the session and goes to login", async () => {
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: /^log out$/i }));
    await userEvent.click(screen.getByRole("button", { name: /yes, log out/i }));
    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(logoutCalls).toHaveBeenCalledTimes(1);
  });

  it("a failed logout is explained and the pop-up stays open", async () => {
    failLogout = true;
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: /^log out$/i }));
    await userEvent.click(screen.getByRole("button", { name: /yes, log out/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't log out/i);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
