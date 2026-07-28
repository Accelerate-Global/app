"use client";

import { DownloadIcon, SearchIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ReferenceResourceLifecycle } from "@/components/dashboard/reference-resource-lifecycle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  EngagementMappingRow,
  JpPeopleId3Row,
  PeidRow,
  PipelineResourceEntryByKey,
  PipelineResourceKey,
  SourceAliasRow,
  Tier1MergePriorityRow,
} from "@/lib/reference-resources/pipeline-types";
import type { ReferenceResourceVersionSummary } from "@/lib/reference-resources/types";

type PipelineResourceEntry = PipelineResourceEntryByKey[PipelineResourceKey];

type EntriesPayload = {
  entries: PipelineResourceEntry[];
  nextCursor: string | null;
};

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "secondary" : "outline"}>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

function ParentStatus({
  status,
  reason,
}: {
  status: "linked" | "approved-missing";
  reason: string | null;
}) {
  return (
    <div className="space-y-1">
      <span>{status === "linked" ? "Linked" : "Approved missing"}</span>
      {reason ? (
        <span className="block max-w-72 text-xs text-muted-foreground">
          {reason}
        </span>
      ) : null}
    </div>
  );
}

function ResourceTable({
  resourceKey,
  entries,
}: {
  resourceKey: PipelineResourceKey;
  entries: PipelineResourceEntry[];
}) {
  if (resourceKey === "source-aliases") {
    const rows = entries as SourceAliasRow[];
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead>Field ID</TableHead>
            <TableHead>Initials</TableHead>
            <TableHead>Accepted aliases</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.fieldId}>
              <TableCell className="min-w-64 whitespace-normal">
                <span className="block font-medium">{row.displayName}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {row.canonicalSourceKey}
                </span>
              </TableCell>
              <TableCell className="font-mono text-xs">{row.fieldId}</TableCell>
              <TableCell className="font-mono text-xs">{row.initials}</TableCell>
              <TableCell className="min-w-56 whitespace-normal">
                {row.aliases.join(", ")}
              </TableCell>
              <TableCell><ActiveBadge active={row.active} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (resourceKey === "jp-peopleid3") {
    const rows = entries as JpPeopleId3Row[];
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PeopleID3</TableHead>
            <TableHead>ROP3</TableHead>
            <TableHead>ISO3</TableHead>
            <TableHead>Parent relationship</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.peopleId3}>
              <TableCell className="font-mono">{row.peopleId3}</TableCell>
              <TableCell className="font-mono">{row.rop3 ?? "Not listed"}</TableCell>
              <TableCell className="font-mono">{row.iso3 ?? "Not listed"}</TableCell>
              <TableCell>
                <ParentStatus
                  status={row.parentStatus}
                  reason={row.missingParentReason}
                />
              </TableCell>
              <TableCell><ActiveBadge active={row.active} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (resourceKey === "peid") {
    const rows = entries as PeidRow[];
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PEID</TableHead>
            <TableHead>People</TableHead>
            <TableHead>ISO3</TableHead>
            <TableHead>ROP3</TableHead>
            <TableHead>ROP1</TableHead>
            <TableHead>Parent relationship</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.peid}>
              <TableCell className="font-mono">{row.peid}</TableCell>
              <TableCell className="min-w-52 whitespace-normal font-medium">
                {row.peopleName}
              </TableCell>
              <TableCell className="font-mono">{row.iso3 ?? "Not listed"}</TableCell>
              <TableCell className="font-mono">{row.rop3 ?? "Not listed"}</TableCell>
              <TableCell className="font-mono">{row.rop1 ?? "Not listed"}</TableCell>
              <TableCell>
                <ParentStatus
                  status={row.parentStatus}
                  reason={row.missingParentReason}
                />
              </TableCell>
              <TableCell><ActiveBadge active={row.active} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (resourceKey === "tier1-merge-priorities") {
    const rows = entries as Tier1MergePriorityRow[];
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Field</TableHead>
            <TableHead>Field ID</TableHead>
            <TableHead>Source priority</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.fieldId}>
              <TableCell className="min-w-64 whitespace-normal">
                <span className="block font-medium">{row.displayName}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {row.canonicalField}
                </span>
              </TableCell>
              <TableCell className="font-mono text-xs">{row.fieldId}</TableCell>
              <TableCell className="min-w-64 whitespace-normal">
                {row.prioritySourceKeys.length > 0
                  ? row.prioritySourceKeys.join(" → ")
                  : "No preferred source"}
              </TableCell>
              <TableCell><ActiveBadge active={row.active} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  const rows = entries as EngagementMappingRow[];
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Source field</TableHead>
          <TableHead>Canonical field</TableHead>
          <TableHead>Display name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Field ID</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.fieldId}>
            <TableCell className="min-w-48 whitespace-normal font-medium">
              {row.sourceField}
            </TableCell>
            <TableCell className="font-mono text-xs">{row.canonicalField}</TableCell>
            <TableCell className="min-w-48 whitespace-normal">{row.displayName}</TableCell>
            <TableCell><Badge variant="outline">{row.dataType}</Badge></TableCell>
            <TableCell className="font-mono text-xs">{row.fieldId}</TableCell>
            <TableCell><ActiveBadge active={row.active} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function PipelineReferenceResourceClient({
  resourceKey,
  initialEntries,
  activeVersion,
  initialNextCursor,
  canManageLifecycle,
}: {
  resourceKey: PipelineResourceKey;
  initialEntries: PipelineResourceEntry[];
  activeVersion: ReferenceResourceVersionSummary;
  initialNextCursor: string | null;
  canManageLifecycle: boolean;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestPage(search: string, cursor?: string) {
    const params = new URLSearchParams({ limit: "100" });
    if (search) params.set("search", search);
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(
      `/api/reference-resources/${resourceKey}/entries?${params.toString()}`,
    );
    if (!response.ok) {
      throw new Error("Could not load resource entries.");
    }
    return (await response.json()) as EntriesPayload;
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;
    const nextSearch = searchInput.trim();
    setIsLoading(true);
    setError(null);
    try {
      const page = await requestPage(nextSearch);
      setEntries(page.entries);
      setNextCursor(page.nextCursor);
      setActiveSearch(nextSearch);
    } catch {
      setError("Could not load matching resource entries. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMore() {
    if (!nextCursor || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const page = await requestPage(activeSearch, nextCursor);
      setEntries((current) => [...current, ...page.entries]);
      setNextCursor(page.nextCursor);
    } catch {
      setError("Could not load more resource entries. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const downloadParams = new URLSearchParams();
  if (activeSearch) downloadParams.set("search", activeSearch);
  const downloadSuffix = downloadParams.size > 0
    ? `?${downloadParams.toString()}`
    : "";

  return (
    <div
      className="space-y-4"
    >
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                {activeVersion.entryCount.toLocaleString()} total entries ·{" "}
                {entries.length.toLocaleString()} shown
              </p>
              {activeSearch ? <p>Filtered by “{activeSearch}”</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                render={
                  <a
                    href={`/api/reference-resources/${resourceKey}/download${downloadSuffix}`}
                    download
                  />
                }
                variant="outline"
              >
                <DownloadIcon /> Download CSV
              </Button>
              {canManageLifecycle ? (
                <ReferenceResourceLifecycle
                  resourceKey={resourceKey}
                  activeVersion={activeVersion}
                  candidate={null}
                />
              ) : null}
            </div>
          </div>

          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={handleSearch}
          >
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search resource entries"
                className="pl-9"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search codes, names, fields, or source values"
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Searching…" : "Search"}
            </Button>
          </form>

          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

          {entries.length > 0 ? (
            <ResourceTable resourceKey={resourceKey} entries={entries} />
          ) : (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              No resource entries match this search.
            </div>
          )}

          {nextCursor ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                onClick={loadMore}
              >
                {isLoading ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
