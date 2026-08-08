# Personal Shopping Agent — proposta de MVP (tools, MCPs e agentes)

> Terceiro documento da série. Os outros dois são conceituais:
>
> - `personal-shopping-agent-mvp.md` — o **quê** (arquitetura conceitual)
> - `personal-shopping-agent-optimization.md` — o **como não ficar lento**
> - **este** — o **onde**: o mesmo desenho aterrado neste repositório, com os
>   nomes de arquivo, tabelas e funções que já existem, e o que falta criar.
>
> Onde este documento discorda dos outros dois, é porque a premissa deles não
> vale aqui. Cada divergência está justificada na §2.

---

## 1. O que o repositório já tem (fatos verificados)

Levantado lendo `db/migrations/`, `src/platform/` e `.deco/blocks/`. Números do
catálogo derivados das migrations — **não foi possível contar ao vivo**, não há
`.env` com `DATABASE_URL` nesta máquina.

### Catálogo — está pronto e é bom o bastante

| | |
|---|---|
| Produtos | ~136 (32 herdados do Shopify + 104 gerados pela `0011`) |
| Variantes | 887 só na `0011` |
| Faixa de preço | R$ 69 – R$ 899 |
| `product_type` | 38 tipos distintos, preenchido em 100% |
| Coleções | 8 (`shirts`, `accessories`, `hoodies-sweatshirts`, `bottoms`, `jackets-outerwear`, `shoes`, `dresses`, `kids`) |
| Tags | 53 distintas, vocabulário repetido de propósito (`everyday` 69×, `unisex` 63×, `layering` 40×, `cotton` 39×, `winter` 26×, `summer` 17×…) |
| Esgotados | 35 variantes indisponíveis de propósito, espalhadas por tipo |
| Descrições | média ~866 caracteres, em português, dizendo material, caimento, ocasião |

O passo 4 do MVP doc ("criar o catálogo") **está feito, e melhor do que o
exemplo do documento**: as tags são o eixo de similaridade que o `monitor 4K`
do exemplo nem tinha.

### Sinais que já são capturados

| Sinal | Onde | Estado |
|---|---|---|
| Desejo declarado (esperou por variante esgotada) | `stock_alerts` (`db/migrations/0005`) | **gravando** |
| Eventos de loja (`view_item`, `add_to_cart`, `search`, `select_item`, `view_item_list`, `add_to_wishlist`, `view_promotion`, `select_promotion`) | `src/sdk/useSendEvent.ts` → `window.DECO.events` | **disparando no browser, ninguém escuta no servidor** |
| Identidade do comprador logado | `alerts.session.ts:22` (`readShopperIdentity`, via Shopify) | funciona logado |
| Wishlist / newsletter por cookie | `src/loaders/_cookie.ts` | padrão de cookie já estabelecido |

### Consultas que já são "agent-ready"

| Função | Arquivo | Serve como |
|---|---|---|
| `findSimilarAvailable(variantId)` | `src/platform/catalog/catalog.d1.ts:409` | **candidate retrieval explicável** — devolve `sameType`, `sameCollection`, `sharedTags`, não só a nota |
| `searchCatalog(opts)` | `src/platform/catalog/catalog.d1.ts:226` | busca + facetas com `quantity`, na mesma query |
| `toProductListingPage(...)` | `src/platform/catalog/catalog.plp.ts:124` | produz `filters[]` com label + quantidade + href = o **espaço de ação** do agente de busca |
| `findWaitedItems(email)` | `src/platform/alerts/alerts.d1.ts` | desejo já cruzado com o catálogo |
| `findOptionNames()` / `findCollectionHandles()` | `catalog.d1.ts:314,342` | whitelists — impedem filtro inventado |
| índice FTS GIN | `db/migrations/0009` | busca textual sobre título+descrição |
| coluna `products.embedding vector(1536)` | `db/migrations/0009` | **existe e está vazia** |

### O que não existe

Identidade de visitante anônimo · event store no servidor · perfil · intenção ·
qualquer chamada de LLM · qualquer cache · qualquer tabela do agente
(`agent_query_log`, `topic_rankings`, `proposals`, `query_cache` estão na spec
aprovada e **não** foram criadas).

---

## 2. Correções de premissa

Cinco coisas que os dois documentos assumem e que não valem neste repositório.
Ignorar qualquer uma custa tempo de implementação.

**2.1 O catálogo é moda, e o código não pode saber disso.** Todo exemplo dos dois
docs é `monitor 4K USB-C para MacBook`; aqui não existe monitor, e "specs" são
material, caimento, estação e tamanho. Mas a conclusão **não** é trocar o
vocabulário de eletrônico pelo de moda — é não ter vocabulário nenhum no código.
O time decidiu (2026-08-07) que o agente é genérico por construção: os eixos são
descobertos em runtime do próprio catálogo, e trocar a loja não muda uma linha.
Consequência prática em todo o resto deste documento: onde se lê "tamanho", o
código lê uma dimensão de opção descoberta por `findOptionNames()`. Ver
`personal-shopping-agent-mudancas.md` §1.

**2.2 Não existe Redis, e o runtime é Vercel Node.** O doc de otimização assume
Redis como camada quente. O stack real é Vercel serverless + Supabase Postgres
(`docs/deploy-vercel-supabase.md`). Duas consequências: (a) memória de processo
não sobrevive entre requests, então cache em `Map` só serve dentro do mesmo
isolate; (b) não existe `ctx.waitUntil` de Worker — escrita "assíncrona" ou é
inline, ou usa `waitUntil` de `@vercel/functions`, ou a função congela antes de
terminar. A camada quente ficou em Postgres por decisão (§14, D1).

**2.3 O índice full-text está em `english` e as descrições da `0011` estão em
português.** `db/migrations/0009:29` usa `to_tsvector('english', ...)`. Isso não
dá erro: só faz stemming errado e descarta as stopwords erradas. Uma busca por
"moletom" contra descrição em português com dicionário inglês degrada em
silêncio. Correção é uma migration de 3 linhas (`'portuguese'`), mas precisa ser
decidida — parte do catálogo herdado do Shopify está em inglês, então o certo é
uma coluna `tsvector` com o dicionário escolhido por produto, ou aceitar
`simple` (sem stemming) para os dois.

**2.4 Não há identidade para visitante anônimo.** `readShopperIdentity` só
resolve logado, via Shopify. Sem um identificador, dois page views do mesmo
visitante são duas pessoas para o banco, e nenhum perfil se acumula. O padrão de
cookie já existe em `src/loaders/_cookie.ts`.

> **Atualizado em 2026-08-07.** Eu tinha classificado isto como o bloqueio
> número um; o time reposicionou o produto como agente para loja que **já
> vende**, onde o histórico se acumula com o tempo de navegação. Com isso, o item
> deixa de ser bloqueio e vira infraestrutura barata que precede os eventos: a
> decisão é **sessão primeiro**, e persistir entre visitas é um atributo de
> cookie a mais na mesma resposta. O que dá e o que não dá para saber de um
> visitante deslogado está em `personal-shopping-agent-mudancas.md` §2.

**2.5 A proibição de índice de popularidade próprio caducou — APROVADA a emenda
(2026-08-07).** `.claude/skills/agent-creator/SKILL.md` mandava redirecionar
popularidade para o `BEST_SELLING` da Shopify. Mas o storefront não lê mais o
catálogo da Shopify — home, PLP, busca e PDP apontam todos para os loaders
locais — e `BEST_SELLING` não existe para a tabela `products`. Com `user_events`
no servidor, popularidade vira um `COUNT(*) GROUP BY` de janela. O time aprovou
as três emendas; elas já estão aplicadas na skill e na spec (r6). Continua
proibido qualquer índice de popularidade que exija job, tabela materializada ou
serviço próprio.

---

## 3. Arquitetura proposta

O princípio dos dois docs se mantém: **LLM entende, SQL ordena**. O que muda é
onde cada peça mora.

```text
                         VISITANTE
                             │
              cookie deco_visitor (passo 0)
                             │
                             ▼
   ┌─────────────────────────────────────────────────┐
   │  BROWSER                                        │
   │  window.DECO.events  ──subscribe único──┐       │
   │  (8 tipos já disparados hoje)           │       │
   └─────────────────────────────────────────┼───────┘
                                             │ batch + sendBeacon
                                             ▼
                          site/actions/events/track   ← 1 endpoint novo
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │ user_events │  (Postgres)
                                      └──────┬──────┘
                                             │ mesmo request, SQL agregado
                                             ▼
                                    ┌──────────────────┐
                                    │  user_context    │  snapshot + version
                                    │  (1 linha/pessoa)│
                                    └────────┬─────────┘
                                             │
                     gatilho relevante?──────┤──────não──────┐
                             │ sim                           │
                             ▼                               │
                    ┌─────────────────┐                      │
                    │  INTENT AGENT   │  Haiku, fora do      │
                    │  (LLM)          │  caminho crítico     │
                    └────────┬────────┘                      │
                             │ grava user_intent             │
                             └───────────────┬───────────────┘
                                             ▼
   ═══════════════ CAMINHO CRÍTICO (sem LLM) ════════════════
                                             │
     GET /  ou  GET /s  ou  PDP              │
                    │                        │
                    ▼                        ▼
          leitura de 1 linha         candidate retrieval
          (snapshot + intent)      searchCatalog / findSimilarAvailable
                    │                        │
                    └───────────┬────────────┘
                                ▼
                          RANKER (TypeScript puro, ≤100 candidatos)
                                │
                                ▼
                     recommendation_log  +  UI "Para você"
   ═══════════════════════════════════════════════════════════
                                │
                                ▼
                          nova ação → novo evento → volta ao topo


   FORA DO CAMINHO CRÍTICO, quando há decisão que exige raciocínio:

        SEARCH RESOLVER (Opus, effort low)     — /s, spec já aprovada
        SHELF COPY (Haiku, cacheado)           — o "por que recomendamos"
        MERCHANDISING (Opus)                   — propostas no admin

   INTEGRAÇÃO:
        /mcp  →  Catalog MCP · Customer MCP · Store Context MCP
                 (as mesmas funções, empacotadas — não um caminho novo)
```

Meta de custo: **≤ 2 chamadas de LLM por sessão**, nenhuma delas bloqueando
render de página.

---

## 4. Modelo de dados — 4 tabelas novas

Uma migration por artefato, na numeração livre a partir da `0012`. Todas em
Postgres, todas acessadas por `src/platform/<domínio>/<domínio>.d1.ts` (a mesma
fronteira que hoje isola o catálogo).

### `0012_visitors.sql` — identidade

```sql
CREATE TABLE IF NOT EXISTS visitors (
  visitor_id  TEXT PRIMARY KEY,           -- uuid do cookie deco_visitor
  email       TEXT,                       -- preenchido no login; costura anônimo→logado
  consent     TEXT NOT NULL DEFAULT 'none', -- 'none' | 'store' | 'store+browser'
  bucket      SMALLINT NOT NULL,          -- 0|1 — A/B determinístico, sem infra
  created_at  TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visitors_email ON visitors(email);
```

`bucket` é `hash(visitor_id) % 2` gravado uma vez. É o A/B inteiro: grupo 0 vê a
vitrine de sempre, grupo 1 vê a personalizada. Sem serviço de experimentação,
sem flag remota, e reprodutível na demo.

### `0013_user_events.sql` — event store

```sql
CREATE TABLE IF NOT EXISTS user_events (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,      -- view_item | search | add_to_cart | ...
  properties JSONB NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL       -- ISO 8601 UTC, TEXT como o resto do schema
);
CREATE INDEX IF NOT EXISTS idx_events_visitor  ON user_events(visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type     ON user_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_product  ON user_events((properties->>'product_group_id'));
```

Sem FK para `visitors` nem para `products`: o seed do catálogo apaga e reinsere
linhas (ver `0011`), e um `ON DELETE CASCADE` destruiria histórico de
comportamento no `db:reset` — mesmo raciocínio já documentado em `0005`.

`TEXT` em `created_at` e não `timestamptz` pela razão já documentada em
`0005:31`: o driver devolveria `Date` e o tipo passaria a mentir.

### `0014_user_context.sql` — perfil, intenção e versão

```sql
CREATE TABLE IF NOT EXISTS user_context (
  visitor_id      TEXT PRIMARY KEY,
  context_version INTEGER NOT NULL DEFAULT 1,
  -- Long-term: preferências estáveis. Recalculado em compra/alerta/janela longa.
  profile         JSONB NOT NULL DEFAULT '{}',
  -- Session: derivado por SQL a cada evento relevante. Barato.
  session         JSONB NOT NULL DEFAULT '{}',
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_intent (
  visitor_id  TEXT PRIMARY KEY,
  topic_key   TEXT NOT NULL,             -- normalizado: minúsculo, sem acento, hífen
  intent      JSONB NOT NULL,            -- { label, types[], collections[], tags[], priceBand, confidence }
  confidence  DOUBLE PRECISION NOT NULL,
  source      TEXT NOT NULL,             -- 'llm' | 'search-resolver' | 'heuristic'
  expires_at  TEXT NOT NULL,             -- TTL: 30 min de inatividade
  created_at  TEXT NOT NULL
);
```

`profile` e `session` separados por frequência de escrita, exatamente como manda
o §2 do doc de otimização — só que a "camada quente" é uma linha indexada em
Postgres em vez de Redis. `context_version` incrementa a cada mudança relevante
e entra na chave do cache de recomendação (§16 do doc de otimização).

### `0015_agent_logs.sql` — observabilidade e cache

```sql
CREATE TABLE IF NOT EXISTS recommendation_log (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_id      TEXT NOT NULL,
  surface         TEXT NOT NULL,   -- 'home-shelf' | 'plp-rerank' | 'pdp-alt'
  topic_key       TEXT,
  context_version INTEGER NOT NULL,
  candidates      INTEGER NOT NULL,
  recommended     JSONB NOT NULL,  -- [{ handle, score, reasons[] }]
  llm_called      BOOLEAN NOT NULL DEFAULT FALSE,
  cache_hit       BOOLEAN NOT NULL DEFAULT FALSE,
  latency_ms      INTEGER NOT NULL,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS query_cache (          -- da spec aprovada
  term_normalized TEXT PRIMARY KEY,
  plp_url         TEXT NOT NULL,
  hits            INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL
);
```

`recommendation_log` é o §20 do MVP doc virando tabela. Guardar `reasons[]` por
produto é o que permite responder "por que este item apareceu para esta pessoa"
na hora da apresentação — e é o que salva a depuração da demo.

---

## 5. As tools

Dez tools. **Cinco já existem** e só precisam de casca. Nenhuma delas escreve no
carrinho ou no checkout — a exclusão da spec aprovada continua valendo.

| # | Tool | Assinatura | Onde mora | Estado |
|---|---|---|---|---|
| 1 | `get_user_context` | `(visitorId) → UserContextSnapshot` | `platform/context/context.d1.ts` | criar |
| 2 | `get_recent_behavior` | `(visitorId, windowDays) → BehaviorSummary` | `platform/context/context.d1.ts` | criar |
| 3 | `get_current_intent` | `(visitorId) → Intent \| null` | `platform/context/context.d1.ts` | criar |
| 4 | `get_waited_items` | `(email) → WaitedItem[]` | `platform/alerts/alerts.d1.ts` | **existe** |
| 5 | `search_products` | `({term, collection, options, sort, page}) → {records, total, facets}` | `catalog.d1.ts:226` | **existe** |
| 6 | `get_product` | `(handle) → Product` | `catalog.d1.ts:359` | **existe** |
| 7 | `find_similar_available` | `(variantId, limit) → SimilarCandidate[]` | `catalog.d1.ts:409` | **existe** |
| 8 | `get_filter_candidates` | `(url) → FilterCandidate[]` | `agent.filters.ts` sobre `catalog.plp.ts:124` | criar (spec) |
| 9 | `get_inventory` | `(productHandles, size?) → {handle, sizesAvailable[]}` | `platform/catalog` | criar (trivial) |
| 10 | `rank_products` | `(snapshot, intent, candidates) → Scored[]` | `platform/ranking/ranking.ts` | criar — **TypeScript puro, sem LLM** |

Duas regras que valem para todas:

- **Toda tool é uma função TypeScript primeiro.** MCP é embalagem (§6). Nenhuma
  tool nasce como endpoint MCP — isso é o que o próprio MVP doc pede na §10
  ("não deixem MCP virar o objetivo do projeto").
- **Nenhuma tool devolve payload cru da Shopify.** Convenção já cobrada pelo
  validador em `.claude/skills/agent-creator/scripts/validate-domain.mjs`.

### Tool 10 em detalhe — o ranker

É o coração e é determinístico. Adaptação da fórmula do §14 do MVP doc ao que
este catálogo de fato tem:

```
score = 0.30 × intent_match       -- product_type ∈ intent.types (.5)
                                  -- + coleção (.2) + Jaccard de tags (.2)
                                  -- + preço dentro da faixa (.1)
      + 0.20 × profile_match      -- afinidade de tags/cores do histórico longo
      + 0.15 × waited_similarity  -- reusa findSimilarAvailable dos stock_alerts
      + 0.15 × session_affinity   -- co-visualização na sessão, com decay temporal
      + 0.10 × popularity         -- COUNT de view_item/add_to_cart, 7 dias (§2.5)
      + 0.10 × business           -- profundidade de estoque + em promoção
```

**Multiplicador de opção** — provavelmente o sinal de maior retorno por linha de
código, e genérico por construção (§2.1):

```
× option_fit  -- 1.0 se os valores de opção que esta pessoa demonstrou preferir
              --     estão disponíveis neste produto
              -- 0.3 se o produto existe mas o valor dela não
```

A dimensão não é escolhida no código: vem de `findOptionNames()`. Nesta loja ela
resolve para `Size`; noutra, para `Voltagem` ou `Capacidade`. E os valores saem
de graça de três lugares que já gravamos — variante vista na PDP, variante no
carrinho e `stock_alerts.variant_id` — com `variants.available` dizendo o resto.
Recomendar a peça perfeita num tamanho que não existe é o erro mais caro de uma
loja de roupa, e o equivalente vale em qualquer categoria com variante.

Cada componente da nota vira uma string em `reasons[]` (`"mesmo tipo"`,
`"3 tags em comum: winter, layering, cotton"`, `"seu tamanho M disponível"`).
É o que alimenta a explicação na UI **sem chamar LLM**.

---

## 6. Os MCPs

Um endpoint HTTP (`POST /mcp`, Streamable HTTP, no mesmo handler da Vercel),
três toolsets lógicos. Nada de servidor novo — a exclusão "no new backend
service" da spec continua respeitada.

```text
Catalog MCP          Customer MCP              Store Context MCP
─────────────        ─────────────             ─────────────────
search_products      get_user_context          get_current_page
get_product          get_recent_behavior       get_current_cart
find_similar         get_waited_items          get_current_filters
get_inventory        get_current_intent
get_filter_candidates

escopo: PÚBLICO     escopo: SESSÃO             escopo: SESSÃO
read-only           (cookie/token)             (cookie/token)
```

**Por que dividir assim:** é o único corte em que a fronteira de autorização
coincide com a fronteira de dados. Catalog MCP não tem nada a proteger — é o
catálogo público, e expô-lo **é** agentic commerce (cobre o track
`seo_geo_agentic_commerce` que a spec aprovada declara e classifica como
descoberto, em `risks.geo_agentic_track_uncovered`). Customer e Store Context
carregam dado pessoal e **nunca** podem aceitar `visitorId` como parâmetro: a
identidade vem do cookie da requisição, senão qualquer um lê o perfil de
qualquer um. Essa é a mesma decisão já tomada em `notifyMe/subscribe.ts` ("a
sessão vence o e-mail do corpo").

**Ordem de construção:** MCP entra na fase 5, depois de tudo funcionar. Se o
tempo apertar, corta — e o produto continua de pé. Isso é literalmente a §29 do
MVP doc.

**Complemento não aprovado (§14, D3):** um `/llms.txt` estático e completar o
JSON-LD que já existe parcialmente (`PLPJsonLd`, `BreadcrumbJsonLd`). Meia hora,
fecharia a narrativa "a loja é legível por agentes externos". Fica como upside
se a fase 5 terminar cedo.

---

## 7. Os agentes

Quatro. Cada um com gatilho, modelo e fallback explícitos.

### 7.1 `intent-agent` — Haiku, assíncrono

| | |
|---|---|
| **Quando roda** | busca nova · 3+ `view_item` do mesmo tipo sem intenção ativa · `add_to_cart` · `notifyMe` |
| **Quando NÃO roda** | scroll · paginação · outro produto da mesma categoria · qualquer render de página |
| **Entrada** | snapshot compacto: últimas 5 buscas, 8 produtos vistos (título+tipo+tags), itens esperados, faixa de preço observada |
| **Saída** | `{ label, types[], collections[], tags[], priceBand, confidence, topicKey }` — structured output, valores **validados contra o vocabulário real** (`findOptionNames`, `findCollectionHandles`, `SELECT DISTINCT product_type`) |
| **Fallback** | intenção heurística por moda estatística dos tipos vistos, `confidence: 0.35` |
| **Custo** | ~1 chamada por sessão; TTL de 30 min de inatividade |

O `topicKey` é o mesmo contrato de
`.claude/skills/agent-creator/SKILL.md` — normalizado igual, porque o dashboard e
a `TrendingCollections` leem dele.

### 7.2 `search-resolver` — Opus effort low, no loader `/s`

Já especificado e aprovado em `docs/tese-agente-vendas-ia.md`. **Não reprojetar.**
A única adição desta proposta: quando ele resolve uma busca, ele **também**
grava `user_intent` — a intenção já foi inferida ali, e inferir de novo no
`intent-agent` seria pagar duas vezes pela mesma pergunta.

### 7.3 `shelf-agent` — o Personal Shopping Agent propriamente dito

Este é o produto. E ele é **majoritariamente código, não LLM**:

```text
1. lê user_context + user_intent          (1 query)
2. candidate retrieval                     (1 query: searchCatalog OU findSimilarAvailable)
3. rank_products                           (TypeScript, ~100 candidatos)
4. decide a experiência:
     confidence ≥ 0.6  → 4 produtos + explicação personalizada
     0.4 – 0.6         → 4 produtos + explicação genérica ("popular esta semana")
     < 0.4             → NÃO personaliza: vitrine padrão
5. copy do "por quê"  → Haiku, cacheado por (topicKey, hash dos handles)
6. recommendation_log
```

O passo 4 é o que separa isto de um recomendador comum, e é o §16 do MVP doc:
**um bom agente sabe quando não recomendar**. Na demo, mostrar o visitante novo
recebendo vitrine genérica vale tanto quanto mostrar o perfil quente recebendo
vitrine cirúrgica.

O passo 5 é a única chamada de LLM, ela é cacheada, e se falhar a UI cai nas
`reasons[]` determinísticas do ranker — a explicação existe sem o modelo.

### 7.4 `merchandising-agent` — admin, fase tardia

Já especificado (`tese-agente-vendas-ia.md`, `admin_surface`): agrega
`agent_query_log`, gera `Proposal` com `before`/`evidence`, humano aprova. Fora
do escopo desta proposta exceto por um ponto: o `recommendation_log` desta
proposta é fonte de evidência para ele. Nada a mudar lá.

---

## 8. Onde a personalização aparece

A §29 do MVP doc é clara: personalização visível é prioridade 1. Três
superfícies, em ordem de retorno:

| Superfície | O que muda | Custo |
|---|---|---|
| **Home — shelf "Para você"** | Section nova, dados buscados client-side via TanStack Query (o cache de HTML da home congelaria a vitrine — armadilha já documentada na skill) | alto retorno, ~3h |
| **PDP — "no seu tamanho"** | Reordena as alternativas por `size_fit` e intenção, em vez de posição fixa | médio, ~1h |
| **PLP — re-rank** | Reordena os resultados dentro da página pelo score | baixo na demo (sutil demais para se ver no telão) |

O card da shelf carrega a explicação — e a explicação cita **sinal real**:

```text
Para você, Vinicius
  Porque você esperou o Classic Pullover Hoodie no M
  e vem olhando peças de inverno em algodão.

  [Oversized Hoodie]  [Bomber Jacket]  [Beanie]  [Long Sleeve Tee]
     M disponível        M disponível    único      M disponível
```

---

## 9. Métricas

Mensurável com o que esta proposta constrói, sem pipeline de conversão:

| Métrica | Como | Baseline |
|---|---|---|
| CTR da vitrine | `select_item` / `view_item_list` por bucket | bucket 0 (vitrine fixa) |
| Add-to-cart por sessão | `COUNT(add_to_cart) / COUNT(DISTINCT session_id)` | bucket 0 |
| Taxa de busca com zero resultado | `/s` com `total = 0` | antes/depois do search-resolver |
| Chamadas de LLM por sessão | `recommendation_log.llm_called` | meta: ≤ 2 |
| Latência p50/p95 da recomendação | `recommendation_log.latency_ms` | meta: p95 < 300 ms |
| Cache hit rate | `recommendation_log.cache_hit` + `query_cache.hits` | — |

**Não mensurável, e é preciso dizer isso no palco:** conversão e receita por
sessão. Não há pipeline de compra. Vai como projeção com a fórmula à vista —
mesma honestidade que `success_metrics.not_measurable_in_v1` da spec já exige.

O A/B é o `bucket` da tabela `visitors`. Determinístico, reprodutível, e dá para
forçar o bucket por querystring na demo.

---

## 10. Demo — duas personas do catálogo real

Substituem o "gamer vs. Mac" do MVP doc, que não existe neste catálogo.

**Perfil A — inverno / streetwear**
```
buscas:      "moletom oversized", "jaqueta bomber"
vistos:      Classic Pullover Hoodie, Oversized Hoodie
esperou:     Classic Pullover Hoodie tamanho M  (variante esgotada real da 0011)
intenção:    layering de inverno, algodão, R$ 150–350
→ shelf:     Oversized Hoodie · Bomber Jacket · Beanie · Long Sleeve Tee
             todos com M disponível
```

**Perfil B — verão / minimalista**
```
buscas:      "vestido leve", "algo para o calor"
vistos:      dresses, Relaxed Crop Tee
tags:        summer, women, minimalist
intenção:    vestido de verão, R$ 100–250
→ shelf:     dresses + Slides + Tote Bag
```

**Perfil C — o visitante novo.** Chega sem histórico. A vitrine é a padrão, e o
agente **diz** que não personalizou. É o slide que prova que o sistema tem
critério.

Mesma loja. Mesmo catálogo. Mesmo código. O que muda é o contexto — que é
exatamente a frase da §26 do MVP doc.

---

## 11. Plano de execução

Estimativas para 5 pessoas em paralelo. As fases 0–3 são o MVP mínimo; da 4 em
diante é upside.

| Fase | Entrega | Prova | ~Horas | Depende de |
|---|---|---|---|---|
| **0** | cookie `deco_visitor` + tabela `visitors` + banner de consentimento | toda requisição tem identidade | 2h | — |
| **1** | subscriber de eventos + `user_events` + snapshot por SQL | dois perfis geram snapshots diferentes | 4h | 0 |
| **2** | `intent-agent` + `user_intent` + TTL/invalidação | busca muda a intenção; product_view não | 3h | 1 |
| **3** | `rank_products` + shelf "Para você" + explicação | **dois perfis, mesma home, produtos diferentes** | 4h | 1 (2 é opcional aqui) |
| **4** | `recommendation_log` + dashboard + A/B por bucket | número na tela com fonte clicável | 3h | 3 |
| **5** | endpoint `/mcp` (3 toolsets) | agente externo consulta o catálogo | 3h | 5 tools já existem |
| **6** | `search-resolver` no `/s` (spec aprovada) | busca livre resolve em PLP filtrada | 4h | independente |

Fora do plano por decisão (§14): browser context/extensão (D2) e embeddings
(D4). A correção do dicionário FTS (D4) é uma migration avulsa, ~20 min, sem
dependência — encaixa em qualquer fase.

**Ordem de corte, se o tempo apertar:** 5 → 4 → 2. A fase 3 sem a 2 ainda
demonstra personalização (usando intenção heurística) — é o menor sistema que
ainda prova a tese.

**Caminho crítico real:** fase 0. Nada funciona sem identidade, e é a tarefa que
parece menor e não é.

---

## 12. Privacidade e segurança

Não é seção de conformidade — são quatro decisões de implementação:

1. **Consentimento antes do primeiro evento.** `visitors.consent` começa em
   `'none'`; com `'none'`, grava-se sessão efêmera e nada é associado a
   identidade persistente. Já existem blocos `Cookie Consent` no
   `.deco/blocks/` — reaproveitar, não criar tela nova.
2. **Dado de browser externo não é coletado** (§14, D2). `visitors.consent`
   mantém o valor `'store+browser'` no enum porque o pipeline o aceita e é isso
   que o slide de arquitetura afirma — mas nenhum código o grava nesta versão.
   Se um dia entrar: coluna própria, nunca misturada aos eventos de loja, para
   que revogar seja um `DELETE` e não uma arqueologia.
3. **Texto de usuário nunca vira instrução.** `rawUserText` entra no prompt do
   `intent-agent` como *dado delimitado*; a saída é validada contra o
   vocabulário real do catálogo antes de virar filtro. Filtro inventado é
   estruturalmente impossível, como já é no search-resolver.
4. **Customer MCP jamais aceita `visitorId` por parâmetro.** Identidade vem do
   cookie. Sem isso, o MCP é um vazamento de perfil com cara de feature.

---

## 13. Riscos

| Risco | Mitigação |
|---|---|
| **Entrada pobre** — poucos eventos, vitrine parece aleatória | Seed sintético das duas personas antes da demo. Diagnóstico já registrado em `feature-back-in-stock-shelf.md`: *suspeite da entrada antes do agente* |
| **Fase 0 subestimada** | É o caminho crítico. Alguém dedicado, primeiro |
| **Escrita de evento atrasando o request** | `waitUntil` de `@vercel/functions`, ou insert inline (é uma linha, ~10 ms pelo pooler). O que **não** funciona é promise solta: a função serverless congela |
| **Cache da home congelando a shelf** | Section busca dados client-side. Armadilha já documentada na skill do time |
| **FTS em dicionário errado (§2.3)** | Migration decidida em §14 (D4). Sem ela, a fase 6 fica com base pior do que poderia |
| **Emenda à spec sobre popularidade (§2.5)** | Aprovar explicitamente com o time antes de implementar |
| **Escopo** | Fases 5–7 são cortáveis por construção. Nenhuma fase anterior depende delas |

---

## 14. Decisões tomadas

Os quatro forks foram decididos em 2026-08-07. Ficam registrados com o
descartado à vista, porque "por que não fizemos X" é a pergunta que volta na
véspera.

**D1 — Camada quente: Postgres puro.**
`user_context` é uma linha indexada; o serviço já existe e não há credencial
nova. Redis (Upstash REST) foi considerado por fidelidade ao doc de otimização e
descartado: um segundo lugar onde o contexto pode ficar stale, em troca de ~20 ms.
A narrativa de cache continua verdadeira — o que muda é que o armazenamento
quente é Postgres, e a apresentação deve dizer isso em vez de desenhar Redis.

**D2 — Browser context: só no slide.**
Sem extensão, sem coleta externa, sem consentimento de segundo nível. O sinal
que já temos (`stock_alerts` + busca dentro da loja) é mais forte e mais
defensável do que histórico de navegador. A fase 7 sai do plano de código e vira
um slide de arquitetura: *o pipeline aceita esse sinal, e o consentimento é a
porta*.

**D3 — MCP público de catálogo: entra, na fase 5.**
Cobre o track `seo_geo_agentic_commerce` que a spec aprovada declara e classifica
como descoberto. Cinco das tools já existem; o Catalog MCP é casca. `llms.txt` e
completar o JSON-LD **não** foram aprovados junto — ficam como complemento
opcional, se a fase 5 terminar cedo.

**D4 — Só corrigir o FTS; embeddings ficam de fora.**
Uma migration trocando o dicionário (§2.3). `products.embedding` continua vazia
e nenhum provedor externo entra no projeto. Com `product_type` e tags em 100% do
catálogo, a similaridade estrutural ordena bem e é explicável — que é
exatamente o argumento já escrito em `db/migrations/0009:14-18`. Reavaliar
depois de medir a vitrine, não antes.
