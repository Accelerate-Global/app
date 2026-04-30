import { describe, expect, it, vi } from "vitest";

import {
  ETNOPEDIA_CATEGORY_TITLE,
  fetchEtnopediaPeopleGroups,
  isEtnopediaApiUrl,
  parseEtnopediaMainWikitext,
  parseEtnopediaTalkWikitext,
} from "@/lib/etnopedia-api";

const mainWikitext = `
[[File:F123456789.jpg|thumb]]
'''Photo Source: [https://example.com/photo Photo credit]'''
'''Countries: [[Russia]], [[Kazakhstan]]'''
'''Population: 43,341
* [[Russia]] 43,000
* [[Kazakhstan]] 341'''
'''Primary religion: Islam'''
'''Reached status: [[File:U001.gif]] [2020] Unreached'''
'''Alternate people names: Alpha; Beta / Alpha'''
'''Primary language: [[Language:Avar|Avar]]'''
'''Sign Language: Alpha Sign'''
'''Bible translation exists: Yes [2018] New Testament'''
'''Bible translation: Complete Bible'''
----
'''Introduction:''' The Alpha people live in the mountains.
'''Prayer Points:'''
* Pray for local leaders.
* Pray for local leaders.
{"type":"ExternalData","title":"Alpha.map"}
Map Source: Etnopedia Maps
== References ==
*Description: Reference description.
*Statistics: Reference statistics.
`;

const talkWikitext = `
{{peoplecode|ROP3=123456|peopleid3=789|peid=111; 222|wcdprn=333,444|eupc=555|profile sources=Registry}}
[[File:U000.gif]] [2021] Joshua Project
[[File:U001.gif]] [2022] Global Status
[[File:U002.gif]] [xxxx] Overall
`;

describe("Etnopedia wikitext parsing", () => {
  it("extracts script-compatible main-page fields", () => {
    const result = parseEtnopediaMainWikitext("Alpha People", mainWikitext);

    expect(result.photoFile).toBe("F123456789.jpg");
    expect(result.photoSource).toBe("Photo credit");
    expect(result.countries).toEqual(["Russia", "Kazakhstan"]);
    expect(result.populationTotal).toBe(43341);
    expect(result.populationByCountry).toEqual([
      { country: "Russia", population: 43000 },
      { country: "Kazakhstan", population: 341 },
    ]);
    expect(result.religion).toBe("Islam");
    expect(result.reachedIndicatorFile).toBe("U001.gif");
    expect(result.reachedIndicatorCode).toBe("001");
    expect(result.reachedIndicatorLevel).toBe("2");
    expect(result.reachedYear).toBe("2020");
    expect(result.alternateNames).toEqual(["Alpha", "Beta"]);
    expect(result.primaryLanguage).toBe("Avar");
    expect(result.bibleTranslationExists).toBe("yes");
    expect(result.bibleTranslationYear).toBe("2018");
    expect(result.mapTitle).toBe("Alpha.map");
    expect(result.referencesDescription).toBe("Reference description.");
    expect(result.referencesStatistics).toBe("Reference statistics.");
    expect(result.sections.Introduction).toBe(
      "The Alpha people live in the mountains.",
    );
    expect(result.prayerPoints).toEqual(["Pray for local leaders."]);
  });

  it("extracts talk-page IDs and progress indicators", () => {
    const result = parseEtnopediaTalkWikitext("Alpha People", talkWikitext);

    expect(result.rop3).toBe("123456");
    expect(result.peopleid3).toBe("789");
    expect(result.peidList).toEqual(["111", "222"]);
    expect(result.wcdprnList).toEqual(["333", "444"]);
    expect(result.eupc).toBe("555");
    expect(result.profileSources).toBe("Registry");
    expect(result.progressJpFile).toBe("U000.gif");
    expect(result.progressJpYear).toBe("2021");
    expect(result.progressGsecFile).toBe("U001.gif");
    expect(result.progressGsecYear).toBe("2022");
    expect(result.progressOverallFile).toBe("U002.gif");
    expect(result.progressOverallYear).toBe("xxxx");
  });
});

describe("fetchEtnopediaPeopleGroups", () => {
  it("lists people titles, fetches main and talk revisions, and returns rows", async () => {
    const requestJson = vi.fn(async (params: Record<string, string>) => {
      if (params.list === "categorymembers") {
        return {
          query: {
            categorymembers: [{ title: "Alpha People" }],
          },
        };
      }

      if (params.titles === "Alpha People") {
        return {
          query: {
            pages: {
              "1": {
                title: "Alpha People",
                revisions: [
                  {
                    revid: 101,
                    timestamp: "2026-04-30T10:00:00Z",
                    slots: { main: { "*": mainWikitext } },
                  },
                ],
              },
            },
          },
        };
      }

      return {
        query: {
          pages: {
            "2": {
              title: "Talk:Alpha People",
              revisions: [
                {
                  revid: 202,
                  timestamp: "2026-04-30T10:05:00Z",
                  slots: { main: { "*": talkWikitext } },
                },
              ],
            },
          },
        },
      };
    });
    const log = vi.fn();

    const result = await fetchEtnopediaPeopleGroups({
      requestJson,
      batchSize: 1,
      log,
    });

    expect(requestJson).toHaveBeenCalledWith(
      expect.objectContaining({
        cmtitle: ETNOPEDIA_CATEGORY_TITLE,
      }),
      "GET",
    );
    expect(requestJson).toHaveBeenCalledWith(
      expect.objectContaining({
        titles: "Alpha People",
      }),
      "POST",
    );
    expect(requestJson).toHaveBeenCalledWith(
      expect.objectContaining({
        titles: "Talk:Alpha People",
      }),
      "POST",
    );
    expect(log).toHaveBeenCalledWith("Found 1 Etnopedia people-group titles.");
    expect(log).toHaveBeenCalledWith("Processed 1/1.");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.provenance.page.revid).toBe(101);
    expect(result.records[0]?.provenance.talk.revid).toBe(202);
    expect(result.rows[0]).toMatchObject({
      title: "Alpha People",
      page_url: "https://en.etnopedia.org/wiki/Alpha_People",
      talk_url: "https://en.etnopedia.org/wiki/Talk:Alpha_People",
      countries: "Russia; Kazakhstan",
      rop3: "123456",
      progress_overall_year: "xxxx",
    });
  });
});

describe("isEtnopediaApiUrl", () => {
  it("matches only the expected HTTPS MediaWiki API endpoint", () => {
    expect(isEtnopediaApiUrl("https://en.etnopedia.org/api.php")).toBe(true);
    expect(isEtnopediaApiUrl("http://en.etnopedia.org/api.php")).toBe(false);
    expect(isEtnopediaApiUrl("https://en.etnopedia.org/wiki/Alpha")).toBe(false);
    expect(isEtnopediaApiUrl("https://example.com/api.php")).toBe(false);
  });
});
