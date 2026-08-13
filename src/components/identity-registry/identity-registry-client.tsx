"use client";

import {
  AlertTriangleIcon,
  DownloadIcon,
  Loader2Icon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  AxIdentityAuthorityStatus,
  AxIdentityChangeAction,
  AxIdentityRegistryEntry,
  AxIdentityRunDetail,
  AxIdentityRunSummary,
  AxRegistryRevision,
} from "@/lib/identity-registry";
import { cn } from "@/lib/utils";

type Overview = {
  authority: AxIdentityAuthorityStatus;
  bindings: readonly AxIdentityRegistryEntry[];
  revisions: readonly AxRegistryRevision[];
  runs: readonly AxIdentityRunSummary[];
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function short(value: string | null) {
  return value ? `${value.slice(0, 8)}…` : "—";
}

export function identityRunPublicationState(
  run: Pick<AxIdentityRunSummary, "status" | "isCurrentPublication">,
) {
  if (run.status !== "published") return null;
  return run.isCurrentPublication ? "Current" : "Prior version";
}

async function errorMessage(response: Response, fallback: string) {
  try {
    return ((await response.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

export function IdentityRegistryClient({
  initialOverview,
  initialSelectedRunId,
}: {
  initialOverview: Overview;
  initialSelectedRunId?: string;
}) {
  const [overview, setOverview] = useState(initialOverview);
  const [query, setQuery] = useState("");
  const [publicationId, setPublicationId] = useState("");
  const [selectedRun, setSelectedRun] = useState<AxIdentityRunDetail | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!initialSelectedRunId) return;
    let cancelled = false;

    async function loadRequestedRun() {
      try {
        const response = await fetch(
          `/api/admin/identity-registry/runs/${initialSelectedRunId}`,
        );
        if (cancelled) return;
        if (!response.ok) {
          setError(
            await errorMessage(
              response,
              "Could not load the linked identity candidate.",
            ),
          );
          return;
        }
        setSelectedRun(
          ((await response.json()) as { run: AxIdentityRunDetail }).run,
        );
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load the linked identity candidate.",
          );
        }
      }
    }

    void loadRequestedRun();
    return () => {
      cancelled = true;
    };
  }, [initialSelectedRunId]);
  const filteredBindings = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return overview.bindings;
    return overview.bindings.filter((binding) =>
      [binding.sourceProfileKey, binding.stableRowKey, binding.pgacCode, binding.pgicCode]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [overview.bindings, query]);

  async function refresh() {
    setIsWorking(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/identity-registry");
      if (!response.ok) throw new Error(await errorMessage(response, "Could not refresh the registry."));
      setOverview((await response.json()) as Overview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not refresh the registry.");
    } finally {
      setIsWorking(false);
    }
  }

  async function buildCandidate() {
    if (!publicationId.trim()) return;
    setIsWorking(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/identity-registry/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePublicationId: publicationId.trim() }),
      });
      if (!response.ok) throw new Error(await errorMessage(response, "Could not build the identity candidate."));
      const payload = (await response.json()) as { run: AxIdentityRunDetail };
      setSelectedRun(payload.run);
      setPublicationId("");
      setMessage("Identity candidate built. Review its findings before publication.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not build the identity candidate.");
    } finally {
      setIsWorking(false);
    }
  }

  async function rebuildReviewedCandidate() {
    if (!selectedRun) return;
    setIsWorking(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/identity-registry/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePublicationId: selectedRun.sourcePublicationId,
          reviewRunId: selectedRun.id,
        }),
      });
      if (!response.ok) {
        throw new Error(await errorMessage(response, "Could not rebuild the reviewed candidate."));
      }
      setSelectedRun(((await response.json()) as { run: AxIdentityRunDetail }).run);
      setMessage("Reviewed identity decisions were applied to a new immutable candidate.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not rebuild the reviewed candidate.");
    } finally {
      setIsWorking(false);
    }
  }

  async function reviewDecision(decisionId: string, action: AxIdentityChangeAction) {
    if (!selectedRun) return;
    setIsWorking(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/identity-registry/runs/${selectedRun.id}/decisions/${decisionId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      if (!response.ok) {
        throw new Error(await errorMessage(response, "Could not record the identity decision."));
      }
      setSelectedRun(((await response.json()) as { run: AxIdentityRunDetail }).run);
      setMessage("Identity change decision recorded immutably.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record the identity decision.");
    } finally {
      setIsWorking(false);
    }
  }

  async function openRun(runId: string) {
    setError(null);
    const response = await fetch(`/api/admin/identity-registry/runs/${runId}`);
    if (!response.ok) {
      setError(await errorMessage(response, "Could not load the identity candidate."));
      return;
    }
    setSelectedRun(((await response.json()) as { run: AxIdentityRunDetail }).run);
  }

  async function decide(action: "publish" | "reject") {
    if (!selectedRun) return;
    const reason = window.prompt(
      action === "publish" ? "Why are you publishing this identity revision?" : "Why are you rejecting this candidate?",
    )?.trim();
    if (!reason) return;
    setIsWorking(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/identity-registry/runs/${selectedRun.id}/${action}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) },
      );
      if (!response.ok) throw new Error(await errorMessage(response, `Could not ${action} the candidate.`));
      setMessage(action === "publish" ? "Identity revision published." : "Identity candidate rejected.");
      setSelectedRun(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not ${action} the candidate.`);
    } finally {
      setIsWorking(false);
    }
  }

  const blockingRuns = overview.runs.filter((run) => run.errorCount > 0).length;

  return (
    <div className="space-y-6">
      {error ? <Alert variant="destructive"><AlertTriangleIcon /><AlertTitle>Registry action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      {message ? <Alert><AlertTitle>Updated</AlertTitle><AlertDescription>{message}</AlertDescription></Alert> : null}
      {!overview.authority.initialized ? <Alert><AlertTriangleIcon /><AlertTitle>Fresh identity authority is not initialized</AlertTitle><AlertDescription>Identity allocation and publication remain disabled. A super administrator must complete the state-bound CLI dry-run and commit procedure; there is intentionally no browser activation control.</AlertDescription></Alert> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Registry summary">
        <Card><CardHeader><CardDescription>Active bindings</CardDescription><CardTitle>{overview.bindings.length.toLocaleString()}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Authority</CardDescription><CardTitle>{overview.authority.initialized ? `Revision #${overview.authority.revisionNumber}` : "Inactive"}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Candidate runs</CardDescription><CardTitle>{overview.runs.length.toLocaleString()}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Runs with conflicts</CardDescription><CardTitle>{blockingRuns.toLocaleString()}</CardTitle></CardHeader></Card>
      </section>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div><CardTitle>Build identity candidate</CardTitle><CardDescription>Use the immutable publication ID from a formed Tier 1 source. The current exact registry revision and Country/ROP resource versions are pinned when the build starts.</CardDescription></div>
          <Button variant="outline" onClick={refresh} disabled={isWorking}><RefreshCwIcon /> Refresh</Button>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2"><Label htmlFor="source-publication-id">Formed publication ID</Label><Input id="source-publication-id" value={publicationId} onChange={(event) => setPublicationId(event.target.value)} placeholder="00000000-0000-4000-8000-000000000000" /></div>
          <Button onClick={buildCandidate} disabled={isWorking || !overview.authority.initialized || !publicationId.trim()}>{isWorking ? <Loader2Icon className="animate-spin" /> : null} Build candidate</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Registry</CardTitle><CardDescription>Search the current canonical PGAC/PGIC bindings by source, stable row key, or code.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-xl"><SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search registry" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search source key or AX code" /></div>
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Stable row</TableHead><TableHead>PGAC</TableHead><TableHead>PGIC</TableHead><TableHead>Revision</TableHead></TableRow></TableHeader><TableBody>
            {filteredBindings.length ? filteredBindings.map((binding) => <TableRow key={binding.bindingId}><TableCell>{binding.sourceProfileKey}</TableCell><TableCell className="font-mono text-xs">{binding.stableRowKey}</TableCell><TableCell className="font-mono">{binding.pgacCode}</TableCell><TableCell className="font-mono">{binding.pgicCode ?? "—"}</TableCell><TableCell className="font-mono text-xs">{short(binding.activatedRevisionId)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No matching active bindings.</TableCell></TableRow>}
          </TableBody></Table></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Candidate and publication history</CardTitle><CardDescription>Select a row to inspect assignment counts, conflicts, and immutable publication anchors.</CardDescription></CardHeader>
        <CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Created</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead>Assigned</TableHead><TableHead>Conflicts</TableHead><TableHead>Revision</TableHead></TableRow></TableHeader><TableBody>
          {overview.runs.length ? overview.runs.map((run) => <TableRow key={run.id} tabIndex={0} role="button" data-smoke-trigger="identity-registry-run-detail" className="cursor-pointer" onClick={() => void openRun(run.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") void openRun(run.id); }}><TableCell>{formatDate(run.createdAt)}</TableCell><TableCell>{run.sourceProfileKey}</TableCell><TableCell><div className="flex flex-wrap gap-2"><Badge variant={run.status === "published" ? "default" : run.errorCount ? "destructive" : "outline"}>{run.status}</Badge>{identityRunPublicationState(run) ? <Badge variant="outline">{identityRunPublicationState(run)}</Badge> : null}</div></TableCell><TableCell>{((run.outputRowCount ?? 0) - run.conflictCount - run.unassignableCount).toLocaleString()}</TableCell><TableCell>{(run.conflictCount + run.unassignableCount).toLocaleString()}</TableCell><TableCell className="font-mono text-xs">{short(run.registryRevisionId)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No identity candidates yet.</TableCell></TableRow>}
        </TableBody></Table></div></CardContent>
      </Card>

      <Sheet open={Boolean(selectedRun)} onOpenChange={(open) => { if (!open) setSelectedRun(null); }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[50vw]" data-smoke-surface="identity-registry-run-detail" data-smoke-ready="identity-registry-run-detail">
          {selectedRun ? <><SheetHeader><SheetTitle>Identity candidate</SheetTitle><SheetDescription>Built {formatDate(selectedRun.createdAt)} from publication {short(selectedRun.sourcePublicationId)}.</SheetDescription></SheetHeader><div className="space-y-6 px-4 pb-6">
            <div className="grid grid-cols-2 gap-3"><Card><CardHeader><CardDescription>Status</CardDescription><CardTitle className="text-xl">{identityRunPublicationState(selectedRun) ?? selectedRun.status}</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>Output rows</CardDescription><CardTitle className="text-xl">{selectedRun.outputRowCount ?? "—"}</CardTitle></CardHeader></Card></div>
            <div className="grid grid-cols-2 gap-2 text-sm"><span>Reused: {selectedRun.reusedCount}</span><span>Reserved: {selectedRun.reservedCount}</span><span>Review required: {selectedRun.decisions.filter((decision) => !decision.selectedAction).length}</span><span>Blocking: {selectedRun.conflictCount + selectedRun.unassignableCount}</span></div>
            {selectedRun.findings.length ? <Alert variant="destructive"><AlertTriangleIcon /><AlertTitle>{selectedRun.findings.length} finding(s)</AlertTitle><AlertDescription><ul className="list-disc pl-5">{selectedRun.findings.slice(0, 20).map((finding, index) => <li key={`${finding.ruleCode}-${index}`}>{finding.message}</li>)}</ul></AlertDescription></Alert> : null}
            {selectedRun.decisions.length ? <div className="space-y-3"><h3 className="font-semibold">Identity-component decisions</h3>{selectedRun.decisions.map((decision) => <Card key={decision.id}><CardHeader><CardTitle className="text-base">{decision.stableRowKey}</CardTitle><CardDescription>Current and proposed evidence must be resolved explicitly. Source-supplied AX codes are not evidence.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid gap-3 text-xs lg:grid-cols-2"><pre className="overflow-auto rounded-md border p-3">{JSON.stringify(decision.currentEvidence, null, 2)}</pre><pre className="overflow-auto rounded-md border p-3">{JSON.stringify(decision.proposedEvidence, null, 2)}</pre></div>{decision.selectedAction ? <Badge variant="outline">Reviewed: {decision.selectedAction}</Badge> : <div className="flex flex-wrap gap-2">{decision.allowedActions.map((action) => <Button key={action} size="sm" variant="outline" disabled={isWorking} onClick={() => void reviewDecision(decision.id, action)}>{action}</Button>)}</div>}</CardContent></Card>) }{selectedRun.decisions.every((decision) => decision.selectedAction) ? <Button disabled={isWorking} onClick={() => void rebuildReviewedCandidate()}>{isWorking ? <Loader2Icon className="animate-spin" /> : null} Build reviewed candidate</Button> : null}</div> : null}
            <div className="flex flex-wrap gap-2"><a className={cn(buttonVariants({ variant: "outline" }))} href={`/api/admin/identity-registry/runs/${selectedRun.id}/download?kind=csv`}><DownloadIcon /> CSV</a><a className={cn(buttonVariants({ variant: "outline" }))} href={`/api/admin/identity-registry/runs/${selectedRun.id}/download?kind=manifest`}><DownloadIcon /> Manifest</a>{selectedRun.status === "valid" ? <Button onClick={() => void decide("publish")} disabled={isWorking}>Publish revision</Button> : null}{["building", "valid", "invalid"].includes(selectedRun.status) ? <Button variant="destructive" onClick={() => void decide("reject")} disabled={isWorking}>Reject</Button> : null}</div>
          </div></> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
