// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IsoCountryCodesClient } from "./iso-country-codes-client";
import type { IsoCountryCodeResource } from "@/lib/iso-country-codes";

const fetchMock = vi.fn();
const writeTextMock = vi.fn();

const initialResource: IsoCountryCodeResource = {
  sourceName: "ISO Online Browsing Platform",
  sourceUrl: "https://www.iso.org/obp/ui/#search/code/",
  sourceCollectionUrl: "https://www.iso.org/publication/PUB500001.html",
  sourceRetrievedAt: "2026-05-06T00:00:00.000Z",
  entryCount: 2,
  entries: [
    {
      alpha2: "AF",
      alpha3: "AFG",
      englishShortName: "Afghanistan",
      numeric: "004",
      uri: "iso:code:3166:AF",
    },
    {
      alpha2: "AL",
      alpha3: "ALB",
      englishShortName: "Albania",
      numeric: "008",
      uri: "iso:code:3166:AL",
    },
  ],
};

function buildJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("IsoCountryCodesClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("filters entries by country name and ISO3 code", () => {
    render(<IsoCountryCodesClient initialResource={initialResource} />);

    expect(screen.getByText("Afghanistan")).toBeTruthy();
    expect(screen.getByText("Albania")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/Search name/), {
      target: { value: "AFG" },
    });

    expect(screen.getByText("Afghanistan")).toBeTruthy();
    expect(screen.queryByText("Albania")).toBeNull();
    expect(screen.getByText("1 visible")).toBeTruthy();
  });

  it("copies the alpha-3 code", async () => {
    writeTextMock.mockResolvedValue(undefined);
    render(<IsoCountryCodesClient initialResource={initialResource} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy AFG" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("AFG");
    });
    expect(screen.getByText("Copied AFG")).toBeTruthy();
  });

  it("refreshes visible entries from the authenticated API", async () => {
    const refreshedResource: IsoCountryCodeResource = {
      ...initialResource,
      entryCount: 1,
      entries: [
        {
          alpha2: "ZW",
          alpha3: "ZWE",
          englishShortName: "Zimbabwe",
          numeric: "716",
          uri: "iso:code:3166:ZW",
        },
      ],
    };
    fetchMock.mockResolvedValue(buildJsonResponse(refreshedResource));
    render(<IsoCountryCodesClient initialResource={initialResource} />);

    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/iso-country-codes/refresh");
    });
    expect(await screen.findByText("Zimbabwe")).toBeTruthy();
    expect(screen.queryByText("Afghanistan")).toBeNull();
  });

  it("keeps generated entries visible when refresh fails", async () => {
    fetchMock.mockResolvedValue(buildJsonResponse({ error: "Nope" }, 502));
    render(<IsoCountryCodesClient initialResource={initialResource} />);

    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));

    expect(await screen.findByText(/Could not refresh from ISO/)).toBeTruthy();
    expect(screen.getByText("Afghanistan")).toBeTruthy();
  });
});
