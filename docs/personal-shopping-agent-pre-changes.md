# PRÉ CHANGES — os desenhos anteriores do Personal Shopping Agent

> ## ⚠️ LEIA ISTO ANTES DE USAR ESTE ARQUIVO COMO CONTEXTO
>
> **Tudo neste documento está REVOGADO.** São **dois** desenhos descartados em
> dois dias — v1 (até 07/08) e v2 (07/08, viveu um dia) — guardados na íntegra
> para o caso de precisarmos voltar atrás.
>
> Os blocos 1–9 são da **v1**. O bloco 10 é da **v2** inteira.
>
> **Não implemente nada daqui.** O plano em vigor é:
>
> - `personal-shopping-agent-proposta.md` — arquitetura atual (a decisão está na §15)
> - `personal-shopping-agent-mudancas.md` — lista de mudanças atual
> - `tese-agente-vendas-ia.md` r6 — spec normativa
>
> Se um agente ou pessoa ler este arquivo junto com os de cima e encontrar
> contradição, **os de cima ganham, sempre**. Este aqui é histórico.

---

## Por que este arquivo existe

O desenho antigo foi substituído por reescrita, não por acréscimo — várias
seções deixaram de existir no texto e só sobreviviam no histórico do git
(commit `f7f606c`). Recuperar de lá exige arqueologia e ninguém faz isso sob
pressão.

Três situações em que voltar aqui é a coisa certa:

1. **O prazo abre.** Boa parte do que foi cortado (identidade, eventos, perfil,
   MCP, A/B) caiu por caber num fim de semana, não por estar errado.
2. **A pré-computação se mostra insuficiente** — por exemplo, se o catálogo
   crescer a ponto de não caber numa passada offline, ou se combinação por pessoa
   passar a importar mais que combinação por produto. Aí a v2 é o ponto de
   partida, não uma folha em branco.
3. **A demo precisa mostrar a evolução** — "tentamos assim, descobrimos isto,
   mudamos por esta razão" é um slide melhor do que "sempre foi assim". E aqui há
   duas mudanças de direção em dois dias, cada uma com um motivo concreto.

---

## As três posições, em uma tabela

| | **v1** — até 07/08 | **v2** — 07/08 | Em vigor (v3, desde 08/08) |
|---|---|---|---|
| Princípio | LLM entende, SQL ordena | O agente decide, o banco garante | O agente raciocina antes, o domingo é uma query |
| Papel do modelo | classificar intenção | montar coleções em runtime | enriquecer catálogo + escrever combinações, offline |
| Quando o modelo roda | por sessão | por vitrine | uma vez, sábado, sobre 136 produtos |
| Quem monta a vitrine | ranker de pesos fixos | o agente, via `CollectionBrief` | `product_affinity` + uma query |
| Relação que expressa | semelhança | semelhança | **complementaridade** |
| Quando não personalizar | `confidence < 0.4` | decisão do agente | não há sementes |

O raciocínio completo das duas trocas está na §15 da proposta. Aqui embaixo está
só o **conteúdo original**, bloco por bloco.

---

# PRÉ CHANGES 1 — princípio e arquitetura

**Vivia em:** `personal-shopping-agent-proposta.md` §3
**Substituído por:** §3 atual (agente no centro do fluxo)

> O princípio dos dois docs se mantém: **LLM entende, SQL ordena**. O que muda é
> onde cada peça mora.

O trecho do diagrama que mudou (o topo, do visitante até `user_context`, continua
igual no documento atual):

```text
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
```

> Meta de custo: **≤ 2 chamadas de LLM por sessão**, nenhuma delas bloqueando
> render de página.

**O que se perdeu na troca:** a garantia de que nenhum render de página dependia
de um modelo. Hoje a vitrine depende, e a defesa passou a ser cache + busca
client-side + fallback para a vitrine padrão.

---

# PRÉ CHANGES 2 — o ranker como coração do sistema

**Vivia em:** `personal-shopping-agent-proposta.md` §5, tool 10 e a subseção
"Tool 10 em detalhe — o ranker"
**Substituído por:** tool 10 atual (`resolve_collection`) + tool 11
(`get_catalog_vocabulary`)

Na tabela de tools:

```
| 9  | get_inventory | (productHandles, size?) → {handle, sizesAvailable[]} | platform/catalog | criar (trivial) |
| 10 | rank_products | (snapshot, intent, candidates) → Scored[]           | platform/ranking/ranking.ts | criar — TypeScript puro, sem LLM |
```

E a subseção inteira:

> ### Tool 10 em detalhe — o ranker
>
> É o coração e é determinístico. Adaptação da fórmula do §14 do MVP doc ao que
> este catálogo de fato tem:

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

> **Multiplicador de opção** — provavelmente o sinal de maior retorno por linha de
> código, e genérico por construção (§2.1):

```
× option_fit  -- 1.0 se os valores de opção que esta pessoa demonstrou preferir
              --     estão disponíveis neste produto
              -- 0.3 se o produto existe mas o valor dela não
```

> A dimensão não é escolhida no código: vem de `findOptionNames()`. Nesta loja ela
> resolve para `Size`; noutra, para `Voltagem` ou `Capacidade`. E os valores saem
> de graça de três lugares que já gravamos — variante vista na PDP, variante no
> carrinho e `stock_alerts.variant_id` — com `variants.available` dizendo o resto.
> Recomendar a peça perfeita num tamanho que não existe é o erro mais caro de uma
> loja de roupa, e o equivalente vale em qualquer categoria com variante.
>
> Cada componente da nota vira uma string em `reasons[]` (`"mesmo tipo"`,
> `"3 tags em comum: winter, layering, cotton"`, `"seu tamanho M disponível"`).
> É o que alimenta a explicação na UI **sem chamar LLM**.

**Nota de aproveitamento:** esta fórmula não morreu inteira. Os pesos genéricos
continuam em `personal-shopping-agent-mvp.md` §14 e
`personal-shopping-agent-optimization.md` §24, que não foram alterados. O que
saiu do texto foi **esta adaptação ao nosso catálogo** — `waited_similarity`
ligado aos `stock_alerts` e `session_affinity` com decay são as duas peças que
não existem em nenhum outro lugar dos documentos.

O `reasons[]` também merece registro: era a explicação da UI **sem custo de
modelo**. No desenho atual a narrativa vem do agente, então uma falha do modelo
deixa o card sem texto — a menos que alguém reimplemente algo como isto.

---

# PRÉ CHANGES 3 — o `shelf-agent`

**Vivia em:** `personal-shopping-agent-proposta.md` §7.3
**Substituído por:** §7.3 atual (`collection-agent`)

> ### 7.3 `shelf-agent` — o Personal Shopping Agent propriamente dito
>
> Este é o produto. E ele é **majoritariamente código, não LLM**:

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

> O passo 4 é o que separa isto de um recomendador comum, e é o §16 do MVP doc:
> **um bom agente sabe quando não recomendar**. Na demo, mostrar o visitante novo
> recebendo vitrine genérica vale tanto quanto mostrar o perfil quente recebendo
> vitrine cirúrgica.
>
> O passo 5 é a única chamada de LLM, ela é cacheada, e se falhar a UI cai nas
> `reasons[]` determinísticas do ranker — a explicação existe sem o modelo.

**Os três limiares (`0.6` / `0.4`) são o detalhe mais reaproveitável daqui.** Se
um dia for preciso pôr um freio determinístico no agente atual — por custo, por
latência ou porque ele está inventando coleções fracas para quem tem pouco
histórico — a escada já está calibrada.

---

# PRÉ CHANGES 4 — o `intent-agent` como agente de primeira classe

**Vivia em:** `personal-shopping-agent-proposta.md` §7.1 (sem a nota de
rebaixamento), `§4` do doc de mudanças e o plano de execução
**Substituído por:** o `collection-agent` lê o contexto bruto e decide sozinho

A ficha técnica do agente **continua no documento atual**, sob uma nota que o
marca como opcional — não foi apagada. O que saiu:

```
src/platform/agent/
  agent.intent.ts              intent-agent (Haiku)
  agent.actions.ts             resolveSearchQuery(), inferIntent()
```

E, na lista dos três consumidores do `CatalogVocabulary`:

> 1. **Prompt do `intent-agent`** — a parte volátil do prompt (depois do breakpoint
>    de cache) carrega o vocabulário. O prompt estável não cita nenhum produto.

**Motivo do rebaixamento:** com o agente decidindo por conta própria, inferir
intenção num passo separado virou pré-digestão do trabalho de quem manda — e um
rótulo estreito é exatamente o que limitaria a especificidade que se quer do
protagonista.

---

# PRÉ CHANGES 5 — a superfície da home e o card

**Vivia em:** `personal-shopping-agent-proposta.md` §8
**Substituído por:** N coleções autorais com títulos do agente

```
| Superfície | O que muda | Custo |
| Home — shelf "Para você" | Section nova, dados buscados client-side via TanStack Query | alto retorno, ~3h |
| PDP — "no seu tamanho"   | Reordena as alternativas por size_fit e intenção | médio, ~1h |
| PLP — re-rank            | Reordena os resultados dentro da página pelo score | baixo na demo |
```

> O card da shelf carrega a explicação — e a explicação cita **sinal real**:

```text
Para você, Vinicius
  Porque você esperou o Classic Pullover Hoodie no M
  e vem olhando peças de inverno em algodão.

  [Oversized Hoodie]  [Bomber Jacket]  [Beanie]  [Long Sleeve Tee]
     M disponível        M disponível    único      M disponível
```

**Observação:** o `size_fit` da linha da PDP já era um resquício — a §1 do doc de
mudanças tinha trocado por `option_fit` (genérico por construção) e essa linha
não acompanhou. Ficou corrigido na reescrita.

---

# PRÉ CHANGES 6 — as métricas do caminho sem LLM

**Vivia em:** `personal-shopping-agent-proposta.md` §9
**Substituído por:** metas separadas para cache HIT e MISS, mais duas métricas
novas de afrouxamento e descarte

```
| Latência p50/p95 da recomendação | recommendation_log.latency_ms | meta: p95 < 300 ms |
| Cache hit rate                   | recommendation_log.cache_hit + query_cache.hits | — |
```

A meta de **p95 < 300 ms sem qualificação** só era alcançável porque nada no
caminho crítico chamava modelo. Hoje ela vale para cache HIT; o MISS assume
p95 < 2,5 s.

---

# PRÉ CHANGES 7 — o plano de execução

**Vivia em:** `personal-shopping-agent-proposta.md` §11 e
`personal-shopping-agent-mudancas.md` §8
**Substituído por:** agente na fase 2 / passo 7, antes da UI

Fases da proposta:

```
| 0 | cookie deco_visitor + tabela visitors + banner de consentimento | 2h |
| 1 | subscriber de eventos + user_events + snapshot por SQL          | 4h |
| 2 | intent-agent + user_intent + TTL/invalidação                    | 3h |
| 3 | rank_products + shelf "Para você" + explicação                  | 4h |
| 4 | recommendation_log + dashboard + A/B por bucket                 | 3h |
| 5 | endpoint /mcp (3 toolsets)                                      | 3h |
| 6 | search-resolver no /s (spec aprovada)                           | 4h |
```

> **Ordem de corte, se o tempo apertar:** 5 → 4 → 2. A fase 3 sem a 2 ainda
> demonstra personalização (usando intenção heurística) — é o menor sistema que
> ainda prova a tese.

Passos do doc de mudanças (os que mudaram):

```
| 6  | rankProducts()      | mesma lista de candidatos, dois snapshots, duas ordens; reasons[] explica cada posição | 3h |
| 7  | Section "Para você" | a home dos dois perfis mostra produtos diferentes ← é a tese inteira | 3h |
| 8  | intent-agent        | busca nova muda a intenção; product_view da mesma categoria não dispara LLM | 3h |
| 9  | recommendation_log + A/B | bucket 0 vê vitrine fixa, bucket 1 a personalizada; CTR comparável | 3h |
```

> **O passo 7 é o corte.** Do 1 ao 7 existe demonstração; antes disso, não. Se o
> tempo apertar, tudo depois do 7 é upside, e a ordem de corte é 11 → 10 → 9 → 8.
>
> Reparem que o **passo 8 é o primeiro que usa LLM**. Do 1 ao 7 não há nenhuma
> chamada de modelo, e a personalização já é visível. Isso não é economia — é a
> tese dos dois documentos originais, tornada verificável: se o passo 7 impressiona
> sem LLM, a arquitetura está certa.

**Este era o argumento mais forte do desenho antigo**, e vale guardá-lo escrito:
existia uma versão do produto que demonstrava personalização visível **sem
nenhuma chamada de modelo**. Se o prazo apertar de verdade, é para cá que se
volta — o caminho estava provado até a UI.

---

# PRÉ CHANGES 8 — a estrutura de diretórios

**Vivia em:** `personal-shopping-agent-mudancas.md` §4 e §5
**Substituído por:** domínio `src/platform/collections/` novo, `ranking/`
rebaixado a desempate

```
src/platform/ranking/          ← o ranker determinístico, zero LLM
  ranking.types.ts             ScoredProduct, ScoreBreakdown
  ranking.ts                   rankProducts(snapshot, intent, candidates)
  ranking.weights.ts           pesos num objeto só, para tunar sem mexer na lógica
  index.ts
```

Arquivos da UI:

```
| src/loaders/          | personalShelf.ts novo | baixo |
| src/sections/Product/ | section PersonalShelf.tsx, dados buscados client-side | baixo |
```

---

# PRÉ CHANGES 9 — a exclusão na spec normativa

**Vivia em:** `tese-agente-vendas-ia.md`, `explicit_exclusions`, revisão r6
**Substituído por:** a mesma regra, emendada em r7 — continua valendo para o
agente de busca do `/s`, não vale para o `CollectionBrief`

```yaml
- "No LLM-authored filter query params — selection only, from loader-returned values."
```

**Esta era a regra mais importante deste arquivo**, porque era a única normativa.
Ela diz: o modelo **nunca** escreve um filtro, só escolhe um de uma lista que o
loader já produziu.

**E ela voltou a valer.** A emenda r7 durou um dia. Na v3 o modelo não autora
filtro em runtime — escreve linhas offline, revisadas por gente — então a regra
não é cruzada e a spec voltou para r6. Este bloco fica aqui como registro de que
a emenda existiu e foi retirada, não porque a regra esteja revogada.

---

# PRÉ CHANGES 10 — a v2 inteira: o agente montando coleções em runtime

**Viveu:** 07/08 a 08/08, um dia. Nunca virou código.
**Substituída por:** as duas passadas offline + `product_affinity`.

## O contrato central

```ts
export interface CollectionBrief {
  title: string;   // autoral, aparece na home como o agente escreveu
  why: string;     // por que ESTA pessoa vê ESTA coleção

  criteria: {      // validado contra CatalogVocabulary antes de virar SQL
    types?: string[];
    collections?: string[];
    tags?: { all?: string[]; any?: string[] };
    priceBand?: { min?: number; max?: number };
    optionValues?: Record<string, string[]>;  // { Size: ["M"] }
    requireAvailable?: boolean;
  };

  order?: "affinity" | "popularity" | "price:asc" | "price:desc" | "newest";
  limit: number;
  minResults: number;
  relaxOrder: Array<keyof CollectionBrief["criteria"]>;
}

export interface ResolvedCollection {
  brief: CollectionBrief;
  products: Product[];
  matched: number;
  relaxedBy: string[];   // a UI lê isto: título que promete o que o critério
                         // não entregou mais é título que mente
}
```

## O resolvedor, em quatro passos

```
1. VALIDA    todo valor de types/collections/tags/optionValues conferido contra
             getCatalogVocabulary(). Valor inexistente é DESCARTADO antes de
             virar SQL — nunca causa erro, nunca vaza.
2. EXECUTA   WHERE product_type IN (...) AND tags @> (...) AND price BETWEEN ...
             AND EXISTS (variante com a opção pedida E available = true)
3. CONTA     se matched >= brief.minResults, devolve e acabou.
4. AFROUXA   se veio pouco, remove a primeira restrição de brief.relaxOrder e
             volta ao 2. Registra o removido em relaxedBy[].
```

## O fluxo do `collection-agent`

```text
1. lê user_context + user_events recentes            (1 query)
2. lê getCatalogVocabulary()                          (cacheado por isolate)
3. UMA chamada, Opus, structured output — o agente decide sozinho:
     · quantas coleções montar (0 a 4)
     · o eixo de cada uma (não há eixo pré-definido)
     · o título e a narrativa
     · a ordem em que aparecem
     · o critério estruturado
     · em que ordem afrouxar
4. para cada brief → resolve_collection
5. descarta coleção abaixo do mínimo mesmo após afrouxar
6. recommendation_log, com o brief inteiro gravado
```

## Por que caiu

**1. Não sabia expressar combinação.** `types`, `tags`, `priceBand`,
`optionValues` descrevem **conjuntos por atributo**. A base do produto pede
complementaridade — que a calça e o gorro fecham o look com o moletom — e isso é
uma relação **produto→produto**, não um filtro. Por mais autoridade que se desse
ao modelo, o contrato não sabia dizer "isto vai com aquilo". Jaccard de tags
devolve outra jaqueta.

**2. Não cabia num fim de semana.** Dependia de `visitors` + `user_events` +
`user_context` — ~6h de caminho crítico para rastrear comportamento anônimo,
quando 3 dos 4 sinais da base já estão persistidos hoje.

## O que vale guardar daqui

- **O motor de afrouxamento** (`relaxOrder`, `minResults`, `relaxedBy`) é a peça
  mais elaborada dos dois desenhos descartados. Se um dia houver recorte composto
  em runtime, ele volta pronto — inclusive a ideia de que **o agente** declara a
  ordem de afrouxar, porque só ele sabe qual restrição carrega o título.
- **A validação contra `getCatalogVocabulary()`** continua sendo o desenho certo
  para qualquer futuro em que o modelo componha critério em runtime.
- **`occasion` na v3 é herdeira direta** da ideia de eixos não enumerados: em vez
  do agente inventar o eixo por pessoa, ele inventa por combinação, offline.
