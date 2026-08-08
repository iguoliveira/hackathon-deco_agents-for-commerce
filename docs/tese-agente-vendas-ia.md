# SPEC: conversational-recommendation-agent

## metadata
```yaml
project: demo-storefront
hackathon_front: search_discovery + seo_geo_agentic_commerce
repo_stack: tanstack-start, react19, cloudflare-workers, deco-cms
status: catalog_implemented_agents_pending
revision: 6
revision_notes: "r2: agent runs as a single structured-output call (not a tool_use loop), filters are discovered at runtime from the commerce protocol, resolution happens in the /s loader, added phase_0 blockers, reframed the admin surface as a proposal-generating agent. r3: reconciled with docs/tese-admin-agentes.md — adopted its Proposal artifact (before/evidence), split storage by access pattern (KV for proposals, D1 for aggregation), and made the autonomy level an explicit store-owner setting instead of a hardcoded v1 exclusion. r4: dropped the Shopify Storefront API, D1, and KV bindings — the goal for this build is to demonstrate agent behavior, not stand up real commerce/persistence infra. Catalog, query log, and proposals moved to static/generated JSON files. r5: replaced those JSON files with SQLite (D1 binding CATALOG_DB). The r4 reasoning still holds — no Shopify, no external service — but flat JSON was the wrong shape for the aggregation the analytics domain needs, and whole-file rewrites are not a safe concurrent write path. D1 is SQLite: local-only, no cloud resource provisioned. The catalog half is BUILT (see implementation_status); the agent tables are not. r6 (2026-08-07): three amendments approved by the team, all consequences of the storefront no longer reading the catalog from Shopify — (a) a custom popularity index is now ALLOWED when computed from user_events in SQL, because BEST_SELLING does not exist for the local `products` table; (b) sortHint values corrected to the ones the local PLP actually accepts (src/platform/catalog/catalog.plp.ts:23-33) — the previous list would have been silently ignored; (c) .claude/skills/agent-creator/SKILL.md updated at both points. Runtime is Vercel Node + Supabase Postgres, not Workers + D1 — see docs/deploy-vercel-supabase.md; the persistence section below is stale on the binding and correct on the reasoning."
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

## implementation_status

```yaml
# O que já existe no repo, para ninguém reimplementar nem assumir de menos.
built:
  - what: "Catálogo em SQLite (D1), binding CATALOG_DB"
    where:
      - db/migrations/0001_create_catalog.sql  # 5 tabelas
      - db/migrations/0002_seed_catalog.sql    # 1 produto, 3 variantes
      - db/README.md                           # fluxo de migrations
      - src/platform/catalog/            # types -> d1 -> mapper -> actions -> barrel
      - src/loaders/catalogProductList.ts
      - src/setup.ts                     # registro em registerCommerceLoaders
      - .deco/blocks/Product%20List%20Loader.json  # aponta para o loader do catálogo
      - package.json                     # predev -> db:migrate; db:reset; db:query
    verified: "Banco apagado e reconstruído do zero via `npm run dev`; vitrine da home
               renderiza a partir do SQLite; migrations idempotentes; typecheck limpo."
not_built:
  - "Tabelas do agente: agent_query_log, topic_rankings, proposals, query_cache."
  - "Todo o hot path do agente (phase_1 em diante)."
  - "PDP, PLP e busca continuam no Shopify — só a vitrine da home migrou."
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
    1. run the existing broad/literal search for <term> against the local SQLite
       catalog (binding CATALOG_DB — src/platform/catalog remonta as linhas no
       mesmo `Product` que a Storefront API devolveria, so nothing downstream
       needs to know the source changed)
    2. read page.filters  (Filter[] / FilterToggle[] from @decocms/apps-commerce/types)
       -> this IS the action space: real labels, real counts, real hrefs
    3. SQLite cache lookup: normalize(term) -> cached plpUrl? (table query_cache)
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
  /**
   * Maps to an existing PLP sort querystring value, never a raw catalog enum.
   * r6: corrected to the values src/platform/catalog/catalog.plp.ts:23-33 parses.
   * The previous list ("best_selling", "price_asc", "price_desc") matched nothing
   * — parseSort would have fallen through to relevance without any error.
   * "popularity" is reserved for when the user_events ordering exists (see r6
   * amendment a); do not emit it before the loader accepts it.
   */
  sortHint?: "relevance" | "price:asc" | "price:desc";
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

### AgentQueryLog (persisted to SQLite — see persistence)
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
  label: string;      // LLM-generated once, then cached in the topic_rankings table — never regenerated per render
  count: number;
  windowDays: number;
}
```

## persistence

### decision: SQLite (D1), local-only
```yaml
chosen: sqlite_via_d1
rejected:
  - static_json_files      # era a decisão da r4; ver why_not_json
  - shopify_storefront_api # r4, mantido fora
  - cloudflare_kv          # r4, mantido fora
what_d1_is: |
  D1 é o SQLite gerenciado da Cloudflare. Não é "parecido com SQLite" — é SQLite,
  com SQL real, índices e transações. Em `vite dev` o binding materializa um
  arquivo .sqlite comum em `.wrangler/state/v3/d1/`, abrível em qualquer cliente.
  O @cloudflare/vite-plugin persiste no mesmo diretório que `wrangler d1 --local`
  usa, então dá para semear pela CLI e ler pelo dev server.
why_not_json: |
  A r4 escolheu JSON para evitar infra, e essa motivação continua válida — nada
  de Shopify, nada de serviço externo. Mas JSON plano tem dois problemas que
  aparecem exatamente onde o projeto precisa:
    - agregação: getTopicRankings tem filtros de sanidade (min count, min sessões
      distintas, denylist) que em JSON viram Array.reduce à mão a cada request;
      em SQL é um GROUP BY com HAVING.
    - escrita: `data/*.json` só se escreve reescrevendo o arquivo inteiro, o que
      perde escrita concorrente. logAgentQuery roda via ctx.waitUntil em toda
      busca — é justamente o caminho onde isso quebra.
  D1 resolve os dois sem trazer serviço novo: continua rodando dentro do Worker.
local_only: |
  Nenhum banco remoto foi provisionado. `database_id` no wrangler.jsonc é um
  placeholder, o que basta para `vite dev` e `wrangler d1 ... --local` e falha de
  propósito em `wrangler deploy`. Ir para produção = `wrangler d1 create` e colar
  o id real. Deploy está fora do escopo desta fase.
caveats:
  - "`.wrangler/` é gitignored: o banco NÃO é versionado. O que se versiona é o
     SQL em db/. `npm run dev:clean` apaga o estado — recriar = reaplicar
     migration + seed."
  - "Ao mexer em bindings, `wrangler types` gera um worker-configuration.d.ts que
     QUEBRA o typecheck (colide com os tipos de Request dos pacotes @decocms/*,
     que shippam TS cru e escapam do skipLibCheck). Por isso os bindings são
     declarados à mão em src/types/cloudflare-bindings.d.ts — adicione binding
     novo lá."
```

### tabela por artefato
```yaml
# Substitui o mapa data/*.json da r4. Uma tabela por artefato, mesma forma dos
# tipos em data_contracts.
catalog:        "products, product_images, product_props, variants, variant_options — BUILT"
AgentQueryLog:  "agent_query_log — uma linha por busca resolvida pelo agente"
TopicRanking:   "topic_rankings — topicKey + label gerado uma vez, nunca por render"
Proposal:       "proposals — uma linha por proposta, chave `id`"
query_cache:    "query_cache — normalize(term) -> plpUrl"
access_rule: |
  Todo acesso passa por src/platform/<domínio>/<domínio>.d1.ts. Nenhum SQL fora
  desses arquivos — é a mesma fronteira que hoje isola o catálogo (o mapper
  devolve `Product`, e nada acima dele sabe que existe banco).
```

## file_layout_to_create
```
src/platform/catalog/     # JÁ EXISTE — catálogo em SQLite
  catalog.types.ts     # linhas cruas do SQLite, uma interface por tabela
  catalog.d1.ts        # queries (único lugar com SQL de catálogo)
  catalog.mapper.ts    # linhas -> Product (espelha o toProduct do Shopify)
  catalog.actions.ts   # listProducts()
  index.ts

src/platform/agent/
  agent.types.ts       # FilterCandidate, AgentSelection, AgentQueryLog
  agent.actions.ts     # resolveSearchQuery(term, candidates) -> { plpUrl } | { fallback: true }
  agent.claude.ts      # the single structured-output call + prompt cache breakpoints
  agent.d1.ts          # tabela query_cache: normalize(term) -> plpUrl
  agent.filters.ts     # ProductListingPage["filters"] -> FilterCandidate[]
  index.ts

src/platform/analytics/
  analytics.types.ts   # TopicRanking
  analytics.actions.ts # logAgentQuery(), getTopicRankings(windowDays), proposeCollections()
  analytics.d1.ts      # agent_query_log / topic_rankings / proposals + agregação em SQL
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
  - [DONE] data lives in SQLite (D1 binding CATALOG_DB), local-only — still no
      Shopify, still no external service. Full rationale and caveats in the
      `persistence` section; table-per-artifact map there too.
      catalog -> products / product_images / product_props / variants /
                 variant_options. BUILT: db/migrations/0001_catalog.sql +
                 src/platform/catalog/. Substitui a chamada à Storefront API e
                 devolve o mesmo `Product`, então nada downstream muda.
      agent + analytics tables -> agent_query_log, topic_rankings, proposals,
                 query_cache. AINDA NÃO CRIADAS — cada uma entra na fase que a
                 consome, não antes.
      All reads/writes go through src/platform/*/*.d1.ts so the storage shape is
      isolated behind one module per domain, not scattered across callers.
  - resolve the admin gate BEFORE building any dashboard UI (see admin_surface.decision)

phase_1_agent_hot_path:
  - agent.filters.ts: ProductListingPage["filters"] -> FilterCandidate[] (drop quantity === 0)
  - agent.claude.ts: single structured-output call, effort low, prompt cache breakpoint
  - agent.d1.ts: query_cache table keyed on normalize(term)   # was phase_3 — it is
                                                        # what makes the demo fast, it belongs here
  - wire resolveSearchQuery into the EXISTING /s route loader (302 on success)
  - fallback: low confidence / empty selection / any error -> render literal search
  - verify prompt caching: usage.cache_read_input_tokens > 0 on the second identical call

phase_2_analytics_foundation:
  - logAgentQuery from inside the same loader run, via ctx.waitUntil (never a second
    client round trip, never blocking the redirect) — INSERT into agent_query_log
  - getTopicRankings: count aggregation in SQL (GROUP BY topicKey + HAVING para os
    filtros de sanidade), no ML ranking
  - topic label generation: one LLM call per new topicKey, persisted in
    topic_rankings

phase_3_admin_surface:
  - build src/sections/AgentDashboard/AgentDashboard.tsx
  - widgets: topic ranking table, zero-result trend, search->PLP redirect rate,
             fallback rate, p50/p95 latency, cache hit rate
  - every number renders with its evidence source (Proposal.evidence) — no unsourced figures
  - "Gerar coleções sugeridas" -> proposeCollections() runs the 3-stage pipeline and
    persists a Proposal to the proposals table. It does NOT bust a cache.
  - review screen: diff + evidence + PLP preview + per-topic approve/edit/reject
  - autonomy selector on the agent card, defaulting to `sugerir`
  - dry run = the same proposeCollections() with commit:false — nothing persisted.
    Build this early: it is a dev tool before it is a feature.
  - CUTTABLE if time-constrained: inline copy editing, PLP preview. The minimum that is
    still an agent: aggregation -> one copy call -> validation -> approvable list
    writing to the proposals table.

phase_4_trending_collections:
  - build src/sections/TrendingCollections/TrendingCollections.tsx
  - data fetched client-side via TanStack Query (same pattern as SearchResult.tsx)
    OR rendered as a deferred section (deferredSectionLoader, already imported at
    src/routes/$.tsx:3) — see cache decision
  - place once on the homepage via CMS (manual placement)
  - verify: an UPDATE on topic_rankings changes the homepage without a deploy

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
  getTopicRankings(windowDays) aggregates agent_query_log in SQL. Sanity filters
  live HERE, not in model judgement: minimum count, minimum distinct sessions
  (otherwise one person refreshing 200x becomes a "trend"), exclude topics that
  fell back, denylist. Em SQL isso é um GROUP BY com HAVING — foi um dos motivos
  de trocar JSON por SQLite (ver persistence.why_not_json). Output is
  topicKey + count. Data, not prose.
stage_2_one_llm_call_copy_only: |
  Input: the already-cleaned topic list. Output: { topicKey, title, subtitle } per topic,
  via structured outputs. The model does NOT choose which topics qualify (stage 1 did),
  does NOT build URLs (stage 3 does), and NEVER sees raw rawUserText — only the
  normalized topicKey. One call per batch, not per topic. Titles persist in
  topic_rankings keyed by topicKey and are never regenerated per render.
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
  before: unknown;                   // row in `proposals` as it is now
  after: unknown;                    // row in `proposals` as proposed

  // The why — natural language, what the human reads first
  hypothesis: string;
  reasoning: string;

  // Provenance. NON-NEGOTIABLE: no number in the admin without a clickable source.
  evidence: Array<{ metric: string; value: number; window: string; source: string }>;

  status: "pending" | "approved" | "rejected" | "applied" | "reverted";
  appliedAs: null | "sqlite";
  decidedBy: null | `human:${string}` | `auto:${string}`;
}
```
Stored in the `proposals` table, one row per proposal, keyed by `id`. `before`,
`after` e `evidence` são colunas TEXT com JSON serializado — são blobs opacos que
só o admin lê inteiros, nunca filtrados em SQL, então não vale normalizar. The review
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
    apply_paths_available: [sqlite]
  - level: autonomo
    v1_default: false
    behavior: "Proposal is auto-approved and applied. Undo window stays open via `before`."
    apply_paths_available: [sqlite]
    requires: "Explicit opt-in by the store owner. See risks.autonomous_content_from_user_text."

apply_paths:
  - id: sqlite
    what: "Approved proposals are UPDATEd in the proposals table (status flips to
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
measurable_in_v1:   # observable from the worker / agent_query_log alone
  - metric: zero_result_search_rate
    before: literal keyword search baseline
    after: agent-mediated filter selection
  - metric: search_to_plp_redirect_rate
    purpose: fraction of free-text queries resolved to a filtered PLP vs. falling back
  - metric: fallback_rate
    purpose: inverse of the above, broken down by cause (low confidence / no match / error)
  - metric: agent_latency_p50_p95
    purpose: proves the hot path is viable, and demonstrates the query_cache effect
  - metric: cache_hit_rate
    purpose: query_cache table + Claude prompt cache, reported separately

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
    prefix. query_cache lookup (indexed, one row) in front of everything. Literal search
    renders on any timeout — the fallback is the default path, not an error branch.

- risk: llm_provider_undefined
  status: NEW — was missing from revision 1
  mitigation: "phase_0. No AI binding or API secret exists in wrangler.jsonc today."

- risk: no_persistence_layer
  status: RESOLVED — D1 binding CATALOG_DB, local-only
  mitigation: "Ver a seção `persistence`. SQLite dentro do próprio Worker: sem
               serviço externo, mas com SQL real para agregação e sem o problema de
               reescrever arquivo inteiro a cada escrita. Nenhum banco remoto
               provisionado — o binding é local."

- risk: local_db_is_not_versioned
  status: MITIGADO — migrations automáticas no predev
  description: |
    `.wrangler/` é gitignored, então o .sqlite não entra no git e `npm run dev:clean`
    o apaga. Sem automação, quem clonasse o repo subiria com banco vazio — e a falha
    é silenciosa (o loader devolve null, a section some, nenhum erro alto).
  mitigation: |
    Schema e seed são migrations versionadas em db/migrations/, aplicadas pelo hook
    `predev` a cada `npm run dev`. O wrangler registra o que já rodou em
    `d1_migrations`, então é idempotente: não duplica linha nem sobrescreve
    alteração feita à mão. `npm run db:reset` reconstrói do zero. Ver db/README.md.
    Verificado apagando .wrangler/state/v3/d1 e subindo o dev do zero.

- risk: admin_route_auth_undefined
  status: CONFIRMED REAL — revision 1's premise was wrong
  mitigation: "Dashboard ships as a CMS section, inheriting the real admin gate."

- risk: homepage_cache_ttl_masks_trending_updates
  mitigation: "Client-fetched or deferred section — not a cache-config override."

- risk: topic_label_quality
  mitigation: "One LLM generation per topicKey, persisted in topic_rankings. Never regenerated per render."

- risk: autonomous_content_from_user_text
  status: NEW — this is why `sugerir` is the v1 default, not a technical limitation
  description: |
    Trending collection copy is derived, transitively, from rawUserText. An agent running
    at `autonomo` can publish a homepage collection title originating from a long-tail,
    test, or abusive query. The risk is content, not infrastructure.
  mitigation: |
    Layered, and mostly outside the model:
      - stage 1 filters (min count, min distinct sessions, denylist) run in SQL
        (GROUP BY / HAVING sobre agent_query_log) before the model sees anything
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
- "SUPERSEDED in r6 — was: 'No custom popularity index in v1.' A popularity signal
   computed from user_events with a SQL GROUP BY over a time window is now allowed,
   and is the only option left: the storefront reads the catalog from Postgres, so
   Shopify's BEST_SELLING is not reachable. Still excluded: any popularity index
   requiring a job, a materialized table, or a service of its own."
- "No proposal apply is hardcoded off — it is an autonomy SETTING (see admin_surface).
   v1 ships defaulting to `sugerir` (human approves). `autonomo` exists on the same code
   path and is opt-in by the store owner."
- "No CMS block writes (.deco/blocks/*.json via git/PR) in v1 — proposals are applied
   by writing to the proposals table, which storefront sections read directly. See
   admin_surface.apply_paths."
- "No new backend service outside the existing Cloudflare Worker / TanStack Start server
   functions. D1 não viola isso: é um binding do próprio Worker, não um serviço à parte."
- "No remote D1 database. O binding é local-only (`database_id` placeholder); deploy está
   fora do escopo desta fase. Ver persistence.local_only."
- "No ORM. SQL escrito à mão em src/platform/*/*.d1.ts — o volume de queries não paga a
   dependência nem o passo de codegen."
```
