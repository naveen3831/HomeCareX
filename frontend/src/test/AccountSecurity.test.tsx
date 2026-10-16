import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccountSecurityPage } from "@/pages/shared/AccountSecurity";
import { authApi } from "@/services/authApi";
import { adminCustomerApi } from "@/services/adminCustomerApi";
import type { AuthUser, UserSession } from "@/types/auth";

// Mock authApi
vi.mock("@/services/authApi", () => ({
  authApi: {
    changePassword: vi.fn(),
    getSessions: vi.fn(),
    revokeSession: vi.fn(),
    logoutAll: vi.fn(),
    revokeUserSessions: vi.fn(),
  },
}));

// Mock adminCustomerApi
vi.mock("@/services/adminCustomerApi", () => ({
  adminCustomerApi: {
    revokeUserSessions: vi.fn(),
  },
}));

// Mock useAuth
const mockLogout = vi.fn().mockResolvedValue(undefined);
let mockCurrentUser: AuthUser = {
  id: "user-123",
  name: "Test User",
  email: "test@homecarex.com",
  role: "customer",
  permissions: [],
  home: "/customer",
};

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    isAuthenticated: true,
    status: "authenticated",
    logout: mockLogout,
    login: vi.fn(),
    register: vi.fn(),
    updateProfile: vi.fn(),
  }),
}));

const mockSessions: UserSession[] = [
  {
    id: "sess-current",
    device: "MacBook Pro",
    browser: "Chrome 124.0",
    os: "macOS",
    ipAddress: "192.168.1.10",
    lastActiveAt: "2026-10-14T10:30:00.000Z",
    isCurrent: true,
  },
  {
    id: "sess-mobile",
    device: "iPhone 15",
    browser: "Safari Mobile",
    os: "iOS 18",
    ipAddress: "10.0.0.5",
    lastActiveAt: "2026-10-13T18:00:00.000Z",
    isCurrent: false,
  },
];

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function renderSecurityPage(initialEntries = ["/account/security"]) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/account/security" element={<AccountSecurityPage />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Account Security — Change Password (Section A)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.getSessions).mockResolvedValue(mockSessions);
  });

  it("validates required fields on empty submit without calling API", async () => {
    const user = userEvent.setup();
    renderSecurityPage();

    const submitBtn = screen.getByRole("button", { name: /^update password$/i });
    await user.click(submitBtn);

    expect(await screen.findByText(/enter your current password/i)).toBeInTheDocument();
    expect(screen.getByText(/enter a new password/i)).toBeInTheDocument();
    expect(screen.getByText(/confirm your new password/i)).toBeInTheDocument();
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it("rejects password confirmation mismatch", async () => {
    const user = userEvent.setup();
    renderSecurityPage();

    await user.type(screen.getByLabelText(/^current password/i), "OldPass123!");
    await user.type(screen.getByLabelText(/^new password/i), "StrongPass123!");
    await user.type(screen.getByLabelText(/^confirm new password/i), "MismatchPass456!");

    await user.click(screen.getByRole("button", { name: /^update password$/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it("enforces password policy (at least 8 chars, uppercase, number, special char)", async () => {
    const user = userEvent.setup();
    renderSecurityPage();

    await user.type(screen.getByLabelText(/^current password/i), "OldPass123!");
    await user.type(screen.getByLabelText(/^new password/i), "weak");
    await user.type(screen.getByLabelText(/^confirm new password/i), "weak");

    await user.click(screen.getByRole("button", { name: /^update password$/i }));

    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it("rejects new password identical to current password", async () => {
    const user = userEvent.setup();
    renderSecurityPage();

    await user.type(screen.getByLabelText(/^current password/i), "SamePass123!");
    await user.type(screen.getByLabelText(/^new password/i), "SamePass123!");
    await user.type(screen.getByLabelText(/^confirm new password/i), "SamePass123!");

    await user.click(screen.getByRole("button", { name: /^update password$/i }));

    expect(await screen.findByText(/new password must be different from your current password/i)).toBeInTheDocument();
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it("submits valid password, clears fields on success, and shows success message", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.changePassword).mockResolvedValueOnce({ changed: true });

    renderSecurityPage();

    const currentInput = screen.getByLabelText(/^current password/i);
    const newInput = screen.getByLabelText(/^new password/i);
    const confirmInput = screen.getByLabelText(/^confirm new password/i);

    await user.type(currentInput, "CurrentSecret123!");
    await user.type(newInput, "NewSecurePass456@");
    await user.type(confirmInput, "NewSecurePass456@");

    await user.click(screen.getByRole("button", { name: /^update password$/i }));

    await waitFor(() => {
      expect(authApi.changePassword).toHaveBeenCalledWith({
        currentPassword: "CurrentSecret123!",
        newPassword: "NewSecurePass456@",
        confirmPassword: "NewSecurePass456@",
      });
    });

    expect(await screen.findByText(/your password has been changed successfully/i)).toBeInTheDocument();
    expect(currentInput).toHaveValue("");
    expect(newInput).toHaveValue("");
    expect(confirmInput).toHaveValue("");
  });

  it("displays error on incorrect current password (INVALID_CURRENT_PASSWORD)", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.changePassword).mockRejectedValueOnce({
      status: 400,
      code: "INVALID_CURRENT_PASSWORD",
      message: "Current password is incorrect",
    });

    renderSecurityPage();

    await user.type(screen.getByLabelText(/^current password/i), "WrongCurrentPass123!");
    await user.type(screen.getByLabelText(/^new password/i), "NewSecurePass456@");
    await user.type(screen.getByLabelText(/^confirm new password/i), "NewSecurePass456@");

    await user.click(screen.getByRole("button", { name: /^update password$/i }));

    expect(await screen.findByText(/current password is incorrect/i)).toBeInTheDocument();
  });

  it("preserves input values on recoverable failure", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.changePassword).mockRejectedValueOnce({
      status: 500,
      message: "Internal server error. Please try again.",
    });

    renderSecurityPage();

    const currentInput = screen.getByLabelText(/^current password/i);
    const newInput = screen.getByLabelText(/^new password/i);
    const confirmInput = screen.getByLabelText(/^confirm new password/i);

    await user.type(currentInput, "CurrentPass123!");
    await user.type(newInput, "NewSecurePass456@");
    await user.type(confirmInput, "NewSecurePass456@");

    await user.click(screen.getByRole("button", { name: /^update password$/i }));

    expect(await screen.findByText(/internal server error/i)).toBeInTheDocument();
    expect(currentInput).toHaveValue("CurrentPass123!");
    expect(newInput).toHaveValue("NewSecurePass456@");
    expect(confirmInput).toHaveValue("NewSecurePass456@");
  });

  it("prevents duplicate submissions while request is pending", async () => {
    const user = userEvent.setup();
    let resolveChange: (val: { changed: boolean }) => void;
    vi.mocked(authApi.changePassword).mockImplementation(
      () =>
        new Promise((res) => {
          resolveChange = res;
        }),
    );

    renderSecurityPage();

    await user.type(screen.getByLabelText(/^current password/i), "CurrentPass123!");
    await user.type(screen.getByLabelText(/^new password/i), "NewSecurePass456@");
    await user.type(screen.getByLabelText(/^confirm new password/i), "NewSecurePass456@");

    const submitBtn = screen.getByRole("button", { name: /^update password$/i });
    await user.click(submitBtn);

    expect(submitBtn).toBeDisabled();
    expect(authApi.changePassword).toHaveBeenCalledTimes(1);

    // Click again while pending
    await user.click(submitBtn);
    expect(authApi.changePassword).toHaveBeenCalledTimes(1);

    resolveChange!({ changed: true });
    await waitFor(() => expect(screen.getByText(/your password has been changed successfully/i)).toBeInTheDocument());
  });
});

describe("Account Security — Active Sessions (Section B)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders active sessions with device, IP, and current session indicator", async () => {
    vi.mocked(authApi.getSessions).mockResolvedValueOnce(mockSessions);
    renderSecurityPage();

    expect(await screen.findByText(/MacBook Pro · Chrome 124.0 · macOS/i)).toBeInTheDocument();
    expect(screen.getByText(/IP: 192.168.1.10/i)).toBeInTheDocument();
    expect(screen.getByText(/This device/i)).toBeInTheDocument();

    expect(screen.getByText(/iPhone 15 · Safari Mobile · iOS 18/i)).toBeInTheDocument();
    expect(screen.getByText(/IP: 10.0.0.5/i)).toBeInTheDocument();
  });

  it("renders empty state when no sessions are returned", async () => {
    vi.mocked(authApi.getSessions).mockResolvedValueOnce([]);
    renderSecurityPage();

    expect(await screen.findByText(/no active sessions found/i)).toBeInTheDocument();
  });

  it("displays retryable error state on API failure", async () => {
    vi.mocked(authApi.getSessions).mockRejectedValue({
      status: 503,
      message: "Sessions service temporarily unavailable",
    });

    renderSecurityPage();

    expect(await screen.findByText(/unable to load active sessions/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    // Clicking retry refetches
    vi.mocked(authApi.getSessions).mockResolvedValueOnce(mockSessions);
    await userEvent.click(retryBtn);

    expect(await screen.findByText(/MacBook Pro/i)).toBeInTheDocument();
  });

  it("requires confirmation and revokes individual session successfully", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.getSessions).mockResolvedValue(mockSessions);
    vi.mocked(authApi.revokeSession).mockResolvedValueOnce({ revoked: true });

    renderSecurityPage();

    const revokeBtn = await screen.findByRole("button", {
      name: /revoke session for iphone 15 · safari mobile · ios 18/i,
    });
    await user.click(revokeBtn);

    // Confirmation dialog appears
    const modalTitle = screen.getByRole("heading", { name: /revoke session\?/i });
    expect(modalTitle).toBeInTheDocument();

    // Confirm revocation
    const confirmBtn = screen.getByRole("button", { name: /^revoke session$/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(authApi.revokeSession).toHaveBeenCalledWith("sess-mobile");
    });
  });

  it("revoking current session signs out and redirects to login", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.getSessions).mockResolvedValue(mockSessions);
    vi.mocked(authApi.revokeSession).mockResolvedValueOnce({ revoked: true });

    renderSecurityPage();

    const currentSignOutBtn = await screen.findByRole("button", {
      name: /revoke session for macbook pro · chrome 124.0 · macos/i,
    });
    await user.click(currentSignOutBtn);

    expect(screen.getByRole("heading", { name: /sign out of this device\?/i })).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /^sign out$/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(authApi.revokeSession).toHaveBeenCalledWith("sess-current");
      expect(mockLogout).toHaveBeenCalled();
    });

    expect(await screen.findByText("Login Page")).toBeInTheDocument();
  });

  it("does not expose session tokens or sensitive secrets in the DOM", async () => {
    const sessionWithSecret: UserSession = {
      id: "sess-secret-1",
      device: "Desktop PC",
      browser: "Firefox",
      ipAddress: "172.16.0.1",
      lastActiveAt: "2026-10-14T11:00:00.000Z",
      isCurrent: false,
    };
    vi.mocked(authApi.getSessions).mockResolvedValueOnce([sessionWithSecret]);

    const { container } = renderSecurityPage();
    await screen.findByText(/Desktop PC/i);

    expect(container.textContent).not.toMatch(/token/i);
    expect(container.textContent).not.toMatch(/secret/i);
    expect(container.textContent).not.toMatch(/cookie/i);
  });
});

describe("Account Security — Log Out All Devices (Section C)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.getSessions).mockResolvedValue(mockSessions);
  });

  it("requires confirmation before calling logout-all", async () => {
    const user = userEvent.setup();
    renderSecurityPage();

    const logoutAllBtn = screen.getByRole("button", { name: /log out all devices/i });
    await user.click(logoutAllBtn);

    expect(screen.getByRole("heading", { name: /log out of all devices\?/i })).toBeInTheDocument();
    expect(authApi.logoutAll).not.toHaveBeenCalled();

    // Cancel closes dialog without logout
    const cancelBtn = screen.getByRole("button", { name: /^cancel$/i });
    await user.click(cancelBtn);

    expect(screen.queryByRole("heading", { name: /log out of all devices\?/i })).not.toBeInTheDocument();
    expect(authApi.logoutAll).not.toHaveBeenCalled();
  });

  it("successful logout-all terminates sessions, clears auth, and redirects to login", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.logoutAll).mockResolvedValueOnce({ revoked: true });

    renderSecurityPage();

    await user.click(screen.getByRole("button", { name: /log out all devices/i }));
    const confirmBtn = screen.getAllByRole("button", { name: /log out all devices/i })[1];
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(authApi.logoutAll).toHaveBeenCalledTimes(1);
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("Login Page")).toBeInTheDocument();
  });

  it("API failure displays error and does not falsely redirect or clear auth", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.logoutAll).mockRejectedValueOnce({
      status: 500,
      message: "Server failed to revoke sessions",
    });

    renderSecurityPage();

    await user.click(screen.getByRole("button", { name: /log out all devices/i }));
    const confirmBtn = screen.getAllByRole("button", { name: /log out all devices/i })[1];
    await user.click(confirmBtn);

    expect(await screen.findByText(/server failed to revoke sessions/i)).toBeInTheDocument();
    expect(mockLogout).not.toHaveBeenCalled();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
  });
});

describe("Admin — Revoke a User's Sessions (Section 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adminCustomerApi.revokeUserSessions calls POST /auth/revoke-user-sessions/:userId", async () => {
    vi.mocked(adminCustomerApi.revokeUserSessions).mockResolvedValueOnce({ revoked: true });

    const result = await adminCustomerApi.revokeUserSessions("target-customer-456");

    expect(adminCustomerApi.revokeUserSessions).toHaveBeenCalledWith("target-customer-456");
    expect(result).toEqual({ revoked: true });
  });

  it("shared Account Security page renders for customer, partner, and admin roles", async () => {
    for (const role of ["customer", "partner", "admin"] as const) {
      mockCurrentUser = {
        id: `user-${role}`,
        name: `${role} User`,
        email: `${role}@homecarex.com`,
        role,
        permissions: role === "admin" ? ["*"] : [],
        home: `/${role}`,
      };
      vi.mocked(authApi.getSessions).mockResolvedValueOnce(mockSessions);

      const { unmount } = renderSecurityPage();
      expect(await screen.findByRole("heading", { name: /account security/i })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /change password/i })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /active sessions/i })).toBeInTheDocument();
      unmount();
    }
  });
});
