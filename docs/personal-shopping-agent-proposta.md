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

> **Revisada em 2026-08-07 (ver §15).** A versão anterior desta seção dizia
> "LLM entende, SQL ordena" e mantinha o agente fora do caminho crítico. O time
> decidiu o contrário: **o agente é o protagonista do produto**, ele fica no
> caminho da vitrine por escolha, e é ele quem decide o que a pessoa vê. O
> princípio novo é **o agente decide, o banco garante**.

A diferença entre os dois princípios não é de quantidade de LLM — é de quem tem
autoridade. Antes, o agente classificava intenção e entregava um rótulo para um
ranker fixo montar sempre a mesma vitrine de 4 produtos. Agora o agente decide
**quantas coleções existem, quais são os eixos de cada uma, como se chamam, em
que ordem aparecem e se vale a pena mostrar alguma**. O banco não escolhe nada:
ele executa o critério que o agente escreveu e responde com o que de fato existe
em estoque.

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
                                             ▼
                        getCatalogVocabulary()  ── o que a loja vende
                                             │      (§1 do doc de mudanças)
   ══════════════ O AGENTE DECIDE ═══════════│════════════════════
                                             ▼
                            ┌────────────────────────────┐
                            │     COLLECTION AGENT       │
                            │  1 chamada, structured     │
                            │  output, no caminho da     │
                            │  vitrine — por escolha     │
                            └─────────────┬──────────────┘
                                          │
                     devolve N CollectionBriefs, cada um com
                     título · narrativa · critério · ordem de
                     afrouxamento · e a decisão de não mostrar
                                          │
   ══════════════ O BANCO GARANTE ════════│════════════════════════
                                          ▼
                        ┌──────────────────────────────┐
                        │  RESOLVER DE CRITÉRIO (SQL)  │
                        │  valida contra o vocabulário │
                        │  executa · conta · afrouxa   │
                        └──────────────┬───────────────┘
                                       │ produtos que EXISTEM,
                                       │ com estoque e opção reais
                                       ▼
                     recommendation_log  +  UI (N coleções autorais)
   ═══════════════════════════════════════════════════════════════
                                       │
                                       ▼
                          nova ação → novo evento → volta ao topo


   TAMBÉM AGENTE, nas outras superfícies:

        SEARCH RESOLVER (Opus, effort low)     — /s, spec já aprovada
        MERCHANDISING (Opus)                   — propostas no admin

   INTEGRAÇÃO:
        /mcp  →  Catalog MCP · Customer MCP · Store Context MCP
                 (as mesmas funções, empacotadas — não um caminho novo)
```

Meta de custo: **1 chamada de LLM por vitrine montada**, cacheada por
(`visitorId`, `contextVersion`). Enquanto o contexto não muda, a mesma vitrine é
servida de novo sem chamar o modelo — é a §16 do doc de otimização, aplicada a
uma saída que agora é autoral em vez de derivada.

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

Onze tools. **Cinco já existem** e só precisam de casca. Nenhuma delas escreve no
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
| 9 | `get_inventory` | `(productHandles, option?) → {handle, optionValuesAvailable[]}` | `platform/catalog` | criar (trivial) |
| 10 | `resolve_collection` | `(CollectionBrief) → {products, matched, relaxedBy[]}` | `platform/collections/collections.d1.ts` | criar — **executa o critério do agente** |
| 11 | `get_catalog_vocabulary` | `() → CatalogVocabulary` | `catalog.vocabulary.ts` | criar — é o que o agente lê antes de decidir |

Duas regras que valem para todas:

- **Toda tool é uma função TypeScript primeiro.** MCP é embalagem (§6). Nenhuma
  tool nasce como endpoint MCP — isso é o que o próprio MVP doc pede na §10
  ("não deixem MCP virar o objetivo do projeto").
- **Nenhuma tool devolve payload cru da Shopify.** Convenção já cobrada pelo
  validador em `.claude/skills/agent-creator/scripts/validate-domain.mjs`.

### Tool 10 em detalhe — o resolvedor de critério

Esta tool substitui o `rank_products` das versões anteriores desta proposta. A
mudança é de autoridade, não de tecnologia: o ranker antigo **escolhia** os
produtos com uma fórmula fixa de pesos; este aqui **executa a escolha que o
agente já fez**. Ele não tem opinião sobre o que é bom — tem a obrigação de só
devolver o que é verdade.

Recebe um `CollectionBrief` (contrato em `personal-shopping-agent-mudancas.md`
§6) e faz quatro coisas, nesta ordem:

```
1. VALIDA    todo valor de types/collections/tags/optionValues é conferido
             contra getCatalogVocabulary(). Valor que não existe no catálogo é
             DESCARTADO antes de virar SQL — nunca causa erro, nunca vaza.

2. EXECUTA   uma query: WHERE product_type IN (...) AND tags @> (...) AND
             price BETWEEN ... AND EXISTS (variante com a opção pedida
             E available = true)

3. CONTA     se matched >= brief.minResults, devolve e acabou.

4. AFROUXA   se veio pouco, remove a primeira restrição de brief.relaxOrder e
             volta ao passo 2. Registra o que removeu em relaxedBy[], porque a
             UI precisa saber que a promessa do título encolheu.
```

O passo 4 é o que impede a falha mais provável deste desenho. Quanto mais
específico o agente for — que é exatamente o que queremos dele — mais fundo ele
corta um catálogo de ~136 produtos, e um recorte fino demais volta com um item
ou nenhum. Coleção vazia no telão é pior que coleção genérica. **O agente diz em
que ordem afrouxar**, porque só ele sabe qual restrição carrega a narrativa: numa
coleção chamada "no seu M, pronto pra levar", a opção `Size=M` é a última coisa
que pode cair — antes dela sai o preço, saem as tags, sai o tipo.

**A ordenação interna continua determinística e continua existindo**, mas foi
rebaixada de decisão para desempate: dentro dos produtos que casaram com o
critério, ordena por afinidade de opção, depois por popularidade
(`COUNT` de `user_events` em 7 dias, §2.5), depois por profundidade de estoque. O
agente pode sobrescrever com `brief.order`. Nada disso decide *quais* produtos
aparecem — só em que sequência.

**Disponibilidade nunca é decisão do modelo.** Os valores de opção que a pessoa
prefere saem de três lugares que já gravamos — variante vista na PDP, variante no
carrinho e `stock_alerts.variant_id` — e `variants.available` dá a palavra final.
A dimensão não é escolhida no código: vem de `findOptionNames()`. Nesta loja
resolve para `Size`; noutra, para `Voltagem` ou `Capacidade`. Recomendar a peça
perfeita num tamanho que não existe é o erro mais caro de uma loja de roupa, e é
justo o tipo de fato que um LLM não tem como saber com confiança.

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

### 7.1 `intent-agent` — Haiku, assíncrono — **rebaixado a opcional em 2026-08-07**

> Na versão anterior deste documento, este agente era o único que raciocinava
> sobre a pessoa, e o resto do sistema consumia o rótulo que ele produzia. Com o
> `collection-agent` (§7.3) lendo o contexto bruto e decidindo por conta própria,
> inferir intenção num passo separado passou a ser **pré-digestão do trabalho de
> quem manda** — e um rótulo estreito demais é justamente o que limitaria a
> especificidade que queremos do protagonista.
>
> O que sobra dele: `user_intent` continua útil como **memória entre requests**
> (o que essa pessoa parecia querer há 5 minutos), e o `search-resolver` já grava
> lá de graça (§7.2). Como agente próprio, sai do caminho crítico do MVP e vira
> corte de primeira hora. A ficha abaixo fica registrada para o caso de o
> `collection-agent` se provar caro demais para rodar a cada vitrine.

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

### 7.3 `collection-agent` — o Personal Shopping Agent propriamente dito

Este é o produto, e desde a revisão de 2026-08-07 ele é **o agente no comando**,
não uma etapa de pré-processamento. Substitui o `shelf-agent` das versões
anteriores, que só classificava intenção e deixava um ranker fixo montar sempre
a mesma prateleira de 4 produtos.

```text
1. lê user_context + user_events recentes            (1 query)
2. lê getCatalogVocabulary()                          (cacheado por isolate)
3. ┌─ UMA chamada, Opus, structured output ─────────────────────┐
   │  O agente recebe quem é a pessoa e o que a loja vende.     │
   │  Ele decide, sozinho:                                      │
   │    · quantas coleções montar (0 a 4)                       │
   │    · o eixo de cada uma (não há eixo pré-definido)         │
   │    · o título e a narrativa de cada uma                     │
   │    · a ordem em que aparecem na página                     │
   │    · o critério estruturado que define cada uma            │
   │    · em que ordem afrouxar se vier pouco resultado         │
   └────────────────────────────────────────────────────────────┘
4. para cada brief → resolve_collection (§5, tool 10)
5. descarta coleção que ficou abaixo do mínimo mesmo depois de afrouxar
6. recommendation_log, com o brief inteiro gravado
```

**O que "protagonista" significa em código.** O passo 3 não tem lista de
prateleiras possíveis. Não existe, em lugar nenhum, um `SHELVES = [...]` para o
agente escolher. Ele compõe o recorte do zero a partir do vocabulário — e por
isso duas pessoas podem receber não só produtos diferentes, mas **um número
diferente de coleções, com eixos que ninguém programou**. Uma pessoa pode receber
uma coleção por ocasião de uso; outra, uma por faixa de preço; outra, uma que
cruza o que ela esperou em estoque com o que ela vinha olhando. Nada disso está
enumerado no código.

**O que ele continua não podendo fazer**: afirmar que um produto existe, que está
em estoque, ou que tem o tamanho da pessoa. Ele escreve o critério; o banco
responde quem atende. Essa fronteira não é timidez com o modelo — é o que faz a
especificidade ser confiável. Quanto mais autoridade ele tem sobre o recorte,
mais importa que ninguém possa inventar o inventário.

**Zero coleções é uma saída legítima e prevista.** Se o agente lê o contexto e
conclui que não sabe o suficiente, ele devolve lista vazia e a home mostra a
vitrine padrão. É o §16 do MVP doc — *um bom agente sabe quando não recomendar* —
e agora a decisão é dele, não de um limiar de `confidence` no código. Na demo,
o visitante novo recebendo vitrine padrão prova que o sistema tem critério.

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
| **Home — coleções autorais** | Section nova que renderiza **N coleções** vindas do agente, não uma prateleira fixa. Dados buscados client-side via TanStack Query (o cache de HTML da home congelaria a vitrine — armadilha já documentada na skill) | alto retorno, ~4h |
| **PDP — alternativas** | Reordena as alternativas por afinidade de opção, em vez de posição fixa | médio, ~1h |
| **PLP — re-rank** | Reordena os resultados dentro da página | baixo na demo (sutil demais para se ver no telão) |

A home é a superfície que carrega a tese, e ela precisa deixar claro que **o
título e o recorte são do agente** — é isso que separa a demo de um carrossel de
recomendação comum. O layout tem que aguentar um número variável de coleções,
porque o agente decide quantas:

```text
Montei três coleções pra você, Vinicius

  ┌─ Camadas de inverno em algodão ────────────────────────┐
  │  Você esperou o Classic Pullover no M e vem olhando    │
  │  peças de inverno.                                     │
  │  [Oversized Hoodie]  [Bomber Jacket]  [Long Sleeve]    │
  │     M disponível        M disponível     M disponível  │
  └────────────────────────────────────────────────────────┘

  ┌─ Para fechar o look, abaixo de R$ 150 ─────────────────┐
  │  Todas as peças que você olhou passam de R$ 200 —      │
  │  estes acessórios combinam e cabem no resto.           │
  │  [Beanie]  [Tote Bag]  [Meia canelada]                 │
  └────────────────────────────────────────────────────────┘

  ┌─ Saiu do forno esta semana ────────────────────────────┐
  │  ...                                                   │
  └────────────────────────────────────────────────────────┘
```

Nenhum desses três títulos existe no código. Numa segunda pessoa, com outro
histórico, os três eixos são outros — e podem ser dois, ou nenhum. **É esse o
slide.** Vale mostrar o `recommendation_log` ao lado, com o brief que o agente
escreveu, para provar que o recorte não estava enumerado em lugar nenhum.

---

## 9. Métricas

Mensurável com o que esta proposta constrói, sem pipeline de conversão:

| Métrica | Como | Baseline |
|---|---|---|
| CTR da vitrine | `select_item` / `view_item_list` por bucket | bucket 0 (vitrine fixa) |
| Add-to-cart por sessão | `COUNT(add_to_cart) / COUNT(DISTINCT session_id)` | bucket 0 |
| Taxa de busca com zero resultado | `/s` com `total = 0` | antes/depois do search-resolver |
| Chamadas de LLM por sessão | `recommendation_log.llm_called` | meta: ≤ 2 |
| Latência p50/p95 da vitrine | `recommendation_log.latency_ms` | cache HIT: p95 < 300 ms · MISS (com LLM): p95 < 2,5 s |
| Cache hit rate | `recommendation_log.cache_hit` + `query_cache.hits` | meta ≥ 70% — é ele que segura a latência |
| **Coleções afrouxadas** | `recommendation_log.recommended[].relaxedBy` não vazio | meta < 30%. Acima disso, o agente está pedindo recorte mais fino do que o catálogo aguenta |
| **Coleções descartadas** | briefs que morreram por falta de resultado | meta < 10%. É o indicador de que a especificidade passou do ponto |

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
→ o agente monta 3 coleções:
   "Camadas de inverno em algodão"      (Oversized Hoodie · Bomber · Long Sleeve, M disponível)
   "Para fechar o look, até R$ 150"     (Beanie · Tote · Meia)
   "Chegou esta semana"
```

**Perfil B — verão / minimalista**
```
buscas:      "vestido leve", "algo para o calor"
vistos:      dresses, Relaxed Crop Tee
tags:        summer, women, minimalist
→ o agente monta 1 coleção só:
   "Leve para o calor, abaixo de R$ 250"   (dresses · Slides · Tote Bag)
```

**A diferença entre A e B é o slide.** Não é que os produtos mudaram — é que
**a estrutura da página mudou**: três coleções contra uma, com eixos distintos
(ocasião + preço + novidade, contra clima + preço). Nenhum dos quatro títulos
está escrito no código, e nenhuma regra diz quantas coleções mostrar.

**Perfil C — o visitante novo.** Chega sem histórico, o agente devolve lista
vazia e a home mostra a vitrine padrão. É o slide que prova que o sistema tem
critério — e agora a abstenção é decisão do agente, não um `if` de confiança.

Mesma loja. Mesmo catálogo. Mesmo código. O que muda é o contexto — que é
exatamente a frase da §26 do MVP doc.

---

## 11. Plano de execução

Estimativas para 5 pessoas em paralelo. As fases 0–3 são o MVP mínimo; da 4 em
diante é upside.

| Fase | Entrega | Prova | ~Horas | Depende de |
|---|---|---|---|---|
| **0** | cookie `deco_visitor` + tabela `visitors` + banner de consentimento | toda requisição tem identidade | 2h | — |
| **1** | `getCatalogVocabulary()` + subscriber de eventos + `user_events` + snapshot por SQL | dois perfis geram snapshots diferentes; o vocabulário sai do banco, não do código | 5h | 0 |
| **2** | **`collection-agent` + `resolve_collection` + afrouxamento** | **um contexto entra, coleções com títulos que ninguém escreveu saem — verificável no JSON, antes de qualquer UI** | 6h | 1 |
| **3** | Section de coleções na home (N variável) + explicação | **dois perfis, mesma home, coleções diferentes em número e em eixo** | 4h | 2 |
| **4** | `recommendation_log` + dashboard + A/B por bucket | número na tela com fonte clicável, e o brief do agente ao lado do resultado | 3h | 3 |
| **5** | endpoint `/mcp` (3 toolsets) | agente externo consulta o catálogo | 3h | 5 tools já existem |
| **6** | `search-resolver` no `/s` (spec aprovada) | busca livre resolve em PLP filtrada | 4h | independente |

Fora do plano por decisão (§14): browser context/extensão (D2) e embeddings
(D4). A correção do dicionário FTS (D4) é uma migration avulsa, ~20 min, sem
dependência — encaixa em qualquer fase. O `intent-agent` saiu do plano em
2026-08-07 (§7.1).

**A fase 2 é a tese.** Ela vem antes da UI de propósito: o agente montando
coleções é verificável em JSON puro, e se ele não impressiona ali, nenhuma
section vai salvar. Inversamente, se impressiona no JSON, a fase 3 é só
renderização.

**Ordem de corte, se o tempo apertar:** 6 → 5 → 4. As fases 0–3 não são
cortáveis — juntas, são o produto. Se o tempo apertar dentro da fase 2, o corte
é o número de coleções (uma só, em vez de até quatro), nunca a autoria do
recorte.

**Caminho crítico real:** continua sendo a fase 0. Nada funciona sem identidade,
e é a tarefa que parece menor e não é. O que mudou é que a fase 2 passou a
carregar o risco de produto: é a primeira vez que se vê se o agente tem, de
fato, algo interessante a dizer sobre uma pessoa.

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
   `collection-agent` como *dado delimitado*; a saída é validada contra o
   vocabulário real do catálogo antes de virar filtro. Filtro inventado é
   estruturalmente impossível, como já é no search-resolver — e essa validação
   ficou mais crítica desde que o agente passou a **compor** o critério em vez de
   escolher um pronto (§15).
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
| **Escopo** | Fases 5–6 são cortáveis por construção. Nenhuma fase anterior depende delas |
| **Especificidade acima do que o catálogo aguenta** — o agente pede um recorte fino e volta 1 produto ou nenhum | Afrouxamento em cascata na ordem que o agente definiu (§5, tool 10), `minResults` por coleção, e descarte silencioso do brief que não se sustenta. Métricas de afrouxamento e descarte na §9 |
| **LLM no caminho da home** — a vitrine passou a depender de uma chamada de modelo | Cache por (`visitorId`, `contextVersion`); a section busca client-side, então a página nunca espera pelo agente; e a vitrine padrão é o fallback de qualquer falha ou timeout. Nenhum render de HTML bloqueia no modelo |
| **Não-determinismo na demo** — a mesma pessoa recarrega e vê outra vitrine | O cache por `contextVersion` já fixa a saída enquanto o contexto não muda. Para a apresentação, `temperature` baixa e a possibilidade de fixar o brief a partir do `recommendation_log` |
| **Título bonito com produto errado** — o agente escreve "no seu M" e entra peça sem M | Estruturalmente impossível: quem resolve a coleção é SQL sobre `variants.available`. Mas a UI **precisa** ler `relaxedBy[]` e suavizar o título quando o critério afrouxou, senão a promessa do título mente |

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

**D5 — O agente é o protagonista, e fica no caminho da vitrine.**
Ver §15, que é a decisão inteira. Descartado: manter o agente como classificador
de intenção fora do caminho crítico, com um ranker fixo montando a vitrine.

**D4 — Só corrigir o FTS; embeddings ficam de fora.**
Uma migration trocando o dicionário (§2.3). `products.embedding` continua vazia
e nenhum provedor externo entra no projeto. Com `product_type` e tags em 100% do
catálogo, a similaridade estrutural ordena bem e é explicável — que é
exatamente o argumento já escrito em `db/migrations/0009:14-18`. Reavaliar
depois de medir a vitrine, não antes.

---

## 15. Decisão: o agente no topo (2026-08-07)

Esta seção registra a mudança de direção que reescreveu as §3, §5, §7, §8, §9,
§11 e §13. Fica com o descartado à vista, pela mesma razão das outras decisões.

> **O desenho anterior está preservado na íntegra** em
> `personal-shopping-agent-pre-changes.md` — a fórmula de ranking, os limiares de
> confiança, o diagrama antigo e o plano de fases, cada bloco marcado
> `PRÉ CHANGES` e com o motivo da troca. Voltar atrás não exige arqueologia no
> git.

### O que mudou

| | Antes | Agora |
|---|---|---|
| Princípio | LLM entende, SQL ordena | **O agente decide, o banco garante** |
| Papel do modelo | classificar intenção num rótulo | **montar as coleções**: quantas, quais eixos, títulos, ordem |
| Quem monta a vitrine | ranker com pesos fixos | o agente, via critério estruturado |
| Posição no fluxo | fora do caminho crítico | **no caminho da vitrine, por escolha** |
| Saída | 4 produtos, sempre | 0 a 4 coleções, com número e eixos variáveis |
| O ranking | decide o que aparece | desempata o que já foi escolhido |

### Por que

O desenho anterior tinha um teto baixo de especificidade que nenhuma quantidade
de contexto resolveria: por melhor que fosse a inferência de intenção, a saída
era sempre a mesma prateleira de quatro produtos, com o mesmo título, mudando só
o conteúdo. O agente podia entender muito e dizer pouco.

O argumento que sustentava manter o LLM fora do caminho — "não ranqueie o
catálogo inteiro" — vem do doc de otimização, que raciocina sobre 100.000
produtos. **Nós temos ~136.** O catálogo inteiro cabe num prompt, e a regra foi
escrita para um problema que não é o nosso. Vale registrar isso explicitamente
para que a regra não seja reaplicada por hábito.

### A fronteira que continua valendo

Autoridade sobre o **recorte** é do agente. Autoridade sobre o **inventário** é
do banco. O agente escreve o que quer; o SQL responde quem atende, com estoque e
opção reais.

Isso não é cautela com o modelo — é o que faz a especificidade ser confiável.
Quanto mais fino o recorte que ele propõe, mais caro fica o erro de afirmar que
um produto existe no tamanho que a pessoa usa. Um agente que erra estoque não é
um agente mais ousado; é um agente em que ninguém confia depois da segunda
recomendação.

### O que isso custa, e é honesto dizer

1. **A vitrine passou a depender de uma chamada de LLM.** Mitigado por cache e
   por busca client-side (§13), mas o custo por sessão sobe e a latência de
   cache MISS entra na casa dos segundos, não das centenas de milissegundos.
2. **A saída ficou não-determinística.** Duas execuções com o mesmo contexto
   podem produzir recortes diferentes. Aceitável — e até desejável no produto —
   mas exige cuidado na demo (§13).
3. **Cruza uma exclusão da spec aprovada.** `explicit_exclusions` da
   `tese-agente-vendas-ia.md` dizia *"No LLM-authored filter query params —
   selection only, from loader-returned values"*. O `CollectionBrief` é, por
   definição, filtro autorado pelo modelo. A spec foi emendada em **r7** com a
   justificativa completa; o espírito da regra — impossibilidade **estrutural**
   de alucinar filtro — continua honrado, porque todo valor dentro do brief é
   validado contra `getCatalogVocabulary()` antes de virar SQL. O que mudou é a
   forma: o agente **compõe** um critério em vez de **escolher** um filtro
   pronto de uma lista.

O item 3 seguiu a mesma disciplina do §0 do doc de mudanças: emendar só este
documento teria criado um plano que perde para a spec antiga.
