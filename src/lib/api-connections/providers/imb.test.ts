import { describe, expect, it } from "vitest";

import { ApiConnectionError } from "../core";
import {
  adaptCurrentImbArcgisFeatures,
  getImbSourceAdapterMetadata,
  IMB_SOURCE_ADAPTER_VERSION,
} from "./imb";

const replacementAttributes = {
  OBJECTID: 100001,
  PEID: 1,
  Name: "Andorran",
  ISOAlpha3: "AND",
  CountryCode: "AND",
  CountryName: "Andorra",
  AffAbbr: "EURO",
  imbAffinityCode: "AG100",
  Population: 46000,
  GSEC: 1,
  EngagementProgress: 0,
  EngagementStatus: "Unengaged",
  EngagementProgressDesc: "Unengaged and Unreached",
  LanguageCode: "cat",
  LanguageName: "Catalan",
  ReligionName: "Christianity - Roman Catholicism",
  ROP3Code: "101896",
  ROP3Name: "Catalan",
  ROP25Code: "301602",
  ROP2Code: "C0202",
  ROP2Name: "Spanish",
  ROP1Code: "A003",
  ROP1Name: "Eurasian Peoples",
  BibleAvailability: "Available",
  JesusFilmAvailability: "Available",
  RadioProgramAvailability: "Not Available",
  GospelResourceAvailability: "Available",
  AudioResourceAvailability: "Available",
  Indigenous: "Indigenous",
  Lat: 42.49,
  Long: 1.52,
};

describe("current IMB ArcGIS source adapter", () => {
  it("maps the replacement schema into the pinned legacy source contract", () => {
    const [adapted] = adaptCurrentImbArcgisFeatures([
      {
        attributes: replacementAttributes,
        geometry: { x: 1.52, y: 42.49 },
      },
    ]);

    expect(adapted).toMatchObject({
      attributes: {
        OBJECTID: 100001,
        PEID: 1,
        Name: "Andorran",
        ISOalpha3: "AND",
        Ctry: "Andorra",
        ROG: null,
        Aff: "EURO",
        AffCd: "AG100",
        Affbloc: "Eurasian Peoples",
        Pop: 46000,
        PopCls: null,
        EngStat: "Unengaged",
        GSEC: 1,
        SPI: 0,
        ROL: "cat",
        Lang: "Catalan",
        Rlgn: "Christianity - Roman Catholicism",
        ROP3: "101896",
        PplNm: "Catalan",
        ROP25: "301602",
        ROP2: "C0202",
        PplClstr: "Spanish",
        ROP1: "A003",
        Jesus: "Available",
        Radio: "Not Available",
        Gospel: "Available",
        Audio: "Available",
        Bible: "Available",
        Indigenous: "Indigenous",
        Latitude: 42.49,
        Longitude: 1.52,
      },
      geometry: { x: 1.52, y: 42.49 },
    });
  });

  it("leaves discontinued optional fields blank instead of deriving values", () => {
    const [adapted] = adaptCurrentImbArcgisFeatures([
      { attributes: replacementAttributes },
    ]);

    expect(adapted).toMatchObject({
      attributes: {
        Ethne: null,
        PopCls: null,
        RlgnDiv: null,
      },
    });
  });

  it("rejects replacement schema drift in required identity fields", () => {
    const attributes: Record<string, unknown> = { ...replacementAttributes };
    delete attributes.ROP3Code;

    expect(() =>
      adaptCurrentImbArcgisFeatures([{ attributes }]),
    ).toThrowError(
      new ApiConnectionError(
        "IMB replacement source is missing required fields: ROP3Code.",
        502,
      ),
    );
  });

  it("exposes stable versioned and checksummed adapter metadata", () => {
    expect(getImbSourceAdapterMetadata()).toMatchObject({
      name: "imb-arcgis-replacement",
      version: IMB_SOURCE_ADAPTER_VERSION,
      checksum: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
  });
});
