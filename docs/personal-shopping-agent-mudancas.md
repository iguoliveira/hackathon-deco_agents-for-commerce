# Personal Shopping Agent — o que precisa mudar no repositório

> Quarto e último documento da série. Os outros três dizem **o quê** e **por quê**:
>
> - `personal-shopping-agent-mvp.md` — arquitetura conceitual
> - `personal-shopping-agent-optimization.md` — latência e custo
> - `personal-shopping-agent-proposta.md` — o desenho aterrado neste repo, com o
>   DDL completo, as tools, os MCPs e os agentes
>
> **Este arquivo é a lista de mudanças.** Arquivo por arquivo, o que muda e como
> se prova que funcionou. Não repete o DDL nem o raciocínio dos outros três —
> quando precisar do porquê, o link está no item.

---

## 0. O que já foi feito

Três emendas aprovadas pelo time em 2026-08-07 e **já aplicadas**:

| Arquivo | Mudança |
|---|---|
| `.claude/skills/agent-creator/SKILL.md:36` | gate de popularidade: de "redirecione pro `BEST_SELLING`" para "permitido, se calculado de `user_events` em SQL", com nota explicando o que continua proibido |
| `.claude/skills/agent-creator/SKILL.md` (contrato) | `StructuredFilters.sort` deixou de ser o literal `"BEST_SELLING"` e passou a ser `"relevance" \| "price:asc" \| "price:desc"`, opcional, com comentário apontando para `catalog.plp.ts:23-33` |
| `docs/tese-agente-vendas-ia.md` | revisão bumped para r6, `sortHint` corrigido pelos mesmos valores, exclusão de popularidade marcada como `SUPERSEDED` |

A spec precisava mudar junto: a própria skill diz que *"se algo aqui contradiz a
spec, a spec ganha"*. Corrigir só a skill teria criado uma regra que perde para
a versão antiga.

**Quarta emenda, mesma data — o agente no comando (r7).** O time decidiu que o
agente é o protagonista do produto: ele monta as coleções em vez de classificar
intenção para um ranker fixo. A decisão inteira, com o descartado à vista, está
em `personal-shopping-agent-proposta.md` §15. Ela cruzava a exclusão
*"No LLM-authored filter query params"* da spec, então a spec foi para **r7** —
pela mesma razão do parágrafo acima. As §1, §4, §6, §8, §9 e §10 deste documento
já refletem a mudança; o §1 (genérico por construção) ficou **mais** importante
com ela, não menos, porque agora é o vocabulário do banco que limita o que o
agente pode inventar.

Tudo abaixo está **por fazer**.

---

## 1. Mudança de princípio: genérico por construção

**Decisão:** o agente não pode saber que esta loja vende roupa.

Isso reverte a direção que a proposta tomava. O `size_fit` que eu tinha proposto
como multiplicador do ranking era bom para moda e inútil para qualquer outro
catálogo. Vira `option_fit`, que é a mesma ideia sem o substantivo:

```
antes:  × size_fit    -- tamanho da pessoa está disponível?
depois: × option_fit  -- os valores de opção que esta pessoa demonstrou
                        preferir estão disponíveis neste produto?
```

Em moda, a dimensão descoberta é `Size` e o efeito é idêntico. Em eletrônico,
seria `Voltagem` ou `Capacidade`. Em vinho, `Safra`. O código não sabe a
diferença — ele lê `findOptionNames()` e trabalha com o que voltar.

### A regra

> **Nenhum literal de catálogo dentro de `src/platform/{context,collections,ranking,agent,analytics}`.**
> Sem `"T-Shirt"`, sem `"winter"`, sem `"shoes"`, sem `Size`. Todo vocabulário é
> lido do banco em runtime.

Não é purismo. É a mesma disciplina que a spec aprovada já aplica ao agente de
busca — *"selecting from a runtime-discovered vocabulary makes filter
hallucination structurally impossible, not just mitigated"*. O que muda é
estender a regra do agente de busca para o ranking e para o perfil.

### A peça que falta

Uma função, cacheada por isolate, que descreve a loja para todo o resto:

```ts
// src/platform/catalog/catalog.vocabulary.ts
export interface CatalogVocabulary {
  types: string[];                          // SELECT DISTINCT product_type
  collections: Array<{ handle: string; label: string }>;
  optionNames: string[];                    // findOptionNames() — já existe
  optionValues: Record<string, string[]>;   // { Size: [...], Color: [...] }
  tags: string[];                           // product_props WHERE name = 'TAG'
  priceBands: { p25: number; p50: number; p75: number };  // percentis do catálogo
  currency: string;
}

export const getCatalogVocabulary = (): Promise<CatalogVocabulary> => { /* ... */ };
```

Três consumidores, e é o que torna tudo portável:

1. **Prompt do `collection-agent`** — a parte volátil do prompt (depois do
   breakpoint de cache) carrega o vocabulário. É literalmente o que o agente pode
   usar para inventar um recorte: sem isso, ele não tem o que compor. O prompt
   estável não cita nenhum produto.
2. **Validação da saída do LLM** — atributo que não está no vocabulário é
   descartado antes de virar filtro. Com o agente autorando critério
   (`CollectionBrief`, §6), esta passagem deixou de ser rede de segurança e
   virou a **única** coisa entre o modelo e o SQL.
3. **Ranking** — as faixas de preço saem de percentis do próprio catálogo, não de
   `R$ 150–350` escrito à mão.

Duas das cinco consultas já existem (`findOptionNames`, `findCollectionHandles`,
em `catalog.d1.ts:314,342`). As outras três são `SELECT DISTINCT`.

### Como se verifica que continua genérico

- **Guarda de código:** um script que faz grep dos valores reais do catálogo
  dentro dos domínios do agente e falha se achar algum. ~30 linhas, encaixa no
  `validate-domain.mjs` que a skill já roda.
- **Teste real:** apontar o `DATABASE_URL` para um banco com catálogo diferente e
  ver a pipeline de pé. É o teste de portabilidade de verdade, e é o slide mais
  forte que essa decisão compra: *"trocamos o catálogo inteiro e não mudamos uma
  linha"*.

---

## 2. Identidade: o que muda depois da discussão

A posição do time — o agente é para loja que **já vende**, e mais tempo no site
significa mais dado — está certa, e muda a prioridade. Identidade sai de
"caminho crítico bloqueante" para "infraestrutura barata que precisa existir
antes dos eventos". O que **não** muda é que precisa existir: sem um
identificador, dois page views do mesmo visitante são duas pessoas para o banco,
e nenhum perfil se acumula.

### Decisão: sessão primeiro, persistência é um atributo a mais

```
deco_session   sem Max-Age    → morre quando o browser fecha
deco_visitor   Max-Age 1 ano  → atravessa visitas
```

Os dois saem do **mesmo middleware**, na mesma resposta. A diferença entre
"correlacionar a visita atual" e "acumular histórico" é literalmente um atributo
de cookie. Por isso o custo de fazer o completo é o mesmo de fazer o mínimo —
não vale escolher.

### O que dá para saber de quem não logou

Resposta direta à pergunta: **sim, e é bastante — desde que seja dado gerado
dentro do nosso site.**

| Dá | Não dá |
|---|---|
| Correlacionar todas as requisições dessa pessoa via cookie de primeira parte | Ler o histórico do navegador ou o que ela fez em outros sites |
| Gravar tudo o que ela faz aqui: páginas, buscas, cliques, carrinho, tempo | Saber nome, e-mail ou CPF antes de ela digitar |
| Reconhecê-la em visitas futuras, no mesmo navegador e dispositivo | Reconhecê-la em outro dispositivo antes do login |
| Inferir intenção, faixa de preço e eixos preferidos — **sem identidade nenhuma** | Recuperar o que aconteceu antes de o cookie existir |
| Costurar todo o histórico anônimo à identidade no momento em que ela loga, compra, assina a newsletter ou pede "avise-me quando voltar" | — |

**Fingerprinting** (hash de canvas, fontes, IP + user-agent) funciona sem cookie
e resolveria a coluna da direita em parte. **Recomendo não fazer**, e não é
melindre: é exatamente o que a LGPD trata como tratamento de dado pessoal sem
consentimento, os navegadores degradam ativamente, e colocaria a história de
privacidade da apresentação na defensiva justo no ano em que ela é o
diferencial. O ganho é pequeno e o risco é a narrativa inteira.

### Três armadilhas de implementação

1. **Marque o cookie pelo servidor, não por `document.cookie`.** O Safari limita
   a 7 dias os cookies escritos por JavaScript. Um `Set-Cookie` de primeira parte
   vindo da resposta HTTP não cai nesse teto. Escrever pelo JS é o caminho
   "óbvio" e ele apaga o histórico de uma fatia grande do tráfego sem avisar.
2. **Cookie limpo ou aba anônima = visitante novo.** É comportamento esperado, não
   bug. Se alguém reportar "perdi meu perfil", a resposta é essa.
3. **Dado comportamental pseudonimizado ainda é dado pessoal.** Os blocos
   `Cookie Consent` já existem em `.deco/blocks/` — reaproveitar, não criar tela
   nova.

### O argumento que sustenta o esforço na tese do time

Numa loja que já vende, o cookie não é para o visitante anônimo. **É o que
completa o histórico do cliente identificado.** A janela de maior intenção — as
visitas de pesquisa antes da compra — acontece deslogada. Sem o costuramento, a
loja só conhece a pessoa a partir do login, e joga fora exatamente o pedaço que
explica *por que* ela comprou.

---

## 3. Migrations novas

DDL completo em `personal-shopping-agent-proposta.md` §4. Aqui só o que mudou
depois da discussão, e a ordem.

| # | Arquivo | O que cria | Muda em relação à proposta |
|---|---|---|---|
| 0012 | `0012_visitors.sql` | `visitors` (visitor_id, email, consent, bucket) | — |
| 0013 | `0013_user_events.sql` | `user_events` + 3 índices | acrescentar `session_id` no índice principal: `(visitor_id, session_id, created_at DESC)`, por causa da decisão de sessão-primeiro |
| 0014 | `0014_user_context.sql` | `user_context`, `user_intent` | — |
| 0015 | `0015_agent_logs.sql` | `recommendation_log`, `query_cache` | — |
| 0016 | `0016_fts_dictionary.sql` | recria o índice FTS no dicionário certo | sem dependência de nada; pode entrar hoje |

Sobre a **0016**: `db/migrations/0009:29` usa `to_tsvector('english', ...)` e o
catálogo virou misto (inglês nos ~32 herdados, português nos 104 da `0011`).
Como não dá para escolher um dicionário certo para os dois, a saída honesta é
`'simple'` — sem stemming, igual para ambos — ou uma coluna `tsvector` por
produto com o dicionário do idioma. Para o MVP, `'simple'` resolve e são 3
linhas. **Decidir na hora de escrever, não antes.**

Todas seguem as convenções já estabelecidas nas migrations existentes, e as duas
não são estéticas:

- `created_at` é `TEXT` ISO-8601, não `timestamptz` — o driver devolveria `Date`
  e o tipo passaria a mentir (`0005:31`).
- **Sem `FOREIGN KEY`** para `products`/`variants` — o seed do catálogo apaga e
  reinsere linhas, e um `ON DELETE CASCADE` destruiria histórico de
  comportamento no `db:reset` (`0005:13-18`).

---

## 4. Domínios novos em `src/platform/`

Estrutura espelhando `src/platform/cart/`, que é o padrão que o validador cobra.

```
src/platform/context/          ← identidade, eventos, perfil, intenção
  context.types.ts             VisitorIdentity, UserContextSnapshot, Intent
  context.cookies.ts           deco_session + deco_visitor (server-side)
  context.d1.ts                único lugar com SQL de eventos/contexto
  context.actions.ts           trackEvents(), getSnapshot()
  context.processor.ts         eventos → snapshot, em SQL agregado
  index.ts

src/platform/collections/      ← O AGENTE NO COMANDO (novo, 2026-08-07)
  collections.types.ts         CollectionBrief, ResolvedCollection
  collections.agent.ts         a chamada que MONTA as coleções (Opus)
  collections.validate.ts      criteria → criteria seguro, contra o vocabulário
  collections.d1.ts            resolve_collection: executa · conta · afrouxa
  collections.actions.ts       buildPersonalCollections(visitorId)
  index.ts

src/platform/ranking/          ← desempate DENTRO da coleção, não decisão
  ranking.types.ts             ScoredProduct, ScoreBreakdown
  ranking.ts                   orderWithin(brief.order, products, snapshot)
  ranking.weights.ts           pesos num objeto só, para tunar sem mexer na lógica
  index.ts

src/platform/agent/            ← já previsto na spec aprovada — agente de BUSCA
  agent.types.ts               FilterCandidate, AgentSelection, StructuredFilters
  agent.claude.ts              chamada única, structured output, cache breakpoint
  agent.filters.ts             ProductListingPage["filters"] → FilterCandidate[]
  agent.d1.ts                  query_cache
  agent.actions.ts             resolveSearchQuery()
  index.ts

src/platform/analytics/        ← já previsto na spec aprovada
  analytics.types.ts           AgentQueryLog, TopicRanking
  analytics.d1.ts              recommendation_log, agregações
  analytics.actions.ts         logRecommendation(), getTopicRankings()
  analytics.hooks.ts
  index.ts
```

Regras que o validador vai cobrar e que é mais barato lembrar agora:

- Barrel com exports nomeados um a um. `export *` quebra o `knip`.
- Todo handler que lê `ctx.data` tem `.inputValidator()`.
- Query key exportada como const, senão quem invalida cache inventa a chave.
- Nenhum import de carrinho/checkout dentro do domínio do agente.

---

## 5. Arquivos existentes a modificar

| Arquivo | Mudança | Risco |
|---|---|---|
| `src/server.ts` | middleware que garante `deco_session` e `deco_visitor` na resposta | **médio** — é o entry. O `RequestContext.run` e a dedup de `Set-Cookie` que já vivem lá não podem ser quebrados; ver `docs/deploy-vercel-supabase.md` §"O que precisou ser reimplementado" |
| `src/setup.ts` | registrar `site/actions/events/track` no `registerInvokeHandlers` e o loader da shelf | baixo — padrão existente, copiar de `notifyMe/subscribe` |
| `src/routes/__root.tsx` | captura de eventos do browser (ver abaixo) | baixo |
| `src/loaders/` | `personalCollections.ts` novo | baixo |
| `src/sections/Product/` | section `PersonalCollections.tsx` — renderiza **N coleções**, não uma prateleira fixa; **dados buscados client-side** | baixo, mas ver a armadilha de cache abaixo, e o layout tem que aguentar 0 a 4 blocos |
| `.deco/blocks/pages-home.json` | posicionar a section na home | conteúdo, não código |
| `db/README.md` | **está desatualizado** e engana quem chega novo | doc |

### Sobre a captura de eventos (`__root.tsx`)

O framework já dispara os 8 eventos que o MVP precisa —
`view_item`, `view_item_list`, `select_item`, `search`, `add_to_cart`,
`add_to_wishlist`, `view_promotion`, `select_promotion` — a partir dos atributos
`data-event` que `src/sdk/useSendEvent.ts` coloca nos componentes.
**Nenhum componente precisa ser tocado.**

Verificado: o script do framework despacha via `window.DECO.events.dispatch(...)`
(`@decocms/blocks/src/sdk/analytics.ts:29`), com guarda de existência.
**Não verifiquei que exista um `subscribe` funcional em runtime** — o comentário
em `src/components/search/Searchbar/Form.tsx:57-61` afirma que o tipo ambiente o
declara, mas o tipo declarar não é o mesmo que o barramento existir.

Por isso o plano **envolve o `dispatch`** em vez de depender do `subscribe`:

```
1. guarda a referência original de window.DECO.events.dispatch
2. substitui por uma função que encaminha para a original E enfileira para nós
3. flush em lote: a cada N eventos ou no `pagehide`, via navigator.sendBeacon
```

Funciona existindo `subscribe` ou não, não altera o comportamento atual do
analytics, e some sozinho se o barramento não estiver montado. Se durante a
implementação o `subscribe` se provar real e estável, trocar por ele é melhor —
mas não é premissa.

Três eventos do MVP doc **não** existem hoje e precisam de captura no servidor,
onde a informação de fato está: `search` com resultado (quantos itens voltaram),
`notifyMe` (já grava em `stock_alerts` — só espelhar em `user_events`) e
`purchase` (não existe pipeline de compra; fica de fora, e a §9 da proposta já
declara isso como não mensurável).

### A armadilha que vai aparecer no dia da demo

A home tem TTL longo de HTML. Uma section que renderize a shelf no servidor
**congela a personalização** dentro da janela da apresentação e parece quebrada.
A shelf busca os dados client-side via TanStack Query — mesmo padrão de
`src/components/search/SearchResult.tsx`. Isso já está registrado como
"o bug mais provável de aparecer no dia" na skill do time; ninguém precisa
descobrir de novo.

---

## 6. Contratos compartilhados novos

Vão em `src/platform/context/context.types.ts` e são importados, nunca
redeclarados — três consumidores leem cada um deles.

```ts
/** O que o ranker recebe. Pequeno de propósito: cabe num prompt e numa linha. */
export interface UserContextSnapshot {
  visitorId: string;
  contextVersion: number;
  profile: {
    /** Eixos descobertos, não campos fixos: { Size: {M: 4, G: 1}, Color: {...} } */
    optionAffinity: Record<string, Record<string, number>>;
    tagAffinity: Record<string, number>;
    typeAffinity: Record<string, number>;
    priceBand: { min: number; max: number } | null;
  };
  session: {
    recentSearches: string[];
    viewedHandles: string[];
    waitedVariantIds: string[];
    cartHandles: string[];
  };
}

export interface Intent {
  topicKey: string;      // normalizado: minúsculo, sem acento, hífen
  label: string;
  types: string[];       // validados contra CatalogVocabulary
  collections: string[];
  tags: string[];
  priceBand: { min: number; max: number } | null;
  confidence: number;    // < 0.4 → não personalizar
  source: "llm" | "search-resolver" | "heuristic";
}
```

`optionAffinity` é o campo que carrega a decisão de genericidade: é um mapa de
dimensões descobertas, não um campo `size`. Um `size?: string` aqui seria a
forma mais silenciosa de tornar o sistema específico de moda para sempre.

### `CollectionBrief` — a saída do agente (novo, 2026-08-07)

Este é **o contrato mais importante do projeto** desde a decisão de pôr o agente
no comando (`personal-shopping-agent-proposta.md` §15). É o que o modelo escreve
e o que o banco executa — a fronteira entre "quem decide" e "quem garante".

```ts
// src/platform/collections/collections.types.ts

export interface CollectionBrief {
  /** Título autoral. Aparece na home exatamente como o agente escreveu. */
  title: string;
  /** A narrativa: por que ESTA pessoa está vendo ESTA coleção. */
  why: string;

  /** O recorte. Todo valor aqui é validado contra CatalogVocabulary
   *  antes de virar SQL — valor inexistente é descartado, não erra. */
  criteria: {
    types?: string[];
    collections?: string[];
    tags?: { all?: string[]; any?: string[] };
    priceBand?: { min?: number; max?: number };
    /** Dimensões descobertas, não `size`: { Size: ["M"] }, { Voltagem: ["220V"] } */
    optionValues?: Record<string, string[]>;
    requireAvailable?: boolean;
  };

  /** Desempate DENTRO do que casou. Não decide quem entra. */
  order?: "affinity" | "popularity" | "price:asc" | "price:desc" | "newest";
  limit: number;
  /** Abaixo disto a coleção não vale a pena existir. */
  minResults: number;
  /**
   * Ordem de afrouxamento, decidida pelo agente. Só ele sabe qual restrição
   * carrega a narrativa do título: em "no seu M, pronto pra levar",
   * optionValues é a ÚLTIMA coisa que pode cair.
   */
  relaxOrder: Array<keyof CollectionBrief["criteria"]>;
}

export interface ResolvedCollection {
  brief: CollectionBrief;
  products: Product[];
  matched: number;
  /** O que precisou ser removido para chegar ao mínimo. A UI LÊ isto:
   *  título que promete o que o critério não entregou mais é título que mente. */
  relaxedBy: string[];
}
```

Três regras que não são estéticas:

1. **`criteria` nunca vira SQL sem passar pela validação.** É o que mantém a
   promessa da §1 deste documento e a da spec — filtro alucinado é
   estruturalmente impossível, não "mitigado".
2. **`optionValues` é `Record<string, string[]>`, não `size`.** Mesma razão do
   `optionAffinity` acima, e o mesmo erro seria fatal aqui.
3. **`relaxedBy` não é log, é dado de UI.** Se o agente pediu M e o resolvedor
   teve que soltar essa restrição para não devolver uma coleção vazia, o card
   precisa parar de dizer "no seu M".

`topicKey` normalizado **igual em todo lugar** — é o que costura o agente, o
dashboard e a `TrendingCollections`. Dois formatos significam ranking partido ao
meio, e o sintoma é "o ranking está estranho", não um erro.

---

## 7. Dependências e configuração

| Item | O quê | Onde |
|---|---|---|
| `@anthropic-ai/sdk` | cliente do LLM, **só no servidor** | `package.json` — instalar com `bun install`, ver armadilha abaixo |
| `@vercel/functions` | `waitUntil` para escrita fora do caminho crítico | idem |
| `ANTHROPIC_API_KEY` | env var da Vercel + `.env` local | **nunca no client**: o CSP não protege chave, quem protege é ela não sair do servidor |

**Armadilha de instalação:** o repo tem `patchedDependencies`, que é campo do
**bun**. Quem instalar com `npm` precisa rodar `bun install` depois, ou a Vercel
instala um conjunto diferente do que foi testado — e existem dois lockfiles no
repo para tropeçar. Está documentado em `docs/deploy-vercel-supabase.md`.

**Armadilha de bundle:** dependência que importa builtins do Node pode chegar ao
grafo do client pelos dynamic imports de `setup.ts` — foi o que obrigou o stub
do driver `postgres` no `vite.config.ts`. Se o build do client quebrar com
"não pode resolver `perf_hooks`" ou similar depois de instalar o SDK, é isso, e
a correção é o mesmo padrão de stub.

---

## 8. Ordem de execução, com a prova de cada passo

Cada linha só está pronta quando a prova passa. "Está implementado" não é prova.

| # | Passo | Prova de que funcionou | ~h |
|---|---|---|---|
| 1 | Migrations 0012–0015 | `npm run db:migrate` roda duas vezes sem erro (idempotente) | 1h |
| 2 | `getCatalogVocabulary()` | devolve os eixos reais; nenhum literal de catálogo no arquivo | 1h |
| 3 | Cookies + `visitors` | duas abas anônimas diferentes = dois `visitor_id`; a mesma aba recarregada = o mesmo | 2h |
| 4 | Captura + `user_events` | navegar 2 min gera linhas com `session_id` correto; `select count(*)` sobe | 3h |
| 5 | `context.processor` | dois perfis navegando diferente produzem `user_context.profile` **diferentes** — no SQL, antes de qualquer UI | 2h |
| 6 | `collections.validate` + `resolve_collection` | um brief escrito à mão vira produtos reais; um brief com tag inventada é **limpo, não quebra**; um brief impossível afrouxa na ordem pedida e reporta `relaxedBy` | 3h |
| 7 | **`collections.agent`** | **dois contextos entram, saem coleções com número, eixos e títulos diferentes — em JSON, sem UI nenhuma** ← é a tese inteira | 4h |
| 8 | Section de coleções na home | a home dos dois perfis mostra **estruturas** diferentes, não só produtos diferentes | 3h |
| 9 | `recommendation_log` + A/B | bucket 0 vê vitrine fixa, bucket 1 as coleções do agente; o brief fica gravado ao lado do resultado | 3h |
| 10 | `/mcp` (3 toolsets) | um cliente MCP externo lista as tools e busca produtos | 3h |
| 11 | `search-resolver` no `/s` | busca livre que hoje dá zero resulta em PLP filtrada | 4h |

**O passo 7 é o corte, e mudou de natureza.** Na versão anterior deste plano, o
passo 7 era a UI e o LLM só entrava no 8 — a ideia era provar que dava para
personalizar sem modelo nenhum. Com a decisão de pôr o agente no comando
(`personal-shopping-agent-proposta.md` §15), isso se inverteu: **o passo 7 é o
agente, e ele vem antes da UI de propósito.**

A razão é econômica, não estética. Se o agente não produz recortes interessantes,
descobrir isso olhando um JSON no passo 7 custa meio dia; descobrir olhando a
home montada custa dois. E se ele produz, a section vira renderização de uma
saída que já se sabe boa.

**Ordem de corte:** 11 → 10 → 9. Do 1 ao 8 não há o que cortar — juntos, são o
produto. Dentro do passo 7, o corte é o número de coleções por pessoa (uma, em
vez de até quatro), nunca a autoria do recorte.

**O passo 6 antes do 7 não é acidente.** O resolvedor precisa estar de pé e
testado *antes* de existir agente para alimentá-lo, senão a primeira vez que uma
coleção voltar vazia ninguém vai saber se a culpa é do modelo, do critério ou do
catálogo. Com o passo 6 provado com briefs escritos à mão, a resposta é sempre:
é do modelo.

---

## 9. Checklist de portabilidade

Isto é o que precisa ser verdade para a mesma pipeline rodar noutra loja. Vale
como critério de revisão de PR, não como aspiração:

- [ ] Nenhum `product_type`, tag, coleção ou nome de opção escrito à mão em
      `src/platform/{context,collections,ranking,agent,analytics}`
- [ ] Faixas de preço vêm de percentis do catálogo, não de números no código
- [ ] Prompt estável (antes do breakpoint de cache) não cita nenhum produto,
      categoria ou atributo desta loja
- [ ] Saída do LLM validada contra `CatalogVocabulary` antes de virar filtro
- [ ] `optionAffinity` e `CollectionBrief.criteria.optionValues` são mapas de
      dimensões descobertas — não existe campo `size` em lugar nenhum
- [ ] Nenhuma lista de coleções possíveis no código. Se existir um
      `SHELVES = [...]` para o agente escolher, a decisão da §15 da proposta foi
      desfeita sem ninguém perceber
- [ ] Trocar o `DATABASE_URL` por um catálogo diferente não quebra nada nem
      exige mudança de código

---

## 10. O que não muda

Escrito para evitar zelo — três pessoas mexendo em coisa que ninguém pediu é
como se perde uma tarde:

- **`src/components/search/Searchbar/Form.tsx`** continua com submit nativo para
  `/s?q=`. A spec é explícita: o Searchbar é **estendido, não substituído**.
- **Nenhuma ação de carrinho ou checkout.** O agente é read-only. Exclusão da
  spec, ainda em vigor.
- **Nenhuma UI de chat.** A narrativa da coleção é texto no card, não conversa.
  O agente ganhou autoridade sobre o recorte, não uma caixa de diálogo.
- **O agente não escolhe produto por ID.** Ele escreve o critério; o SQL responde
  quem atende. Essa fronteira é o que sustenta a especificidade — ver
  `personal-shopping-agent-proposta.md` §15.
- **Nenhum componente de produto precisa ser instrumentado** — os eventos já
  são disparados.
- **Nenhuma escrita em `.deco/blocks/*.json` por código.** Proposta se aplica
  escrevendo em tabela, e a section lê de lá.
- **Embeddings continuam fora** (decisão D4). A coluna existe, vazia, e assim fica.
- **Browser context / extensão continua fora** (decisão D2). Vira slide.
