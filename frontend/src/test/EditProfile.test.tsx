import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EditProfile from "@/pages/customer/Profile/EditProfile";
import Profile from "@/pages/customer/Profile";
import type { ProfileDto } from "@/features/customer";

const updateProfileMock = vi.fn();
const mockUser = {
  id: "customer-1",
  name: "Test Customer",
  email: "customer@homecarex.com",
  phone: "9000000006",
  role: "customer" as const,
  permissions: [],
  home: "/customer",
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockUser,
    updateProfile: updateProfileMock,
    logout: vi.fn(),
  }),
}));

type Handler = (body?: unknown) => unknown;
const routes: Record<string, Handler> = {};
const fail = (status: number, code: string, message: string, details?: unknown) =>
  Promise.reject({ status, code, message, details });

const request = (method: string) => (url: string, body?: unknown) => {
  const h = routes[`${method} ${url}`];
  return h ? Promise.resolve(h(body)) : fail(404, "NOT_FOUND", `no fake for ${method} ${url}`);
};

vi.mock("@/lib/http", () => ({
  default: {
    get: (u: string) => request("GET")(u),
    patch: (u: string, b: unknown) => request("PATCH")(u, b),
    post: (u: string, b: unknown) => request("POST")(u, b),
    delete: (u: string) => request("DELETE")(u),
  },
}));

const initialProfile: ProfileDto = {
  id: "customer-1",
  name: "Test Customer",
  email: "customer@homecarex.com",
  phone: "9000000006",
};

const renderEditProfile = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/customer/profile/edit"]}>
        <Routes>
          <Route path="/customer/profile/edit" element={<EditProfile />} />
          <Route path="/customer/profile" element={<Profile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("EditProfile component", () => {
  beforeEach(() => {
    for (const k of Object.keys(routes)) delete routes[k];
    updateProfileMock.mockReset();
    routes["GET /customer/profile"] = () => ({
      data: { success: true, data: { profile: initialProfile } },
    });
    routes["GET /customer/dashboard"] = () => ({
      data: { success: true, data: { activeBookings: [], stats: {} } },
    });
    routes["GET /addresses"] = () => ({
      data: { success: true, data: { addresses: [] } },
    });
  });

  it("loads current user profile data into inputs", async () => {
    renderEditProfile();

    expect(await screen.findByDisplayValue("Test Customer")).toBeInTheDocument();
    expect(screen.getByDisplayValue("customer@homecarex.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("9000000006")).toBeInTheDocument();
    expect(screen.getByText("TC")).toBeInTheDocument();
  });

  it("updates FULL NAME, EMAIL, and PHONE, saves to backend and updates profile", async () => {
    let capturedPatch: unknown = null;
    routes["PATCH /customer/profile"] = (body) => {
      capturedPatch = body;
      return {
        data: {
          success: true,
          data: {
            profile: {
              ...initialProfile,
              ...(body as object),
            },
          },
        },
      };
    };

    renderEditProfile();

    const nameInput = await screen.findByDisplayValue("Test Customer");
    const emailInput = screen.getByDisplayValue("customer@homecarex.com");
    const phoneInput = screen.getByDisplayValue("9000000006");

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Test Customer Updated");

    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "customer_new@homecarex.com");

    await userEvent.clear(phoneInput);
    await userEvent.type(phoneInput, "9000000007");

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    expect(saveButton).toBeEnabled();

    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(capturedPatch).toEqual({
        name: "Test Customer Updated",
        email: "customer_new@homecarex.com",
        phone: "9000000007",
      });
    });

    expect(updateProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Test Customer Updated",
        email: "customer_new@homecarex.com",
        phone: "9000000007",
      }),
    );

    expect(await screen.findByText("Profile updated successfully.")).toBeInTheDocument();
  });

  it("clearing the phone field sends null to remove it from database", async () => {
    let capturedPatch: unknown = null;
    routes["PATCH /customer/profile"] = (body) => {
      capturedPatch = body;
      return {
        data: {
          success: true,
          data: {
            profile: {
              ...initialProfile,
              phone: undefined,
            },
          },
        },
      };
    };

    renderEditProfile();

    const phoneInput = await screen.findByDisplayValue("9000000006");
    await userEvent.clear(phoneInput);

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(capturedPatch).toEqual({
        phone: null,
      });
    });
  });

  it("displays server error when email is already in use (409)", async () => {
    routes["PATCH /customer/profile"] = () =>
      fail(409, "EMAIL_ALREADY_EXISTS", "That email is already used by another account.", [
        { field: "email", message: "That email is already in use" },
      ]);

    renderEditProfile();

    const emailInput = await screen.findByDisplayValue("customer@homecarex.com");
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "taken@homecarex.com");

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(saveButton);

    expect(await screen.findByText("That email is already in use")).toBeInTheDocument();
    expect(screen.queryByText("Profile updated successfully.")).not.toBeInTheDocument();
  });

  it("disables save button when phone number is invalid", async () => {
    renderEditProfile();

    const phoneInput = await screen.findByDisplayValue("9000000006");
    await userEvent.clear(phoneInput);
    await userEvent.type(phoneInput, "12345"); // invalid phone number

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    expect(saveButton).toBeDisabled();
    expect(screen.getByText("Enter a valid 10-digit mobile number")).toBeInTheDocument();
  });
});
