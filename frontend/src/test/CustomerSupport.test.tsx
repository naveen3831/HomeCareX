import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Support from "@/pages/customer/Support";
import { supportApi } from "@/services/supportApi";
import { validateFiles, MAX_FILE_BYTES } from "@/features/support/attachments";
import type { TicketDetail } from "@/features/support/types";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "507f1f77bcf86cd799439011" } }),
}));
vi.mock("@/hooks/useSocket", () => ({
  useSocket: () => ({
    socket: { on: () => {}, off: () => {} },
    connected: false,
  }),
}));
vi.mock("@/services/supportApi", () => ({
  supportApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    reply: vi.fn(),
    download: vi.fn(),
  },
}));
vi.mock("@/services/bookingApi", () => ({
  bookingApi: {
    listBookings: vi.fn().mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
    }),
  },
}));

const ticket: TicketDetail["ticket"] = {
  id: "507f1f77bcf86cd799439099",
  createdBy: "507f1f77bcf86cd799439011",
  createdByRole: "customer",
  bookingId: null,
  category: "payment",
  subject: "Payment needs checking",
  priority: "normal",
  status: "open",
  assignedTo: null,
  createdAt: "2026-10-15T10:00:00Z",
  updatedAt: "2026-10-15T10:00:00Z",
  lastMessageAt: "2026-10-15T10:00:00Z",
};
const detail: TicketDetail = {
  ticket,
  nextBefore: null,
  messages: [
    {
      id: "m1",
      ticketId: ticket.id,
      senderId: ticket.createdBy,
      senderRole: "customer",
      body: "Please check my payment.",
      attachments: [],
      readAt: null,
      createdAt: ticket.createdAt,
    },
    {
      id: "m2",
      ticketId: ticket.id,
      senderId: "admin",
      senderRole: "admin",
      body: "We are checking your payment.",
      attachments: [],
      readAt: null,
      createdAt: ticket.createdAt,
    },
  ],
};
const clients: QueryClient[] = [];
function mount(url = "/customer/support") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/customer/support" element={<Support />} />
          <Route
            path="/customer/support/tickets/:ticketId"
            element={<Support />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  vi.mocked(supportApi.list).mockResolvedValue({
    items: [],
    meta: { page: 1, limit: 10, total: 0, pages: 1 },
  });
  vi.mocked(supportApi.get).mockResolvedValue(detail);
  vi.mocked(supportApi.create).mockResolvedValue(ticket);
  vi.mocked(supportApi.reply).mockResolvedValue(detail.messages[0]);
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.clearAllMocks();
});

describe("customer support screens", () => {
  it("shows all eight help sections and searches article text", async () => {
    const user = userEvent.setup();
    mount();
    expect(screen.getByRole("heading", { name: "Safety" })).toBeInTheDocument();
    expect(screen.getByText("8 help sections")).toBeInTheDocument();
    await user.type(
      screen.getByRole("searchbox", { name: "Search help articles" }),
      "refund",
    );
    expect(
      screen.getByRole("heading", { name: "Refunds" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Safety" }),
    ).not.toBeInTheDocument();
  });
  it("has useful empty, loading and error states", async () => {
    const view = mount("/customer/support?view=tickets");
    expect(
      await screen.findByRole("heading", { name: "No tickets yet" }),
    ).toBeInTheDocument();
    view.unmount();
    vi.mocked(supportApi.list).mockImplementation(() => new Promise(() => {}));
    const loading = mount("/customer/support?view=tickets");
    expect(screen.getByText("Loading your tickets…")).toBeInTheDocument();
    loading.unmount();
    vi.mocked(supportApi.list).mockRejectedValue({
      message: "Support is temporarily unavailable.",
    });
    mount("/customer/support?view=tickets");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Support is temporarily unavailable.",
    );
  });
  it("creates a ticket with the entered fields and image attachment", async () => {
    const user = userEvent.setup();
    mount("/customer/support?view=new&category=refunds");
    await user.type(screen.getByLabelText("Subject"), "Refund needs checking");
    await user.type(
      screen.getByLabelText("Description"),
      "Please check the refund for this booking.",
    );
    const file = new File(["image"], "proof.png", { type: "image/png" });
    const upload = document.querySelector(
      "input[type=file]",
    ) as HTMLInputElement;
    await user.upload(upload, file);
    await user.click(screen.getByRole("button", { name: "Create ticket" }));
    await waitFor(() =>
      expect(supportApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "refunds",
          subject: "Refund needs checking",
        }),
        [file],
      ),
    );
    expect(
      await screen.findByRole("heading", { name: ticket.subject }),
    ).toBeInTheDocument();
  });
  it("renders both sides of the conversation and sends a reply", async () => {
    const user = userEvent.setup();
    mount(`/customer/support/tickets/${ticket.id}`);
    expect(
      await screen.findByText("We are checking your payment."),
    ).toBeInTheDocument();
    expect(screen.getByText("Please check my payment.")).toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Your reply"),
      "Thank you for checking.",
    );
    await user.click(screen.getByRole("button", { name: "Send reply" }));
    await waitFor(() =>
      expect(supportApi.reply).toHaveBeenCalledWith(
        ticket.id,
        "Thank you for checking.",
        [],
      ),
    );
    expect(await screen.findByText("Reply sent.")).toBeInTheDocument();
  });
  it("keeps the draft and displays an error when sending fails", async () => {
    vi.mocked(supportApi.reply).mockRejectedValue({
      message: "Please retry your reply.",
    });
    const user = userEvent.setup();
    mount(`/customer/support/tickets/${ticket.id}`);
    await screen.findByLabelText("Your reply");
    await user.type(screen.getByLabelText("Your reply"), "Keep this reply.");
    await user.click(screen.getByRole("button", { name: "Send reply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please retry your reply.",
    );
    expect(screen.getByLabelText("Your reply")).toHaveValue("Keep this reply.");
  });
  it("prevents double submission while a reply is pending", async () => {
    vi.mocked(supportApi.reply).mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    mount(`/customer/support/tickets/${ticket.id}`);
    await screen.findByLabelText("Your reply");
    await user.type(screen.getByLabelText("Your reply"), "Only one reply.");
    fireEvent.submit(screen.getByLabelText("Your reply").closest("form")!);
    fireEvent.submit(screen.getByLabelText("Your reply").closest("form")!);
    expect(supportApi.reply).toHaveBeenCalledTimes(1);
  });
  it("disables offline submissions and keeps help articles available", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    mount("/customer/support?view=new");
    expect(
      screen.getByRole("button", { name: "Create ticket" }),
    ).toBeDisabled();
    expect(screen.getByText(/Your form stays here/)).toBeInTheDocument();
  });
  it("makes closed tickets read-only", async () => {
    vi.mocked(supportApi.get).mockResolvedValue({
      ...detail,
      ticket: { ...ticket, status: "closed" },
    });
    mount(`/customer/support/tickets/${ticket.id}`);
    expect(
      await screen.findByText(/This ticket is resolved or closed/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send reply" }),
    ).not.toBeInTheDocument();
  });
  it("retains loaded messages when the latest page advances during live refresh", async () => {
    mount(`/customer/support/tickets/${ticket.id}`);
    await screen.findByText("Please check my payment.");
    vi.mocked(supportApi.get).mockResolvedValue({
      ...detail,
      messages: [
        detail.messages[1],
        { ...detail.messages[0], id: "m3", body: "A later update." },
      ],
    });
    await act(async () => {
      await clients[0].invalidateQueries({ queryKey: ["customer-support"] });
    });
    expect(await screen.findByText("A later update.")).toBeInTheDocument();
    expect(screen.getByText("Please check my payment.")).toBeInTheDocument();
  });
});
describe("attachment rules", () => {
  it("accepts exactly 5 MB and rejects larger, empty and unsupported files", () => {
    const pdf = new File([new Uint8Array(MAX_FILE_BYTES)], "proof.pdf", {
      type: "application/pdf",
    });
    expect(validateFiles([pdf])).toBeNull();
    expect(
      validateFiles([
        new File([new Uint8Array(MAX_FILE_BYTES + 1)], "big.pdf", {
          type: "application/pdf",
        }),
      ]),
    ).toMatch(/5 MB/);
    expect(
      validateFiles([new File([], "empty.pdf", { type: "application/pdf" })]),
    ).toMatch(/1 byte/);
    expect(
      validateFiles([new File(["<svg/>"], "x.svg", { type: "image/svg+xml" })]),
    ).toMatch(/use JPG/);
    expect(validateFiles([pdf, pdf, pdf, pdf])).toMatch(/up to 3/);
  });
});
