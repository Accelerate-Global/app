import type { CurrentIdentity } from "@/lib/auth";
import { executePrivateDataChatQuery } from "@/lib/private-data-chat/broker";
import { PRIVATE_DATA_CHAT_METRIC_KEYS } from "@/lib/private-data-chat/catalog";
import {
  compilePrivateDataChatQuery,
  PrivateDataChatQueryPolicyError,
} from "@/lib/private-data-chat/compiler";
import type {
  PrivateDataChatStage,
  PrivateDataChatTurnMessage,
} from "@/lib/private-data-chat/events";
import { getPrivateQwenGateway } from "@/lib/private-data-chat/get-qwen-gateway";
import type {
  PrivateQwenConversationMessage,
  PrivateQwenGateway,
} from "@/lib/private-data-chat/qwen-gateway";
import type {
  PrivateDataChatQuery,
  PrivateDataChatQueryResult,
} from "@/lib/private-data-chat/schemas";
import { resolvePrivateDataChatQueryValues } from "@/lib/private-data-chat/value-resolver";
import { renderPrivateDataChatGroundedAnswer } from "@/lib/private-data-chat/evidence";
import { getPrivateDataChatConfiguration } from "@/lib/private-data-chat/config";
import {
  createPrivateDataChatTurnStateToken,
  verifyPrivateDataChatTurnStateToken,
  type PrivateDataChatTurnState,
} from "@/lib/private-data-chat/turn-state";
import { PrivateDataChatSignedStateError } from "@/lib/private-data-chat/signed-state";
import {
  executePrivateDataChatResourceQuery,
  renderPrivateDataChatResourceResult,
} from "@/lib/private-data-chat/resource-query";
import {
  verifyPrivateDataChatViewContextAgainstCurrentDataset,
  type PrivateDataChatViewContext,
} from "@/lib/private-data-chat/view-context";
import {
  buildPrivateDataChatRetrievalAudit,
  retrievePrivateDataChatSemanticContext,
  type PrivateDataChatRetrievalAudit,
  type PrivateDataChatRetrievalReady,
} from "@/lib/private-data-chat/retrieval";
import { getActivePrivateDataChatSemanticContext } from "@/lib/private-data-chat/semantic-context-candidate";
import {
  buildPrivateDataChatGeographyQuery,
  resolvePrivateDataChatGeographyIntent,
  type PrivateDataChatResolvedGeographyIntent,
} from "@/lib/private-data-chat/geography-resolver";

export type PrivateDataChatOrchestratorDependencies = {
  gateway: PrivateQwenGateway;
  executeQuery: typeof executePrivateDataChatQuery;
  resolveValues: typeof resolvePrivateDataChatQueryValues;
  executeResourceQuery: typeof executePrivateDataChatResourceQuery;
  verifyViewContext: typeof verifyPrivateDataChatViewContextAgainstCurrentDataset;
  loadSemanticContext: typeof getActivePrivateDataChatSemanticContext;
  retrieveSemanticContext: typeof retrievePrivateDataChatSemanticContext;
  resolveGeographyIntent: typeof resolvePrivateDataChatGeographyIntent;
};

const PRIVATE_DATA_CHAT_REPAIR_MESSAGE =
  "The previous semantic plan could not pass the deterministic query policy. Re-evaluate the original user question and return one complete corrected decision using only the approved catalog. Do not explain the failed plan.";

function deterministicQueryAnswer(result: PrivateDataChatQueryResult) {
  const answer = renderPrivateDataChatGroundedAnswer({ result });
  return {
    ...answer,
    facts: answer.facts.filter((fact) => fact !== answer.answer),
  };
}

function currentViewWithoutCountryScope(
  currentView: PrivateDataChatViewContext | null,
) {
  return currentView
    ? {
        ...currentView,
        filters: currentView.filters.filter((filter) => filter.field !== "country"),
      }
    : null;
}

function shouldReplaceCurrentView(question: string) {
  return (
    /\b(?:ignore|clear|remove|without)\b.{0,40}\b(?:view|filters?|context)\b/iu.test(
      question,
    ) || /\b(?:all|entire)\s+(?:data|dataset)\b/iu.test(question)
  );
}

function semanticCardKey(concept: string) {
  return (PRIVATE_DATA_CHAT_METRIC_KEYS as readonly string[]).includes(concept)
    ? `metric.${concept}`
    : `field.${concept}`;
}

function currentViewSemanticKeys(currentView: PrivateDataChatViewContext | null) {
  if (!currentView) return [];
  return [
    ...currentView.filters.map((filter) => semanticCardKey(filter.field)),
    ...currentView.namedFilters.map((filter) => `filter.${filter.key}`),
  ];
}

function priorTurnSemanticKeys(states: readonly PrivateDataChatTurnState[]) {
  return states.flatMap((state) => [
    ...state.selectedConcepts.map(semanticCardKey),
    ...state.namedFilterKeys.map((key) => `filter.${key}`),
  ]);
}

function renderReviewedDefinition(
  retrieval: PrivateDataChatRetrievalReady,
) {
  const exact = new Set(retrieval.exactKeys);
  const definitions = retrieval.items
    .filter(
      (item) =>
        item.kind !== "demonstration" &&
        item.kind !== "dataset" &&
        (exact.has(item.stableKey) || item.kind === "named-filter"),
    )
    .slice(0, 3);
  if (definitions.length === 0) return null;
  return {
    content: definitions
      .map((item) => `${item.label}: ${item.definition}`)
      .join("\n\n"),
    facts: definitions.flatMap((item) =>
      item.nullMeaning ? [`${item.label} null meaning: ${item.nullMeaning}`] : [],
    ),
    provenance: null,
  };
}

export function inheritPrivateDataChatViewContext(input: {
  query: PrivateDataChatQuery;
  currentView: PrivateDataChatViewContext | null;
  question: string;
}) {
  if (!input.currentView || shouldReplaceCurrentView(input.question)) {
    return input.query;
  }
  const explicitFields = new Set(
    input.query.filters.map((filter) => filter.field),
  );
  const filters = [
    ...input.query.filters,
    ...input.currentView.filters.filter(
      (filter) => !explicitFields.has(filter.field),
    ),
  ];
  const explicitNamedFilters = new Set(
    input.query.namedFilters.map((filter) => filter.key),
  );
  const namedFilters = [
    ...input.query.namedFilters,
    ...input.currentView.namedFilters.filter(
      (filter) => !explicitNamedFilters.has(filter.key),
    ),
  ];
  const selected = new Set(
    input.query.mode === "aggregate"
      ? [...input.query.dimensions, ...input.query.metrics]
      : input.query.fields,
  );
  const inheritedSort = input.currentView.sort.filter((sort) =>
    selected.has(sort.field),
  );
  return {
    ...input.query,
    filters,
    namedFilters,
    sort: input.query.sort.length > 0 ? input.query.sort : inheritedSort,
  } as PrivateDataChatQuery;
}

export async function orchestratePrivateDataChatTurn(input: {
  identity: CurrentIdentity;
  messages: PrivateQwenConversationMessage[];
  conversationId?: string;
  turnStateTokens?: readonly string[];
  resourceContinuationToken?: string;
  viewContextToken?: string;
  signal?: AbortSignal;
  onStage?: (stage: PrivateDataChatStage) => void;
  dependencies?: Partial<PrivateDataChatOrchestratorDependencies>;
}): Promise<PrivateDataChatTurnMessage> {
  const dependencies: PrivateDataChatOrchestratorDependencies = {
    gateway: getPrivateQwenGateway(),
    executeQuery: executePrivateDataChatQuery,
    resolveValues: resolvePrivateDataChatQueryValues,
    executeResourceQuery: executePrivateDataChatResourceQuery,
    verifyViewContext:
      verifyPrivateDataChatViewContextAgainstCurrentDataset,
    loadSemanticContext: getActivePrivateDataChatSemanticContext,
    retrieveSemanticContext: retrievePrivateDataChatSemanticContext,
    resolveGeographyIntent: resolvePrivateDataChatGeographyIntent,
    ...input.dependencies,
  };
  const configuration = getPrivateDataChatConfiguration();
  const turnStateKey = configuration.semanticContextEnabled
    ? configuration.turnStateHmacKey
    : null;
  let trustedTurnState: PrivateDataChatTurnState[] = [];
  let trustedCurrentView: PrivateDataChatViewContext | null = null;
  const question = [...input.messages]
    .reverse()
    .find((message) => message.role === "user")?.content;

  if (!question) {
    throw new Error("A user question is required.");
  }
  const activeSemanticContext = configuration.semanticContextEnabled
    ? await dependencies.loadSemanticContext()
    : null;
  const semanticSnapshotChecksum =
    activeSemanticContext?.version.contentChecksum ?? null;
  if (configuration.semanticContextEnabled && !semanticSnapshotChecksum) {
    throw new PrivateDataChatSignedStateError(
      "semantic_context_unavailable",
      "The reviewed semantic context is unavailable.",
    );
  }

  if (input.viewContextToken) {
    if (!configuration.viewContextHmacKey || !input.conversationId) {
      throw new PrivateDataChatSignedStateError(
        "view_context_unavailable",
        "Trusted current-view context is unavailable.",
      );
    }
    trustedCurrentView = await dependencies.verifyViewContext({
      token: input.viewContextToken,
      ownerId: input.identity.ownerId,
      conversationId: input.conversationId,
      key: configuration.viewContextHmacKey,
    });
  }

  if ((input.turnStateTokens?.length ?? 0) > 0) {
    if (!turnStateKey || !input.conversationId) {
      throw new PrivateDataChatSignedStateError(
        "turn_state_unavailable",
        "Trusted prior-turn state is unavailable.",
      );
    }
    trustedTurnState = input.turnStateTokens!.map((token) =>
      verifyPrivateDataChatTurnStateToken({
        token,
        ownerId: input.identity.ownerId,
        conversationId: input.conversationId!,
        key: turnStateKey,
        semanticSnapshotChecksum,
      }),
    );
  }

  if (input.resourceContinuationToken) {
    if (!configuration.continuationHmacKey || !input.conversationId) {
      throw new PrivateDataChatSignedStateError(
        "continuation_unavailable",
        "Bounded ROP continuation is unavailable.",
      );
    }
    input.onStage?.("querying");
    const resourceResult = await dependencies.executeResourceQuery({
      identity: input.identity,
      conversationId: input.conversationId,
      resourceQuery: {
        resourceKey: "rop-codes",
        operation: "continue",
        query: null,
        lookupKey: null,
        continuationToken: input.resourceContinuationToken,
        limit: 25,
      },
      continuationKey: configuration.continuationHmacKey,
    });
    const rendered = renderPrivateDataChatResourceResult(resourceResult);
    return { ...rendered, provenance: null, resourceResult };
  }

  const geographyResolution =
    activeSemanticContext && semanticSnapshotChecksum
      ? await dependencies.resolveGeographyIntent({
          question,
          expectedFilterRegionChecksum:
            activeSemanticContext.payload.sourceVersionManifest?.filterRegions,
        })
      : ({ status: "none" } as const);
  if (geographyResolution.status === "clarify") {
    return {
      content: geographyResolution.question,
      facts: [],
      provenance: null,
    };
  }
  if (geographyResolution.status === "unavailable") {
    return {
      content: geographyResolution.message,
      facts: [],
      provenance: null,
    };
  }
  const resolvedGeography: PrivateDataChatResolvedGeographyIntent | null =
    geographyResolution.status === "resolved" ? geographyResolution : null;

  let plannerSemanticContext: PrivateDataChatRetrievalReady | null = null;
  let plannerRetrievalAudit: PrivateDataChatRetrievalAudit | null = null;
  if (activeSemanticContext && semanticSnapshotChecksum) {
    const retrievalStartedAt = performance.now();
    const retrieval = await dependencies.retrieveSemanticContext({
      utterance: question,
      audience: "planner",
      package: activeSemanticContext.payload,
      snapshotChecksum: semanticSnapshotChecksum,
      expectedSnapshotChecksum: semanticSnapshotChecksum,
      verifiedCurrentViewKeys: currentViewSemanticKeys(trustedCurrentView),
      verifiedPriorTurnKeys: priorTurnSemanticKeys(trustedTurnState),
      ...(resolvedGeography
        ? {
            requiredKeys: resolvedGeography.requiredSemanticKeys,
            verifiedResolverViews: resolvedGeography.resolverViews,
          }
        : {}),
    });
    if (retrieval.status !== "ready") {
      return {
        content:
          retrieval.reason === "semantic-retrieval-low-confidence"
            ? "I can only help with Accelerate Global's reviewed datasets, definitions, filters, metrics, and governed reference resources. What would you like to explore there?"
            : "I cannot safely assemble the reviewed semantic context required for that request. Please narrow or restate the data question.",
        facts: [],
        provenance: null,
      };
    }
    plannerSemanticContext = retrieval;
    plannerRetrievalAudit = buildPrivateDataChatRetrievalAudit({
      audience: "planner",
      retrieval,
      latencyMs: performance.now() - retrievalStartedAt,
    });
  }

  input.onStage?.("interpreting");
  let plan: Awaited<ReturnType<PrivateQwenGateway["plan"]>> | null = null;
  let plannedQuery: PrivateDataChatQuery;
  if (resolvedGeography) {
    plannedQuery = buildPrivateDataChatGeographyQuery(resolvedGeography);
  } else {
    plan = await dependencies.gateway.plan({
      messages: input.messages,
      trustedTurnState,
      trustedCurrentView,
      semanticContext: plannerSemanticContext,
      signal: input.signal,
    });

    if (plan.decision === "clarify") {
      return { content: plan.question, facts: [], provenance: null };
    }

    if (plan.decision === "answer") {
      if (plannerSemanticContext) {
        const definition = renderReviewedDefinition(plannerSemanticContext);
        if (definition) return definition;
        if (!/\b(?:cannot|can't|not available|only help|outside)\b/iu.test(plan.answer)) {
          return {
            content:
              "I can only answer from Accelerate Global's reviewed data and definitions.",
            facts: [],
            provenance: null,
          };
        }
      }
      return { content: plan.answer, facts: [], provenance: null };
    }

    if (plan.decision === "resource_query") {
      if (!configuration.continuationHmacKey || !input.conversationId) {
        throw new PrivateDataChatSignedStateError(
          "continuation_unavailable",
          "Bounded ROP continuation is unavailable.",
        );
      }
      input.onStage?.("querying");
      const resourceResult = await dependencies.executeResourceQuery({
        identity: input.identity,
        conversationId: input.conversationId,
        resourceQuery: plan.resourceQuery,
        continuationKey: configuration.continuationHmacKey,
        retrievalAudit: plannerRetrievalAudit,
      });
      const rendered = renderPrivateDataChatResourceResult(resourceResult);
      return {
        ...rendered,
        provenance: null,
        resourceResult,
      };
    }
    plannedQuery = plan.query;
  }

  input.onStage?.("validating");
  let compiled: ReturnType<typeof compilePrivateDataChatQuery>;
  try {
    const resolution = await dependencies.resolveValues(
      inheritPrivateDataChatViewContext({
        query: plannedQuery,
        currentView: resolvedGeography
          ? currentViewWithoutCountryScope(trustedCurrentView)
          : trustedCurrentView,
        question,
      }),
    );
    if (resolution.status === "clarify") {
      return {
        content: resolution.question,
        facts: [],
        provenance: null,
      };
    }
    compiled = compilePrivateDataChatQuery(resolution.query, {
      valueBindings: resolution.valueBindings,
    });
  } catch (error) {
    if (!(error instanceof PrivateDataChatQueryPolicyError)) {
      throw error;
    }

    if (resolvedGeography) {
      throw error;
    }

    plan = await dependencies.gateway.plan({
      messages: [
        ...input.messages.slice(-10),
        { role: "assistant", content: JSON.stringify(plan) },
        { role: "user", content: PRIVATE_DATA_CHAT_REPAIR_MESSAGE },
      ],
      trustedTurnState,
      trustedCurrentView,
      semanticContext: plannerSemanticContext,
      signal: input.signal,
    });

    if (plan.decision === "clarify") {
      return { content: plan.question, facts: [], provenance: null };
    }

    if (plan.decision === "answer") {
      if (plannerSemanticContext) {
        const definition = renderReviewedDefinition(plannerSemanticContext);
        if (definition) return definition;
      }
      return { content: plan.answer, facts: [], provenance: null };
    }

    if (plan.decision === "resource_query") {
      if (!configuration.continuationHmacKey || !input.conversationId) {
        throw new PrivateDataChatSignedStateError(
          "continuation_unavailable",
          "Bounded ROP continuation is unavailable.",
        );
      }
      input.onStage?.("querying");
      const resourceResult = await dependencies.executeResourceQuery({
        identity: input.identity,
        conversationId: input.conversationId,
        resourceQuery: plan.resourceQuery,
        continuationKey: configuration.continuationHmacKey,
        retrievalAudit: plannerRetrievalAudit,
      });
      const rendered = renderPrivateDataChatResourceResult(resourceResult);
      return { ...rendered, provenance: null, resourceResult };
    }

    const resolution = await dependencies.resolveValues(
      inheritPrivateDataChatViewContext({
        query: plan.query,
        currentView: trustedCurrentView,
        question,
      }),
    );
    if (resolution.status === "clarify") {
      return {
        content: resolution.question,
        facts: [],
        provenance: null,
      };
    }
    compiled = compilePrivateDataChatQuery(resolution.query, {
      valueBindings: resolution.valueBindings,
    });
  }
  input.onStage?.("querying");
  const result = await dependencies.executeQuery({
    identity: input.identity,
    compiled,
    retrievalAudit: plannerRetrievalAudit,
  });
  const turnStateToken =
    turnStateKey && input.conversationId
      ? createPrivateDataChatTurnStateToken({
          ownerId: input.identity.ownerId,
          conversationId: input.conversationId,
          compiled,
          result,
          semanticSnapshotChecksum,
          key: turnStateKey,
        })
      : null;
  input.onStage?.("explaining");
  if (resolvedGeography) {
    const answer = renderPrivateDataChatGroundedAnswer({ result });
    return {
      content: `${resolvedGeography.scope.displayName}: ${answer.answer}`,
      facts: answer.facts,
      provenance: result.provenance,
      ...(turnStateToken ? { turnStateToken } : {}),
    };
  }
  const answer = deterministicQueryAnswer(result);
  return {
    content: answer.answer,
    facts: answer.facts,
    provenance: result.provenance,
    ...(turnStateToken ? { turnStateToken } : {}),
  };
}
