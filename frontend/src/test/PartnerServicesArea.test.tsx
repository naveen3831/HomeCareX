import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  addEntry,
  emptyForm,
  hasErrors,
  toInput,
  validateForm,
  type AreaForm,
} from "@/pages/partner/ServiceArea/serviceAreaModel";
import { suggestCities } from "@/pages/partner/ServiceArea/indianCities";
import * as osm from "@/components/customer/maps/osm";
import PartnerMyServicesPage from "@/pages/partner/MyServices";
import PartnerServiceAreaPage from "@/pages/partner/ServiceArea";
import * as servicesApi from "@/pages/partner/MyServices/myServices.api";
import * as areaApi from "@/pages/partner/ServiceArea/serviceArea.api";

vi.mock("@/pages/partner/MyServices/myServices.api");
vi.mock("@/pages/partner/ServiceArea/serviceArea.api");
vi.mock("@/components/customer/maps/osm");

const valid: AreaForm = {
  label: "Eluru",
  lat: "16.71",
  lng: "81.09",
  cities: ["Eluru"],
  areas: [],
  radius: "25",
};

describe("service area validation", () => {
  it("accepts a valid form and builds the API input", () => {
    expect(hasErrors(validateForm(valid))).toBe(false);
    expect(toInput(valid)).toEqual({
      baseLocation: { lat: 16.71, lng: 81.09, label: "Eluru" },
      cities: ["Eluru"],
      areas: [],
      radiusKm: 25,
    });
  });

  it("requires a base location and at least one city", () => {
    const e = validateForm(emptyForm());
    expect(e.baseLocation).toBeTruthy();
    expect(e.cities).toBeTruthy();
  });

  it("rejects out-of-range coordinates", () => {
    expect(validateForm({ ...valid, lat: "95" }).baseLocation).toMatch(
      /Latitude/,
    );
    expect(validateForm({ ...valid, lng: "-181" }).baseLocation).toMatch(
      /Longitude/,
    );
    expect(validateForm({ ...valid, lat: "abc" }).baseLocation).toBeTruthy();
  });

  it.each(["0", "51", "-1", "2.5", "", "x"])("rejects radius %j", (radius) => {
    expect(validateForm({ ...valid, radius }).radiusKm).toBeTruthy();
  });

  it.each(["1", "50"])("accepts radius %s", (radius) => {
    expect(validateForm({ ...valid, radius }).radiusKm).toBeUndefined();
  });

  it("adds entries trimmed, rejecting short, duplicate and over-limit values", () => {
    expect(addEntry([], "  Eluru  ", 5).list).toEqual(["Eluru"]);
    expect(addEntry(["Eluru"], "eluru", 5).error).toMatch(/already/);
    expect(addEntry([], "a", 5).error).toBeTruthy();
    expect(addEntry(["A1", "B2"], "Cc", 2).error).toMatch(/at most/);
  });
});

describe("MyServices page", () => {
  beforeEach(() => vi.resetAllMocks());

  it("shows a loading state, then the approved services", async () => {
    vi.mocked(servicesApi.getPartnerServices).mockResolvedValue({
      approved: [
        { id: "a", name: "AC Repair", slug: "ac", categoryId: "c", icon: "" },
        {
          id: "b",
          name: "Refrigerator Repair",
          slug: "fr",
          categoryId: "c",
          icon: "",
        },
      ],
      selectedIds: ["a"],
    });
    render(<PartnerMyServicesPage />);
    expect(screen.getByTestId("services-loading")).toBeInTheDocument();
    expect(await screen.findByLabelText("AC Repair")).toBeChecked();
    expect(screen.getByLabelText("Refrigerator Repair")).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeDisabled();
  });

  it("saves only after a change", async () => {
    vi.mocked(servicesApi.getPartnerServices).mockResolvedValue({
      approved: [
        { id: "a", name: "AC Repair", slug: "ac", categoryId: "c", icon: "" },
      ],
      selectedIds: [],
    });
    vi.mocked(servicesApi.savePartnerServices).mockResolvedValue({
      approved: [
        { id: "a", name: "AC Repair", slug: "ac", categoryId: "c", icon: "" },
      ],
      selectedIds: ["a"],
    });
    render(<PartnerMyServicesPage />);
    await userEvent.click(await screen.findByLabelText("AC Repair"));
    await userEvent.click(
      screen.getByRole("button", { name: /save changes/i }),
    );
    await waitFor(() =>
      expect(servicesApi.savePartnerServices).toHaveBeenCalledWith(["a"]),
    );
    expect(await screen.findByText("Services saved.")).toBeInTheDocument();
  });

  it("shows an empty state when nothing is approved", async () => {
    vi.mocked(servicesApi.getPartnerServices).mockResolvedValue({
      approved: [],
      selectedIds: [],
    });
    render(<PartnerMyServicesPage />);
    expect(
      await screen.findByText("No services available yet"),
    ).toBeInTheDocument();
  });

  it("shows an error state with retry", async () => {
    vi.mocked(servicesApi.getPartnerServices).mockRejectedValue(
      new Error("boom"),
    );
    render(<PartnerMyServicesPage />);
    expect(
      await screen.findByText("Couldn't load your services"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("ServiceArea page", () => {
  beforeEach(() => vi.resetAllMocks());

  it("shows the empty prompt and blocks an invalid save", async () => {
    vi.mocked(areaApi.getServiceArea).mockResolvedValue({
      baseLocation: null,
      cities: [],
      areas: [],
      radiusKm: 10,
      configured: false,
      updatedAt: null,
    });
    render(<PartnerServiceAreaPage />);
    expect(await screen.findByText("Service area not set")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /save service area/i }),
    );
    expect(
      await screen.findByText(/Set your base location/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Add at least one city/)).toBeInTheDocument();
    expect(areaApi.saveServiceArea).not.toHaveBeenCalled();
  });

  it("saves a valid area", async () => {
    vi.mocked(areaApi.getServiceArea).mockResolvedValue({
      baseLocation: null,
      cities: [],
      areas: [],
      radiusKm: 10,
      configured: false,
      updatedAt: null,
    });
    vi.mocked(areaApi.saveServiceArea).mockResolvedValue({
      baseLocation: { lat: 16.7, lng: 81.1, label: "" },
      cities: ["Eluru"],
      areas: [],
      radiusKm: 10,
      configured: true,
      updatedAt: null,
    });
    render(<PartnerServiceAreaPage />);
    await userEvent.type(await screen.findByLabelText("Latitude"), "16.7");
    await userEvent.type(screen.getByLabelText("Longitude"), "81.1");
    await userEvent.type(
      screen.getByLabelText("Service cities"),
      "Eluru{enter}",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /save service area/i }),
    );
    await waitFor(() =>
      expect(areaApi.saveServiceArea).toHaveBeenCalledWith({
        baseLocation: { lat: 16.7, lng: 81.1, label: "" },
        cities: ["Eluru"],
        areas: [],
        radiusKm: 10,
      }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Service area saved!");
    expect(dialog).toHaveTextContent("1 city · 10 km radius");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("shows an error state when loading fails", async () => {
    vi.mocked(areaApi.getServiceArea).mockRejectedValue(new Error("boom"));
    render(<PartnerServiceAreaPage />);
    expect(
      await screen.findByText("Couldn't load your service area"),
    ).toBeInTheDocument();
  });
});

describe("suggestCities", () => {
  it("needs two letters and ranks starts-with first", () => {
    expect(suggestCities("e")).toEqual([]);
    const r = suggestCities("elu");
    expect(r[0]).toBe("Eluru");
    expect(suggestCities("vij")[0]).toBe("Vijayawada");
  });

  it("matches anywhere in the name, ignores case and skips cities already added", () => {
    expect(suggestCities("HYDERA")).toContain("Hyderabad");
    expect(suggestCities("nagar")).toContain("Mahbubnagar");
    expect(suggestCities("elu", ["eluru"])).not.toContain("Eluru");
  });

  it("returns at most the limit", () => {
    expect(suggestCities("an", [], 3).length).toBeLessThanOrEqual(3);
  });
});

describe("ServiceArea suggestions and location", () => {
  const unconfigured = {
    baseLocation: null,
    cities: [],
    areas: [],
    radiusKm: 10,
    configured: false,
    updatedAt: null,
  };
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(areaApi.getServiceArea).mockResolvedValue(unconfigured);
  });

  it("suggests cities after two letters and adds the clicked one", async () => {
    render(<PartnerServiceAreaPage />);
    const input = await screen.findByLabelText("Service cities");
    await userEvent.type(input, "el");
    const option = await screen.findByRole("option", { name: "Eluru" });
    await userEvent.click(option);
    expect(
      screen.getByRole("list", { name: "Service cities added" }),
    ).toHaveTextContent("Eluru");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("supports the keyboard: arrow down then Enter picks a suggestion", async () => {
    render(<PartnerServiceAreaPage />);
    const input = await screen.findByLabelText("Service cities");
    await userEvent.type(input, "vij");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(
      screen.getByRole("list", { name: "Service cities added" }),
    ).toHaveTextContent("Vijayawada");
  });

  it("still allows a city that is not in the list", async () => {
    render(<PartnerServiceAreaPage />);
    await userEvent.type(
      await screen.findByLabelText("Service cities"),
      "Smalltownville{enter}",
    );
    expect(
      screen.getByRole("list", { name: "Service cities added" }),
    ).toHaveTextContent("Smalltownville");
  });

  it("shows a clear success message when the location is fetched", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({
            coords: { latitude: 16.46057, longitude: 79.43575 },
          } as GeolocationPosition),
      },
    });
    vi.mocked(osm.reverseGeocode).mockResolvedValue({
      lat: 16.46057,
      lng: 79.43575,
      formatted: "",
      line1: "",
      area: "Powerpet",
      city: "Eluru",
      state: "Andhra Pradesh",
      pincode: "",
    });
    render(<PartnerServiceAreaPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: /use my current location/i }),
    );
    expect(
      await screen.findByText(/Location fetched successfully/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Latitude")).toHaveValue("16.46057");
    await waitFor(() =>
      expect(
        screen.getByText(/Powerpet, Eluru, Andhra Pradesh/),
      ).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/Name \(optional\)/)).toHaveValue("Powerpet");
  });

  it("explains a denied location permission", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (
          _ok: PositionCallback,
          fail: PositionErrorCallback,
        ) => fail({ code: 1, message: "denied" } as GeolocationPositionError),
      },
    });
    render(<PartnerServiceAreaPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: /use my current location/i }),
    );
    expect(
      await screen.findByText(/permission was denied/i),
    ).toBeInTheDocument();
  });
});
