export const ETNOPEDIA_DEFAULT_API_URL = "https://en.etnopedia.org/api.php";
export const ETNOPEDIA_CATEGORY_TITLE = "Category:Peoples_by_name";
export const ETNOPEDIA_DEFAULT_BATCH_SIZE = 50;

export type EtnopediaRequestMethod = "GET" | "POST";
export type EtnopediaRequestJson = (
  params: Record<string, string>,
  method: EtnopediaRequestMethod,
) => Promise<unknown>;

export type EtnopediaPopulationCountry = {
  country: string;
  population: number;
};

export type EtnopediaRecord = {
  title: string;
  urls: {
    page: string;
    talk: string;
  };
  provenance: {
    page: {
      revid: number | null;
      timestamp: string;
    };
    talk: {
      revid: number | null;
      timestamp: string;
    };
  };
  main: {
    photo_file: string;
    photo_source: string;
    countries: string[];
    population_total: number | null;
    population_by_country: EtnopediaPopulationCountry[];
    religion: string;
    reached: {
      status: string;
      indicator_file: string;
      indicator_code: string;
      indicator_level: string;
      year: string;
    };
    alternate_names: string[];
    languages: {
      primary: string;
      sign: string;
    };
    bible_translation: {
      exists: string;
      year: string;
      notes: string;
      detail: string;
    };
    map: {
      title: string;
      titles: string[];
      latitude: string;
      longitude: string;
      zoom: string;
      source: string;
    };
    references: {
      description: string;
      statistics: string;
    };
    sections: Record<string, string>;
    prayer_points: string[];
  };
  talk: {
    rop3: string;
    peopleid3: string;
    peid_list: string[];
    wcdprn_list: string[];
    eupc: string;
    profile_sources: string;
    progress: {
      jp: {
        file: string;
        year: string;
      };
      gsec: {
        file: string;
        year: string;
      };
      overall: {
        file: string;
        year: string;
      };
    };
  };
};

type PageRevision = {
  title: string;
  wikitext: string;
  revid: number | null;
  timestamp: string;
};

type ParsedMainWikitext = {
  photoFile: string;
  photoSource: string;
  countries: string[];
  populationTotal: number | null;
  populationByCountry: EtnopediaPopulationCountry[];
  religion: string;
  reachedStatus: string;
  reachedIndicatorFile: string;
  reachedIndicatorCode: string;
  reachedIndicatorLevel: string;
  reachedYear: string;
  alternateNames: string[];
  primaryLanguage: string;
  signLanguage: string;
  bibleTranslationExists: string;
  bibleTranslationYear: string;
  bibleTranslationNotes: string;
  bibleTranslationDetail: string;
  mapTitle: string;
  mapTitles: string[];
  mapLatitude: string;
  mapLongitude: string;
  mapZoom: string;
  mapSource: string;
  referencesDescription: string;
  referencesStatistics: string;
  sections: Record<string, string>;
  prayerPoints: string[];
};

type ParsedTalkWikitext = {
  rop3: string;
  peopleid3: string;
  peidList: string[];
  wcdprnList: string[];
  eupc: string;
  profileSources: string;
  progressJpFile: string;
  progressJpYear: string;
  progressGsecFile: string;
  progressGsecYear: string;
  progressOverallFile: string;
  progressOverallYear: string;
};

export const ETNOPEDIA_CSV_COLUMNS = [
  "title",
  "page_url",
  "talk_url",
  "page_revid",
  "page_timestamp",
  "talk_revid",
  "talk_timestamp",
  "photo_file",
  "photo_source",
  "countries",
  "countries_list_json",
  "population_total",
  "population_by_country_json",
  "primary_or_principal_religion",
  "reached_status",
  "reached_indicator_file",
  "reached_indicator_code",
  "reached_indicator_level",
  "reached_year",
  "alternate_names",
  "alternate_names_list_json",
  "primary_language",
  "sign_language",
  "bible_translation_exists",
  "bible_translation_year",
  "bible_translation_notes",
  "bible_translation_detail",
  "map_title",
  "map_titles_json",
  "map_latitude",
  "map_longitude",
  "map_zoom",
  "map_source",
  "references_description",
  "references_statistics",
  "sections_json",
  "prayer_points_json",
  "rop3",
  "peopleid3",
  "peid_list_json",
  "wcdprn_list_json",
  "eupc",
  "profile_sources",
  "progress_jp_file",
  "progress_jp_year",
  "progress_gsec_file",
  "progress_gsec_year",
  "progress_overall_file",
  "progress_overall_year",
] as const;

const RE_CAT_LINK_LINE = /^\s*\[\[Category:[^\]]+\]\]\s*$/gim;
const RE_INTERLANG_LINE = /^\s*\[\[[a-z]{2,3}(?:-[a-z0-9]+)?:[^\]]+\]\]\s*$/gim;
const RE_DEFAULTSORT = /^\s*\{\{\s*DEFAULTSORT:[^}]+\}\}\s*$/gim;
const RE_REF_TAG = /<ref[^>]*>[\s\S]*?<\/ref>/gi;
const RE_REFS_SELF = /<references\s*\/\s*>/gi;
const RE_COMMENT = /<!--[\s\S]*?-->/g;
const RE_HTML_TAG = /<[^>]+>/g;
const RE_MAPFRAME_TAG = /<mapframe\b([^>]*)>/i;
const RE_SECTION_LABEL = /'''([^'\n]{2,50}?)\s*:\s*'''/gm;
const RE_EXTERNALDATA_BLOCK = /\{\s*"type"\s*:\s*"ExternalData"[\s\S]*?\}\s*/gi;
const RE_EXTERNALDATA_TITLE = /\{\s*"type"\s*:\s*"ExternalData"[\s\S]*?"title"\s*:\s*"([^"]+)"/gi;
const RE_HEADER_LABEL =
  /^\s*(?:\*+\s*)?(Photo\s+Source|Countr(?:y|ies)|Population|Primary\s+religion|Principal\s+religion|Religion|Reached\s+status|Alternate\s+(?:people\s+)?names?|Primary\s+language|Language|Sign\s+Language|Bible\s+translation\s+exists|Bible\s+translation)\s*:?\s*/gim;
const RE_PEOPLECODE = /\{\{\s*peoplecode\b([\s\S]*?)\}\}/i;
const RE_PROGRESS_LINE =
  /\[\[(?:Image|File):(U\d{3}\.gif)[^\]]*\]\]\s*\[(\d{4}|xxxx)\][^\n\r]*(Joshua\s+Project|Global\s+Status|Overall)\b/gim;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function cleanOneLine(value: string) {
  return value.replace(/\r/g, "\n").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
    const normalized = String(entity).toLowerCase();

    if (normalized.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
    }

    if (normalized.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
    }

    return (
      {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
        nbsp: " ",
      }[normalized] ?? match
    );
  });
}

function stripNoiseLines(wikitext: string) {
  return wikitext
    .replace(RE_COMMENT, "")
    .replace(RE_REF_TAG, "")
    .replace(RE_REFS_SELF, "")
    .replace(RE_CAT_LINK_LINE, "")
    .replace(RE_INTERLANG_LINE, "")
    .replace(RE_DEFAULTSORT, "")
    .trim();
}

function wikitextToPlain(value: string) {
  let text = value;

  if (!text) {
    return "";
  }

  text = text
    .replace(RE_COMMENT, "")
    .replace(RE_REF_TAG, "")
    .replace(RE_REFS_SELF, "")
    .replace(/<mapframe\b[\s\S]*?<\/mapframe>/gi, "")
    .replace(/\[(https?:\/\/[^\s\]]+)(?:\s+([^\]]+))?\]/g, (_match, url: string, label?: string) =>
      (label || url).trim(),
    )
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target: string, label?: string) => {
      if (label) {
        return label.trim();
      }

      return target.includes(":") ? target.split(":", 2)[1].trim() : target.trim();
    })
    .replace(/\[\[(?:File|Image):[^\]]+\]\]/gi, "")
    .replace(/\[\[Category:[^\]]+\]\]/gi, "")
    .replace(/'''/g, "")
    .replace(/''/g, "")
    .replace(RE_HTML_TAG, "");

  text = decodeHtmlEntities(text);

  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normUFile(value: string) {
  const match = /^u(\d{3})\.gif$/i.exec(value.trim());
  return match ? `U${match[1]}.gif` : value.trim();
}

function uFileToLevel(value: string) {
  const match = /^u(\d{3})\.gif$/i.exec(value.trim());

  if (!match) {
    return { code: "", level: "" };
  }

  return {
    code: match[1],
    level: String(Number.parseInt(match[1], 10) + 1),
  };
}

function splitList(value: string) {
  if (!value) {
    return [];
  }

  const parts = wikitextToPlain(value)
    .replace(/\n/g, " ")
    .split(/[;,/]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const part of parts) {
    const key = part.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    out.push(part);
  }

  return out;
}

function pickPopulationToken(line: string) {
  const matches = [...line.matchAll(/\d[\d,]*/g)];
  const candidates = matches
    .map((match) => {
      const token = match[0];
      const value = Number.parseInt(token.replace(/,/g, ""), 10);

      return Number.isFinite(value)
        ? {
            start: match.index ?? 0,
            end: (match.index ?? 0) + token.length,
            token,
            value,
            hasComma: token.includes(","),
          }
        : null;
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);

  if (candidates.length === 0) {
    return null;
  }

  const commaCandidate = candidates.find((candidate) => candidate.hasComma);

  if (commaCandidate) {
    return commaCandidate;
  }

  const nonYearCandidate = candidates.find((candidate) => {
    const normalized = candidate.token.replace(/,/g, "");
    const isYearish =
      normalized.length === 4 && candidate.value >= 1700 && candidate.value <= 2100;

    return !isYearish;
  });

  return nonYearCandidate ?? candidates[0];
}

function parsePopulationBlock(populationBlock: string) {
  if (!populationBlock) {
    return {
      total: null as number | null,
      breakdown: [] as EtnopediaPopulationCountry[],
    };
  }

  const text = populationBlock
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r/g, "\n");
  const bulletMatch = /^\s*\*/m.exec(text);
  const totalZone = bulletMatch ? text.slice(0, bulletMatch.index) : text;
  const totalMatch = /\d[\d,]*/.exec(totalZone);
  const total = totalMatch
    ? Number.parseInt(totalMatch[0].replace(/,/g, ""), 10)
    : null;
  const breakdown: EtnopediaPopulationCountry[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed.startsWith("*")) {
      continue;
    }

    const raw = trimmed.replace(/^\*+/, "").trim();
    const token = pickPopulationToken(raw);

    if (!token) {
      continue;
    }

    const country = cleanOneLine(
      wikitextToPlain(raw.slice(0, token.start).replace(/[ \-–:\t,;]+$/u, "")),
    );

    if (country) {
      breakdown.push({ country, population: token.value });
    }
  }

  return {
    total: Number.isFinite(total) ? total : null,
    breakdown,
  };
}

function splitHeaderBody(wikitext: string) {
  if (!wikitext) {
    return { header: "", body: "" };
  }

  const candidates: number[] = [];
  const rule = /^\s*----\s*$/m.exec(wikitext);
  const section = RE_SECTION_LABEL.exec(wikitext);
  const refs = /^==\s*References\s*==\s*$/im.exec(wikitext);
  const map = /<mapframe\b/i.exec(wikitext);

  RE_SECTION_LABEL.lastIndex = 0;

  for (const match of [rule, section, refs, map]) {
    if (match?.index !== undefined) {
      candidates.push(match.index);
    }
  }

  if (candidates.length === 0) {
    return { header: wikitext, body: "" };
  }

  const cut = Math.min(...candidates);

  return {
    header: wikitext.slice(0, cut).trim(),
    body: wikitext.slice(cut).trim(),
  };
}

function parseHeaderFields(headerWikitext: string) {
  const out: Record<string, string> = {};

  if (!headerWikitext) {
    return out;
  }

  const headerForLabels = headerWikitext.replace(/'''/g, "");
  const matches = [...headerForLabels.matchAll(RE_HEADER_LABEL)];

  for (const [index, match] of matches.entries()) {
    const label = (match[1] ?? "").trim().toLowerCase();
    const start = (match.index ?? 0) + match[0].length;
    const end =
      index + 1 < matches.length ? matches[index + 1].index ?? headerForLabels.length : headerForLabels.length;

    out[label] = headerForLabels.slice(start, end).trim();
  }

  return out;
}

function chooseReligion(fields: Record<string, string>) {
  for (const key of ["primary religion", "principal religion", "religion"]) {
    const value = fields[key];

    if (value?.trim()) {
      return cleanOneLine(wikitextToPlain(value));
    }
  }

  return "";
}

function chooseLanguage(fields: Record<string, string>) {
  for (const key of ["primary language", "language"]) {
    const value = fields[key];

    if (value?.trim()) {
      return cleanOneLine(wikitextToPlain(value));
    }
  }

  return "";
}

function parseReached(value: string) {
  let status = value;
  let indicator = "";
  let year = "";
  const fileMatch = /\[\[(?:File|Image):([^|\]]+)\]\]/i.exec(value);

  if (fileMatch) {
    indicator = normUFile(fileMatch[1].trim());
    status = status.replace(fileMatch[0], " ");
  }

  const yearMatch = /\[(\d{4})\]/.exec(value);

  if (yearMatch) {
    year = yearMatch[1];
    status = status.replace(yearMatch[0], " ");
  }

  return {
    status: cleanOneLine(wikitextToPlain(status)),
    indicator,
    year,
  };
}

function parseYesNoYear(value: string) {
  let text = value;
  let year = "";
  const yearMatch = /\[(\d{4})\]/.exec(value);

  if (yearMatch) {
    year = yearMatch[1];
    text = text.replace(yearMatch[0], " ");
  }

  const plain = cleanOneLine(wikitextToPlain(text));
  const yesNo = /^(yes|no)\b/i.exec(plain);

  if (!yesNo) {
    return { yesNo: "", year, notes: plain };
  }

  return {
    yesNo: yesNo[1].toLowerCase(),
    year,
    notes: plain.slice(yesNo[0].length).replace(/^[ \-–:;,.()]+|[ \-–:;,.()]+$/gu, ""),
  };
}

function referencesSection(wikitext: string) {
  const match = /^==\s*References\s*==\s*$/im.exec(wikitext);
  return match ? wikitext.slice(match.index + match[0].length) : wikitext;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractReferenceBullet(label: string, wikitext: string) {
  if (!wikitext) {
    return "";
  }

  const pattern = new RegExp(
    `^\\s*\\*\\s*${escapeRegExp(label)}\\s*:\\s*([\\s\\S]*?)(?=^\\s*\\*\\s*\\w|^\\s*==|(?![\\s\\S]))`,
    "im",
  );
  const match = pattern.exec(referencesSection(wikitext));

  return match ? cleanOneLine(wikitextToPlain(match[1] || "")) : "";
}

function parseMapInfo(wikitext: string) {
  const titles: string[] = [];
  let latitude = "";
  let longitude = "";
  let zoom = "";
  const mapframe = RE_MAPFRAME_TAG.exec(wikitext);

  if (mapframe) {
    const attrs: Record<string, string> = {};

    for (const attr of mapframe[1].matchAll(/(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attrs[(attr[1] || "").trim().toLowerCase()] = (attr[2] ?? attr[3] ?? "").trim();
    }

    latitude = cleanOneLine(attrs.latitude || "");
    longitude = cleanOneLine(attrs.longitude || "");
    zoom = cleanOneLine(attrs.zoom || "");

    if (attrs.title?.trim()) {
      titles.push(attrs.title.trim());
    }

    const titleMatch = /"title"\s*:\s*"([^"]+)"/i.exec(mapframe[1]);

    if (titleMatch) {
      titles.push(titleMatch[1].trim());
    }
  }

  for (const match of wikitext.matchAll(RE_EXTERNALDATA_TITLE)) {
    titles.push(match[1].trim());
  }

  for (const match of wikitext.matchAll(/"title"\s*:\s*"([^"]+\.map)"/gi)) {
    titles.push(match[1].trim());
  }

  const seen = new Set<string>();
  const uniqueTitles = titles.filter((title) => {
    const key = title.toLowerCase();

    if (!title || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  return {
    title: uniqueTitles[0] ?? "",
    titles: uniqueTitles,
    latitude,
    longitude,
    zoom,
  };
}

function extractMapSource(wikitext: string) {
  const match = /^\s*Map\s+Source\s*:\s*(.+?)\s*$/im.exec(wikitext);
  return match ? cleanOneLine(wikitextToPlain(match[1] || "")) : "";
}

function extractPhotoFile(headerWikitext: string) {
  const files = [...headerWikitext.matchAll(/\[\[(?:File|Image):([^|\]]+)/gi)].map((match) =>
    (match[1] || "").trim(),
  );

  return (
    files.find((file) => /^F\d{6,}\.(?:jpg|jpeg|png|webp)$/i.test(file)) ??
    files.find((file) => !/^U\d{3}\.gif$/i.test(file)) ??
    ""
  );
}

function parseSections(wikitext: string) {
  const out: Record<string, string> = {};

  if (!wikitext) {
    return out;
  }

  const main = wikitext.split(/^==\s*References\s*==\s*$/im, 1)[0] || "";
  const labels = [...main.matchAll(RE_SECTION_LABEL)];

  for (const [index, match] of labels.entries()) {
    const label = cleanOneLine(match[1] || "");
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < labels.length ? labels[index + 1].index ?? main.length : main.length;
    const contentRaw = (main.slice(start, end) || "")
      .replace(/^\s*Map\s+Source\s*:\s*.+?\s*$/gim, "")
      .replace(RE_EXTERNALDATA_BLOCK, "")
      .trim();
    const plain = wikitextToPlain(contentRaw);

    if (plain) {
      out[label] = plain;
    }
  }

  return out;
}

function parsePrayerPoints(wikitext: string) {
  const match = /'''Prayer\s+Points\s*:\s*'''/i.exec(wikitext);

  if (!match) {
    return [];
  }

  const tail = wikitext.slice((match.index ?? 0) + match[0].length);
  const nextSection =
    /^'''\s*[^'\n]{2,50}\s*:\s*'''|^==\s*References\s*==|<mapframe\b/im.exec(
      tail,
    );
  const block = tail.slice(0, nextSection?.index ?? tail.length);
  const seen = new Set<string>();
  const points: string[] = [];

  for (const line of block.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed.startsWith("*")) {
      continue;
    }

    const point = cleanOneLine(wikitextToPlain(trimmed.replace(/^\*+/, "").trim()));
    const key = point.toLowerCase();

    if (point && !seen.has(key)) {
      seen.add(key);
      points.push(point);
    }
  }

  return points;
}

export function parseEtnopediaMainWikitext(title: string, wikitext: string): ParsedMainWikitext {
  void title;

  const stripped = stripNoiseLines(wikitext || "");
  const { header } = splitHeaderBody(stripped);
  const fields = parseHeaderFields(header);
  const countriesRaw = (fields.countries || fields.country || "").trim();
  const population = parsePopulationBlock(fields.population || "");
  const reached = parseReached(fields["reached status"] || "");
  const reachedLevel = uFileToLevel(reached.indicator);
  const alternateRaw =
    fields["alternate people names"] ||
    fields["alternate people name"] ||
    fields["alternate names"] ||
    fields["alternate name"] ||
    "";
  const bibleExists = parseYesNoYear(fields["bible translation exists"] || "");
  const map = parseMapInfo(stripped);

  return {
    photoFile: extractPhotoFile(header),
    photoSource: cleanOneLine(wikitextToPlain(fields["photo source"] || "")),
    countries: countriesRaw ? splitList(countriesRaw) : [],
    populationTotal: population.total,
    populationByCountry: population.breakdown,
    religion: chooseReligion(fields),
    reachedStatus: reached.status,
    reachedIndicatorFile: reached.indicator,
    reachedIndicatorCode: reachedLevel.code,
    reachedIndicatorLevel: reachedLevel.level,
    reachedYear: reached.year,
    alternateNames: alternateRaw ? splitList(alternateRaw) : [],
    primaryLanguage: chooseLanguage(fields),
    signLanguage: cleanOneLine(wikitextToPlain(fields["sign language"] || "")),
    bibleTranslationExists: bibleExists.yesNo,
    bibleTranslationYear: bibleExists.year,
    bibleTranslationNotes: bibleExists.notes,
    bibleTranslationDetail: cleanOneLine(wikitextToPlain(fields["bible translation"] || "")),
    mapTitle: map.title,
    mapTitles: map.titles,
    mapLatitude: map.latitude,
    mapLongitude: map.longitude,
    mapZoom: map.zoom,
    mapSource: extractMapSource(stripped),
    referencesDescription: extractReferenceBullet("Description", stripped),
    referencesStatistics: extractReferenceBullet("Statistics", stripped),
    sections: parseSections(stripped),
    prayerPoints: parsePrayerPoints(stripped),
  };
}

function parsePeoplecodeTemplate(wikitext: string) {
  const out: Record<string, string> = {};
  const match = RE_PEOPLECODE.exec(wikitext);

  if (!match) {
    return out;
  }

  for (const part of (match[1] || "").split("|")) {
    const trimmed = part.trim();

    if (!trimmed) {
      continue;
    }

    const separator = trimmed.includes("=") ? "=" : trimmed.includes(":") ? ":" : null;

    if (!separator) {
      continue;
    }

    const [key, ...rest] = trimmed.split(separator);
    out[cleanOneLine(key).toLowerCase()] = cleanOneLine(rest.join(separator));
  }

  return out;
}

function digitsList(value: string) {
  return value.match(/\d+/g) ?? [];
}

function firstDigits(value: string) {
  return digitsList(value)[0] ?? "";
}

export function parseEtnopediaTalkWikitext(title: string, wikitext: string): ParsedTalkWikitext {
  void title;

  const stripped = stripNoiseLines(wikitext || "");
  const template = parsePeoplecodeTemplate(stripped);
  let rop3 = "";

  for (const key of ["his rop", "rop3", "rop"]) {
    if (template[key] && firstDigits(template[key])) {
      rop3 = firstDigits(template[key]);
      break;
    }
  }

  if (!rop3) {
    rop3 = /(?:HIS\s+ROP|ROP3)\b[^0-9]*([0-9]+)/i.exec(stripped)?.[1]?.trim() ?? "";
  }

  let peopleid3 = "";

  for (const key of ["peopleid3", "people id3"]) {
    if (template[key] && firstDigits(template[key])) {
      peopleid3 = firstDigits(template[key]);
      break;
    }
  }

  if (!peopleid3) {
    peopleid3 = /\bPeople\s*ID3\b[^0-9]*([0-9]+)/i.exec(stripped)?.[1]?.trim() ?? "";
  }

  let peidList = template.peid ? digitsList(template.peid) : [];

  if (peidList.length === 0) {
    peidList = digitsList(/\bPEID\b[^0-9]*([0-9][0-9;\s,]+)/i.exec(stripped)?.[1] ?? "");
  }

  let wcdprnList = template.wcdprn ? digitsList(template.wcdprn) : [];

  if (wcdprnList.length === 0) {
    wcdprnList = digitsList(/\bWCDPRN\b[^0-9]*([0-9][0-9;\s,]+)/i.exec(stripped)?.[1] ?? "");
  }

  const eupc =
    template.eupc && firstDigits(template.eupc)
      ? firstDigits(template.eupc)
      : /\bEUPC\b[^0-9]*([0-9]+)/i.exec(stripped)?.[1]?.trim() ?? "";
  let profileSources = "";

  for (const key of ["profile sources", "profile source"]) {
    if (template[key]?.trim()) {
      profileSources = cleanOneLine(wikitextToPlain(template[key]));
      break;
    }
  }

  if (!profileSources) {
    profileSources = cleanOneLine(
      wikitextToPlain(/^\s*Profile\s+Sources?\s*[:=]\s*(.+?)\s*$/im.exec(stripped)?.[1] ?? ""),
    );
  }

  const progress = {
    progressJpFile: "",
    progressJpYear: "",
    progressGsecFile: "",
    progressGsecYear: "",
    progressOverallFile: "",
    progressOverallYear: "",
  };

  for (const match of stripped.matchAll(RE_PROGRESS_LINE)) {
    const file = normUFile(match[1] || "");
    const year = (match[2] || "").trim();
    const label = (match[3] || "").toLowerCase();

    if (label.includes("joshua")) {
      progress.progressJpFile = file;
      progress.progressJpYear = year;
    } else if (label.includes("global")) {
      progress.progressGsecFile = file;
      progress.progressGsecYear = year;
    } else if (label.includes("overall")) {
      progress.progressOverallFile = file;
      progress.progressOverallYear = year;
    }
  }

  return {
    rop3,
    peopleid3,
    peidList,
    wcdprnList,
    eupc,
    profileSources,
    ...progress,
  };
}

export function etnopediaPageUrl(title: string) {
  return `https://en.etnopedia.org/wiki/${title.replace(/ /g, "_")}`;
}

function createRecord(input: {
  title: string;
  mainRevision: PageRevision;
  talkRevision: PageRevision;
}) {
  const main = parseEtnopediaMainWikitext(input.title, input.mainRevision.wikitext);
  const talk = parseEtnopediaTalkWikitext(input.title, input.talkRevision.wikitext);

  return {
    title: input.title,
    urls: {
      page: etnopediaPageUrl(input.title),
      talk: etnopediaPageUrl(`Talk:${input.title}`),
    },
    provenance: {
      page: {
        revid: input.mainRevision.revid,
        timestamp: input.mainRevision.timestamp,
      },
      talk: {
        revid: input.talkRevision.revid,
        timestamp: input.talkRevision.timestamp,
      },
    },
    main: {
      photo_file: main.photoFile,
      photo_source: main.photoSource,
      countries: main.countries,
      population_total: main.populationTotal,
      population_by_country: main.populationByCountry,
      religion: main.religion,
      reached: {
        status: main.reachedStatus,
        indicator_file: main.reachedIndicatorFile,
        indicator_code: main.reachedIndicatorCode,
        indicator_level: main.reachedIndicatorLevel,
        year: main.reachedYear,
      },
      alternate_names: main.alternateNames,
      languages: {
        primary: main.primaryLanguage,
        sign: main.signLanguage,
      },
      bible_translation: {
        exists: main.bibleTranslationExists,
        year: main.bibleTranslationYear,
        notes: main.bibleTranslationNotes,
        detail: main.bibleTranslationDetail,
      },
      map: {
        title: main.mapTitle,
        titles: main.mapTitles,
        latitude: main.mapLatitude,
        longitude: main.mapLongitude,
        zoom: main.mapZoom,
        source: main.mapSource,
      },
      references: {
        description: main.referencesDescription,
        statistics: main.referencesStatistics,
      },
      sections: main.sections,
      prayer_points: main.prayerPoints,
    },
    talk: {
      rop3: talk.rop3,
      peopleid3: talk.peopleid3,
      peid_list: talk.peidList,
      wcdprn_list: talk.wcdprnList,
      eupc: talk.eupc,
      profile_sources: talk.profileSources,
      progress: {
        jp: {
          file: talk.progressJpFile,
          year: talk.progressJpYear,
        },
        gsec: {
          file: talk.progressGsecFile,
          year: talk.progressGsecYear,
        },
        overall: {
          file: talk.progressOverallFile,
          year: talk.progressOverallYear,
        },
      },
    },
  } satisfies EtnopediaRecord;
}

function toJson(value: unknown) {
  return JSON.stringify(value);
}

export function etnopediaRecordToRow(record: EtnopediaRecord) {
  const main = record.main;
  const talk = record.talk;

  return {
    title: record.title,
    page_url: record.urls.page,
    talk_url: record.urls.talk,
    page_revid: record.provenance.page.revid ? String(record.provenance.page.revid) : "",
    page_timestamp: record.provenance.page.timestamp,
    talk_revid: record.provenance.talk.revid ? String(record.provenance.talk.revid) : "",
    talk_timestamp: record.provenance.talk.timestamp,
    photo_file: main.photo_file,
    photo_source: main.photo_source,
    countries: main.countries.join("; "),
    countries_list_json: toJson(main.countries),
    population_total:
      main.population_total === null || main.population_total === undefined
        ? ""
        : String(main.population_total),
    population_by_country_json: toJson(main.population_by_country),
    primary_or_principal_religion: main.religion,
    reached_status: main.reached.status,
    reached_indicator_file: main.reached.indicator_file,
    reached_indicator_code: main.reached.indicator_code,
    reached_indicator_level: main.reached.indicator_level,
    reached_year: main.reached.year,
    alternate_names: main.alternate_names.join("; "),
    alternate_names_list_json: toJson(main.alternate_names),
    primary_language: main.languages.primary,
    sign_language: main.languages.sign,
    bible_translation_exists: main.bible_translation.exists,
    bible_translation_year: main.bible_translation.year,
    bible_translation_notes: main.bible_translation.notes,
    bible_translation_detail: main.bible_translation.detail,
    map_title: main.map.title,
    map_titles_json: toJson(main.map.titles),
    map_latitude: main.map.latitude,
    map_longitude: main.map.longitude,
    map_zoom: main.map.zoom,
    map_source: main.map.source,
    references_description: main.references.description,
    references_statistics: main.references.statistics,
    sections_json: toJson(main.sections),
    prayer_points_json: toJson(main.prayer_points),
    rop3: talk.rop3,
    peopleid3: talk.peopleid3,
    peid_list_json: toJson(talk.peid_list),
    wcdprn_list_json: toJson(talk.wcdprn_list),
    eupc: talk.eupc,
    profile_sources: talk.profile_sources,
    progress_jp_file: talk.progress.jp.file,
    progress_jp_year: talk.progress.jp.year,
    progress_gsec_file: talk.progress.gsec.file,
    progress_gsec_year: talk.progress.gsec.year,
    progress_overall_file: talk.progress.overall.file,
    progress_overall_year: talk.progress.overall.year,
  } satisfies Record<(typeof ETNOPEDIA_CSV_COLUMNS)[number], string>;
}

export function etnopediaRecordsToRows(records: EtnopediaRecord[]) {
  return records.map(etnopediaRecordToRow);
}

async function listPeopleTitles(input: {
  requestJson: EtnopediaRequestJson;
  limit?: number | null;
}) {
  const titles: string[] = [];
  let continuation: Record<string, string> = {};

  while (true) {
    const data = asRecord(
      await input.requestJson(
        {
          action: "query",
          format: "json",
          list: "categorymembers",
          cmtitle: ETNOPEDIA_CATEGORY_TITLE,
          cmnamespace: "0",
          cmtype: "page",
          cmlimit: "500",
          ...continuation,
        },
        "GET",
      ),
    );

    const error = asRecord(data.error);

    if (error.code || error.info) {
      throw new Error(`Etnopedia API error: ${asString(error.info) || asString(error.code)}`);
    }

    const categoryMembers = asArray(asRecord(data.query).categorymembers);

    for (const categoryMember of categoryMembers) {
      const title = asString(asRecord(categoryMember).title);

      if (!title) {
        continue;
      }

      titles.push(title);

      if (input.limit && titles.length >= input.limit) {
        return titles.slice(0, input.limit);
      }
    }

    const nextContinuation = asRecord(data.continue);

    if (Object.keys(nextContinuation).length === 0) {
      return titles;
    }

    continuation = Object.fromEntries(
      Object.entries(nextContinuation).map(([key, value]) => [key, String(value)]),
    );
  }
}

async function fetchRevisions(input: {
  requestJson: EtnopediaRequestJson;
  titles: string[];
}) {
  if (input.titles.length === 0) {
    return new Map<string, PageRevision>();
  }

  const data = asRecord(
    await input.requestJson(
      {
        action: "query",
        format: "json",
        prop: "revisions",
        rvslots: "main",
        rvprop: "ids|timestamp|content",
        redirects: "1",
        titles: input.titles.join("|"),
      },
      "POST",
    ),
  );
  const error = asRecord(data.error);

  if (error.code || error.info) {
    throw new Error(`Etnopedia API error: ${asString(error.info) || asString(error.code)}`);
  }

  const pages = asRecord(asRecord(data.query).pages);
  const out = new Map<string, PageRevision>();

  for (const pageValue of Object.values(pages)) {
    const page = asRecord(pageValue);
    const title = asString(page.title);
    const revision = asRecord(asArray(page.revisions)[0]);
    const slots = asRecord(revision.slots);
    const main = asRecord(slots.main);
    const revid = typeof revision.revid === "number" ? revision.revid : null;

    if (!title) {
      continue;
    }

    out.set(title, {
      title,
      wikitext: asString(main["*"]) || asString(main.content),
      revid,
      timestamp: asString(revision.timestamp),
    });
  }

  return out;
}

export async function fetchEtnopediaPeopleGroups(input: {
  requestJson: EtnopediaRequestJson;
  batchSize?: number;
  limit?: number | null;
  log?: (message: string) => void | Promise<void>;
}) {
  const batchSize = input.batchSize ?? ETNOPEDIA_DEFAULT_BATCH_SIZE;
  const records: EtnopediaRecord[] = [];
  const titles = await listPeopleTitles({
    requestJson: input.requestJson,
    limit: input.limit,
  });

  await input.log?.(`Found ${titles.length} Etnopedia people-group titles.`);

  for (let index = 0; index < titles.length; index += batchSize) {
    const chunk = titles.slice(index, index + batchSize);
    const [mainRevisions, talkRevisions] = await Promise.all([
      fetchRevisions({ requestJson: input.requestJson, titles: chunk }),
      fetchRevisions({
        requestJson: input.requestJson,
        titles: chunk.map((title) => `Talk:${title}`),
      }),
    ]);

    for (const title of chunk) {
      const mainRevision =
        mainRevisions.get(title) ??
        ({
          title,
          wikitext: "",
          revid: null,
          timestamp: "",
        } satisfies PageRevision);
      const talkRevision =
        talkRevisions.get(`Talk:${title}`) ??
        ({
          title: `Talk:${title}`,
          wikitext: "",
          revid: null,
          timestamp: "",
        } satisfies PageRevision);

      records.push(
        createRecord({
          title,
          mainRevision,
          talkRevision,
        }),
      );
    }

    await input.log?.(`Processed ${Math.min(index + batchSize, titles.length)}/${titles.length}.`);
  }

  return {
    records,
    rows: etnopediaRecordsToRows(records),
  };
}

export function isEtnopediaApiUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.hostname === "en.etnopedia.org" && url.pathname === "/api.php";
  } catch {
    return false;
  }
}
