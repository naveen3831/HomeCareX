import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ExportPaymentsMenu, {
  buildPaymentsCsv,
  buildPaymentsShareSummary,
  buildPaymentsStatementHtml,
} from "../components/customer/payments/ExportPaymentsMenu";
import type { PaymentRow } from "../types/payment";

const mockPayments: PaymentRow[] = [
  {
    id: "6af2db646ee4bf461e4fef46",
    bookingId: "6af2db636ee4bf461e4fef36",
    bookingRef: "BK-FEF36",
    serviceName: "General Pest Control",
    bookingDate: "2026-11-10T10:00:00.000Z",
    amount: 1685,
    currency: "INR",
    method: "netbanking",
    status: "PAID",
    paidAt: "2026-11-10T08:53:18.035Z",
    createdAt: "2026-11-10T08:50:00.000Z",
    receiptNo: "RCPT-1E4FEF46",
  },
  {
    id: "6af2f51d7e31f3757d9b3306",
    bookingId: "6aec38567aececc0000fd254",
    bookingRef: "BK-FD254",
    serviceName: "Wardrobe & Drawer Repair",
    bookingDate: "2026-11-05T12:00:00.000Z",
    amount: 505,
    currency: "INR",
    method: "netbanking",
    status: "PAID",
    paidAt: "2026-11-05T08:04:02.204Z",
    createdAt: "2026-11-05T08:00:00.000Z",
    receiptNo: "RCPT-7D9B3306",
  },
];

describe("ExportPaymentsMenu component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders desktop dropdown button with Export label", () => {
    render(<ExportPaymentsMenu payments={mockPayments} activeFilter="PAID" variant="desktop" />);

    const button = screen.getByRole("button", { name: /export payments/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(screen.getByText("Export")).toBeInTheDocument();
  });

  it("renders mobile pill-shaped button when variant='mobile'", () => {
    render(<ExportPaymentsMenu payments={mockPayments} activeFilter="PAID" variant="mobile" />);

    const button = screen.getByRole("button", { name: /export payment statement/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("rounded-full");
    expect(button).not.toBeDisabled();
  });

  it("disables button when payments list is empty", () => {
    render(<ExportPaymentsMenu payments={[]} activeFilter="PAID" variant="desktop" />);

    const button = screen.getByRole("button", { name: /export payments/i });
    expect(button).toBeDisabled();
    expect(button).toHaveClass("opacity-50");
    expect(button).toHaveClass("cursor-not-allowed");
  });

  it("toggles dropdown menu on click and lists all 3 export options", () => {
    render(<ExportPaymentsMenu payments={mockPayments} activeFilter="PAID" variant="desktop" />);

    const button = screen.getByRole("button", { name: /export payments/i });
    fireEvent.click(button);

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText(/Download CSV/i)).toBeInTheDocument();
    expect(screen.getByText(/Download PDF Statement/i)).toBeInTheDocument();
    expect(screen.getByText(/Share Statement/i)).toBeInTheDocument();

    // Closes on pressing Escape
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("triggers CSV download on clicking Download CSV", async () => {
    render(<ExportPaymentsMenu payments={mockPayments} activeFilter="PAID" variant="desktop" />);

    const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    fireEvent.click(screen.getByRole("button", { name: /export payments/i }));
    fireEvent.click(screen.getByText(/Download CSV/i));

    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    clickSpy.mockRestore();
  });

  it("triggers PDF print window on clicking Download PDF Statement", async () => {
    render(<ExportPaymentsMenu payments={mockPayments} activeFilter="PAID" variant="desktop" />);

    const mockPrint = vi.fn();
    const mockOpen = vi.fn().mockReturnValue({
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
      focus: vi.fn(),
      print: mockPrint,
    });
    window.open = mockOpen;

    fireEvent.click(screen.getByRole("button", { name: /export payments/i }));
    fireEvent.click(screen.getByText(/Download PDF Statement/i));

    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalledWith("", "_blank");
    });
  });

  it("copies summary to clipboard and shows confirmation state on share fallback", async () => {
    render(<ExportPaymentsMenu payments={mockPayments} activeFilter="PAID" variant="desktop" />);

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
      share: undefined,
    });

    fireEvent.click(screen.getByRole("button", { name: /export payments/i }));
    fireEvent.click(screen.getByText(/Share Statement/i));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(/Copied to clipboard!/i)).toBeInTheDocument();
  });
});

describe("Export utility functions", () => {
  it("buildPaymentsCsv prepends UTF-8 BOM and formats columns", () => {
    const csv = buildPaymentsCsv(mockPayments);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Transaction ID");
    expect(csv).toContain("General Pest Control");
    expect(csv).toContain("₹1685.00");
    expect(csv).toContain("Netbanking");
    expect(csv).toContain("Paid");
  });

  it("buildPaymentsStatementHtml generates branded HTML with summary cards and table", () => {
    const html = buildPaymentsStatementHtml(mockPayments, "PAID");
    expect(html).toContain("HomeCareX");
    expect(html).toContain("Official Customer Payment Statement");
    expect(html).toContain("Total Transactions");
    expect(html).toContain("Total Paid Amount");
    expect(html).toContain("General Pest Control");
    expect(html).toContain("BK-FEF36");
  });

  it("buildPaymentsShareSummary generates readable plain text summary", () => {
    const summary = buildPaymentsShareSummary(mockPayments, "PAID");
    expect(summary).toContain("HomeCareX Payment Statement");
    expect(summary).toContain("Total Transactions: 2");
    expect(summary).toContain("General Pest Control");
  });
});
