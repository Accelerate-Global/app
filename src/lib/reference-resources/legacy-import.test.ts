import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { validatePipelineResource } from "./pipeline-adapters";
import {
  ExactLegacyResourceImportError,
  parseExactLegacyPipelineResource,
  readExactLegacyPipelineResourceFile,
} from "./legacy-import";
import {
  JP_PEOPLE_ID3_RESOURCE_KEY,
  PEID_RESOURCE_KEY,
  SOURCE_ALIASES_RESOURCE_KEY,
  TIER1_MERGE_PRIORITIES_RESOURCE_KEY,
} from "./pipeline-types";

const retrievedAt = "2026-03-30T20:41:17.000Z";
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("exact legacy pipeline resource import", () => {
  it("handles the source registry's mixed newlines, short rows, and blank placeholders", () => {
    const resource = parseExactLegacyPipelineResource({
      resourceKey: SOURCE_ALIASES_RESOURCE_KEY,
      sourceRetrievedAt: retrievedAt,
      body: [
        "Field ID,Database Name,Initials,Alt Name 1,Alt Name 2,Alt Name 3,Alt Name 4\r\n",
        "F_2,Joshua Project,jp,jp\n",
        "F_3,IMB,im,imb,people groups\r\n",
        "F_12\n",
      ].join(""),
    });

    expect(resource.entries).toHaveLength(2);
    expect(resource.entries[1]).toMatchObject({
      canonicalSourceKey: "im",
      aliases: ["imb", "people groups"],
    });
  });

  it("turns unavailable legacy ROP relationships into explicit bounded warnings", () => {
    const context = {
      knownRop3Codes: new Set(["100001"]),
      knownRop1Codes: new Set(["A013"]),
      knownIso3Codes: new Set(["AGO"]),
    };
    const people = parseExactLegacyPipelineResource({
      resourceKey: JP_PEOPLE_ID3_RESOURCE_KEY,
      sourceRetrievedAt: retrievedAt,
      body: "PeopleID3,ROP3,ISO3\n900001,999999,AGO\n",
      validationContext: context,
    });
    const peid = parseExactLegacyPipelineResource({
      resourceKey: PEID_RESOURCE_KEY,
      sourceRetrievedAt: retrievedAt,
      body: "PEID,People Name,ISO3,ROP3,ROP1\n800001,Example,AGO,100001,A099\n",
      validationContext: context,
    });

    expect(people.entries[0]).toMatchObject({
      rop3: null,
      parentStatus: "approved-missing",
    });
    expect(people.entries[0]?.missingParentReason).toContain("999999");
    expect(validatePipelineResource(JP_PEOPLE_ID3_RESOURCE_KEY, people, context)).toMatchObject({
      valid: true,
      findings: [expect.objectContaining({
        severity: "warning",
        ruleCode: "approved-bounded-missing-parent",
      })],
    });
    expect(peid.entries[0]).toMatchObject({
      rop3: "100001",
      rop1: null,
      parentStatus: "linked",
    });
    expect(validatePipelineResource(PEID_RESOURCE_KEY, peid, context)).toMatchObject({
      valid: true,
      findings: [expect.objectContaining({
        severity: "warning",
        ruleCode: "missing-rop1-cross-reference",
      })],
    });
  });

  it("preserves first-choice ordering while collapsing synonymous source aliases", () => {
    const aliases = parseExactLegacyPipelineResource({
      resourceKey: SOURCE_ALIASES_RESOURCE_KEY,
      sourceRetrievedAt: retrievedAt,
      body: "Field ID,Database Name,Initials,Alt Name 1,Alt Name 2,Alt Name 3,Alt Name 4\nF_2,Etnopedia,et,ETNO\n",
    });
    const priorities = parseExactLegacyPipelineResource({
      resourceKey: TIER1_MERGE_PRIORITIES_RESOURCE_KEY,
      sourceRetrievedAt: retrievedAt,
      sourceAliases: aliases,
      body: "Field ID,Aggregate 1 (internal),User Interface,Active,Priority #1,Priority #2,Priority #3,Priority #4\nF_2,PG_Name_Main,Name,TRUE,Etnopedia,ETNO\nF_3,Data_Source,Source,TRUE\n",
    });
    const result = validatePipelineResource(
      TIER1_MERGE_PRIORITIES_RESOURCE_KEY,
      priorities,
      {
        knownSourceKeys: new Set(["et"]),
        activeSourceKeys: new Set(["et"]),
      },
    );

    expect(priorities.entries[0]?.prioritySourceKeys).toEqual(["et"]);
    expect(result.valid).toBe(true);
    expect(result.findings).toEqual([
      expect.objectContaining({
        severity: "warning",
        ruleCode: "active-priority-has-no-sources",
      }),
    ]);
  });

  it("requires the caller's exact file checksum and rejects substitutions", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "pipeline-resource-import-"));
    temporaryDirectories.push(directory);
    const relativePath = "resources/source.csv";
    const absolutePath = path.join(directory, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    const body = "Field ID,Database Name,Initials\nF_2,Example,ex\n";
    await writeFile(absolutePath, body, "utf8");
    const sha256 = createHash("sha256").update(body).digest("hex");

    await expect(
      readExactLegacyPipelineResourceFile({
        axDataRoot: directory,
        file: {
          resourceKey: SOURCE_ALIASES_RESOURCE_KEY,
          relativePath,
          sha256,
          sourceRetrievedAt: retrievedAt,
        },
      }),
    ).resolves.toMatchObject({ sourceFileChecksum: sha256, relativePath });

    await expect(
      readExactLegacyPipelineResourceFile({
        axDataRoot: directory,
        file: {
          resourceKey: SOURCE_ALIASES_RESOURCE_KEY,
          relativePath,
          sha256: "f".repeat(64),
          sourceRetrievedAt: retrievedAt,
        },
      }),
    ).rejects.toBeInstanceOf(ExactLegacyResourceImportError);
  });

  it("rejects a symlink that resolves outside the explicit AX Data root", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "pipeline-resource-root-"));
    const outsideDirectory = await mkdtemp(
      path.join(tmpdir(), "pipeline-resource-outside-"),
    );
    temporaryDirectories.push(directory, outsideDirectory);
    const relativePath = "resources/source.csv";
    const linkedPath = path.join(directory, relativePath);
    const outsidePath = path.join(outsideDirectory, "source.csv");
    await mkdir(path.dirname(linkedPath), { recursive: true });
    const body = "Field ID,Database Name,Initials\nF_2,Example,ex\n";
    await writeFile(outsidePath, body, "utf8");
    await symlink(outsidePath, linkedPath);
    const sha256 = createHash("sha256").update(body).digest("hex");

    await expect(
      readExactLegacyPipelineResourceFile({
        axDataRoot: directory,
        file: {
          resourceKey: SOURCE_ALIASES_RESOURCE_KEY,
          relativePath,
          sha256,
          sourceRetrievedAt: retrievedAt,
        },
      }),
    ).rejects.toMatchObject({
      code: "invalid-row",
      message: expect.stringContaining("inside the explicit AX Data root"),
    });
  });
});
