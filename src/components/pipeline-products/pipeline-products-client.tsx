"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  Loader2Icon,
  RefreshCwIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PipelineRunDetail, PipelineRunSummary, Tier1ReleaseInputKey } from "@/lib/pipeline-products";

type Definition = {
  key: string;
  stage: "tier1-merge" | "aggregate1";
  displayName: string;
  version: string;
  checksum: string;
  requiredInputKeys: readonly string[];
  outputClassification: "PGAC" | "PGIC";
  publicationTargetKey: string;
};

type IdentityPublication = {
  id: string;
  sourceProfileKey: string | null;
  suggestedInputKey: Tier1ReleaseInputKey | null;
  registryRevisionId: string | null;
  outputChecksum: string;
  rowCount: number;
  rowsPresent: boolean;
  createdAt: string;
};

type Release = {
  id: string;
  releaseKey: string;
  resourceSetId: string;
  registryRevisionId: string;
  ruleVersion: string;
  ruleChecksum: string;
  status: string;
  canonicalChecksum: string | null;
  isSuperseded: boolean;
  finalizedAt: string | null;
  createdAt: string;
};

type Publication = {
  id: string;
  producerDefinitionKey: string | null;
  publicationTargetKey: string | null;
  datasetId: string;
  releaseSetId: string | null;
  registryRevisionId: string | null;
  outputChecksum: string;
  rowCount: number;
  createdAt: string;
};

type Overview = {
  system: {
    resourceSet: { id: string; checksum: string } | null;
    registryRevision: { id: string; revisionNumber: number; checksum: string } | null;
    defaultRuleBinding: {
      version: string;
      checksum: string;
      priorities: readonly { canonicalField: string; prioritySourceKeys: readonly string[] }[];
    };
  };
  definitions: readonly Definition[];
  eligibleIdentityPublications: readonly IdentityPublication[];
  releases: readonly Release[];
  publications: readonly Publication[];
  runs: readonly PipelineRunSummary[];
};

const INPUT_KEYS = ["ax", "etno", "imb", "jp", "wcd"] as const;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function short(value: string | null) {
  return value ? `${value.slice(0, 8)}…` : "—";
}

async function responseError(response: Response, fallback: string) {
  try {
    return ((await response.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

function defaultSelections(overview: Overview) {
  return Object.fromEntries(INPUT_KEYS.map((key) => {
    const publication = overview.eligibleIdentityPublications.find((candidate) =>
      candidate.suggestedInputKey === key
      && candidate.rowsPresent
      && candidate.registryRevisionId === overview.system.registryRevision?.id,
    );
    return [key, publication?.id ?? ""];
  })) as Record<Tier1ReleaseInputKey, string>;
}

export function PipelineProductsClient({ initialOverview }: { initialOverview: Overview }) {
  const [overview, setOverview] = useState(initialOverview);
  const [selections, setSelections] = useState(() => defaultSelections(initialOverview));
  const [releaseKey, setReleaseKey] = useState("tier1-release");
  const [releaseReason, setReleaseReason] = useState("Reviewed exact Tier 1 source publications and bindings.");
  const [definitionKey, setDefinitionKey] = useState(initialOverview.definitions[0]?.key ?? "");
  const [releaseSetId, setReleaseSetId] = useState(initialOverview.releases.find((release) => release.status === "finalized")?.id ?? "");
  const [parentPublicationId, setParentPublicationId] = useState("");
  const [selectedRun, setSelectedRun] = useState<PipelineRunDetail | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedDefinition = overview.definitions.find((definition) => definition.key === definitionKey) ?? null;
  const compatibleParents = useMemo(() => {
    const required = selectedDefinition?.stage === "aggregate1" ? selectedDefinition.requiredInputKeys[0] : null;
    return required ? overview.publications.filter((publication) => publication.publicationTargetKey === required) : [];
  }, [overview.publications, selectedDefinition]);

  async function refresh() {
    const response = await fetch("/api/admin/pipeline-products");
    if (!response.ok) throw new Error(await responseError(response, "Could not refresh pipeline operations."));
    const next = (await response.json()) as Overview;
    setOverview(next);
    return next;
  }

  async function perform(action: () => Promise<void>) {
    setIsWorking(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pipeline action failed.");
    } finally {
      setIsWorking(false);
    }
  }

  function updateDefinition(value: string) {
    setDefinitionKey(value);
    setParentPublicationId("");
  }

  async function finalizeRelease() {
    await perform(async () => {
      const resourceSet = overview.system.resourceSet;
      const registryRevision = overview.system.registryRevision;
      if (!resourceSet || !registryRevision) throw new Error("Current resources and an AX registry revision are required.");
      const members = INPUT_KEYS.map((inputKey) => {
        const publication = overview.eligibleIdentityPublications.find((candidate) => candidate.id === selections[inputKey]);
        if (!publication) throw new Error(`Select a ${inputKey.toUpperCase()} identity publication.`);
        return { inputKey, publicationId: publication.id, expectedChecksum: publication.outputChecksum };
      });
      const response = await fetch("/api/admin/pipeline-products/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          releaseKey,
          resourceSetId: resourceSet.id,
          registryRevisionId: registryRevision.id,
          ruleVersion: overview.system.defaultRuleBinding.version,
          ruleChecksum: overview.system.defaultRuleBinding.checksum,
          priorities: overview.system.defaultRuleBinding.priorities,
          members,
          reason: releaseReason,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Could not finalize the release."));
      const next = await refresh();
      setReleaseSetId(next.releases[0]?.id ?? "");
      setMessage("Tier 1 release finalized. Its source publications and rules are now immutable.");
    });
  }

  async function buildProduct() {
    if (!selectedDefinition) return;
    await perform(async () => {
      const response = await fetch("/api/admin/pipeline-products/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          definitionKey: selectedDefinition.key,
          releaseSetId: selectedDefinition.stage === "tier1-merge" ? releaseSetId : null,
          parentPublicationId: selectedDefinition.stage === "aggregate1" ? parentPublicationId : null,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Could not build the product candidate."));
      const payload = (await response.json()) as { run: PipelineRunDetail };
      setSelectedRun(payload.run);
      setMessage("Candidate built from exact retained inputs. Review findings and evidence before publishing.");
      await refresh();
    });
  }

  async function openRun(runId: string) {
    await perform(async () => {
      const response = await fetch(`/api/admin/pipeline-products/runs/${runId}`);
      if (!response.ok) throw new Error(await responseError(response, "Could not load the pipeline candidate."));
      setSelectedRun(((await response.json()) as { run: PipelineRunDetail }).run);
      setDecisionReason("");
      setAcknowledgeWarnings(false);
    });
  }

  async function decide(action: "publish" | "reject") {
    if (!selectedRun || !decisionReason.trim()) return;
    await perform(async () => {
      const expectedCurrentPublicationId = selectedRun.expectedCurrentPublicationId;
      const response = await fetch(`/api/admin/pipeline-products/runs/${selectedRun.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: decisionReason.trim(),
          acknowledgeWarnings,
          ...(action === "publish" ? { expectedCurrentPublicationId } : {}),
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, `Could not ${action} the candidate.`));
      setSelectedRun(null);
      setMessage(action === "publish" ? "Product published to its stable dataset target." : "Candidate rejected with retained audit history.");
      await refresh();
    });
  }

  const releaseReady = Boolean(
    overview.system.resourceSet
    && overview.system.registryRevision
    && releaseKey.trim()
    && releaseReason.trim()
    && INPUT_KEYS.every((key) => selections[key]),
  );
  const buildReady = Boolean(
    selectedDefinition
    && (selectedDefinition.stage === "tier1-merge" ? releaseSetId : parentPublicationId),
  );

  return (
    <div className="space-y-6">
      {error ? <Alert variant="destructive"><AlertTriangleIcon /><AlertTitle>Pipeline action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      {message ? <Alert><CheckCircle2Icon /><AlertTitle>Updated</AlertTitle><AlertDescription>{message}</AlertDescription></Alert> : null}

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Pipeline readiness">
        <Card><CardHeader><CardDescription>Reference set</CardDescription><CardTitle className="text-xl">{overview.system.resourceSet ? short(overview.system.resourceSet.id) : "Unavailable"}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>AX registry revision</CardDescription><CardTitle className="text-xl">{overview.system.registryRevision ? `#${overview.system.registryRevision.revisionNumber}` : "Unavailable"}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Finalized releases</CardDescription><CardTitle className="text-xl">{overview.releases.filter((release) => release.status === "finalized").length}</CardTitle></CardHeader></Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>1. Finalize a Tier 1 release</CardTitle>
          <CardDescription>Select one identity-enriched publication for every source. Finalization pins all five inputs, current resources, the AX registry revision, and the priority rule binding.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="pipeline-release-key">Release key</Label><Input id="pipeline-release-key" value={releaseKey} onChange={(event) => setReleaseKey(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="pipeline-release-reason">Finalization reason</Label><Input id="pipeline-release-reason" value={releaseReason} onChange={(event) => setReleaseReason(event.target.value)} /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {INPUT_KEYS.map((key) => (
              <div className="space-y-2" key={key}>
                <Label htmlFor={`release-input-${key}`}>{key.toUpperCase()}</Label>
                <select id={`release-input-${key}`} className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={selections[key]} onChange={(event) => setSelections((current) => ({ ...current, [key]: event.target.value }))}>
                  <option value="">Select publication</option>
                  {overview.eligibleIdentityPublications.filter((candidate) => candidate.suggestedInputKey === key).map((publication) => (
                    <option key={publication.id} value={publication.id} disabled={!publication.rowsPresent}>{formatDate(publication.createdAt)} · {publication.rowCount.toLocaleString()} rows</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <Button onClick={() => void finalizeRelease()} disabled={isWorking || !releaseReady}>{isWorking ? <Loader2Icon className="animate-spin" /> : null} Finalize release</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle>2. Build a product candidate</CardTitle><CardDescription>Build from one exact release or one exact published parent. Existing publications remain unchanged until you explicitly publish.</CardDescription></div><Button variant="outline" onClick={() => void perform(async () => { await refresh(); setMessage("Pipeline state refreshed."); })} disabled={isWorking}><RefreshCwIcon /> Refresh</Button></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-2"><Label htmlFor="pipeline-definition">Product</Label><select id="pipeline-definition" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={definitionKey} onChange={(event) => updateDefinition(event.target.value)}>{overview.definitions.map((definition) => <option key={definition.key} value={definition.key}>{definition.displayName} · {definition.version}</option>)}</select></div>
          {selectedDefinition?.stage === "tier1-merge" ? <div className="space-y-2"><Label htmlFor="pipeline-release">Finalized release</Label><select id="pipeline-release" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={releaseSetId} onChange={(event) => setReleaseSetId(event.target.value)}><option value="">Select release</option>{overview.releases.filter((release) => release.status === "finalized").map((release) => <option key={release.id} value={release.id}>{release.releaseKey} · {formatDate(release.finalizedAt)}{release.isSuperseded ? " · newer source available" : ""}</option>)}</select></div> : <div className="space-y-2"><Label htmlFor="pipeline-parent">Exact parent publication</Label><select id="pipeline-parent" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={parentPublicationId} onChange={(event) => setParentPublicationId(event.target.value)}><option value="">Select parent</option>{compatibleParents.map((publication) => <option key={publication.id} value={publication.id}>{formatDate(publication.createdAt)} · {publication.rowCount.toLocaleString()} rows · {short(publication.outputChecksum)}</option>)}</select></div>}
          <Button onClick={() => void buildProduct()} disabled={isWorking || !buildReady}>{isWorking ? <Loader2Icon className="animate-spin" /> : null} Build candidate</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Product history</CardTitle><CardDescription>Select a candidate to inspect findings, lineage, side-by-side differences, evidence downloads, and publication controls.</CardDescription></CardHeader>
        <CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Built</TableHead><TableHead>Product</TableHead><TableHead>Status</TableHead><TableHead>Rows</TableHead><TableHead>Findings</TableHead><TableHead>Freshness</TableHead></TableRow></TableHeader><TableBody>
          {overview.runs.length ? overview.runs.map((run) => <TableRow key={run.id} role="button" tabIndex={0} className="cursor-pointer" data-smoke-trigger="pipeline-product-run-detail" onClick={() => void openRun(run.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") void openRun(run.id); }}><TableCell>{formatDate(run.createdAt)}</TableCell><TableCell>{run.definitionName}<span className="block text-xs text-muted-foreground">{run.definitionVersion}</span></TableCell><TableCell><Badge variant={run.status === "published" ? "default" : run.errorCount > 0 || run.status === "failed" ? "destructive" : "outline"}>{run.status}</Badge></TableCell><TableCell>{run.outputRowCount?.toLocaleString() ?? "—"}</TableCell><TableCell>{run.warningCount} warnings · {run.errorCount} errors</TableCell><TableCell>{run.isOutOfDate ? <Badge variant="secondary">Out of date</Badge> : "Current input lineage"}</TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No product candidates yet.</TableCell></TableRow>}
        </TableBody></Table></div></CardContent>
      </Card>

      <Sheet open={Boolean(selectedRun)} onOpenChange={(open) => { if (!open) setSelectedRun(null); }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[50vw]" data-smoke-surface="pipeline-product-run-detail" data-smoke-ready="pipeline-product-run-detail">
          {selectedRun ? <><SheetHeader><SheetTitle>{selectedRun.definitionName}</SheetTitle><SheetDescription>Candidate {short(selectedRun.id)} built {formatDate(selectedRun.createdAt)} from exact immutable input publications.</SheetDescription></SheetHeader><div className="space-y-6 px-4 pb-6">
            <div className="grid gap-3 sm:grid-cols-3"><Card><CardHeader><CardDescription>Status</CardDescription><CardTitle className="text-lg">{selectedRun.status}</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>Output</CardDescription><CardTitle className="text-lg">{selectedRun.outputRowCount?.toLocaleString() ?? "—"}</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>Findings</CardDescription><CardTitle className="text-lg">{selectedRun.warningCount + selectedRun.errorCount}</CardTitle></CardHeader></Card></div>
            {selectedRun.isOutOfDate ? <Alert><AlertTriangleIcon /><AlertTitle>Inputs have advanced</AlertTitle><AlertDescription>This candidate remains exactly reproducible, but at least one newer parent publication exists. Build a new candidate before choosing which output to publish.</AlertDescription></Alert> : null}
            <div className="space-y-2"><h3 className="font-semibold">Exact inputs</h3>{selectedRun.inputs.map((binding) => <div key={binding.inputKey} className="grid grid-cols-[7rem_1fr_auto] gap-2 border-b py-2 text-sm"><strong>{binding.inputKey}</strong><span className="font-mono text-xs">{binding.publicationId}</span><span>{binding.rowCount.toLocaleString()} rows</span></div>)}</div>
            <div className="space-y-2"><h3 className="font-semibold">Findings</h3>{selectedRun.findings.length ? <ul className="space-y-2">{selectedRun.findings.map((finding, index) => <li key={`${finding.ruleCode}-${index}`} className="rounded-lg border p-3 text-sm"><Badge variant={finding.severity === "error" ? "destructive" : "secondary"}>{finding.severity}</Badge><strong className="ml-2">{finding.ruleCode}</strong><p className="mt-2 text-muted-foreground">{finding.message}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">No validation findings.</p>}</div>
            <div className="flex flex-wrap gap-2"><a className={buttonVariants({ variant: "outline" })} href={`/api/admin/pipeline-products/runs/${selectedRun.id}/download?kind=rows-csv`}><DownloadIcon /> Rows CSV</a><a className={buttonVariants({ variant: "outline" })} href={`/api/admin/pipeline-products/runs/${selectedRun.id}/download?kind=findings-json`}><DownloadIcon /> Findings</a><a className={buttonVariants({ variant: "outline" })} href={`/api/admin/pipeline-products/runs/${selectedRun.id}/download?kind=lineage-json`}><DownloadIcon /> Lineage</a><a className={buttonVariants({ variant: "outline" })} href={`/api/admin/pipeline-products/runs/${selectedRun.id}/download?kind=comparison-json`}><DownloadIcon /> Comparison</a></div>
            {selectedRun.status === "valid" || selectedRun.status === "invalid" ? <div className="space-y-3 rounded-xl border p-4"><Label htmlFor="pipeline-decision-reason">Review reason</Label><Input id="pipeline-decision-reason" value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} placeholder="Record why this candidate is being published or rejected" />{selectedRun.warningCount > 0 && selectedRun.status === "valid" ? <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={acknowledgeWarnings} onChange={(event) => setAcknowledgeWarnings(event.target.checked)} className="mt-1" />I reviewed and acknowledge all candidate warnings.</label> : null}<div className="flex gap-2">{selectedRun.status === "valid" ? <Button onClick={() => void decide("publish")} disabled={isWorking || !decisionReason.trim() || (selectedRun.warningCount > 0 && !acknowledgeWarnings)}>Publish to stable target</Button> : null}<Button variant="destructive" onClick={() => void decide("reject")} disabled={isWorking || !decisionReason.trim()}>Reject candidate</Button></div></div> : null}
          </div></> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
