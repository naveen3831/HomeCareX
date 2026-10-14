import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const getInvoice = vi.fn();

vi.mock("@/services/bookingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/bookingApi")>();
  return {
    ...actual,
    bookingApi: {
      ...actual.bookingApi,
      getInvoice: (...a: unknown[]) => getInvoice(...a),
    },
  };
});

import InvoiceCard from "../pages/customer/BookingDetails/components/InvoiceCard";

const HTML = "<!doctype html><html><body>Invoice</body></html>";

function renderCard(enabled = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <InvoiceCard bookingId="b1" bookingCode="BK-ABCDE" enabled={enabled} />
    </QueryClientProvider>,
  );
}

const createObjectURL = vi.fn(() => "blob:invoice");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  getInvoice.mockReset();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  Object.defineProperty(URL, "createObjectURL", {
    value: createObjectURL,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: revokeObjectURL,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "onLine", {
    value: true,
    configurable: true,
  });
});

describe("InvoiceCard", () => {
  it("shows the invoice number and stays disabled until the booking is paid", () => {
    renderCard(false);
    expect(screen.getByText("INV-BK-ABCDE")).toBeInTheDocument();
    expect(
      screen.getByText(/once the payment is complete/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download invoice/i }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /print/i })).toBeDisabled();
    expect(getInvoice).not.toHaveBeenCalled();
  });

  it("downloads the invoice for a paid booking as INV-<code>.html", async () => {
    getInvoice.mockResolvedValue(HTML);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    renderCard();

    await userEvent.click(
      screen.getByRole("button", { name: /download invoice/i }),
    );

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(getInvoice).toHaveBeenCalledWith("b1");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toContain("text/html");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a preparing state while the invoice loads", async () => {
    let finish: (html: string) => void = () => undefined;
    getInvoice.mockReturnValue(
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );
    renderCard();

    await userEvent.click(
      screen.getByRole("button", { name: /download invoice/i }),
    );
    expect(
      await screen.findByRole("button", { name: /preparing invoice/i }),
    ).toBeDisabled();

    finish(HTML);
    expect(
      await screen.findByRole("button", { name: /download invoice/i }),
    ).toBeEnabled();
  });

  it("shows the server's reason when the invoice is refused (404 / 409)", async () => {
    getInvoice.mockRejectedValue({
      status: 404,
      code: "BOOKING_NOT_FOUND",
      message: "Booking not found",
    });
    renderCard();

    await userEvent.click(
      screen.getByRole("button", { name: /download invoice/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Booking not found",
    );
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("says so when offline, without sending a request", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    renderCard();

    await userEvent.click(
      screen.getByRole("button", { name: /download invoice/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/offline/i);
    expect(getInvoice).not.toHaveBeenCalled();
  });
});
