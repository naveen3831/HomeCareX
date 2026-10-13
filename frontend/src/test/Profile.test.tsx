import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const updateProfile = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "customer-1", name: "Asha", email: "asha@x.com", role: "customer" }, updateProfile, logout: vi.fn() }),
}));

/** Every request goes through this fake: tests decide what each URL answers. */
type Handler = (body?: unknown) => unknown;
const routes: Record<string, Handler> = {};
const fail = (status: number, code: string, message: string, details?: unknown) =>
  Promise.reject({ status, code, message, details });
const request = (method: string) => (url: string, body?: unknown) => {
  const h = routes[`${method} ${url}`];
  return h ? Promise.resolve(h(body)).then((r) => r) : fail(404, "NOT_FOUND", `no fake for ${method} ${url}`);
};
vi.mock("@/lib/http", () => ({
  default: { get: (u: string) => request("GET")(u), patch: (u: string, b: unknown) => request("PATCH")(u, b), post: (u: string, b: unknown) => request("POST")(u, b), delete: (u: string) => request("DELETE")(u) },
}));

import ProfileForm, { buildProfilePatch } from "../pages/customer/Profile/ProfileForm";
import ChangePasswordForm from "../pages/customer/Profile/ChangePasswordForm";
import AvatarUpload from "../pages/customer/Profile/AvatarUpload";
import PreferencesCard, { buildPreferencesPatch } from "../pages/customer/Profile/PreferencesCard";
import Profile from "../pages/customer/Profile";
import { validateAvatarFile, cropRect, AVATAR_MAX_BYTES } from "@/lib/avatarCrop";
import { changePasswordSchema, profileSchema } from "@/lib/profileSchemas";
import type { PreferencesDto, ProfileDto } from "@/features/customer";

const profile: ProfileDto = { id: "customer-1", name: "Asha", email: "asha@x.com", phone: "9876543210" };
const prefs: PreferencesDto = {
  language: "en",
  notifications: {
    booking: { push: true, sms: true, email: true, inApp: true },
    payment: { push: true, sms: true, email: true, inApp: true },
    offers: { push: false, sms: false, email: false, inApp: true },
    reminders: { push: true, sms: false, email: true, inApp: true },
    support: { push: true, sms: false, email: true, inApp: true },
  },
};

const wrap = (ui: ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  for (const k of Object.keys(routes)) delete routes[k];
  updateProfile.mockReset();
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
});

/* ---------- pure helpers ---------- */

describe("avatar file rules", () => {
  it("accepts jpg / png / webp up to 2 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validateAvatarFile({ type, size: 1000, name: "a" })).toBeNull();
    }
    expect(validateAvatarFile({ type: "image/png", size: AVATAR_MAX_BYTES, name: "a" })).toBeNull();
  });
  it("rejects an oversized image with its size", () => {
    expect(validateAvatarFile({ type: "image/png", size: 3 * 1024 * 1024, name: "a" })).toMatch(/3\.0 MB.*2 MB or smaller/);
  });
  it("rejects other types and empty files", () => {
    expect(validateAvatarFile({ type: "image/gif", size: 10, name: "a" })).toMatch(/JPG, PNG or WebP/);
    expect(validateAvatarFile({ type: "application/pdf", size: 10, name: "a" })).toMatch(/JPG, PNG or WebP/);
    expect(validateAvatarFile({ type: "image/png", size: 0, name: "a" })).toMatch(/empty/);
  });
});

describe("crop maths", () => {
  it("centres a wide image and covers the square at zoom 1", () => {
    const r = cropRect(400, 200, 100, { zoom: 1, offsetX: 0, offsetY: 0 });
    expect(r.h).toBe(100);
    expect(r.w).toBe(200);
    expect(r.x).toBe(-50);
    expect(r.y).toBe(0);
  });
  it("never lets the image leave a gap, whatever the offsets", () => {
    for (const zoom of [1, 1.7, 3]) {
      for (const o of [-5, -1, 0, 1, 5]) {
        const r = cropRect(300, 500, 100, { zoom, offsetX: o, offsetY: o });
        expect(r.x).toBeLessThanOrEqual(0.0001);
        expect(r.y).toBeLessThanOrEqual(0.0001);
        expect(r.x + r.w).toBeGreaterThanOrEqual(99.9999);
        expect(r.y + r.h).toBeGreaterThanOrEqual(99.9999);
      }
    }
  });
});

describe("form schemas", () => {
  it("profile: bad data is refused", () => {
    expect(profileSchema.safeParse({ name: "A", email: "x@y.com", phone: "" }).success).toBe(false);
    expect(profileSchema.safeParse({ name: "Asha", email: "nope", phone: "" }).success).toBe(false);
    expect(profileSchema.safeParse({ name: "Asha", email: "x@y.com", phone: "12345" }).success).toBe(false);
    expect(profileSchema.safeParse({ name: "Asha", email: "x@y.com", phone: "+91 98765 43210" }).success).toBe(true);
    expect(profileSchema.safeParse({ name: "Asha", email: "x@y.com", phone: "" }).success).toBe(true);
  });
  it("password: rules, match and must differ", () => {
    const ok = { currentPassword: "Old@1234", newPassword: "New@12345", confirmPassword: "New@12345" };
    expect(changePasswordSchema.safeParse(ok).success).toBe(true);
    expect(changePasswordSchema.safeParse({ ...ok, newPassword: "weak", confirmPassword: "weak" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ ...ok, confirmPassword: "Different@1" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ ...ok, newPassword: "Old@1234", confirmPassword: "Old@1234" }).success).toBe(false);
  });
  it("sends only what changed", () => {
    expect(buildProfilePatch(profile, { name: "Asha", email: "ASHA@x.com", phone: "98765 43210" })).toEqual({});
    expect(buildProfilePatch(profile, { name: "Asha K", email: "asha@x.com", phone: "" })).toEqual({ name: "Asha K", phone: null });
    const p = structuredClone(prefs);
    p.notifications.offers.email = true;
    expect(buildPreferencesPatch(prefs, p)).toEqual({ notifications: { offers: { email: true } } });
  });
});

/* ---------- ProfileForm ---------- */

describe("ProfileForm", () => {
  it("starts with Save disabled, enables on edit, and persists", async () => {
    routes["PATCH /customer/profile"] = (body) => ({ data: { success: true, data: { profile: { ...profile, ...(body as object) } } } });
    wrap(<ProfileForm profile={profile} />);
    const save = screen.getByRole("button", { name: /save changes/i });
    expect(save).toBeDisabled();

    await userEvent.clear(screen.getByLabelText(/full name/i));
    await userEvent.type(screen.getByLabelText(/full name/i), "Asha Kumar");
    expect(save).toBeEnabled();
    await userEvent.click(save);

    expect(await screen.findByText(/profile updated/i)).toBeInTheDocument();
    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ name: "Asha Kumar" }));
  });

  it("shows validation errors and sends nothing", async () => {
    const patch = vi.fn();
    routes["PATCH /customer/profile"] = patch;
    wrap(<ProfileForm profile={profile} />);
    await userEvent.clear(screen.getByLabelText(/^email/i));
    await userEvent.type(screen.getByLabelText(/^email/i), "not-an-email");
    await userEvent.clear(screen.getByLabelText(/phone/i));
    await userEvent.type(screen.getByLabelText(/phone/i), "123");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
    expect(screen.getByText(/valid 10-digit mobile number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute("aria-invalid", "true");
    expect(patch).not.toHaveBeenCalled();
  });

  it("a taken email comes back as a 409 on the email field", async () => {
    routes["PATCH /customer/profile"] = () =>
      fail(409, "EMAIL_ALREADY_EXISTS", "That email is already used by another account.", [{ field: "email", message: "That email is already in use" }]);
    wrap(<ProfileForm profile={profile} />);
    await userEvent.clear(screen.getByLabelText(/^email/i));
    await userEvent.type(screen.getByLabelText(/^email/i), "bala@x.com");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    const error = await screen.findByText("That email is already in use");
    expect(error).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute("aria-invalid", "true");
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("a taken phone number comes back as a 409 on the phone field", async () => {
    routes["PATCH /customer/profile"] = () => fail(409, "PHONE_ALREADY_EXISTS", "That phone number is already used by another account.");
    wrap(<ProfileForm profile={profile} />);
    await userEvent.clear(screen.getByLabelText(/phone/i));
    await userEvent.type(screen.getByLabelText(/phone/i), "9123456780");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText(/phone number is already in use/i)).toBeInTheDocument();
  });

  it("shows a server error for the whole form", async () => {
    routes["PATCH /customer/profile"] = () => fail(500, "INTERNAL_ERROR", "boom");
    wrap(<ProfileForm profile={profile} />);
    await userEvent.type(screen.getByLabelText(/full name/i), "x");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText(/went wrong on our side/i)).toBeInTheDocument();
  });

  it("disables saving while offline", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    wrap(<ProfileForm profile={profile} />);
    await userEvent.type(screen.getByLabelText(/full name/i), "x");
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
  });
});

/* ---------- ChangePasswordForm ---------- */

describe("ChangePasswordForm", () => {
  const fill = async (cur: string, next: string, confirm: string) => {
    await userEvent.type(screen.getByLabelText(/^current password/i), cur);
    await userEvent.type(screen.getByLabelText(/^new password/i), next);
    await userEvent.type(screen.getByLabelText(/^confirm new password/i), confirm);
  };

  it("ticks each rule as the new password meets it", async () => {
    wrap(<ChangePasswordForm />);
    const rules = screen.getByRole("list", { name: /password rules/i });
    expect(within(rules).getAllByText(/not met yet/i)).toHaveLength(4);
    await userEvent.type(screen.getByLabelText(/^new password/i), "Abcdef1!");
    expect(within(rules).queryAllByText(/not met yet/i)).toHaveLength(0);
  });

  it("refuses mismatched passwords without calling the server", async () => {
    const post = vi.fn();
    routes["POST /auth/change-password"] = post;
    wrap(<ChangePasswordForm />);
    await fill("Old@1234", "New@12345", "New@123456");
    await userEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("a wrong current password is shown on that field", async () => {
    routes["POST /auth/change-password"] = () =>
      fail(400, "INVALID_CURRENT_PASSWORD", "Your current password is incorrect.", [{ field: "currentPassword", message: "Current password is incorrect" }]);
    wrap(<ChangePasswordForm />);
    await fill("Wrong@123", "New@12345", "New@12345");
    await userEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByText("Current password is incorrect")).toBeInTheDocument();
  });

  it("success clears the form and confirms", async () => {
    routes["POST /auth/change-password"] = () => ({ data: { success: true, data: { changed: true } } });
    wrap(<ChangePasswordForm />);
    await fill("Old@1234", "New@12345", "New@12345");
    await userEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^current password/i)).toHaveValue("");
  });
});

/* ---------- AvatarUpload ---------- */

describe("AvatarUpload", () => {
  const user = () => userEvent.setup({ applyAccept: false });

  it("rejects an oversized photo before uploading anything", async () => {
    const post = vi.fn();
    routes["POST /customer/profile/avatar"] = post;
    wrap(<AvatarUpload profile={profile} />);
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    await user().upload(screen.getByLabelText(/add photo/i), big);
    expect(await screen.findByRole("alert")).toHaveTextContent(/2 MB or smaller/i);
    expect(post).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: /adjust your photo/i })).not.toBeInTheDocument();
  });

  it("rejects a file that is not jpg / png / webp", async () => {
    wrap(<AvatarUpload profile={profile} />);
    await user().upload(screen.getByLabelText(/add photo/i), new File(["gif"], "a.gif", { type: "image/gif" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/JPG, PNG or WebP/i);
  });

  it("shows initials with no photo and the picture when there is one", () => {
    const { unmount } = wrap(<AvatarUpload profile={profile} />);
    expect(screen.getByRole("img", { name: /no profile photo/i })).toHaveTextContent("A");
    unmount();
    wrap(<AvatarUpload profile={{ ...profile, avatarUrl: "data:image/jpeg;base64,AAAA" }} />);
    expect(screen.getByRole("img", { name: /your profile photo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
  });
});

/* ---------- PreferencesCard ---------- */

describe("PreferencesCard", () => {
  it("saves only the switches that changed", async () => {
    const patch = vi.fn((body: unknown) => {
      const b = body as { notifications: { offers: { email: boolean } } };
      const next = structuredClone(prefs);
      next.notifications.offers.email = b.notifications.offers.email;
      return { data: { success: true, data: { preferences: next } } };
    });
    routes["PATCH /customer/preferences"] = patch;
    wrap(<PreferencesCard preferences={prefs} />);

    expect(screen.getByRole("button", { name: /save preferences/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: /email for offers/i }));
    await userEvent.click(screen.getByRole("button", { name: /save preferences/i }));

    expect(await screen.findByText(/preferences saved/i)).toBeInTheDocument();
    expect(patch).toHaveBeenCalledWith({ notifications: { offers: { email: true } } });
  });

  it("changes language", async () => {
    routes["PATCH /customer/preferences"] = (b) => ({ data: { success: true, data: { preferences: { ...prefs, ...(b as object) } } } });
    wrap(<PreferencesCard preferences={prefs} />);
    await userEvent.selectOptions(screen.getByLabelText(/^language/i), "hi");
    await userEvent.click(screen.getByRole("button", { name: /save preferences/i }));
    expect(await screen.findByText(/preferences saved/i)).toBeInTheDocument();
  });

  it("reports a failed save and keeps the customer's choices", async () => {
    routes["PATCH /customer/preferences"] = () => fail(500, "INTERNAL_ERROR", "boom");
    wrap(<PreferencesCard preferences={prefs} />);
    const box = screen.getByRole("checkbox", { name: /sms for offers/i });
    await userEvent.click(box);
    await userEvent.click(screen.getByRole("button", { name: /save preferences/i }));
    expect(await screen.findByText(/went wrong on our side/i)).toBeInTheDocument();
    expect(box).toBeChecked();
  });
});

/* ---------- the page: loading / error / offline / success ---------- */

describe("Profile page states", () => {
  const dashboardAndAddresses = () => {
    routes["GET /customer/dashboard"] = () => fail(500, "INTERNAL_ERROR", "x");
    routes["GET /addresses"] = () => ({ data: { success: true, data: { addresses: [] } } });
  };

  it("loads the profile and preferences into their forms", async () => {
    dashboardAndAddresses();
    routes["GET /customer/profile"] = () => ({ data: { success: true, data: { profile } } });
    routes["GET /customer/preferences"] = () => ({ data: { success: true, data: { preferences: prefs } } });
    wrap(<Profile />);
    expect(await screen.findByLabelText(/full name/i)).toHaveValue("Asha");
    expect(await screen.findByRole("group", { name: /notification preferences/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /password/i })).toBeInTheDocument();
  });

  it("shows a loading state first, never a blank section", async () => {
    dashboardAndAddresses();
    routes["GET /customer/profile"] = () => new Promise(() => undefined);
    routes["GET /customer/preferences"] = () => new Promise(() => undefined);
    wrap(<Profile />);
    expect(await screen.findByText(/loading your profile/i)).toBeInTheDocument();
    expect(screen.getByText(/loading your preferences/i)).toBeInTheDocument();
  });

  it("shows an error with Try again, and recovers", async () => {
    dashboardAndAddresses();
    let calls = 0;
    routes["GET /customer/profile"] = () => (++calls === 1 ? fail(403, "FORBIDDEN", "nope") : { data: { success: true, data: { profile } } });
    routes["GET /customer/preferences"] = () => ({ data: { success: true, data: { preferences: prefs } } });
    wrap(<Profile />);
    expect(await screen.findByText(/couldn't load your profile/i)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: /try again/i })[0]);
    await waitFor(() => expect(screen.getByLabelText(/full name/i)).toHaveValue("Asha"));
  });

  it("shows the offline state when there is no connection and nothing to show", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    dashboardAndAddresses();
    routes["GET /customer/profile"] = () => fail(0 as number, "NETWORK_ERROR", "Network Error");
    routes["GET /customer/preferences"] = () => fail(0 as number, "NETWORK_ERROR", "Network Error");
    wrap(<Profile />);
    expect((await screen.findAllByText(/you're offline/i)).length).toBeGreaterThan(0);
  });
});
