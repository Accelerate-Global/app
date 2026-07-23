"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  Loader2Icon,
  RefreshCwIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  Tier2AdminOverview,
  Tier2LegacyComparisonArtifact,
} from "@/lib/tier2-products";

type ProductKind = "tier2" | "aggregate2";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Request failed.");
  return body;
}

export function Tier2ProductsAdmin({
  initialOverview,
}: {
  initialOverview: Tier2AdminOverview;
}) {
  const initialProfileId = initialOverview.profiles.find((profile) => profile.active)?.id ?? "";
  const initialSchedule = initialOverview.tier2Schedules.find(
    (schedule) => schedule.sourceProfileId === initialProfileId,
  );
  const [overview, setOverview] = useState(initialOverview);
  const [profileId, setProfileId] = useState(initialProfileId);
  const [scheduleIntervalMinutes, setScheduleIntervalMinutes] = useState(
    String(initialSchedule?.intervalMinutes ?? 60),
  );
  const [scheduleCanaryRunId, setScheduleCanaryRunId] = useState(
    initialSchedule?.manualCanaryRunId ?? "",
  );
  const [profileJson, setProfileJson] = useState("");
  const [resourceKey, setResourceKey] = useState("jp-peopleid3");
  const [resourceJson, setResourceJson] = useState("");
  const [activateImportedResource, setActivateImportedResource] = useState(true);
  const [productKind, setProductKind] = useState<ProductKind>("tier2");
  const [memberIds, setMemberIds] = useState<Record<string, string>>({});
  const [reviewReason, setReviewReason] = useState("Reviewed exact retained evidence and lineage.");
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);
  const [identityRunId, setIdentityRunId] = useState("");
  const [rollbackPublicationId, setRollbackPublicationId] = useState("");
  const [legacyComparisonRunId, setLegacyComparisonRunId] = useState(
    initialOverview.runs[0]?.id ?? "",
  );
  const [legacySnapshotFile, setLegacySnapshotFile] = useState<File | null>(null);
  const [legacyComparison, setLegacyComparison] =
    useState<Tier2LegacyComparisonArtifact | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requiredKeys = useMemo(
    () => productKind === "tier2"
      ? overview.profiles.filter((profile) => profile.active).map((profile) => profile.profileKey).sort()
      : ["tier2", "imb", "jp"],
    [overview.profiles, productKind],
  );

  async function refresh() {
    const next = await jsonRequest<Tier2AdminOverview>("/api/admin/tier2-products/releases");
    setOverview(next);
    return next;
  }

  async function perform(action: () => Promise<string | void>) {
    setIsWorking(true);
    setError(null);
    setMessage(null);
    try {
      setMessage((await action()) ?? "Tier 2 state updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tier 2 action failed.");
    } finally {
      setIsWorking(false);
    }
  }

  function post(url: string, body: unknown) {
    return jsonRequest<unknown>(url, { method: "POST", body: JSON.stringify(body) });
  }

  function launchPartnerFlow() {
    if (!profileId) return;
    void perform(async () => {
      await post("/api/admin/tier2-products/flows", {
        profileId,
        requestId: crypto.randomUUID(),
      });
      return "The selected partner flow was accepted with its exact profile and resource snapshot.";
    });
  }

  function selectProfile(nextProfileId: string) {
    setProfileId(nextProfileId);
    const schedule = overview.tier2Schedules.find(
      (candidate) => candidate.sourceProfileId === nextProfileId,
    );
    setScheduleIntervalMinutes(String(schedule?.intervalMinutes ?? 60));
    setScheduleCanaryRunId(schedule?.manualCanaryRunId ?? "");
  }

  function configurePartnerSchedule(enabled: boolean) {
    if (!profileId || !scheduleCanaryRunId.trim()) return;
    void perform(async () => {
      await jsonRequest(
        "/api/admin/pipeline-operations/schedules/tier2-partner",
        {
          method: "PATCH",
          body: JSON.stringify({
            sourceProfileId: profileId,
            enabled,
            intervalMinutes: Number(scheduleIntervalMinutes),
            canaryRunId: scheduleCanaryRunId.trim(),
          }),
        },
      );
      await refresh();
      return enabled
        ? "This partner schedule is enabled from its successful manual canary."
        : "This partner schedule is disabled; its canary evidence remains retained.";
    });
  }

  function createProfile() {
    void perform(async () => {
      const profile = JSON.parse(profileJson) as unknown;
      await post("/api/admin/tier2-products/profiles", { profile });
      const next = await refresh();
      setProfileId(next.profiles[0]?.id ?? "");
      setProfileJson("");
      return "Partner profile created with a stable Sheet-tab identity.";
    });
  }

  function importResource() {
    void perform(async () => {
      await post("/api/admin/tier2-products/resources", {
        resourceKey,
        payload: JSON.parse(resourceJson) as unknown,
        activate: activateImportedResource,
        reason: reviewReason,
      });
      await refresh();
      setResourceJson("");
      return activateImportedResource
        ? "Validated resource version imported and activated atomically."
        : "Validated resource version imported for later activation.";
    });
  }

  function activateResource(versionId: string, action: "activate" | "rollback" = "activate") {
    void perform(async () => {
      await post("/api/admin/tier2-products/resources", {
        versionId,
        action,
        reason: reviewReason,
      });
      await refresh();
      return action === "rollback" ? "Resource pointer rolled back with audit history." : "Resource activated.";
    });
  }

  function decideForming(formingRunId: string, action: "publish" | "reject") {
    void perform(async () => {
      await post(`/api/admin/tier2-products/forming/${formingRunId}/${action}`, {
        reason: reviewReason,
        acknowledgeWarnings,
      });
      await refresh();
      return action === "publish"
        ? "Forming candidate published; identity reconciliation can now use its exact publication."
        : "Forming candidate rejected with retained evidence.";
    });
  }

  function buildIdentity(formingRunId: string) {
    void perform(async () => {
      const result = await jsonRequest<{ candidate: { id: string } }>(
        "/api/admin/tier2-products/identity",
        { method: "POST", body: JSON.stringify({ formingRunId }) },
      );
      setIdentityRunId(result.candidate.id);
      await refresh();
      return "Identity candidate built. Review it before publication.";
    });
  }

  function decideIdentity(action: "publish" | "reject") {
    if (!identityRunId.trim()) return;
    void perform(async () => {
      await post(`/api/admin/tier2-products/identity/${identityRunId.trim()}/${action}`, {
        reason: reviewReason,
      });
      await refresh();
      return action === "publish" ? "Identity candidate published." : "Identity candidate rejected.";
    });
  }

  function buildRelease() {
    const resourceSetId = overview.system.resourceSet?.id;
    const registryRevisionId = overview.system.registryRevision?.id;
    if (!resourceSetId || !registryRevisionId) return;
    void perform(async () => {
      const members = requiredKeys.map((inputKey) => {
        const publication = overview.eligiblePublications.find(
          (candidate) => candidate.id === memberIds[inputKey],
        );
        if (!publication) throw new Error(`Choose the exact ${inputKey.toUpperCase()} publication.`);
        return {
          inputKey,
          publicationId: publication.id,
          expectedChecksum: publication.outputChecksum,
        };
      });
      await post("/api/admin/tier2-products/releases", {
        productKind,
        resourceSetId,
        registryRevisionId,
        members,
        reason: reviewReason,
      });
      await refresh();
      return `${productKind === "tier2" ? "Tier 2" : "Aggregate 2"} candidate built from exact immutable publications.`;
    });
  }

  function decideProduct(runId: string, action: "publish" | "reject") {
    void perform(async () => {
      await post(`/api/admin/tier2-products/releases/${runId}/${action}`, action === "publish"
        ? {
            acknowledgeWarnings,
            reason: reviewReason,
          }
        : { reason: reviewReason });
      await refresh();
      return action === "publish" ? "Stable product target advanced atomically." : "Product candidate rejected.";
    });
  }

  function rollbackTarget(kind: ProductKind) {
    const target = overview.targets.find((candidate) => candidate.productKind === kind);
    if (!target?.currentPublicationId || !rollbackPublicationId.trim()) return;
    void perform(async () => {
      await post(`/api/admin/tier2-products/targets/${kind}/rollback`, {
        publicationId: rollbackPublicationId.trim(),
        expectedCurrentPublicationId: target.currentPublicationId,
        reason: reviewReason,
      });
      await refresh();
      return "Stable dataset restored from immutable publication evidence; incident version retained.";
    });
  }

  function retainLegacyComparison() {
    if (!legacyComparisonRunId || !legacySnapshotFile) return;
    void perform(async () => {
      const legacy = JSON.parse(await legacySnapshotFile.text()) as unknown;
      const result = await jsonRequest<{
        comparison: Tier2LegacyComparisonArtifact;
      }>(
        `/api/admin/tier2-products/releases/${legacyComparisonRunId}/legacy-comparison`,
        {
          method: "POST",
          body: JSON.stringify({ legacy, reason: reviewReason }),
        },
      );
      setLegacyComparison(result.comparison);
      setLegacySnapshotFile(null);
      await refresh();
      return "The side-by-side legacy comparison is retained as immutable release evidence.";
    });
  }

  function viewLegacyComparison(runId: string) {
    setLegacyComparisonRunId(runId);
    void perform(async () => {
      const result = await jsonRequest<{
        comparison: Tier2LegacyComparisonArtifact;
      }>(
        `/api/admin/tier2-products/releases/${runId}/legacy-comparison`,
      );
      setLegacyComparison(result.comparison);
      return "Retained legacy comparison loaded.";
    });
  }

  const releasesReady = Boolean(
    overview.system.resourceSet &&
    overview.system.registryRevision &&
    requiredKeys.length > 0 &&
    requiredKeys.every((key) => memberIds[key]),
  );

  return (
    <div className="space-y-6">
      {error ? <Alert variant="destructive"><AlertTriangleIcon /><AlertTitle>Tier 2 action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      {message ? <Alert><CheckCircle2Icon /><AlertTitle>Updated</AlertTitle><AlertDescription>{message}</AlertDescription></Alert> : null}

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div><CardTitle>Partner profiles and runs</CardTitle><CardDescription>Select one active partner explicitly. The flow pins its profile revision, Google Sheet tab, reference set, and all three contract-resource versions.</CardDescription></div>
          <Button variant="outline" disabled={isWorking} onClick={() => void perform(async () => { await refresh(); return "Tier 2 state refreshed."; })}><RefreshCwIcon />Refresh</Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2"><Label htmlFor="tier2-profile">Partner profile</Label><select id="tier2-profile" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={profileId} onChange={(event) => selectProfile(event.target.value)}><option value="">Select active partner</option>{overview.profiles.filter((profile) => profile.active).map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName} · {profile.sheetTitle}</option>)}</select></div>
            <Button disabled={isWorking || !profileId} onClick={launchPartnerFlow}>{isWorking ? <Loader2Icon className="animate-spin" /> : null}Launch selected partner flow</Button>
          </div>
          <div className="space-y-3 rounded-xl border p-4">
            <div><h3 className="font-semibold">Profile schedule</h3><p className="text-sm text-muted-foreground">Enable each partner independently only after one successful manual canary for that exact profile.</p></div>
            <div className="grid gap-3 md:grid-cols-[10rem_1fr_auto_auto] md:items-end">
              <div className="space-y-2"><Label htmlFor="tier2-schedule-interval">Interval (minutes)</Label><Input id="tier2-schedule-interval" type="number" min={5} max={10080} value={scheduleIntervalMinutes} onChange={(event) => setScheduleIntervalMinutes(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="tier2-schedule-canary">Successful manual canary run ID</Label><Input id="tier2-schedule-canary" value={scheduleCanaryRunId} onChange={(event) => setScheduleCanaryRunId(event.target.value)} /></div>
              <Button disabled={isWorking || !profileId || !scheduleCanaryRunId.trim()} onClick={() => configurePartnerSchedule(true)}>Enable schedule</Button>
              <Button variant="outline" disabled={isWorking || !profileId || !scheduleCanaryRunId.trim()} onClick={() => configurePartnerSchedule(false)}>Disable schedule</Button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">{overview.profiles.filter((profile) => profile.active).map((profile) => { const schedule = overview.tier2Schedules.find((candidate) => candidate.sourceProfileId === profile.id); return <div key={profile.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm"><span><strong>{profile.displayName}</strong><span className="block text-xs text-muted-foreground">{schedule?.manualCanaryRunId ? `Canary ${schedule.manualCanaryRunId.slice(0, 8)}…` : "No verified canary"}</span></span><Badge variant={schedule?.enabled ? "default" : "outline"}>{schedule?.enabled ? `Every ${schedule.intervalMinutes}m` : "Disabled"}</Badge></div>; })}</div>
          </div>
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Partner</TableHead><TableHead>Sheet tab</TableHead><TableHead>Tracking identity</TableHead><TableHead>Contract</TableHead></TableRow></TableHeader><TableBody>{overview.profiles.map((profile) => <TableRow key={profile.id}><TableCell>{profile.displayName}<span className="block text-xs text-muted-foreground">{profile.profileKey}</span></TableCell><TableCell>{profile.spreadsheetId} · {profile.sheetId}<span className="block text-xs text-muted-foreground">{profile.sheetTitle}</span></TableCell><TableCell>{profile.trackingIdSource} · {profile.trackingIdColumn}</TableCell><TableCell>{profile.contractVersion}<span className="block font-mono text-xs">{profile.contractChecksum.slice(0, 10)}…</span></TableCell></TableRow>)}</TableBody></Table></div>
          <details className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Create a reviewed partner profile</summary><div className="mt-4 space-y-3"><Label htmlFor="tier2-profile-json">Profile contract JSON</Label><textarea id="tier2-profile-json" className="min-h-36 w-full rounded-md border bg-background p-3 font-mono text-xs" value={profileJson} onChange={(event) => setProfileJson(event.target.value)} /><Button disabled={isWorking || !profileJson.trim()} onClick={createProfile}>Create profile</Button></div></details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contract resources</CardTitle><CardDescription>Import typed PeopleID3, PEID, and engagement mappings. Validation runs before an immutable version can activate.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3"><div className="space-y-2"><Label htmlFor="tier2-resource-key">Resource</Label><select id="tier2-resource-key" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={resourceKey} onChange={(event) => setResourceKey(event.target.value)}><option value="jp-peopleid3">JP PeopleID3</option><option value="peid">PEID</option><option value="engagement-mappings">Engagement mappings</option></select></div><label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={activateImportedResource} onChange={(event) => setActivateImportedResource(event.target.checked)} />Activate after validation</label><div className="flex items-end"><Button disabled={isWorking || !resourceJson.trim()} onClick={importResource}>Import version</Button></div></div>
          <textarea aria-label="Contract resource JSON" className="min-h-32 w-full rounded-md border bg-background p-3 font-mono text-xs" value={resourceJson} onChange={(event) => setResourceJson(event.target.value)} />
          <div className="grid gap-3 lg:grid-cols-3">{overview.resources.map((resource) => <Card key={resource.id}><CardHeader><CardTitle className="text-base">{resource.label}</CardTitle><CardDescription>{resource.versions.length} retained version(s)</CardDescription></CardHeader><CardContent className="space-y-2">{resource.versions.map((version) => { const id = String(version.id); const active = resource.activeVersionId === id; return <div key={id} className="rounded-lg border p-3 text-sm"><div className="flex items-center justify-between"><strong>v{String(version.versionNumber)}</strong><Badge variant={active ? "default" : "outline"}>{active ? "active" : String(version.lifecycleState)}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{String(version.entryCount)} entries</p>{!active && version.lifecycleState === "valid" ? <Button className="mt-2" size="sm" variant="outline" onClick={() => activateResource(id)}>Activate</Button> : null}</div>; })}</CardContent></Card>)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Forming and identity review</CardTitle><CardDescription>Publishing remains a separate human decision. Invalid rows and findings stay available for correction and evidence downloads.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]"><div className="space-y-2"><Label htmlFor="tier2-review-reason">Review reason</Label><Input id="tier2-review-reason" value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} /></div><label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={acknowledgeWarnings} onChange={(event) => setAcknowledgeWarnings(event.target.checked)} />Warnings reviewed</label><div className="flex items-end gap-2"><Input aria-label="Identity run ID" placeholder="Identity run ID" value={identityRunId} onChange={(event) => setIdentityRunId(event.target.value)} /><Button variant="outline" disabled={!identityRunId.trim()} onClick={() => decideIdentity("publish")}>Publish identity</Button><Button variant="destructive" disabled={!identityRunId.trim()} onClick={() => decideIdentity("reject")}>Reject</Button></div></div>
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Built</TableHead><TableHead>Profile</TableHead><TableHead>Status</TableHead><TableHead>Rows</TableHead><TableHead>Findings</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{overview.formingRuns.length ? overview.formingRuns.map((run) => <TableRow key={run.id}><TableCell>{formatDate(run.createdAt)}</TableCell><TableCell>{run.sourceProfileKey}</TableCell><TableCell><Badge variant={run.status === "published" ? "default" : run.errorCount > 0 ? "destructive" : "outline"}>{run.status}</Badge></TableCell><TableCell>{run.outputRowCount ?? "—"}</TableCell><TableCell>{run.warningCount} warnings · {run.errorCount} errors</TableCell><TableCell><div className="flex flex-wrap gap-2">{run.status === "valid" ? <Button size="sm" onClick={() => decideForming(run.id, "publish")}>Publish forming</Button> : null}{run.status === "valid" || run.status === "invalid" ? <Button size="sm" variant="destructive" onClick={() => decideForming(run.id, "reject")}>Reject</Button> : null}{run.sourcePublicationId ? <Button size="sm" variant="outline" onClick={() => buildIdentity(run.id)}>Build identity</Button> : null}</div></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No forming candidates yet.</TableCell></TableRow>}</TableBody></Table></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Exact Tier 2 and Aggregate 2 releases</CardTitle><CardDescription>Tier 2 requires every active partner identity publication. Aggregate 2 requires the published Tier 2 release plus exact IMB and JP publications.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2"><Label htmlFor="tier2-product-kind">Product</Label><select id="tier2-product-kind" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={productKind} onChange={(event) => { setProductKind(event.target.value as ProductKind); setMemberIds({}); }}><option value="tier2">Tier 2 partner release</option><option value="aggregate2">Aggregate 2 Combined Release</option></select></div>
          <div className="grid gap-3 md:grid-cols-3">{requiredKeys.map((inputKey) => <div className="space-y-2" key={inputKey}><Label htmlFor={`tier2-member-${inputKey}`}>{inputKey.toUpperCase()}</Label><select id={`tier2-member-${inputKey}`} className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={memberIds[inputKey] ?? ""} onChange={(event) => setMemberIds((current) => ({ ...current, [inputKey]: event.target.value }))}><option value="">Select exact publication</option>{overview.eligiblePublications.filter((publication) => publication.eligibleInputKeys.includes(inputKey)).map((publication) => <option key={publication.id} value={publication.id} disabled={!publication.rowsPresent}>{formatDate(publication.createdAt)} · {publication.rowCount} rows</option>)}</select></div>)}</div>
          <Button disabled={isWorking || !releasesReady} onClick={buildRelease}>Build exact candidate</Button>
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Built</TableHead><TableHead>Product</TableHead><TableHead>Status</TableHead><TableHead>Rows</TableHead><TableHead>Freshness</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{overview.runs.length ? overview.runs.map((run) => <TableRow key={run.id}><TableCell>{formatDate(run.createdAt)}</TableCell><TableCell>{run.displayName}</TableCell><TableCell><Badge variant={run.status === "published" ? "default" : run.errorCount > 0 ? "destructive" : "outline"}>{run.status}</Badge></TableCell><TableCell>{run.outputRowCount ?? "—"}</TableCell><TableCell>{run.outOfDate ? `Out of date: ${run.changedInputs.join(", ")}` : "Exact inputs current"}</TableCell><TableCell><div className="flex gap-2">{run.status === "valid" ? <Button size="sm" onClick={() => decideProduct(run.id, "publish")}>Publish</Button> : null}{run.status === "valid" || run.status === "invalid" ? <Button size="sm" variant="destructive" onClick={() => decideProduct(run.id, "reject")}>Reject</Button> : null}</div></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No product candidates yet.</TableCell></TableRow>}</TableBody></Table></div>
          <div className="space-y-4 rounded-xl border p-4">
            <div>
              <h3 className="font-semibold">Legacy side-by-side comparison</h3>
              <p className="text-sm text-muted-foreground">Attach the final read-only AX Data rows JSON artifact to one completed candidate. The report retains exact rows and explains every retained, dropped, added, or conflicting canonical identity.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="tier2-comparison-run">Candidate</Label>
                <select id="tier2-comparison-run" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={legacyComparisonRunId} onChange={(event) => { setLegacyComparisonRunId(event.target.value); setLegacyComparison(null); }}>
                  <option value="">Select completed candidate</option>
                  {overview.runs.map((run) => <option key={run.id} value={run.id}>{run.displayName} · {formatDate(run.createdAt)}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tier2-legacy-snapshot">Legacy rows JSON</Label>
                <Input id="tier2-legacy-snapshot" type="file" accept="application/json,.json" onChange={(event) => setLegacySnapshotFile(event.target.files?.[0] ?? null)} />
              </div>
              <Button disabled={isWorking || !legacyComparisonRunId || !legacySnapshotFile || overview.runs.find((run) => run.id === legacyComparisonRunId)?.legacyComparisonAvailable} onClick={retainLegacyComparison}>Retain comparison</Button>
              <Button variant="outline" disabled={!overview.runs.find((run) => run.id === legacyComparisonRunId)?.legacyComparisonAvailable} onClick={() => viewLegacyComparison(legacyComparisonRunId)}>View retained report</Button>
            </div>
            {legacyComparison ? <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">{legacyComparison.report.counts.retained} retained</Badge>
                <Badge variant="outline">{legacyComparison.report.counts.dropped} dropped</Badge>
                <Badge variant="outline">{legacyComparison.report.counts.added} added</Badge>
                <Badge variant={legacyComparison.report.counts.conflicting > 0 ? "destructive" : "outline"}>{legacyComparison.report.counts.conflicting} conflicting</Badge>
                <span className="text-muted-foreground">{legacyComparison.report.legacyRowCount} legacy rows · {legacyComparison.report.candidateRowCount} candidate rows</span>
                <a className="font-medium underline underline-offset-4" href={`/api/admin/tier2-products/releases/${legacyComparison.runId}/legacy-comparison?download=1`}>Download full retained report</a>
              </div>
              <div className="max-h-96 overflow-auto rounded-lg border">
                <Table><TableHeader><TableRow><TableHead>Canonical identity</TableHead><TableHead>Outcome</TableHead><TableHead>Legacy</TableHead><TableHead>Candidate</TableHead><TableHead>Explanation</TableHead></TableRow></TableHeader><TableBody>{legacyComparison.report.differences.slice(0, 100).map((difference) => <TableRow key={difference.canonicalPgic}><TableCell className="font-mono text-xs">{difference.canonicalPgic}</TableCell><TableCell><Badge variant={difference.outcome === "conflicting" ? "destructive" : "outline"}>{difference.outcome}</Badge></TableCell><TableCell>{difference.legacyCount}</TableCell><TableCell>{difference.candidateCount}</TableCell><TableCell>{difference.explanation}</TableCell></TableRow>)}</TableBody></Table>
              </div>
              {legacyComparison.report.differences.length > 100 ? <p className="text-xs text-muted-foreground">Showing the first 100 identities. Download the retained report for every difference and its exact legacy/candidate rows.</p> : null}
            </div> : null}
          </div>
          <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_1fr_auto]"><div className="space-y-2"><Label htmlFor="tier2-rollback-product">Stable target</Label><select id="tier2-rollback-product" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={productKind} onChange={(event) => setProductKind(event.target.value as ProductKind)}><option value="tier2">Tier 2</option><option value="aggregate2">Aggregate 2</option></select></div><div className="space-y-2"><Label htmlFor="tier2-rollback-publication">Prior publication ID</Label><Input id="tier2-rollback-publication" value={rollbackPublicationId} onChange={(event) => setRollbackPublicationId(event.target.value)} /></div><div className="flex items-end"><Button variant="outline" disabled={!rollbackPublicationId.trim()} onClick={() => rollbackTarget(productKind)}>Restore prior release</Button></div></div>
        </CardContent>
      </Card>
    </div>
  );
}
