# SPEC: conversational-recommendation-agent

## metadata
```yaml
project: demo-storefront
hackathon_front: search_discovery + seo_geo_agentic_commerce
repo_stack: tanstack-start, react19, cloudflare-workers, shopify-storefront-api, deco-cms
status: thesis_approved_pending_implementation
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
  - id: no_contextual_ranking
    description: "PLP is not re-ranked based on inferred intent + popularity; generic listing shown regardless of query context."
```

## solution_thesis
```yaml
approach: "Agent embedded in the existing site search bar (no new chat UI) that parses free-text search input into structured catalog filters, then navigates the user client-side to the existing PLP route with those filters applied and sort=popularity (most-wanted -> least-wanted)."
explicit_non_goals:
  - "Agent does NOT call any cart mutation (no addToCart action)."
  - "Agent does NOT complete checkout."
  - "Agent does NOT decide the purchase; it only narrows the catalog view."
  - "Agent does NOT introduce a new chat/conversation UI component; it extends the existing search input."
rationale:
  - "Removes write-path risk (no incorrect autonomous cart actions)."
  - "No new UI surface for users to learn — same search bar, smarter behavior."
  - "Directly matches hackathon front: PLP ordering / search & discovery."
  - "Smaller surface area = lower implementation risk given fixed timeline."
```

## architecture
```
[existing search bar component, src/components/search/] -> [server function: search submit handler]
                        -> tool: interpretFilters(text) -> StructuredFilters
                        -> tool: searchProducts(StructuredFilters) -> Product[]
                        -> tool: getProductDetails(productId) -> ProductDetail
                        -> tool: compareProducts(productIds[]) -> ComparisonTable
                  -> agent emits: { plpUrl: string }
[client] -> on search submit, intercepts default literal-search navigation and instead
            navigates via <Link preload="intent"> (@tanstack/react-router) to plpUrl
[PLP route] -> existing Shopify loader, sort=BEST_SELLING, filters applied from query params
```
Note: no new UI surface is introduced. The existing search input's submit handler is extended to call the agent pipeline instead of (or before falling back to) literal keyword search.

## data_contracts

### StructuredFilters
```typescript
interface StructuredFilters {
  category?: string;
  priceMax?: number;
  priceMin?: number;
  attributes?: Record<string, string>; // e.g. { material: "thermal", use_case: "running" }
  sort: "BEST_SELLING"; // fixed for v1, MUST match Shopify ProductSortKeys enum
}
```

### Agent tool schema (Claude tool_use format)
```json
[
  {
    "name": "interpretFilters",
    "description": "Extract structured catalog filters from a free-text user request.",
    "input_schema": {
      "type": "object",
      "properties": { "userText": { "type": "string" } },
      "required": ["userText"]
    }
  },
  {
    "name": "searchProducts",
    "description": "Query the Shopify catalog with structured filters, sorted by BEST_SELLING.",
    "input_schema": {
      "type": "object",
      "properties": {
        "category": { "type": "string" },
        "priceMin": { "type": "number" },
        "priceMax": { "type": "number" },
        "attributes": { "type": "object" }
      }
    }
  },
  {
    "name": "getProductDetails",
    "input_schema": {
      "type": "object",
      "properties": { "productId": { "type": "string" } },
      "required": ["productId"]
    }
  },
  {
    "name": "compareProducts",
    "input_schema": {
      "type": "object",
      "properties": { "productIds": { "type": "array", "items": { "type": "string" } } },
      "required": ["productIds"]
    }
  }
]
```

## file_layout_to_create
```
src/platform/agent/
  agent.types.ts       # StructuredFilters, SearchQueryInput, AgentResponse types
  agent.actions.ts      # createServerFn: resolveSearchQuery(userText) -> AgentResponse ({ plpUrl })
  agent.hooks.ts        # useMutation wrapper, following useCart() pattern
  agent.shopify.ts       # adapter: StructuredFilters -> Shopify Storefront API query/sort params
  index.ts               # barrel export

src/components/search/
  (existing search bar component — MODIFY, do not replace)
  # extend the existing submit handler to call agent.actions.resolveSearchQuery(userText)
  # and navigate to the returned plpUrl instead of (or as fallback from) the current
  # literal-keyword search route
```
Note: MUST follow existing convention in `src/platform/cart/` (types/actions/hooks/adapter/barrel) for the new `platform/agent/` domain. No new CMS section/UI is created — the existing search component in `src/components/search/` is extended, not replaced.

## build_sequence
```yaml
phase_1_foundation:
  - create src/platform/agent/* following src/platform/cart/* shape
  - implement interpretFilters, searchProducts, getProductDetails, compareProducts as Claude tools
  - build resolveSearchQuery server function with tool_use loop
  - enumerate existing PLP query param vocabulary (category, price, attributes) to constrain interpretFilters output space

phase_2_integration:
  - locate and extend the existing search bar component in src/components/search/
  - on submit, call resolveSearchQuery(userText) instead of (or before) the current literal-keyword search
  - wire searchProducts to real Shopify Storefront API loader, sort=BEST_SELLING
  - implement navigation: agent response -> construct PLP URL with filters+sort -> <Link preload="intent">
  - e2e test: free text typed into the existing search input -> filters -> correct PLP URL -> correct rendered listing

phase_3_metrics_and_hardening:
  - instrument GTM events: search_to_plp_redirect, plp_filtered_conversion
  - expand interpretFilters: synonyms, implicit price ranges ("baratinho" -> priceMax heuristic), multi-attribute
  - handle: zero-match filter (suggest nearest valid filter, do not render empty PLP silently), ambiguous input (fall back to literal keyword search rather than blocking the user), unknown attribute (explicit "not available" message)

phase_4_demo_prep:
  - comparative demo: literal keyword search returning 0 results vs agent-derived PLP with results, same search bar
  - business impact slide with formula: impact = (zero_result_rate_reduction) x (plp_conversion_rate) x (monthly_traffic) x (AOV)
```

## success_metrics
```yaml
- metric: zero_result_search_rate
  before: baseline literal keyword search
  after: agent-mediated filter translation
- metric: plp_conversion_rate
  compare: agent-filtered PLP vs traditional search/PLP
- metric: search_to_plp_redirect_rate
  purpose: validate intent-translation quality (fraction of free-text queries successfully resolved to a filtered PLP vs falling back to literal search)
- metric: top_of_list_ctr
  purpose: validate BEST_SELLING ordering improves perceived relevance
```

## risks
```yaml
- risk: incorrect_filter_extraction
  mitigation: "interpretFilters output is validated against the PLP's known filter vocabulary before navigating; on low-confidence extraction, fall back to the existing literal-keyword search instead of guessing"
- risk: filter_matches_zero_products
  mitigation: "agent explicitly states no exact match and offers nearest valid filter instead of rendering empty PLP"
- risk: popularity_proxy_inaccurate_on_day_1
  mitigation: "use Shopify native BEST_SELLING sort as v1; custom search-frequency-based ranking is a post-hackathon iteration"
- risk: search_latency
  mitigation: "cache frequent filter translations; keep the existing search input's instant/literal behavior as immediate fallback while the agent call resolves, avoiding a blocking wait on every keystroke"
- risk: scope_overrun
  mitigation: "MVP = single-attribute + price filter only; multi-attribute/synonym handling is phase_3, cuttable if time-constrained"
```

## extension: admin_dashboard_and_trending_collections

### decision
```yaml
chosen_approach: option_a_dynamic_section
rejected_for_hackathon: option_b_cms_block_write
reason: "Option B requires a programmatic block-write API in @decocms/start that is not documented in the repo README. Confirming/discovering it mid-hackathon is a schedule risk. Option A achieves the same user-visible effect (homepage shows auto-updated trending collections) using only patterns already proven in this repo (platform/<domain> convention, section rendering, existing Shopify search loader)."
future_iteration: "Option B (writing real CMS blocks via admin protocol) is a valid post-hackathon upgrade — call out explicitly in the pitch as a stated next step, not a limitation being hidden."
```

### data_model: query logging
```typescript
// src/platform/analytics/analytics.types.ts
interface AgentQueryLog {
  id: string;
  timestamp: number;
  rawUserText: string;
  filters: StructuredFilters; // reuses type from src/platform/agent/agent.types.ts
  topicKey: string; // normalized: e.g. category+primary_attribute -> "tenis-corrida"
}

interface TopicRanking {
  topicKey: string;
  label: string; // human-readable, can be LLM-generated once and cached
  count: number;
  windowDays: number; // e.g. 7 or 30
}
```

### file_layout_to_create (extension)
```
src/platform/analytics/
  analytics.types.ts     # AgentQueryLog, TopicRanking
  analytics.actions.ts   # createServerFn: logAgentQuery(filters), getTopicRankings(windowDays)
  analytics.hooks.ts      # useQuery wrapper for admin dashboard consumption
  index.ts

src/routes/admin/
  agent-dashboard.tsx     # protected route, charts + topic ranking table

src/sections/TrendingCollections/
  TrendingCollections.tsx  # CMS section placed once on homepage; self-refreshing
```
Note: `logAgentQuery` MUST be called from the same server function that runs `interpretFilters` in `src/platform/agent/agent.actions.ts` (the `resolveSearchQuery` handler triggered by the existing search bar) — do not add a second network round-trip from the client.

### admin_dashboard_requirements
```yaml
route: /admin/agent-dashboard
access: "must reuse whatever auth/session gating already exists for admin routes in src/worker-entry.ts (createDecoWorkerEntry admin route handling) — do not build a new auth mechanism"
widgets:
  - topic_ranking_table: "topicKey, label, count, trend (up/down vs previous window)"
  - zero_result_rate_chart: "time series, before/after agent launch marker"
  - search_to_plp_redirect_rate_chart: "time series"
  - plp_conversion_comparison: "bar chart, agent-filtered PLP vs traditional PLP/search"
action_button:
  label: "Gerar coleções sugeridas"
  behavior: "triggers server function that recomputes TopicRanking and invalidates/refreshes the TrendingCollections section cache (does NOT write new CMS blocks — see decision above)"
```

### TrendingCollections section spec
```typescript
// src/sections/TrendingCollections/TrendingCollections.tsx
interface TrendingCollectionsProps {
  windowDays?: number;   // default 7
  maxTopics?: number;    // default 3-5, keep homepage scannable
  productsPerTopic?: number; // default 4-8
}
// Behavior:
// 1. loader calls getTopicRankings(windowDays) from src/platform/analytics
// 2. for top N topics, calls searchProducts(filters derived from topicKey) with sort=BEST_SELLING
// 3. renders one product carousel/grid per topic, title = TopicRanking.label
// 4. respects existing edge cache profile for "/" (static, 1 day TTL) — MUST use a shorter
//    cache override in src/cache-config.ts for this section's data fetch, or it will not
//    reflect new trending topics within the demo window
```

### build_sequence (extension)
```yaml
phase_5_analytics_foundation:
  - create src/platform/analytics/* (types, actions, hooks) following src/platform/cart/* shape
  - wire logAgentQuery into existing agent.actions.ts resolveSearchQuery handler
  - implement getTopicRankings with simple count-based aggregation (no ML ranking needed for v1)

phase_6_admin_dashboard:
  - build src/routes/admin/agent-dashboard.tsx
  - implement chart widgets (topic ranking, zero-result trend, click rate, conversion comparison)
  - wire "Gerar coleções sugeridas" button to trigger ranking recompute + cache invalidation

phase_7_trending_collections_section:
  - build src/sections/TrendingCollections/TrendingCollections.tsx
  - place section once on homepage via CMS (manual placement by team, not agent-written)
  - override cache-config.ts TTL for this section's data so trending updates are visible within demo timeframe
  - verify: changing simulated topic frequency in analytics store changes homepage collections without a deploy
```

### risks (extension)
```yaml
- risk: admin_route_auth_undefined
  mitigation: "confirm early which existing admin auth mechanism (worker-entry.ts) can gate a new route before building dashboard UI"
- risk: homepage_cache_ttl_masks_trending_updates
  mitigation: "explicit cache-config.ts override for TrendingCollections section, independent of the page-level static 1-day TTL"
- risk: cms_block_write_temptation_mid_hackathon
  mitigation: "explicitly scoped out (option_b) — do not attempt during hackathon; only revisit if phases 1-7 complete early with time to spare"
- risk: topic_label_quality
  mitigation: "LLM-generated label per topicKey, cached after first generation — do not regenerate label on every render"
```

## explicit_exclusions
```yaml
- "No cart write actions (addToCart) in this agent."
- "No checkout flow changes."
- "No new backend service outside existing Cloudflare Worker / TanStack Start server functions."
- "No custom popularity index in v1 — use Shopify BEST_SELLING sort key."
- "No programmatic CMS block writes in v1 — trending collections render dynamically from a single manually-placed section, not via agent-authored blocks (see extension.decision)."
```
