import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Payments from "../pages/customer/Payments";
import type { PaymentsPage } from "../types/payment";

const mockList = vi.fn();

vi.mock("@/services/paymentApi", () => ({
  paymentApi: {
    list: (...args: unknown[]) => mockList(...args),
  },
}));

const samplePayments: PaymentsPage = {
  page: 1,
  limit: 10,
  total: 2,
  items: [
    {
      id: "65f0c0ffee00000000cf97b7db",
      bookingId: "65f0c0ffee00000000a1b2c3",
      bookingRef: "BK-6F4A6",
      serviceName: "Electrician Visit (General)",
      bookingDate: "2026-10-06T10:00:00.000Z",
      amount: 278,
      currency: "INR",
      method: null,
      status: "PENDING",
      paidAt: null,
      createdAt: "2026-10-06T09:00:00.000Z",
      receiptNo: null,
    },
    {
      id: "65f0c0ffee00000000d15bf58d",
      bookingId: "65f0c0ffee00000000a1b2c4",
      bookingRef: "BK-BF586",
      serviceName: "Deep Home Cleaning",
      bookingDate: "2026-10-06T14:00:00.000Z",
      amount: 1578,
      currency: "INR",
      method: "card",
      status: "PAID",
      paidAt: "2026-10-06T14:05:00.000Z",
      createdAt: "2026-10-06T14:00:00.000Z",
      receiptNo: "RCPT-1002",
    },
  ],
};

function renderPayments() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Payments />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Payments page: Desktop vs Mobile View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue(samplePayments);
  });

  it("renders desktop table with all columns and structure on md+ screens", async () => {
    renderPayments();

    // Verify desktop heading exists
    expect(await screen.findByRole("heading", { name: "Payments", level: 1 })).toBeInTheDocument();

    // Verify table columns exist after data loads
    expect(await screen.findByRole("columnheader", { name: /transaction/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /booking/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /date/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /amount/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /method/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /status/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /receipt/i })).toBeInTheDocument();

    // Verify desktop table data rows
    expect(screen.getByText("CF97B7DB")).toBeInTheDocument();
    expect(screen.getByText("D15BF58D")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /receipt/i })).toBeInTheDocument();
  });

  it("renders mobile view structure with filter tabs and cards list", async () => {
    renderPayments();

    // Verify mobile tabs list exists
    const tablist = await screen.findByRole("tablist", { name: /payment status filter/i });
    expect(tablist).toBeInTheDocument();

    // Verify mobile filter tabs
    expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Paid" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Pending" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Failed" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Refunded" })).toBeInTheDocument();

    // Verify mobile cards list after data loads
    expect(await screen.findByRole("list", { name: /payments list/i })).toBeInTheDocument();
  });
});
