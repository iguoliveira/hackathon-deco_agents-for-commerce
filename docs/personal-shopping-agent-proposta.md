# Personal Shopping Agent — proposta de MVP (tools, MCPs e agentes)

> **Este é o documento em vigor** — o **onde**: o desenho aterrado neste
> repositório, com os nomes de arquivo, tabelas e funções que já existem, e o que
> falta criar. Onde ele discordar de qualquer outro arquivo de `docs/`, ele ganha.
>
> Os outros da série, com o estado de cada um:
>
> - `personal-shopping-agent-mudancas.md` — **em vigor**: a lista de mudanças,
>   arquivo por arquivo
> - `tese-agente-vendas-ia.md` r6 — **em vigor**: a spec normativa
> - `personal-shopping-agent-mvp.md` — **revogado**: arquitetura conceitual da v1
> - `personal-shopping-agent-optimization.md` — **revogado**: latência e custo da
>   v1, escritos para um catálogo de 100 mil produtos
> - `personal-shopping-agent-pre-changes.md` — **histórico, revogado**: os desenhos
>   substituídos, guardados na íntegra
>
> A §2 registra as premissas dos dois revogados que não valem aqui. É histórico do
> raciocínio, não uma lista de exceções que os mantenha parcialmente vivos.

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

Cinco coisas que os dois documentos revogados assumem e que não valem neste
repositório. Ignorar qualquer uma custa tempo de implementação.

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

> **Nota de 08/08:** com `user_events` fora do escopo do fim de semana (§4), não
> há de onde calcular popularidade agora. A emenda continua válida e aplicada —
> só não tem uso nesta versão. A ordenação da vitrine é `position`, definida pelo
> agente na passada B.

---

## 3. Arquitetura proposta

> **Revisada duas vezes em 2026-08-07/08 (ver §15).** A primeira versão dizia
> "LLM entende, SQL ordena" e mantinha o agente fora do caminho crítico. A
> segunda pôs o agente no caminho da vitrine, montando coleções em runtime. A
> terceira — esta — mantém o agente como autor do raciocínio e **tira o raciocínio
> do runtime**: ele roda sobre os 136 produtos **antes** da demo. O princípio é
> **o agente raciocina antes, o domingo é uma query**.

O que forçou a terceira revisão foram duas coisas que não estavam escritas em
nenhum dos quatro documentos:

1. **A base do produto pede combinação, não semelhança.** O agente deve, a partir
   do que a pessoa comprou, favoritou, viu e pediu "avise-me", recomendar as
   **melhores combinações** e produtos próximos. Combinar é o que fecha o look: a
   calça e o gorro que vão com o moletom, não outro moletom.
2. **O prazo é um fim de semana.**

O desenho anterior (`CollectionBrief` composto em runtime) fatiava o catálogo por
`types`, `tags`, `priceBand` e `optionValues` — vocabulário de **atributo**, que
descreve conjuntos. Combinar é uma relação **produto→produto**, e não há como
escrevê-la num filtro de atributo. Era um fatiador melhor para o problema errado.

**Onde o LLM é insubstituível:** SQL já sabe filtrar por tipo, tag e preço. O que
SQL não sabe é que uma Bomber Jacket combina com Slim Chino e Beanie, e não
combina com um vestido de verão. Isso é conhecimento de mundo — e conhecimento de
mundo **não muda por usuário**, então calculá-lo uma vez e guardar é correto, não
atalho.

```text
   ═════════ ANTES DA DEMO — O AGENTE RACIOCINA (offline) ═════════

        136 produtos: título · descrição (~866 chars) · tipo · tags
                             │
                             ▼
                 ┌───────────────────────────┐
                 │  PASSADA A — especificar  │
                 │  lê a prosa, emite        │
                 │  atributos estruturados   │
                 └─────────────┬─────────────┘
                               │  material · caimento · ocasião
                               │  formalidade · estação · paleta
                               ▼
                        product_props        ← tabela que JÁ existe
                        (name, value)          e o mapper já lê
                               │
                               ▼
                 ┌───────────────────────────┐
                 │  PASSADA B — combinar     │
                 │  para cada produto, quais │
                 │  o complementam — E POR   │
                 │  QUÊ, em texto            │
                 └─────────────┬─────────────┘
                               ▼
                      product_affinity       ← tabela nova
                      (produto, relacionado,
                       kind, occasion, reason)
                               │
                               ▼
                    ┌──────────────────────┐
                    │  REVISÃO HUMANA      │  ← sábado à noite.
                    │  antes de virar SQL  │     compra a demo.
                    └──────────┬───────────┘
                               ▼
                   migration versionada (SQL commitado)

   ══════════════ NA DEMO — DOMINGO É UMA QUERY ══════════════════

     SEMENTES da pessoa                       (sem LLM, sem cache,
     favoritos ∪ avise-me ∪ vistos ∪ compras   sem API key no caminho)
                 │
                 │  deco_wishlist · stock_alerts · deco_recent · orders
                 ▼
          product_affinity  ──join──  variants (disponibilidade)
                 │
                 ▼
     vitrine agrupada por `occasion`, com o `reason` do agente no card
   ═══════════════════════════════════════════════════════════════
                 │
                 ▼
     favoritar agora → nova semente → vitrine muda no reload seguinte


   OPCIONAL, se sobrar tempo no domingo:
        MANCHETE AO VIVO (Haiku, 1 chamada, não-bloqueante)
        — o texto pré-computado é o fallback

   FORA DO ESCOPO deste fim de semana:
        /mcp · A/B por bucket · dashboard · search-resolver
```

Meta de custo em runtime: **zero chamadas de LLM**. Todo o raciocínio do modelo
foi pago antes, uma vez, sobre o catálogo inteiro — e está revisado por gente.

**Isto não é o agente sendo rebaixado.** Ele continua produzindo tudo o que
importa: os atributos, as combinações, os agrupamentos e os textos. O que muda é
*quando* — o protagonismo migra de runtime para build-time. Em troca, a demo não
tem latência de modelo, não tem não-determinismo e não tem chance de quebrar no
telão por causa de uma chamada de rede.

---

## 4. Modelo de dados — 2 tabelas novas

Duas tabelas novas e uma que **já existe**. As seis tabelas das versões
anteriores desta proposta (`visitors`, `user_events`, `user_context`,
`user_intent`, `recommendation_log`, `query_cache`) foram cortadas — elas
existiam para rastrear comportamento **anônimo de navegação**, e a nossa base é
feita de sinais **declarados**, que já estão persistidos hoje (§1).

### Já existe: `product_props` — a saída da passada A

Nenhuma mudança de schema. `db/migrations/0001:51` já define `(name, value)`
genérico, e `catalog.mapper.ts:66,112` já lê e devolve como `additionalProperty`.
A passada A só acrescenta linhas com novos `name`.

O precedente é literal: `0008_enrich_catalog_attributes.sql` abre dizendo que *"o
problema não era falta de informação... o problema é que estavam só em prosa"* —
e promoveu prosa a atributo **na mão**. A passada A é essa mesma migration
escrita pelo modelo, sobre os 136.

### `0012_product_affinity.sql` — a saída da passada B

```sql
CREATE TABLE IF NOT EXISTS product_affinity (
  product_group_id TEXT NOT NULL REFERENCES products(product_group_id) ON DELETE CASCADE,
  related_id       TEXT NOT NULL REFERENCES products(product_group_id) ON DELETE CASCADE,
  kind             TEXT NOT NULL,   -- 'complement' | 'similar'
  occasion         TEXT,            -- 'inverno' | 'trabalho' | ... vocabulário do modelo,
                                    -- NÃO enumerado no código. É o que dá à vitrine
                                    -- blocos com títulos diferentes, a custo zero de runtime.
  reason           TEXT NOT NULL,   -- escrito pelo agente, offline, revisado por gente
  position         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_group_id, related_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_affinity_seed ON product_affinity(product_group_id, kind, position);
```

**Sobre a `FOREIGN KEY`, que aqui é o oposto da regra da `0005`.** As tabelas de
comportamento não podem ter FK para `products` porque o seed apaga e reinsere
linhas, e o cascade destruiria histórico. `product_affinity` é **derivada do
catálogo**: se os produtos são regenerados, ela *deve* cair junto — dado derivado
que sobrevive à sua fonte é dado que mente.

**Consequência prática, e ela importa:** `db:reset` esvazia esta tabela. Por isso
a saída das duas passadas **entra no repo como migration versionada**, igual à
`0008`, e não como script que roda quando alguém lembra. O script é ferramenta de
autoria; o SQL commitado é a dependência. Regenerar no sábado às 23h porque
alguém rodou `db:reset` é o tipo de acidente que se evita de graça.

**Uma linha obrigatória no cabeçalho da migration:** *"esta saída foi revisada à
mão; regenerar sem revisar quebra a garantia."* A proteção contra combinação
errada aqui é **revisão humana**, não validação em código — e revisão humana é
mais forte enquanto existe, mas some sem deixar rastro se alguém automatizar a
regeneração depois.

### `0013_orders_seed.sql` — compra, para as personas da demo

`purchase` não existe no repositório: sem checkout, sem tabela de pedidos. Mas
compra é o sinal que dá credibilidade à combinação — *"você comprou a calça,
faltam as peças de cima"* — e sem ela a narrativa perde o melhor exemplo.

Decisão: uma tabela mínima, semeada só para as personas, **e dito no slide**. O
que não se faz é fingir que existe pipeline de compra.

### As sementes não precisam de tabela

| Semente | Onde já está | Leitura |
|---|---|---|
| Favoritos | cookie `deco_wishlist`, TTL 1 ano | `readWishlistCookie(req)` — `src/loaders/_cookie.ts:6` |
| Avise-me | `stock_alerts` (migration `0005`) | `findWaitedItems(email)` — `alerts.d1.ts:124` |
| Vistos | — | cookie `deco_recent`, últimos N handles, ~30 min |
| Comprou | `0013_orders_seed` | join direto |

Três das quatro já têm identidade e persistência **hoje**. É por isso que a fase 0
(`visitors` + consentimento) e a fase 1 (`user_events` + wrapper no dispatch +
`sendBeacon` + endpoint novo) saíram do plano: ~6h de caminho crítico para
rastrear comportamento anônimo que esta base não usa.

---

## 5. As tools

Sete tools. **Quatro já existem** e só precisam de casca. Nenhuma delas escreve no
carrinho ou no checkout — a exclusão da spec aprovada continua valendo.

> **Correção (2026-08-08).** As versões anteriores desta seção diziam "cinco já
> existem", em três lugares. São **quatro** — as marcadas `**existe**` abaixo.
> `get_filter_candidates` estava na conta e é para criar. O erro virava estimativa
> otimista da fase do MCP.

| # | Tool | Assinatura | Onde mora | Estado |
|---|---|---|---|---|
| 1 | `get_seeds` | `(req) → Seed[]` | `platform/seeds/seeds.d1.ts` | criar — une wishlist ∪ waited ∪ recent ∪ orders |
| 2 | `get_affinities` | `(groupIds, kind?) → AffinityRow[]` | `platform/seeds/seeds.d1.ts` | criar — **a query do domingo** |
| 3 | `get_waited_items` | `(email) → WaitedItem[]` | `platform/alerts/alerts.d1.ts` | **existe** |
| 4 | `search_products` | `({term, collection, options, sort, page}) → {records, total, facets}` | `catalog.d1.ts:226` | **existe** |
| 5 | `get_product` | `(handle) → Product` | `catalog.d1.ts:359` | **existe** |
| 6 | `find_similar_available` | `(variantId, limit) → SimilarCandidate[]` | `catalog.d1.ts:409` | **existe** — é o `kind = 'similar'` de graça |
| 7 | `get_inventory` | `(productHandles, option?) → {handle, optionValuesAvailable[]}` | `platform/catalog` | criar (trivial) |

Saíram desta lista: `get_user_context`, `get_recent_behavior`,
`get_current_intent` (dependiam das tabelas cortadas na §4), `resolve_collection`
e `get_catalog_vocabulary` (dependiam do `CollectionBrief` em runtime) e
`get_filter_candidates` (é do agente de busca, fora do escopo do fim de semana).

Duas regras que valem para todas:

- **Toda tool é uma função TypeScript primeiro.** MCP é embalagem (§6). Nenhuma
  tool nasce como endpoint MCP — isso é o que o próprio MVP doc pede na §10
  ("não deixem MCP virar o objetivo do projeto").
- **Nenhuma tool devolve payload cru da Shopify.** Convenção já cobrada pelo
  validador em `.claude/skills/agent-creator/scripts/validate-domain.mjs`.

### Tool 2 em detalhe — a query do domingo

É a única coisa que roda quando alguém abre a home, e é uma query só:

```sql
SELECT a.related_id, a.kind, a.occasion, a.reason, a.position
  FROM product_affinity a
  JOIN variants v ON v.product_group_id = a.related_id AND v.available
 WHERE a.product_group_id = ANY($1)      -- as sementes da pessoa
   AND a.kind = 'complement'
 GROUP BY a.related_id, a.kind, a.occasion, a.reason, a.position
 ORDER BY a.occasion, a.position;
```

Sem LLM, sem cache, sem chave de API no caminho. O `JOIN` com `variants` é o que
garante que nada esgotado apareça — **disponibilidade nunca é afirmação do
modelo**, é estado do banco no instante da leitura.

O `GROUP BY a.occasion` é o que dá blocos com títulos diferentes na vitrine, e o
vocabulário de ocasião **vem do modelo, não do código** — mantém a regra de
genericidade da §1 do doc de mudanças. Uma pessoa com sementes de inverno e de
trabalho recebe dois blocos; uma com uma semente só recebe um.

**Não existe afrouxamento aqui, e isso é economia real.** O `relaxOrder`,
`minResults` e a regra de UI para `relaxedBy` do desenho anterior existiam porque
um recorte composto em runtime podia voltar vazio. Aqui a validação de que cada
combinação tem produtos suficientes acontece **offline**, na revisão de sábado.
Não há conjunto vazio para afrouxar em runtime — some um motor inteiro.

**O que continua determinístico:** a ordenação dentro do bloco é `position` (que o
agente definiu na passada B) com desempate por recência da semente. Nenhuma
fórmula de pesos, nenhum score.

---

## 6. Os MCPs

> **Fora do escopo do fim de semana (08/08).** Esta seção fica como está, para
> quando houver prazo. Duas ressalvas para quem voltar aqui: são **quatro** tools
> prontas, não cinco (§5), e o Customer MCP desenhado abaixo depende de
> `get_user_context` / `get_recent_behavior` / `get_current_intent`, que saíram
> junto com as tabelas de comportamento (§4). Num retorno, o Customer MCP passa a
> expor sementes, não perfil.

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

Dois que importam para o fim de semana, ambos **offline**. O `intent-agent` foi
cortado em 2026-08-08 junto com as tabelas de que dependia: rotular intenção é a
etapa que esta base pula, porque **as sementes já são a intenção**. Quem favoritou
uma jaqueta e pediu "avise-me" de um moletom não precisa de um modelo para
declarar que está montando um look de inverno.

### 7.1 `passada A` — extrair especificidade

| | |
|---|---|
| **Quando roda** | sábado de manhã, uma vez, sobre os 136 produtos |
| **Entrada** | título + descrição (~866 chars, em português) + `product_type` + tags |
| **Saída** | linhas de `product_props`: material, caimento, ocasião, formalidade, estação, paleta |
| **Prompt** | genérico: *"leia a descrição e emita os atributos que encontrar"* — nenhum vocabulário de moda no prompt |
| **Validação** | revisão à mão em 10 produtos **antes** de rodar nos 136 |

Isto é literalmente *"o máximo de especificidades do produto"* da base do produto.
E ataca um desperdício que já estava documentado: as descrições são a fonte mais
rica do catálogo e hoje **ninguém as lê** — o único leitor é um índice FTS com
dicionário `english` sobre texto em português (§2.3).

### 7.2 `passada B` — combinar

| | |
|---|---|
| **Quando roda** | sábado à tarde, depois da A, com o vocabulário já enriquecido |
| **Entrada** | cada produto + o catálogo enriquecido pela passada A |
| **Saída** | linhas de `product_affinity`: `related_id`, `kind`, `occasion`, `reason`, `position` |
| **O insubstituível** | que Bomber Jacket combina com Slim Chino e Beanie, e não com vestido de verão. SQL não sabe isso; é conhecimento de mundo |
| **Validação** | revisão à mão sábado à noite — **100%** dos produtos das personas da demo, amostragem no resto |

O `reason` é escrito aqui, em texto, produto a produto (*"o caimento reto da
calça equilibra o volume do moletom oversized"*). É o que aparece no card no
domingo, **sem nenhuma chamada de modelo**, e é o que torna a recomendação
defensável quando alguém no júri perguntar "por quê?".

O `kind = 'similar'` sai de graça: `findSimilarAvailable()` já existe
(`catalog.d1.ts:409`) e já devolve explicável — `sameType`, `sameCollection`,
`sharedTags`. Só o `'complement'` precisa do modelo.

### 7.3 `manchete` — Haiku, opcional, domingo à tarde

A única chamada de modelo que pode acontecer com alguém olhando. **Uma** chamada,
que lê o conjunto de sementes e escreve a frase de topo da vitrine (*"Você vem
montando um inverno em algodão — aqui está o que fecha"*).

Três condições, e as três são inegociáveis: **não-bloqueante** (a section renderiza
sem ela), **cacheada** por hash das sementes, e com **fallback no texto
pré-computado**. Se a chave de API falhar no telão, ninguém percebe.

É o que sobrou da ideia de narrativa autoral do desenho anterior — e sobrou no
lugar certo, porque o texto que **importa** (o `reason` de cada combinação) já
está no banco, escrito e revisado.

### 7.4 Cortados do escopo deste fim de semana

`search-resolver` (§7.2 das versões anteriores) continua especificado e aprovado
em `tese-agente-vendas-ia.md` — não foi cancelado, só não cabe no sábado. Idem
`merchandising-agent`. O `intent-agent` não volta: as sementes são a intenção.

---

## 8. Onde a personalização aparece

A §29 do MVP doc é clara: personalização visível é prioridade 1. Três
superfícies, em ordem de retorno:

| Superfície | O que muda | Custo |
|---|---|---|
| **Home — "Combina com o que você quer"** | Section nova, blocos agrupados por `occasion`, cada card com o `reason` do agente. Dados buscados client-side via TanStack Query (o cache de HTML da home congelaria a vitrine — armadilha já documentada na skill) | alto retorno, ~3h |
| **PDP — "completa o look"** | Os complementos do produto aberto, direto de `product_affinity`. Mesma tabela, outra semente | baixo, ~1h |
| **PLP — re-rank** | Fora do escopo do fim de semana |  |

A home carrega a tese, e o que ela precisa provar não é que os produtos mudam —
é que **o sistema sabe o que combina com o quê, e sabe dizer por quê**:

```text
Combina com o que você quer, Vinicius

  ┌─ Para o frio ──────────────────────────────────────────┐
  │  [Slim Chino]        [Beanie]         [Bomber Jacket]  │
  │  "o caimento reto    "fecha o look    "camada externa  │
  │   equilibra o         de inverno       sobre o moletom │
  │   oversized"          sem volume"      oversized"      │
  └────────────────────────────────────────────────────────┘
     porque você pediu avise-me do Classic Pullover Hoodie

  ┌─ Para trabalhar ───────────────────────────────────────┐
  │  [Oxford Shirt]      [Leather Belt]                    │
  └────────────────────────────────────────────────────────┘
     porque você favoritou a Slim Chino
```

Três coisas nesse card, e todas vêm do agente: **o agrupamento** (`occasion`), **a
escolha** (`related_id`) e **a explicação** (`reason`). Nenhuma delas é calculada
em runtime, e nenhuma está enumerada no código — o vocabulário de ocasião é
emitido pelo modelo na passada B.

**O que a demo ganha em troca do que perdeu.** Some o slide de "duas pessoas,
números de coleção diferentes". Entra um mais forte: **favoritar um produto ao
vivo e a vitrine mudar no reload seguinte** — porque os complementos daquele
produto já estão na tabela. Personalização instantânea, sem esperar modelo
nenhum.

---

## 9. Métricas

Mensurável com o que esta proposta constrói, sem pipeline de conversão:

O A/B por `bucket`, o dashboard e o `recommendation_log` saíram do escopo junto
com as tabelas de comportamento. O que sobra é medível **antes** da demo, sobre a
tabela pronta — e é isso que importa quando o prazo é um fim de semana:

| Métrica | Como | Meta |
|---|---|---|
| **Cobertura** | produtos com ≥ 3 complementos em `product_affinity` | ≥ 90% do catálogo. Abaixo disso, alguém abre uma PDP na demo e não vê nada |
| **Taxa de aprovação na revisão** | complementos aceitos / revisados, sábado à noite | ≥ 85%. Abaixo, o prompt da passada B precisa de ajuste antes de rodar de novo |
| **Complementos por ocasião** | `COUNT(*) GROUP BY occasion` | nenhuma ocasião com < 5 produtos, senão o bloco fica ralo |
| **Sementes por persona** | wishlist ∪ waited ∪ recent ∪ orders | ≥ 3 em cada persona, senão a vitrine é curta demais para impressionar |
| **Latência da vitrine** | uma query, sem modelo | p95 < 150 ms. Se passar disso, falta índice |
| Chamadas de LLM em runtime | — | **zero** (uma, se a manchete opcional entrar) |

**Não mensurável, e é preciso dizer isso no palco:** conversão e receita por
sessão. Não há pipeline de compra — a tabela `orders` é semeada para as personas
(§4) e isso vai dito no slide. Mesma honestidade que
`success_metrics.not_measurable_in_v1` da spec já exige.

---

## 10. Demo — duas personas do catálogo real

Substituem o "gamer vs. Mac" do MVP doc, que não existe neste catálogo.

As personas agora são definidas por **sementes**, não por buscas — porque semente
é o que o sistema lê.

**Perfil A — inverno / streetwear**
```
favoritou:   Oversized Hoodie              (cookie deco_wishlist)
pediu avise: Classic Pullover Hoodie M     (stock_alerts, variante esgotada real da 0011)
comprou:     Slim Chino                    (orders seed)
→ blocos:  "Para o frio"       Beanie · Bomber Jacket · Long Sleeve
           "Para trabalhar"    Oxford Shirt · Leather Belt
   cada card com o reason escrito na passada B
```

**Perfil B — verão / minimalista**
```
favoritou:   Relaxed Crop Tee
comprou:     um dress                      (orders seed)
→ blocos:  "Para o calor"      Slides · Tote Bag · Linen Shorts
```

**Perfil C — o visitante novo.** Sem sementes, sem vitrine personalizada: a home
padrão. Continua sendo o slide que prova que o sistema tem critério — a diferença
é que agora a abstenção é uma consequência de não haver semente, não uma decisão
de modelo.

**O momento da demo** é o Perfil C virando Perfil A ao vivo: favoritar um produto
na tela, recarregar, e a vitrine aparecer. Sem espera, sem modelo, porque os
complementos daquele produto já estavam na tabela.

Mesma loja. Mesmo catálogo. Mesmo código. O que muda é o contexto — que é
exatamente a frase da §26 do MVP doc.

---

## 11. Plano de execução — um fim de semana

O plano de 7 fases das versões anteriores assumia prazo aberto. O prazo é
**sexta à noite a domingo à tarde**.

| Quando | Entrega | Prova | ~h |
|---|---|---|---|
| **Sex noite** | cookie `deco_recent` + leitor unificado de sementes (wishlist ∪ waited ∪ recent ∪ orders seed) | `get_seeds(req)` devolve os 4 tipos numa lista só, para uma persona semeada | 2h |
| **Sáb manhã** | script da passada A + **revisar 10 produtos antes de rodar nos 136** | `product_props` ganha material/ocasião/estação, e a amostra de 10 está boa | 3h |
| **Sáb tarde** | `0012_product_affinity` + script da passada B + rodar o catálogo inteiro | ≥ 90% dos produtos com ≥ 3 complementos, com `reason` e `occasion` preenchidos | 4h |
| **Sáb noite** | **revisar o output à mão** e congelar como migration versionada | 100% das personas da demo conferidas; taxa de aprovação ≥ 85% | 1h |
| **Dom manhã** | section "Combina com o que você quer", client-side, agrupada por `occasion` | **favoritar ao vivo → recarregar → vitrine muda** | 3h |
| **Dom tarde** | manchete opcional (Haiku) + roteiro + plano B | a demo roda com a rede desligada, exceto pela manchete | 2h |

**O corte é a noite de sábado.** Com a passada B na tabela e revisada, existe
demo. Tudo depois disso é acabamento — inclusive a manchete, que é a única coisa
no plano que depende de uma chave de API.

**A revisão de sábado à noite é a hora que compra a demo**, e é a tarefa que mais
parece dispensável e menos é. Um complemento errado num produto que está no
roteiro custa mais caro que qualquer bug de layout.

Fora do escopo deste fim de semana: `visitors` + consentimento, `user_events`,
`user_context`, `user_intent`, `intent-agent`, ranker ponderado, A/B por bucket,
dashboard, `/mcp`, `search-resolver`, guard script de portabilidade, e a correção
do FTS (`0016`) — esta última cai de prioridade porque a recomendação aqui não
passa por busca textual.

---

## 12. Privacidade e segurança

Esta seção encolheu com o escopo, e o motivo é bom: **não coletamos mais
comportamento anônimo de navegação**. Sobram três decisões:

1. **Nenhum dado pessoal entra em prompt.** As duas passadas leem **catálogo** —
   título, descrição, tipo, tags. Nenhuma delas vê quem é a pessoa. Isso não é
   coincidência do desenho: é consequência de o raciocínio ser produto→produto.
   Injeção de prompt via texto de usuário deixa de ser superfície de ataque
   porque texto de usuário não chega ao modelo.
2. **As sementes não saem do servidor.** `deco_wishlist` e `deco_recent` são
   cookies de primeira parte lidos server-side; `stock_alerts` é por e-mail com
   sessão. Nenhuma tool aceita identidade por parâmetro — vale a mesma regra de
   `notifyMe/subscribe.ts` ("a sessão vence o e-mail do corpo").
3. **Dado de browser externo continua fora** (§14, D2). Vira slide, não código.

O banner de consentimento sai do caminho crítico junto com `visitors`: cookie de
preferência declarada (favoritos) é outra conversa que a de rastreamento de
comportamento. Se a tabela `visitors` voltar um dia, o banner volta com ela.

---

## 13. Riscos

| Risco | Mitigação |
|---|---|
| **Combinação ruim no telão** — o modelo diz que a bota combina com o vestido de verão | **A revisão de sábado à noite é a mitigação**, e por isso ela não é cortável. 100% dos produtos do roteiro conferidos à mão |
| **`db:reset` esvazia `product_affinity`** — a FK é `ON DELETE CASCADE`, corretamente | A saída das passadas vira **migration versionada**, igual à `0008`. O script é ferramenta de autoria, não dependência de runtime. Regenerar às 23h de sábado porque alguém rodou reset é o acidente que isso evita |
| **Revisão subestimada** — 136 × ~5 complementos ≈ 680 linhas em 1h | Amostragem estratificada no geral, **100%** nos produtos das personas. O que quebra a demo é erro no roteiro, não erro na cauda |
| **A garantia de revisão some sem avisar** — alguém automatiza a regeneração depois | Linha explícita no cabeçalho da migration: *"saída revisada à mão; regenerar sem revisar quebra a garantia"*. Diferente de validação em código, revisão humana não se defende sozinha |
| **Cobertura baixa** — produtos sem complemento, PDP vazia na demo | Métrica de cobertura ≥ 90% na §9, medida **antes** da demo. Fallback: `kind = 'similar'` via `findSimilarAvailable()`, que já existe |
| **Entrada pobre** — persona sem sementes, vitrine vazia | Seed das personas antes da demo. Diagnóstico já registrado em `feature-back-in-stock-shelf.md`: *suspeite da entrada antes do agente* |
| **Cache da home congelando a vitrine** | Section busca dados client-side. Armadilha já documentada na skill do time |
| **Manchete ao vivo falhando no telão** | Não-bloqueante, cacheada, com o texto pré-computado como fallback. É a única dependência de rede do domingo, e é opcional |

---

## 14. Decisões tomadas

Os quatro forks foram decididos em 2026-08-07. Ficam registrados com o
descartado à vista, porque "por que não fizemos X" é a pergunta que volta na
véspera.

**D1 — Camada quente: não existe mais camada quente.**
A versão anterior escolhia Postgres em vez de Redis para guardar `user_context`.
Com o contexto de usuário cortado (§4), a pergunta some: o que precisa estar
quente é `product_affinity`, e ela é uma tabela indexada de ~700 linhas que o
Postgres serve em milissegundos. A discussão Redis vs. Postgres fica registrada
como resolvida por eliminação do problema.

**D2 — Browser context: só no slide.**
Sem extensão, sem coleta externa, sem consentimento de segundo nível. O sinal
que já temos (`stock_alerts` + busca dentro da loja) é mais forte e mais
defensável do que histórico de navegador. A fase 7 sai do plano de código e vira
um slide de arquitetura: *o pipeline aceita esse sinal, e o consentimento é a
porta*.

**D3 — MCP público de catálogo: adiado, não cancelado.**
Cobre o track `seo_geo_agentic_commerce` que a spec aprovada declara e classifica
como descoberto. **Quatro** das tools já existem (não cinco — ver a correção na
§5); o Catalog MCP é casca. Fora do fim de semana por prazo, não por mérito.

**D5 — O agente é o protagonista, e o raciocínio dele acontece antes.**
Ver §15, que é a decisão inteira, com as duas revisões que ela sofreu.

**D6 — Compra vira seed (2026-08-08).**
`purchase` não existe no repositório e a §9 já declarava conversão como não
mensurável. Decidido: semear uma tabela `orders` mínima para as personas, **e
dizer isso no slide**. Compra é o sinal que dá credibilidade à combinação — *"você
comprou a calça, faltam as peças de cima"* — e sem ela a narrativa perde o melhor
exemplo. Descartado: fingir pipeline de compra, ou abrir mão do sinal.

**D4 — Só corrigir o FTS; embeddings ficam de fora.**
Uma migration trocando o dicionário (§2.3). `products.embedding` continua vazia
e nenhum provedor externo entra no projeto. Com `product_type` e tags em 100% do
catálogo, a similaridade estrutural ordena bem e é explicável — que é
exatamente o argumento já escrito em `db/migrations/0009:14-18`. Reavaliar
depois de medir a vitrine, não antes.

---

## 15. Decisão: o agente no topo — duas revisões (07–08/08/2026)

Esta seção passou por duas mudanças de direção em dois dias. Ficam as duas
registradas, com o descartado à vista, porque *"por que não fizemos X"* é a
pergunta que volta na véspera.

> **Os dois desenhos anteriores estão preservados na íntegra** em
> `personal-shopping-agent-pre-changes.md`, cada bloco marcado `PRÉ CHANGES` e
> com o motivo da troca. Voltar atrás não exige arqueologia no git.

### As três posições, lado a lado

| | v1 — até 07/08 | v2 — 07/08 | **v3 — 08/08 (em vigor)** |
|---|---|---|---|
| Princípio | LLM entende, SQL ordena | O agente decide, o banco garante | **O agente raciocina antes, o domingo é uma query** |
| Papel do modelo | classificar intenção | montar coleções em runtime | **enriquecer o catálogo e escrever as combinações, offline** |
| Quando o modelo roda | por sessão | por vitrine | **uma vez, sábado, sobre 136 produtos** |
| O que ele produz | um rótulo | `CollectionBrief` | `product_props` + `product_affinity` + o `reason` de cada par |
| Runtime | ranker de 6 pesos | LLM + resolvedor + afrouxamento | **uma query com `JOIN`** |
| Relação que expressa | semelhança | semelhança | **complementaridade** |

### Por que a v2 caiu

Duas coisas que não estavam escritas em nenhum dos quatro documentos:

**1. A base do produto pede combinação.** O agente deve, a partir do que a pessoa
comprou, favoritou, viu e pediu "avise-me", recomendar as **melhores combinações**
e produtos próximos. O `CollectionBrief` da v2 fatiava por `types`, `tags`,
`priceBand`, `optionValues` — vocabulário de **atributo**, que descreve conjuntos.
Combinar é uma relação **produto→produto** e não cabe num filtro de atributo. Por
mais autoridade que se desse ao modelo, o contrato não sabia dizer "isto vai com
aquilo". Jaccard de tags devolve outra jaqueta.

**2. O prazo é um fim de semana.** A v2 punha ~6h de caminho crítico em `visitors`
e `user_events` — rastreamento de comportamento **anônimo de navegação** — quando
3 dos 4 sinais da base são **declarados** e já estão persistidos hoje: cookie
`deco_wishlist` (`_cookie.ts:6`) e `stock_alerts` (`alerts.d1.ts:124`). Não era
excesso de escopo; era escopo errado.

### O que a v3 preserva da v2

O instinto estava certo: **o modelo no comando**. Ele só estava apontado para o
problema errado. SQL já sabe filtrar por tipo, tag e preço — usar um LLM para isso
é caro e não compra especificidade nenhuma. O que SQL não sabe é que uma Bomber
Jacket combina com Slim Chino e Beanie, e não com um vestido de verão. **Esse é o
único pedaço insubstituível**, e é para ele que o modelo foi realocado.

Título e narrativa autorais também sobrevivem: o `reason` de cada combinação é
escrito pelo modelo, e o agrupamento por `occasion` dá à vitrine blocos com
títulos que ninguém programou — a custo zero de runtime.

### O que se perde, e foi aceito conscientemente

**A estrutura da página deixa de variar por pessoa.** Morre o slide de duas
pessoas receberem números e eixos de coleção diferentes; a personalização passa a
ser "quais sementes você tem". O protagonismo do agente migra de runtime para
build-time.

Em troca, entra um momento de demo mais forte: **favoritar um produto ao vivo e a
vitrine mudar no reload seguinte** — instantâneo, porque os complementos já estão
na tabela.

### Os três custos da v2 desaparecem

1. ~~A vitrine depende de uma chamada de LLM~~ → zero chamadas em runtime.
2. ~~A saída ficou não-determinística~~ → a tabela é fixa e revisada.
3. ~~A explicação some se o modelo falhar~~ → o `reason` está no banco.

### E a emenda r7 fica sem objeto

A v2 cruzava a exclusão *"No LLM-authored filter query params — selection only,
from loader-returned values"*, e por isso a spec foi para r7. Na v3 **o modelo não
autora filtro em runtime**: ele escreve linhas em `product_props` e
`product_affinity`, offline, com revisão humana antes de virar SQL.

`tese-agente-vendas-ia.md` **volta para r6**. Revisão humana sobre saída offline é
garantia mais forte que validação de vocabulário em runtime — com a ressalva de
que ela não é código, e some sem deixar rastro se alguém automatizar a
regeneração (daí a linha obrigatória no cabeçalho da migration, §4).

Mexer em documento normativo sem necessidade é dívida. O desenho deixou de
precisar da permissão, então a permissão volta atrás.
