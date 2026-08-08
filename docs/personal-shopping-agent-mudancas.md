# Personal Shopping Agent — o que precisa mudar no repositório

> **Este arquivo está em vigor.** Os outros da série, com o estado de cada um —
> os revogados ficam listados porque continuam no repositório, não porque valem:
>
> - `personal-shopping-agent-proposta.md` — **em vigor**: o desenho aterrado neste
>   repo, com o DDL completo, as tools, os MCPs e os agentes
> - `tese-agente-vendas-ia.md` r6 — **em vigor**: a spec normativa
> - `personal-shopping-agent-mvp.md` — **revogado**: arquitetura conceitual da v1
> - `personal-shopping-agent-optimization.md` — **revogado**: latência e custo da
>   v1, escritos para um catálogo de 100 mil produtos
> - `personal-shopping-agent-pre-changes.md` — **histórico, revogado**: os desenhos
>   anteriores à decisão de 08/08, guardados para o caso de precisarmos voltar
>
> **É a lista de mudanças.** Arquivo por arquivo, o que muda e como se prova que
> funcionou. Não repete o DDL nem o raciocínio dos outros — quando precisar do
> porquê, o link está no item.

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

**Quarta emenda (07/08) e quinta (08/08) — e a quarta foi revertida.**

Em 07/08 o time decidiu pôr o agente no comando montando coleções em runtime
(`CollectionBrief`). Isso cruzava a exclusão *"No LLM-authored filter query
params"* e levou a spec para r7.

Em 08/08, com a **base do produto** e o **prazo** finalmente escritos, essa
direção caiu:

> Um agente que, a partir dos produtos que a pessoa **comprou**, **se interessou**,
> **favoritou** e pediu **avise-me**, extrai o máximo de especificidades do produto
> para recomendar as **melhores combinações** e produtos próximos.
> Hackathon de **um fim de semana**.

Duas palavras quebram o plano da quarta emenda: **combinações** (o
`CollectionBrief` só sabia expressar semelhança) e **fim de semana** (as fases 0 e
1 eram ~6h construindo rastreamento de comportamento anônimo, quando 3 dos 4
sinais são declarados e já estão persistidos hoje).

**A quinta emenda:** o agente continua sendo quem raciocina, mas raciocina
**antes** — duas passadas offline sobre os 136 produtos, e o domingo vira uma
query. A decisão inteira, com as três posições lado a lado, está em
`personal-shopping-agent-proposta.md` §15.

**A spec volta para r6.** Sem o modelo autorando filtro em runtime, a exclusão não
é cruzada e a emenda r7 fica sem objeto. Mexer em documento normativo sem
necessidade é dívida.

O §1 (genérico por construção) **sobrevive intacto e fica mais fácil de honrar**:
o prompt de extração é genérico ("leia a descrição, emita os atributos que
encontrar"), e a saída específica de moda vive no banco, não no código. Se alguém
levantar conflito entre isso e "o máximo de especificidades", é falso dilema.

Os dois desenhos substituídos estão guardados em
`personal-shopping-agent-pre-changes.md`, bloco por bloco. **São históricos e
estão revogados** — o arquivo avisa isso no topo, para que ninguém (nem nenhum
agente) os leia como plano em vigor.

Tudo abaixo está **por fazer**.

---

## 1. Mudança de princípio: genérico por construção

**Decisão:** o agente não pode saber que esta loja vende roupa.

> **Esta seção sobreviveu às duas mudanças de direção** e ficou mais fácil de
> honrar em cada uma. Na v3, o prompt das passadas é genérico (*"leia a
> descrição, emita os atributos que encontrar"*) e **toda** a especificidade de
> moda passa a viver no banco, escrita pelo modelo. Não há tensão entre isto e
> *"extrair o máximo de especificidades do produto"*: uma coisa é o que o **código**
> sabe, outra é o que os **dados** contêm. Se alguém levantar esse dilema, é falso.

Isso reverteu a direção que a proposta tomava. O `size_fit` proposto como
multiplicador do ranking era bom para moda e inútil para qualquer outro catálogo.
Virou `option_fit`, e na v3 virou `occasion` — a mesma ideia, sem substantivo:

```
v1:  × size_fit      -- tamanho da pessoa está disponível?
v2:  × option_fit    -- os valores de opção que ela prefere estão disponíveis?
v3:  occasion TEXT   -- o eixo pelo qual estes produtos combinam, nomeado
                        pelo modelo a partir DESTE catálogo
```

Em moda, a dimensão descoberta é `Size` e a ocasião é "inverno". Em eletrônico,
seria `Voltagem` e "home office". Em vinho, `Safra` e "harmonização". O código não
sabe a diferença — lê `findOptionNames()` e `SELECT DISTINCT occasion`, e trabalha
com o que voltar.

### A regra

> **Nenhum literal de catálogo dentro de `src/platform/seeds/`, e nenhum no prompt
> das passadas.** Sem `"T-Shirt"`, sem `"winter"`, sem `"shoes"`, sem `Size`, sem
> uma união de literais para `occasion`. Todo vocabulário é lido do banco.

Não é purismo. É a mesma disciplina que a spec aprovada já aplica ao agente de
busca — *"selecting from a runtime-discovered vocabulary makes filter
hallucination structurally impossible, not just mitigated"*.

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

**Onde ela é consumida mudou em 08/08**, mas ela não deixou de ser necessária —
mudou de lugar, do runtime para os scripts:

1. **Validação da saída das passadas** — `relatedId` conferido contra `products`,
   `name` conferido contra o que existe. É o que impede que um handle inventado
   pelo modelo vire `INSERT` e exploda no meio de um `db:migrate`.
2. **Contexto das duas passadas** — o modelo precisa saber que dimensões esta loja
   tem para escrever atributos e combinações coerentes com ela.
3. **`SELECT DISTINCT occasion`** — no runtime, é o que a section usa para montar
   os blocos. Não é o `CatalogVocabulary` completo, mas é a mesma disciplina:
   vocabulário vem do banco, nunca do código.

O que **saiu**: os percentis de preço (existiam para o ranker, que não existe
mais) e o breakpoint de cache de prompt (não há prompt em runtime).

Duas das cinco consultas já existem (`findOptionNames`, `findCollectionHandles`,
em `catalog.d1.ts:314,342`). As outras três são `SELECT DISTINCT`.

### Como se verifica que continua genérico

O **guard script** e o **teste de trocar `DATABASE_URL`** saíram do plano do fim
de semana (é virtude que juiz nenhum vê), mas ficam registrados como o jeito
certo de verificar. Para o fim de semana, três checagens a olho, na revisão:

- o prompt das passadas não cita nenhuma peça de roupa
- `occasion` é `string` no tipo, não união de literais
- `src/platform/seeds/` não importa `@anthropic-ai/sdk`

---

## 2. Identidade: fora do escopo do fim de semana (08/08)

> **Esta seção inteira saiu do plano**, e o motivo é que ela resolvia um problema
> que não temos. `visitors`, `deco_visitor`, `deco_session` e o banner de
> consentimento existiam para dar identidade a **comportamento anônimo de
> navegação**. A base do produto é feita de sinais **declarados**, e declarado é
> justamente o que já está gravado:
>
> | Sinal | Onde já está |
> |---|---|
> | Favoritos | cookie `deco_wishlist`, TTL 1 ano — `readWishlistCookie(req)` (`_cookie.ts:6`) |
> | Avise-me | `stock_alerts` — `findWaitedItems(email)` (`alerts.d1.ts:124`) |
> | Vistos | falta: **um cookie `deco_recent`**, não um pipeline de eventos |
> | Comprou | não existe — vira seed para as personas (proposta §4) |
>
> Sobra **uma** tarefa desta seção: o cookie `deco_recent` com os últimos N
> handles, ~30 min, sexta à noite. As três armadilhas abaixo continuam valendo
> para ele — sobretudo a primeira, que é a que apaga histórico em silêncio.
>
> O resto fica registrado para quando houver prazo. O raciocínio não envelheceu;
> o escopo é que mudou.

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

| # | Arquivo | O que cria | Quando |
|---|---|---|---|
| 0012 | `0012_product_affinity.sql` | `product_affinity` + índice por semente | sáb tarde, **antes** de rodar a passada B |
| 0013 | `0013_orders_seed.sql` | `orders` mínima, semeada para as personas | sex noite ou sáb |
| 0014 | `0014_catalog_enrichment.sql` | **o output revisado das passadas A e B**, como `INSERT` | sáb noite, depois da revisão |

**A 0014 é a mais importante e a menos óbvia.** O output das duas passadas não
fica em script: vira SQL commitado, exatamente como a `0008` fez com os atributos
escritos à mão. Razão prática: `product_affinity` tem FK
`ON DELETE CASCADE` para `products` — corretamente, porque é dado derivado — e
portanto `db:reset` a esvazia. Se os dados só existissem como saída de script,
regenerar custaria chamadas de modelo na pior hora possível.

O script é ferramenta de autoria. A migration é a dependência.

**Uma linha obrigatória no cabeçalho da 0014:**

```sql
-- Saída das passadas A e B, REVISADA À MÃO em <data>.
-- Regenerar sem revisar quebra a garantia: a proteção contra combinação
-- errada aqui é revisão humana, não validação em código.
```

Diferente de uma validação em runtime, revisão humana não se defende sozinha —
some sem deixar rastro se alguém automatizar a regeneração depois.

Migrations que **saíram** do escopo: `visitors`, `user_events`, `user_context`,
`agent_logs` (as tabelas de comportamento, §2) e a `0016_fts_dictionary` — esta
última cai de prioridade porque a recomendação aqui não passa por busca textual.

Convenções que continuam valendo: `created_at` é `TEXT` ISO-8601, não
`timestamptz` (`0005:31`). **A regra de não usar `FOREIGN KEY` não se aplica
aqui** — ela vale para tabelas de comportamento, cujo histórico o `db:reset` não
pode destruir (`0005:13-18`). `product_affinity` é derivada do catálogo: se os
produtos caem, ela **deve** cair junto. Dado derivado que sobrevive à sua fonte é
dado que mente.

---

## 4. Domínios novos em `src/platform/`

Estrutura espelhando `src/platform/cart/`, que é o padrão que o validador cobra.

**Um domínio novo.** Os quatro das versões anteriores (`context`, `collections`,
`ranking`, `analytics`) saíram junto com as tabelas que os sustentavam.

```
src/platform/seeds/            ← as sementes e as combinações (novo, 08/08)
  seeds.types.ts               Seed, AffinityRow, SeedKind
  seeds.cookies.ts             deco_recent (server-side, últimos N handles)
  seeds.d1.ts                  getSeeds(req) · getAffinities(groupIds, kind?)
  seeds.actions.ts             buildPersonalShelf(req) — a query do domingo
  index.ts
```

**Fora de `src/platform/`, porque não é runtime:**

```
scripts/enrich/
  pass-a-attributes.ts         lê catálogo → product_props     (sáb manhã)
  pass-b-affinity.ts           lê catálogo → product_affinity  (sáb tarde)
  review.ts                    dump legível para a revisão     (sáb noite)
  emit-migration.ts            output revisado → 0014.sql
```

A separação importa: `scripts/` roda na máquina de quem está construindo, com
chave de API. `src/platform/seeds/` roda em produção e **não conhece nenhum
modelo**. Se alguém um dia importar `@anthropic-ai/sdk` dentro de
`src/platform/seeds/`, a garantia de "zero LLM em runtime" foi quebrada — e isso
é fácil de checar em review.

`src/platform/agent/` (agente de busca) continua previsto na spec, fora do escopo
deste fim de semana.

Regras que o validador vai cobrar e que é mais barato lembrar agora:

- Barrel com exports nomeados um a um. `export *` quebra o `knip`.
- Todo handler que lê `ctx.data` tem `.inputValidator()`.
- Query key exportada como const, senão quem invalida cache inventa a chave.
- Nenhum import de carrinho/checkout dentro do domínio do agente.

---

## 5. Arquivos existentes a modificar

| Arquivo | Mudança | Risco |
|---|---|---|
| `src/server.ts` | middleware que grava `deco_recent` (últimos N handles vistos) | **médio** — é o entry. O `RequestContext.run` e a dedup de `Set-Cookie` que já vivem lá não podem ser quebrados; ver `docs/deploy-vercel-supabase.md` §"O que precisou ser reimplementado" |
| `src/setup.ts` | registrar o loader da vitrine no `registerInvokeHandlers` | baixo — padrão existente, copiar de `notifyMe/subscribe` |
| `src/loaders/` | `personalShelf.ts` novo — chama `buildPersonalShelf(req)` | baixo |
| `src/sections/Product/` | section `PersonalShelf.tsx` — blocos por `occasion`, **dados buscados client-side** | baixo, mas ver a armadilha de cache abaixo |
| `src/components/product/` | complementos na PDP, mesma tabela | baixo |
| `.deco/blocks/pages-home.json` | posicionar a section na home | conteúdo, não código |
| `db/README.md` | **está desatualizado** e engana quem chega novo | doc |

**`src/routes/__root.tsx` saiu da lista.** Não há mais captura de eventos do
browser: o wrapper no `dispatch`, o `sendBeacon` e o endpoint
`site/actions/events/track` existiam para alimentar `user_events`, que foi
cortada. A subseção abaixo fica registrada porque o levantamento é bom e a
armadilha do `subscribe` é real — mas não é trabalho deste fim de semana.

<details>
<summary>Captura de eventos do browser (fora do escopo, registrado)</summary>

O framework já dispara os 8 eventos —
`view_item`, `view_item_list`, `select_item`, `search`, `add_to_cart`,
`add_to_wishlist`, `view_promotion`, `select_promotion` — a partir dos atributos
`data-event` que `src/sdk/useSendEvent.ts` coloca nos componentes.
**Nenhum componente precisaria ser tocado.**

Verificado: o script do framework despacha via `window.DECO.events.dispatch(...)`
(`@decocms/blocks/src/sdk/analytics.ts:29`), com guarda de existência.
**Não verifiquei que exista um `subscribe` funcional em runtime** — o comentário
em `src/components/search/Searchbar/Form.tsx:57-61` afirma que o tipo ambiente o
declara, mas o tipo declarar não é o mesmo que o barramento existir.

Por isso o plano **envolvia o `dispatch`** em vez de depender do `subscribe`:

```
1. guarda a referência original de window.DECO.events.dispatch
2. substitui por uma função que encaminha para a original E enfileira para nós
3. flush em lote: a cada N eventos ou no `pagehide`, via navigator.sendBeacon
```

Funciona existindo `subscribe` ou não, não altera o comportamento atual do
analytics, e some sozinho se o barramento não estiver montado.

</details>

### A armadilha que vai aparecer no dia da demo

A home tem TTL longo de HTML. Uma section que renderize a vitrine no servidor
**congela a personalização** dentro da janela da apresentação e parece quebrada.
A section busca os dados client-side via TanStack Query — mesmo padrão de
`src/components/search/SearchResult.tsx`. Isso já está registrado como
"o bug mais provável de aparecer no dia" na skill do time; ninguém precisa
descobrir de novo.

E aqui ela ficou **mais** crítica, não menos: o momento da demo é favoritar um
produto ao vivo e a vitrine mudar no reload. Com HTML cacheado, não muda — e o
efeito é exatamente o de um sistema quebrado.

---

## 6. Contratos compartilhados novos

Vão em `src/platform/seeds/seeds.types.ts` e são importados, nunca redeclarados.

`UserContextSnapshot` e `Intent` foram cortados junto com as tabelas de
comportamento (§2). São dois contratos a menos para manter, e a razão é boa: **as
sementes são a intenção**. Quem favoritou uma jaqueta e pediu "avise-me" de um
moletom não precisa de um objeto `Intent` para declarar que está montando um look
de inverno.

```ts
export type SeedKind = "wishlist" | "waited" | "recent" | "purchased";

/** O que a pessoa declarou querer. Substitui perfil + intenção. */
export interface Seed {
  productGroupId: string;
  kind: SeedKind;
  /** ISO 8601. Desempata a ordem da vitrine: semente recente puxa mais. */
  at: string;
}

/** Uma linha de product_affinity, já com o produto resolvido. */
export interface AffinityRow {
  seedId: string;          // de qual semente esta recomendação saiu
  product: Product;
  kind: "complement" | "similar";
  /** Vocabulário emitido pelo modelo na passada B. NÃO enumerado no código. */
  occasion: string | null;
  /** Escrito pelo agente, offline, revisado. É o texto do card. */
  reason: string;
  position: number;
}
```

**`occasion` é `string`, não uma união de literais**, e isso é deliberado: é a
mesma disciplina do `optionAffinity` das versões anteriores. Um
`occasion: "inverno" | "trabalho" | ...` aqui seria a forma mais silenciosa de
tornar o sistema específico de moda para sempre — e o vocabulário tem que vir do
banco, porque quem o escreveu foi o modelo, lendo *este* catálogo.

**`reason` nunca é opcional.** Um complemento sem explicação é um carrossel
comum. Se a passada B não soube dizer por que dois produtos combinam, a linha não
deveria ter sido gravada.

### O contrato das passadas (offline)

O que os scripts de `scripts/enrich/` emitem, antes de virar SQL. Fica aqui e não
em `src/platform/` porque **nada disso existe em runtime**.

```ts
/** Passada A: uma linha de product_props. */
export interface ExtractedProp {
  productGroupId: string;
  /** Ex.: "material", "caimento", "ocasiao". Emitido pelo modelo, não enumerado. */
  name: string;
  value: string;
}

/** Passada B: uma linha de product_affinity, antes da revisão. */
export interface ProposedAffinity {
  productGroupId: string;
  relatedId: string;
  kind: "complement" | "similar";
  occasion: string | null;
  reason: string;
  position: number;
}
```

Duas regras que não são estéticas:

1. **Nenhum dos dois entra no banco sem passar pela revisão.** `emit-migration.ts`
   lê o arquivo **revisado**, não a saída bruta do modelo. Se algum dia esses dois
   passos forem encadeados num comando só, a garantia do projeto muda de natureza
   sem ninguém decidir isso.
2. **`relatedId` é conferido contra `products` antes de virar `INSERT`.** O modelo
   pode inventar um handle; a FK pegaria isso na migration, mas com erro feio no
   meio de um `db:migrate`. Melhor filtrar na emissão.

O antigo `CollectionBrief` — o contrato central da versão de 07/08 — está
preservado em `personal-shopping-agent-pre-changes.md`. Ele caiu porque
`types`/`tags`/`priceBand` descrevem **conjuntos por atributo**, e combinar é uma
relação **produto→produto** que não cabe nesse vocabulário.

---

## 7. Dependências e configuração

| Item | O quê | Onde |
|---|---|---|
| `@anthropic-ai/sdk` | cliente do LLM — **`devDependency`**, porque só `scripts/enrich/` usa | `package.json` — instalar com `bun install`, ver armadilha abaixo |
| `ANTHROPIC_API_KEY` | só no `.env` local de quem roda as passadas | **não precisa ir para a Vercel**, a menos que a manchete opcional entre |

**O SDK como `devDependency` não é detalhe de organização — é a garantia virando
código.** Se o cliente do modelo não está nas dependências de produção, "zero LLM
em runtime" para de ser promessa de documento e vira algo que o build reclama.

`@vercel/functions` saiu: o `waitUntil` existia para gravar eventos fora do
caminho crítico, e não há mais eventos para gravar.

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

| # | Quando | Passo | Prova de que funcionou | ~h |
|---|---|---|---|---|
| 1 | Sex noite | cookie `deco_recent` | recarregar mantém os handles; aba anônima começa vazia | 1h |
| 2 | Sex noite | `getSeeds(req)` | uma persona semeada devolve os 4 `SeedKind` numa lista só | 1h |
| 3 | Sáb manhã | passada A em **10 produtos** | ler as 10 saídas à mão e reconhecer o produto na descrição dos atributos | 1h |
| 4 | Sáb manhã | passada A nos 136 | `product_props` cresce; nenhum `name` fora do vocabulário emitido | 2h |
| 5 | Sáb tarde | `0012_product_affinity` | `db:migrate` roda duas vezes sem erro (idempotente) | 30min |
| 6 | Sáb tarde | passada B no catálogo | **≥ 90% dos produtos com ≥ 3 complementos**, todos com `reason` e `occasion` | 3h |
| 7 | Sáb noite | **revisão + `emit-migration`** | 100% das personas conferidas; aprovação ≥ 85%; `0014.sql` commitado | 1h |
| 8 | Dom manhã | `buildPersonalShelf(req)` | **duas personas, mesma home, blocos e produtos diferentes — em JSON** | 1h |
| 9 | Dom manhã | Section na home | **favoritar ao vivo → recarregar → a vitrine muda** ← é a tese inteira | 2h |
| 10 | Dom manhã | complementos na PDP | abrir qualquer produto mostra o que combina, com o motivo | 1h |
| 11 | Dom tarde | manchete opcional | derrubar a rede e a vitrine continuar inteira | 2h |

**O passo 7 é o corte, e mudou de natureza duas vezes.** Na primeira versão deste
plano, o corte era a UI e o LLM só entrava depois. Na segunda, o corte era o
agente montando coleções. Agora é **a revisão humana** — a hora que parece
dispensável e é a que compra a demo.

Com a `0014` commitada, existe demonstração mesmo que todo o resto falhe: os
dados estão no banco e a vitrine é uma query. Sem ela, não existe nada, por mais
bonita que a section esteja.

**Ordem de corte:** 11 → 10. Do 1 ao 9 não há o que cortar. Dentro do passo 6, o
corte é o número de complementos por produto (3 em vez de 5), nunca a revisão.

**O passo 3 antes do 4 não é acidente.** Rodar a passada A nos 136 antes de olhar
10 saídas à mão é gastar tempo e chamadas para descobrir tarde que o prompt está
errado. Dez produtos custam minutos e respondem a única pergunta que importa
naquele momento: *o modelo entendeu o que estamos pedindo?*

**Reparem que do passo 8 em diante não há nenhuma chamada de modelo.** Isso não é
economia — é a garantia do desenho, tornada verificável: se alguém precisar de uma
chave de API para rodar a demo, algo saiu do lugar.

---

## 9. Checklist de portabilidade

Isto é o que precisa ser verdade para a mesma pipeline rodar noutra loja. Vale
como critério de revisão de PR, não como aspiração.

> O guard script e o teste de trocar `DATABASE_URL` saíram do plano do fim de
> semana — é virtude de engenharia que juiz nenhum vê. **A disciplina fica**: a
> lista abaixo é rápida de conferir a olho, e o item que mais importa agora é o
> penúltimo, porque é onde o novo desenho poderia escorregar sem ninguém notar.

- [ ] Nenhum `product_type`, tag, coleção ou nome de opção escrito à mão em
      `src/platform/seeds/`
- [ ] O prompt das duas passadas é genérico — *"leia a descrição, emita os
      atributos que encontrar"* —, sem vocabulário de moda
- [ ] `occasion` é `string`, não união de literais. Um
      `"inverno" | "trabalho" | ...` no tipo trava o sistema em moda para sempre
- [ ] Nenhuma lista de blocos possíveis no código. Os agrupamentos da vitrine vêm
      de `SELECT DISTINCT occasion`, não de um `SHELVES = [...]`
- [ ] **`@anthropic-ai/sdk` não aparece em `dependencies` nem em nenhum import
      dentro de `src/`** — se aparecer, "zero LLM em runtime" deixou de ser verdade
- [ ] Trocar o `DATABASE_URL` por um catálogo diferente e rodar as duas passadas
      produz uma vitrine coerente, sem mudança de código

---

## 10. O que não muda

Escrito para evitar zelo — três pessoas mexendo em coisa que ninguém pediu é
como se perde uma tarde:

- **`src/components/search/Searchbar/Form.tsx`** continua com submit nativo para
  `/s?q=`. A spec é explícita: o Searchbar é **estendido, não substituído**.
- **Nenhuma ação de carrinho ou checkout.** O agente é read-only. Exclusão da
  spec, ainda em vigor.
- **Nenhuma UI de chat.** O `reason` da combinação é texto no card, não conversa.
- **Disponibilidade nunca é afirmação do modelo.** O `JOIN` com `variants` na
  leitura é quem decide o que aparece. O agente diz o que combina; o banco diz o
  que existe.
- **Nenhum componente de produto precisa ser instrumentado** — e agora nem os
  eventos precisam ser capturados.
- **Nenhuma escrita em `.deco/blocks/*.json` por código.** A section lê de tabela.
- **Embeddings continuam fora** (decisão D4). A coluna existe, vazia, e assim fica.
- **Browser context / extensão continua fora** (decisão D2). Vira slide.
