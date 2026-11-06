import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import BookingFailed from "@/pages/customer/BookingFailed";
import { useBookingDraftStore } from "@/features/booking";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("BookingFailed Redesigned Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBookingDraftStore.setState({
      serviceSlug: "deep-cleaning",
      step: 4,
    });
  });

  it("renders the redesigned payment failure card with heading, error lines, and reference badge", () => {
    render(
      <MemoryRouter initialEntries={["/customer/booking/failed/BK-1D919?reason=failed"]}>
        <Routes>
          <Route path="/customer/booking/failed/:id" element={<BookingFailed />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: /Payment Failed/i })).toBeInTheDocument();
    expect(screen.getByText(/Your payment could not be completed/i)).toBeInTheDocument();
    expect(screen.getByText(/Your booking has not been confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/BK-1D919/i)).toBeInTheDocument();
  });

  it("renders the Next Steps section with supporting icon and description", () => {
    render(
      <MemoryRouter initialEntries={["/customer/booking/failed/BK-1D919?reason=failed"]}>
        <Routes>
          <Route path="/customer/booking/failed/:id" element={<BookingFailed />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 2, name: /Next Steps/i })).toBeInTheDocument();
    expect(screen.getByText(/You can try completing your payment again or view your existing requests/i)).toBeInTheDocument();
  });

  it("renders the three action buttons: Retry Payment, View My Bookings, Return to Home", () => {
    render(
      <MemoryRouter initialEntries={["/customer/booking/failed/BK-1D919?reason=failed"]}>
        <Routes>
          <Route path="/customer/booking/failed/:id" element={<BookingFailed />} />
        </Routes>
      </MemoryRouter>,
    );

    const retryBtn = screen.getByRole("button", { name: /Retry Payment/i });
    expect(retryBtn).toBeInTheDocument();

    const bookingsLink = screen.getByRole("link", { name: /View My Bookings/i });
    expect(bookingsLink).toBeInTheDocument();
    expect(bookingsLink).toHaveAttribute("href", "/customer/bookings");

    const homeLink = screen.getByRole("link", { name: /Return to Home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute("href", "/customer");
  });

  it("navigates to step 4 when Retry Payment is clicked", () => {
    render(
      <MemoryRouter initialEntries={["/customer/booking/failed/BK-1D919?reason=failed"]}>
        <Routes>
          <Route path="/customer/booking/failed/:id" element={<BookingFailed />} />
        </Routes>
      </MemoryRouter>,
    );

    const retryBtn = screen.getByRole("button", { name: /Retry Payment/i });
    fireEvent.click(retryBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/customer/book/deep-cleaning?step=4", { replace: true });
  });

  it("renders Payment Verification Failed when reason is verification", () => {
    render(
      <MemoryRouter initialEntries={["/customer/booking/failed/BK-C2C2AB?reason=verification"]}>
        <Routes>
          <Route path="/customer/booking/failed/:id" element={<BookingFailed />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: /Payment Verification Failed/i })).toBeInTheDocument();
    expect(screen.getByText(/Please contact support or retry/i)).toBeInTheDocument();
    expect(screen.getByText(/BK-C2C2AB/i)).toBeInTheDocument();
  });

  it("renders Choose another slot when reason is slot", () => {
    render(
      <MemoryRouter initialEntries={["/customer/booking/failed/BK-1D919?reason=slot"]}>
        <Routes>
          <Route path="/customer/booking/failed/:id" element={<BookingFailed />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: /Slot No Longer Available/i })).toBeInTheDocument();
    const slotBtn = screen.getByRole("button", { name: /Choose another slot/i });
    expect(slotBtn).toBeInTheDocument();

    fireEvent.click(slotBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/customer/book/deep-cleaning?step=3", { replace: true });
  });
});
