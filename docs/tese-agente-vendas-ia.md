# SPEC: conversational-recommendation-agent

## metadata
```yaml
project: demo-storefront
hackathon_front: search_discovery + seo_geo_agentic_commerce
repo_stack: tanstack-start, react19, cloudflare-workers, deco-cms
status: thesis_revised_pending_implementation
revision: 4
revision_notes: "r2: agent runs as a single structured-output call (not a tool_use loop), filters are discovered at runtime from the commerce protocol, resolution happens in the /s loader, added phase_0 blockers, reframed the admin surface as a proposal-generating agent. r3: reconciled with docs/tese-admin-agentes.md — adopted its Proposal artifact (before/evidence), split storage by access pattern (KV for proposals, D1 for aggregation), and made the autonomy level an explicit store-owner setting instead of a hardcoded v1 exclusion. r4: dropped the Shopify Storefront API, D1, and KV bindings — the goal for this build is to demonstrate agent behavior, not stand up real commerce/persistence infra. Catalog, query log, and proposals now live in static/generated JSON files with the same shapes the loader and sections already expect."
scope: |
  NORMATIVE. This file is the single source of truth for what gets built: verified facts
  about this repo, binding technical decisions, schemas, and the build sequence. If a
  statement here conflicts with any other document, this one wins.
  Product narrative, pitch framing, and fleet-wide design that is NOT being built live in
  docs/tese-admin-agentes.md. Do not restate those here; do not restate these there.
related_docs:
  - path: docs/tese-admin-agentes.md
    relation: |
      Vision/pitch document for the wider agent-fleet admin — non-normative, written
      before this spec. Its §3 (one artifact, autonomy is a gate) and §6 (Proposal) are
      adopted here and become binding at this file's version, not that one's.
      That document owns: the problem framing, the fleet narrative, autonomy as a product
      idea, workflows, guardrails, metric honesty, and the pitch.
```

## problem_statement
```yaml
issues:
  - id: nl_search_failure
    description: "Free-text queries return zero results because search matches literal keywords, not intent."
    example_input: "algo pra correr no frio"
    example_current_output: "0 results"
  - id: unanswered_product_questions
    description: "No conversational Q&A for size/material/comparison at decision time; user leaves to research elsewhere."
    v1_status: "OUT OF SCOPE — see explicit_exclusions. There is no UI surface to render an answer, and the agent's only output is a URL."
  - id: no_contextual_ranking
    description: "PLP is not re-ranked based on inferred intent + popularity; generic listing shown regardless of query context."
```

## solution_thesis
```yaml
approach: "Agent embedded in the existing site search flow (no new chat UI) that maps a free-text query onto the filter vocabulary the PLP loader already returns, then redirects the user to the existing PLP route with those filters applied."
explicit_non_goals:
  - "Agent does NOT call any cart mutation (no addToCart action)."
  - "Agent does NOT complete checkout."
  - "Agent does NOT decide the purchase; it only narrows the catalog view."
  - "Agent does NOT introduce a new chat/conversation UI component."
  - "Agent does NOT invent filter values — it selects from values the loader returned."
rationale:
  - "Removes write-path risk (no incorrect autonomous cart actions)."
  - "No new UI surface for users to learn — same search bar, smarter behavior."
  - "Directly matches hackathon front: PLP ordering / search & discovery."
  - "Selecting from a runtime-discovered vocabulary makes filter hallucination structurally impossible, not just mitigated."
  - "Smaller surface area = lower implementation risk given fixed timeline."
```

## architecture

```
[existing search form, src/components/search/Searchbar/Form.tsx]
    -> native submit to /s?q=<term>   (UNCHANGED — no client-side interception)

[/s route loader]
    1. run the existing broad/literal search for <term> against the local JSON
       catalog (data/catalog.json — same shape a live commerce API would return,
       so nothing downstream needs to know the source changed)
    2. read page.filters  (Filter[] / FilterToggle[] from @decocms/apps-commerce/types)
       -> this IS the action space: real labels, real counts, real hrefs
    3. JSON cache lookup: normalize(term) -> cached plpUrl? (data/query-cache.json)
       ---- HIT -> 302 redirect
    4. MISS -> ONE Claude call with structured outputs:
         input:  term + the enumerated filter values from step 2
         output: { selected: [{ filterKey, valueLabel }], confidence, sortHint }
    5. resolve selected labels back to the hrefs the loader already returned
    6. logAgentQuery(...) via ctx.waitUntil  (non-blocking)
    7. 302 redirect to the filtered PLP URL   |   on low confidence or zero
                                              |   selection: render the literal
                                              |   search result as-is (fallback)
```

**Key inversion vs. revision 1:** the agent does not emit filters, it *chooses* from filters.
`ProductListingPage["filters"]` already carries, per value: a human label, a product
`quantity`, and a ready-to-use href (see `src/components/search/Filters.tsx:66-135`,
which renders exactly these into `<Link to search>` via `rebaseToSearch`). The LLM never
constructs a query param.

**Why the loader and not a client submit handler:** the current form does a native HTML
submit to `/s?q=` (`Form.tsx:12-16`, `ACTION = "/s"`, `NAME = "q"`) with HTMX-driven
suggestions. There is no clean client submit handler to extend. Resolving in the loader
means: one request, works without JS, SSR-friendly, better SEO, and the literal-search
fallback is the natural default path rather than an error branch.

## data_contracts

### FilterCandidate (built by the loader, NOT by the model)
```typescript
// Derived directly from ProductListingPage["filters"] — no new vocabulary invented.
interface FilterCandidate {
  filterKey: string;   // Filter.key
  label: string;       // FilterToggle value label, as shown to users
  quantity: number;    // product count — a value with quantity 0 is never offered
  href: string;        // the loader-provided URL for this value
}
```

### AgentSelection (the model's structured output)
```typescript
interface AgentSelection {
  /** Labels chosen from the FilterCandidate[] supplied in the prompt. */
  selected: Array<{ filterKey: string; label: string }>;
  /** 0-1. Below AGENT_CONFIDENCE_FLOOR we fall back to literal search. */
  confidence: number;
  /** Optional: maps to an existing PLP sort querystring value, never a raw catalog enum. */
  sortHint?: "relevance" | "best_selling" | "price_asc" | "price_desc";
}
```

### LLM call shape
```typescript
// ONE call. No tool_use loop. Structured outputs, not forced tool_choice.
const response = await client.messages.create({
  model: "claude-opus-5",
  max_tokens: 1024,
  output_config: {
    effort: "low",                         // latency lever for the hot path
    format: { type: "json_schema", schema: AGENT_SELECTION_SCHEMA },
  },
  system: [{
    type: "text",
    text: STABLE_SYSTEM_PROMPT,            // >512 tokens -> cacheable on claude-opus-5
    cache_control: { type: "ephemeral" },  // breakpoint HERE
  }],
  messages: [{
    role: "user",
    content: renderCandidates(candidates) + "\n\nUser query: " + term,  // AFTER the breakpoint
  }],
});
```
Rules:
- The **stable** prefix (system prompt, instructions, output contract) sits before the
  `cache_control` breakpoint. The **volatile** part (candidate list + user term) goes after it.
- Verify caching works: `usage.cache_read_input_tokens > 0` on repeat requests. If it is
  zero, something dynamic leaked into the prefix (timestamp, session id, unordered JSON).
- Do **not** set `thinking: {type:"disabled"}`. On `claude-opus-5` it is only accepted at
  effort `high` or below and has known failure modes. `effort: "low"` is the correct lever.
- Model choice is a product decision. `claude-opus-5` at `effort: "low"` is the default;
  swapping to a cheaper model is a deliberate call, not an implicit optimization.

### AgentQueryLog (persisted to a JSON file — see phase_0)
```typescript
interface AgentQueryLog {
  id: string;
  timestamp: number;
  rawUserText: string;
  selection: AgentSelection;
  resolvedUrl: string | null;   // null when we fell back to literal search
  fellBack: boolean;
  topicKey: string;             // normalized: filterKey+label pair -> "categoria:tenis|uso:corrida"
  latencyMs: number;
  cacheHit: boolean;
}

interface TopicRanking {
  topicKey: string;
  label: string;      // LLM-generated once, then cached in data/topic-rankings.json — never regenerated per render
  count: number;
  windowDays: number;
}
```

## file_layout_to_create
```
src/platform/agent/
  agent.types.ts       # FilterCandidate, AgentSelection, AgentQueryLog
  agent.actions.ts     # resolveSearchQuery(term, candidates) -> { plpUrl } | { fallback: true }
  agent.claude.ts      # the single structured-output call + prompt cache breakpoints
  agent.cache.ts       # JSON file read/write for normalize(term) -> plpUrl
  agent.filters.ts     # ProductListingPage["filters"] -> FilterCandidate[]
  index.ts

src/platform/analytics/
  analytics.types.ts   # TopicRanking
  analytics.actions.ts # logAgentQuery(), getTopicRankings(windowDays), proposeCollections()
  analytics.json.ts    # JSON file read/write + in-process aggregation
  analytics.hooks.ts   # useQuery wrapper for the dashboard section
  index.ts

src/routes/
  (the existing /s route loader — MODIFY, do not replace)

src/sections/AgentDashboard/
  AgentDashboard.tsx       # CMS section, placed on an unindexed page (see admin gate decision)

src/sections/TrendingCollections/
  TrendingCollections.tsx  # CMS section, client-fetched data (see cache decision)
```
Note: follows the existing `src/platform/cart/` convention (types/actions/hooks/adapter/barrel).
`src/components/search/Searchbar/Form.tsx` is **not modified** — the native submit to `/s?q=`
stays exactly as it is.

## build_sequence

```yaml
phase_0_unblock:   # NEW — blocks phase_1
  - decide LLM transport: @anthropic-ai/sdk from the server function.
      key via `wrangler secret put ANTHROPIC_API_KEY` — server-side only.
      note: the CSP in src/worker-entry.ts:28-35 is irrelevant here; the call never
      leaves the worker. A client-side call would leak the key.
  - data lives in static/generated JSON files, not a database — the goal is to
      demonstrate agent behavior, not to stand up real persistence infra:
      catalog                       -> data/catalog.json (replaces a Shopify
                        Storefront API call; same shape the loader already expects,
                        so nothing downstream changes)
      AgentQueryLog + TopicRanking  -> data/agent-query-log.json and
                        data/topic-rankings.json, appended to per run and
                        aggregated in-process (Array.reduce / groupBy) — the
                        dataset is small enough that SQL buys nothing here
      Proposals + normalize(term)->plpUrl cache -> data/proposals.json and
                        data/query-cache.json, read/written whole-file
      All reads/writes go through src/platform/*/*.json.ts helpers so the storage
      shape is isolated behind one module per domain, not scattered across callers.
  - resolve the admin gate BEFORE building any dashboard UI (see admin_surface.decision)

phase_1_agent_hot_path:
  - agent.filters.ts: ProductListingPage["filters"] -> FilterCandidate[] (drop quantity === 0)
  - agent.claude.ts: single structured-output call, effort low, prompt cache breakpoint
  - agent.cache.ts: JSON-file cache keyed on normalize(term)   # was phase_3 — it is
                                                        # what makes the demo fast, it belongs here
  - wire resolveSearchQuery into the EXISTING /s route loader (302 on success)
  - fallback: low confidence / empty selection / any error -> render literal search
  - verify prompt caching: usage.cache_read_input_tokens > 0 on the second identical call

phase_2_analytics_foundation:
  - logAgentQuery from inside the same loader run, via ctx.waitUntil (never a second
    client round trip, never blocking the redirect) — appends a row to
    data/agent-query-log.json
  - getTopicRankings: simple count aggregation in-process over the JSON log, no ML
    ranking
  - topic label generation: one LLM call per new topicKey, persisted in
    data/topic-rankings.json

phase_3_admin_surface:
  - build src/sections/AgentDashboard/AgentDashboard.tsx
  - widgets: topic ranking table, zero-result trend, search->PLP redirect rate,
             fallback rate, p50/p95 latency, cache hit rate
  - every number renders with its evidence source (Proposal.evidence) — no unsourced figures
  - "Gerar coleções sugeridas" -> proposeCollections() runs the 3-stage pipeline and
    persists a Proposal to data/proposals.json. It does NOT bust a cache.
  - review screen: diff + evidence + PLP preview + per-topic approve/edit/reject
  - autonomy selector on the agent card, defaulting to `sugerir`
  - dry run = the same proposeCollections() with commit:false — nothing persisted.
    Build this early: it is a dev tool before it is a feature.
  - CUTTABLE if time-constrained: inline copy editing, PLP preview. The minimum that is
    still an agent: aggregation -> one copy call -> validation -> approvable list
    writing to data/proposals.json.

phase_4_trending_collections:
  - build src/sections/TrendingCollections/TrendingCollections.tsx
  - data fetched client-side via TanStack Query (same pattern as SearchResult.tsx)
    OR rendered as a deferred section (deferredSectionLoader, already imported at
    src/routes/$.tsx:3) — see cache decision
  - place once on the homepage via CMS (manual placement)
  - verify: changing topic frequency in data/topic-rankings.json changes the homepage
    without a deploy

phase_5_hardening_and_demo:
  - synonyms, implicit price ranges, multi-filter selection
  - comparative demo: literal search returning 0 results vs. agent-resolved filtered PLP
  - business impact slide (see success_metrics for what is actually measurable)
```

## admin_surface

### decision: dashboard as a CMS section, not a protected route
```yaml
chosen: cms_section_on_unindexed_page
rejected: custom_route_with_new_auth
reason: |
  Revision 1 assumed `/admin/agent-dashboard` could reuse "whatever auth already gates
  admin routes in src/worker-entry.ts". That auth does not exist. What lives there
  (src/worker-entry.ts:47-53 — handleMeta, handleDecofileRead, handleDecofileReload,
  handleRender) is the deco CMS *admin protocol* for the editor and preview, not a user
  session gate. There is no reusable auth for an arbitrary /admin route.
  Rendering the dashboard as a CMS section on an unindexed page inherits the real
  admin gate, and gets editor + preview for free.
alternatives_if_rejected:
  - Cloudflare Access in front of the route
  - shared token in header/cookie — acceptable for the hackathon ONLY if stated as
    explicit technical debt in the pitch, never presented as auth
```

### decision: one artifact (Proposal), autonomy is a gate — adopted from tese-admin-agentes.md §3
```yaml
principle: |
  Automatic mode is NOT a different code path. Every agent run — manual, scheduled, or
  fully autonomous — produces the same artifact: a Proposal. The autonomy level only
  decides what happens to it after creation.
consequences:
  - "Preview always exists, in every mode, because there is always a Proposal to render."
  - "Dry run is the same run() with commit:false. No separate simulator."
  - "Rollback is free: `before` is stored in the Proposal. Reverting is rewriting `before`."
  - "Changing autonomy level does not change the agent. It is configuration, not code."
rejected_v1: recompute_ranking_and_invalidate_cache   # that is BI, not an agent
```

### the pipeline: deterministic -> LLM -> deterministic
```yaml
why: "The model touches only the middle stage. Selection and resolution stay in code."
stage_1_aggregation_no_model: |
  getTopicRankings(windowDays) aggregates AgentQueryLog (data/agent-query-log.json)
  in-process. Sanity filters live HERE, not in model judgement: minimum count,
  minimum distinct sessions (otherwise one person refreshing 200x becomes a
  "trend"), exclude topics that fell back, denylist. Output is topicKey + count.
  Data, not prose.
stage_2_one_llm_call_copy_only: |
  Input: the already-cleaned topic list. Output: { topicKey, title, subtitle } per topic,
  via structured outputs. The model does NOT choose which topics qualify (stage 1 did),
  does NOT build URLs (stage 3 does), and NEVER sees raw rawUserText — only the
  normalized topicKey. One call per batch, not per topic. Titles persist in
  data/topic-rankings.json keyed by topicKey and are never regenerated per render.
stage_3_resolve_and_validate_no_model: |
  Each topicKey resolves back to a URL using the same page.filters the search agent uses.
  A topic whose filter no longer exists in the catalog is dropped here, not shipped as a
  broken proposal. The resulting object is validated against the section's JSON Schema
  (already in .deco/meta.gen.json — it is what feeds the deco editor). A Proposal that
  does not validate never reaches the review screen.
```

### Proposal artifact — adopted from tese-admin-agentes.md §6
```typescript
interface Proposal {
  id: string;
  agent: "trending-collections";
  createdAt: number;

  // The change. `before` is what makes rollback free.
  target: string;                    // e.g. "home.trending-collections" — a logical
                                      // key the section reads by, not a file path
  before: unknown;                   // entry in data/proposals.json as it is now
  after: unknown;                    // entry in data/proposals.json as proposed

  // The why — natural language, what the human reads first
  hypothesis: string;
  reasoning: string;

  // Provenance. NON-NEGOTIABLE: no number in the admin without a clickable source.
  evidence: Array<{ metric: string; value: number; window: string; source: string }>;

  status: "pending" | "approved" | "rejected" | "applied" | "reverted";
  appliedAs: null | "json";
  decidedBy: null | `human:${string}` | `auto:${string}`;
}
```
Stored in `data/proposals.json`, one entry per proposal, keyed by `id`. The review
screen shows the diff, the evidence (including the top 3 real queries behind
each topicKey), a preview of the resolved PLP with its product count, and per-topic
approve/edit/reject. Titles are editable inline so a human fixes copy without rejecting
the whole proposal.

### autonomy level — a store-owner setting, not a hardcoded exclusion
```yaml
principle: "Same code path. The gate is configuration, exposed to the store owner."
setting: "agent.autonomy — persisted per agent, changeable at runtime, no redeploy."

levels:
  - level: sugerir
    v1_default: true
    behavior: "Proposal goes to a review queue. Nothing reaches the store until approved."
    apply_paths_available: [json]
  - level: autonomo
    v1_default: false
    behavior: "Proposal is auto-approved and applied. Undo window stays open via `before`."
    apply_paths_available: [json]
    requires: "Explicit opt-in by the store owner. See risks.autonomous_content_from_user_text."

apply_paths:
  - id: json
    what: "Approved proposals are written into data/proposals.json (status flips to
           `applied`); TrendingCollections and the dashboard read from there at
           render time."
    human_needed: false
    changes_prod: "Immediately, next request. No deploy, no CMS write."
    note: "This is the only apply path in v1, and it is what makes the demo work.
           Writing real .deco/blocks/*.json via git or the GitHub API is a
           capability the underlying stack has, but it's infra plumbing that
           doesn't change what needs demonstrating: an agent that proposes, a
           human (or an autonomy setting) that decides, and a storefront section
           that reflects the decision. Out of scope here — revisit only if this
           moves past the demo stage."

scheduling: |
  Fully unattended operation additionally needs `triggers.crons` in wrangler.jsonc and a
  `scheduled` handler in src/worker-entry.ts. Neither exists today (verified). Config
  only — no exotic pieces.
```

## TrendingCollections section spec
```typescript
interface TrendingCollectionsProps {
  windowDays?: number;       // default 7
  maxTopics?: number;        // default 3-5
  productsPerTopic?: number; // default 4-8
}
// Behavior:
// 1. getTopicRankings(windowDays) from src/platform/analytics
// 2. for top N topics, resolve each topicKey to its filtered PLP query and fetch products
// 3. render one carousel per topic, title = TopicRanking.label
```

### cache decision (corrects revision 1)
```yaml
problem: "The homepage edge cache would freeze trending topics for the demo window."
wrong_fix: |
  Revision 1 proposed a setCacheProfile override in src/cache-config.ts. That adjusts
  data-fetch profiles, but the edge cache for "/" caches the whole HTML response —
  a profile override does not punch through it.
correct_fix: |
  Either (a) the section fetches its data client-side via TanStack Query — the pattern
  src/components/search/SearchResult.tsx already uses — or (b) it is registered as a
  deferred section (deferredSectionLoader is already imported at src/routes/$.tsx:3).
  Both bypass the page-level HTML cache by construction.
```

## success_metrics
```yaml
measurable_in_v1:   # observable from the worker / JSON log alone
  - metric: zero_result_search_rate
    before: literal keyword search baseline
    after: agent-mediated filter selection
  - metric: search_to_plp_redirect_rate
    purpose: fraction of free-text queries resolved to a filtered PLP vs. falling back
  - metric: fallback_rate
    purpose: inverse of the above, broken down by cause (low confidence / no match / error)
  - metric: agent_latency_p50_p95
    purpose: proves the hot path is viable, and demonstrates the JSON cache effect
  - metric: cache_hit_rate
    purpose: JSON translation cache + Claude prompt cache, reported separately

not_measurable_in_v1:
  - metric: plp_conversion_rate
    reason: |
      Requires GTM events correlated to session + purchase. The repo has
      useSendEvent / window.DECO.events (Form.tsx:56-63 already fires a `search` event)
      but no conversion pipeline. CUT from the dashboard.
    handling: "Keep on the business-impact slide as a projection, with the formula stated:
               impact = zero_result_rate_reduction x plp_conversion_rate x traffic x AOV"
```

## risks
```yaml
- risk: incorrect_filter_extraction
  status: STRUCTURALLY ELIMINATED
  mitigation: "The model selects from FilterCandidate[] built by the loader. A filter that
               does not exist cannot be selected. Selections are still resolved back
               against the candidate list before redirecting."

- risk: filter_matches_zero_products
  status: STRUCTURALLY ELIMINATED
  mitigation: "FilterToggle values carry `quantity` (src/components/search/Filters.tsx:102,115).
               Candidates with quantity === 0 are never offered to the model."

- risk: search_latency
  mitigation: |
    ONE LLM call (not a tool_use loop — that was 2-4 round trips / 3-8s and is the single
    biggest correction in this revision). effort: "low". Prompt caching on the stable
    prefix. JSON translation cache in front of everything. Literal search renders on any
    timeout — the fallback is the default path, not an error branch.

- risk: llm_provider_undefined
  status: NEW — was missing from revision 1
  mitigation: "phase_0. No AI binding or API secret exists in wrangler.jsonc today."

- risk: no_persistence_layer
  status: RESOLVED — no binding needed
  mitigation: "phase_0. Data lives in data/*.json, read/written directly by the
               worker. No D1/KV binding for the demo; revisit only if this needs to
               survive real concurrent writes or scale past a single store's dataset."

- risk: admin_route_auth_undefined
  status: CONFIRMED REAL — revision 1's premise was wrong
  mitigation: "Dashboard ships as a CMS section, inheriting the real admin gate."

- risk: homepage_cache_ttl_masks_trending_updates
  mitigation: "Client-fetched or deferred section — not a cache-config override."

- risk: topic_label_quality
  mitigation: "One LLM generation per topicKey, persisted in data/topic-rankings.json. Never regenerated per render."

- risk: autonomous_content_from_user_text
  status: NEW — this is why `sugerir` is the v1 default, not a technical limitation
  description: |
    Trending collection copy is derived, transitively, from rawUserText. An agent running
    at `autonomo` can publish a homepage collection title originating from a long-tail,
    test, or abusive query. The risk is content, not infrastructure.
  mitigation: |
    Layered, and mostly outside the model:
      - stage 1 filters (min count, min distinct sessions, denylist) run in SQL before
        the model sees anything
      - the model never receives rawUserText, only the normalized topicKey
      - stage 3 schema validation drops malformed proposals
      - `sugerir` is the shipped default; `autonomo` is opt-in by the store owner
      - `before` in every Proposal keeps undo one click away at any level
  demo_guidance: |
    Run the demo at `sugerir`. Present `autonomo` as the same code path with the gate
    configured differently — that IS the architectural argument, and it is stronger than
    showing an unattended publish.

- risk: geo_agentic_track_uncovered
  status: NEW — declared in metadata, zero coverage in the solution
  mitigation: |
    Make this an explicit decision, not an omission. Cheapest high-value item:
    expose the commerce loaders as an MCP endpoint so an external agent can query the
    catalog — that is literally agentic commerce. Secondary: llms.txt. JSON-LD already
    partially exists (PLPJsonLd, BreadcrumbJsonLd — SearchResult.tsx:2).
    If the track is dropped, drop it from `metadata.hackathon_front` too.

- risk: scope_overrun
  mitigation: "MVP = single-filter selection. Multi-filter, synonyms, and price heuristics
               are phase_5 and cuttable."
```

## explicit_exclusions
```yaml
- "No cart write actions (addToCart) in this agent."
- "No checkout flow changes."
- "No getProductDetails / compareProducts tools in v1 — the agent's only output is a URL,
   and there is no UI surface to render a detail view or comparison table. Revision 1
   specified both tools against a stated no-chat-UI non-goal; that was an internal
   contradiction, now resolved by cutting them."
- "No tool_use loop in the hot path — a single structured-output call."
- "No LLM-authored filter query params — selection only, from loader-returned values."
- "No client-side interception of the search submit — resolution happens in the /s loader."
- "No custom popularity index in v1."
- "No proposal apply is hardcoded off — it is an autonomy SETTING (see admin_surface).
   v1 ships defaulting to `sugerir` (human approves). `autonomo` exists on the same code
   path and is opt-in by the store owner."
- "No CMS block writes (.deco/blocks/*.json via git/PR) in v1 — proposals are applied
   by writing to data/proposals.json, which storefront sections read directly. See
   admin_surface.apply_paths."
- "No new backend service outside the existing Cloudflare Worker / TanStack Start server functions."
```
