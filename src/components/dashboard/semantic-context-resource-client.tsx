"use client";

import { DownloadIcon, FileCheckIcon, SearchIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ReferenceResourceLifecycle } from "@/components/dashboard/reference-resource-lifecycle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PrivateDataChatSemanticCard } from "@/lib/private-data-chat/semantic-context";
import type {
  ReferenceResourceCandidateResult,
  ReferenceResourceVersionSummary,
} from "@/lib/reference-resources/types";

type EntriesPayload = {
  entries: PrivateDataChatSemanticCard[];
  nextCursor: string | null;
};

export function SemanticContextResourceClient({
  initialEntries,
  activeVersion,
  initialNextCursor,
  canManageLifecycle,
  guidingDocument,
  definitionPackageChecksum,
  initialCandidate,
}: {
  initialEntries: PrivateDataChatSemanticCard[];
  activeVersion: ReferenceResourceVersionSummary;
  initialNextCursor: string | null;
  canManageLifecycle: boolean;
  guidingDocument: string;
  definitionPackageChecksum: string;
  initialCandidate: ReferenceResourceCandidateResult | null;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [document, setDocument] = useState(guidingDocument);
  const [blakeApproved, setBlakeApproved] = useState(false);
  const [candidate, setCandidate] = useState(initialCandidate);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function requestPage(search: string, cursor?: string) {
    const params = new URLSearchParams({ limit: "100" });
    if (search) params.set("search", search);
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(
      `/api/reference-resources/semantic-context-catalog/entries?${params.toString()}`,
    );
    if (!response.ok) throw new Error("Could not load semantic entries.");
    return (await response.json()) as EntriesPayload;
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;
    const search = searchInput.trim();
    setIsLoading(true);
    setError(null);
    try {
      const page = await requestPage(search);
      setEntries(page.entries);
      setNextCursor(page.nextCursor);
      setActiveSearch(search);
    } catch {
      setError("Could not load matching semantic definitions. Please try again.");
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
      setError("Could not load more semantic definitions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function buildCandidate() {
    if (isSaving || !blakeApproved) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        "/api/reference-resources/semantic-context-catalog/guiding-document",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document,
            expectedDefinitionPackageChecksum: definitionPackageChecksum,
            blakeApproved: true,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | (ReferenceResourceCandidateResult & { changedKeys?: string[] })
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(
          payload && "error" in payload && payload.error
            ? payload.error
            : "Could not build the semantic candidate.",
        );
      }
      const nextCandidate = payload as ReferenceResourceCandidateResult & {
        changedKeys?: string[];
      };
      setCandidate(nextCandidate.unchanged ? null : nextCandidate);
      setNotice(
        nextCandidate.unchanged
          ? "The document already matches an immutable semantic version."
          : `${nextCandidate.changedKeys?.length ?? 0} semantic definitions are ready for lifecycle review.`,
      );
    } catch (candidateError) {
      setError(
        candidateError instanceof Error
          ? candidateError.message
          : "Could not build the semantic candidate.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const downloadParams = new URLSearchParams();
  if (activeSearch) downloadParams.set("search", activeSearch);
  const downloadSuffix = downloadParams.size
    ? `?${downloadParams.toString()}`
    : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                {activeVersion.entryCount.toLocaleString()} reviewed definitions ·{" "}
                {entries.length.toLocaleString()} shown
              </p>
              <p className="font-mono text-xs">
                Package {definitionPackageChecksum.slice(0, 12)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                render={
                  <a
                    href={`/api/reference-resources/semantic-context-catalog/download${downloadSuffix}`}
                    download
                  />
                }
                nativeButton={false}
                variant="outline"
              >
                <DownloadIcon /> Download CSV
              </Button>
              {canManageLifecycle ? (
                <ReferenceResourceLifecycle
                  resourceKey="semantic-context-catalog"
                  activeVersion={activeVersion}
                  candidate={candidate}
                />
              ) : null}
            </div>
          </div>

          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSearch}>
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search semantic definitions"
                className="pl-9"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search definitions, aliases, fields, metrics, or filters"
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Searching…" : "Search"}
            </Button>
          </form>

          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Definition</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Authority</TableHead>
                <TableHead>Aliases</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.stableKey}>
                  <TableCell className="min-w-80 whitespace-normal">
                    <span className="block font-medium">{entry.label}</span>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {entry.stableKey}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {entry.definition}
                    </span>
                  </TableCell>
                  <TableCell><Badge variant="outline">{entry.kind}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{entry.queryAuthority}</Badge></TableCell>
                  <TableCell className="max-w-64 whitespace-normal text-sm">
                    {entry.aliases.length ? entry.aliases.join(", ") : "None"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {nextCursor ? (
            <div className="flex justify-center">
              <Button type="button" variant="outline" disabled={isLoading} onClick={loadMore}>
                {isLoading ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canManageLifecycle ? (
        <Card
          data-smoke-surface="semantic-guiding-document"
          data-smoke-ready="semantic-guiding-document"
        >
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Guiding definitions document</h2>
              <p className="text-sm text-muted-foreground">
                Supported Definition and Aliases edits rebuild the structured cards. Checksums,
                query authority, and card identities remain server-controlled.
              </p>
            </div>
            <label className="grid gap-2 text-sm font-medium">
              Reviewed Markdown
              <textarea
                aria-label="Semantic guiding document"
                className="min-h-[32rem] w-full rounded-md border border-input bg-transparent p-3 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={document}
                onChange={(event) => setDocument(event.target.value)}
                spellCheck={false}
              />
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={blakeApproved}
                onCheckedChange={(checked) => setBlakeApproved(checked === true)}
                aria-label="Blake approved semantic edits"
              />
              <span>
                Blake has reviewed and approved these definition or alias edits for candidate
                creation. Activation remains a separate reviewed action.
              </span>
            </label>
            <Button
              type="button"
              disabled={isSaving || !blakeApproved}
              onClick={buildCandidate}
              data-smoke-trigger="semantic-guiding-document"
            >
              <FileCheckIcon /> {isSaving ? "Building candidate…" : "Build reviewed candidate"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
