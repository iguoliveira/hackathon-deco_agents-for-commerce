---
name: agent-creator
description: Cria um agente novo neste storefront seguindo o padrão do time — recebe o escopo em linguagem natural e gera o domínio completo em src/platform/<dominio>/ (types, actions, hooks, adapter, barrel), já dentro da convenção, dos contratos compartilhados e das exclusões da spec aprovada. Use sempre que alguém pedir para criar, montar, adicionar ou começar um agente, com ou sem detalhes — "cria um agente que interpreta a busca", "quero um agente pra ranquear tópicos", "monta o agente de recomendação", "/agent-creator <escopo>" — e também ao revisar, consertar ou depurar um agente existente que precise voltar ao padrão, ou ao trabalhar em src/platform/agent e src/platform/analytics. Na dúvida entre criar do zero e seguir o padrão, invoque; ela cobre os dois.
---

# agent-creator

Gera um agente novo dentro do padrão do time, a partir de um escopo em linguagem natural.

Existimos porque somos 5 pessoas e o mesmo dado atravessa três donos: o agente **escreve** `AgentQueryLog`, o dashboard **lê** `TopicRanking`, e a `TrendingCollections` **lê o mesmo ranking**. Cinco formatos inventados em paralelo só aparecem na integração — que vai acontecer na véspera da apresentação. Este workflow existe pra que isso não dependa de alguém ter lido documentação.

**A spec aprovada manda:** [`docs/tese-agente-vendas-ia.md`](../../../docs/tese-agente-vendas-ia.md). Se algo aqui contradiz a spec, a spec ganha — e corrija esta skill. Existe também [`docs/tese-admin-agentes.md`](../../../docs/tese-admin-agentes.md), com um desenho mais amplo (frota, propostas, autonomia, escrita de bloco CMS): é material de visão e de pitch, **não é plano de execução da v1**. Se você se pegar implementando algo de lá, pare.

---

## Passo 0 — Entenda o escopo

O escopo vem junto da invocação (`/agent-creator um agente que traduz busca livre em filtros`). Se vier vazio ou vago demais para decidir onde o código mora, pergunte só o que falta — não gere código sobre suposição, porque domínio no lugar errado custa mais pra desfazer do que pra perguntar:

1. **O que entra e o que sai?** (ex.: texto livre → `{ plpUrl }`)
2. **Ele lê ou escreve?** Se escreve, escreve o quê e onde?
3. **Quem consome?** Server function da busca, rota de admin, seção da home?

Com essas três dá pra gerar. Sem a segunda, pare — ela decide se o escopo é permitido.

## Passo 1 — Gate de escopo

Antes de criar qualquer arquivo, confronte o escopo com as exclusões da spec. Não é burocracia: é o que impede alguém de gastar meio dia numa direção já decidida contra.

| Se o escopo pedir | Faça |
|---|---|
| Ação de carrinho (`addToCart`) | **Pare.** Fora do escopo v1 — o agente é read-only |
| Alterar fluxo de checkout | **Pare.** Fora do escopo v1 |
| Escrever bloco CMS (`.deco/blocks/*.json`) | **Pare.** `option_b_cms_block_write` foi rejeitada por risco de cronograma |
| Serviço fora do Worker / server functions | **Pare.** Sem backend novo |
| Índice de popularidade próprio | **Permitido** desde 2026-08-07, se calculado de `user_events` em SQL. Ver nota abaixo |

Parar significa: diga qual exclusão o escopo cruza, explique que foi decisão de cronograma e não impossibilidade, e ofereça a alternativa dentro do escopo. Não gere "só o esqueleto" — esqueleto vira implementação.

> **Nota sobre popularidade (emenda de 2026-08-07).** A regra antiga mandava
> redirecionar para o `BEST_SELLING` da Shopify. Ela caducou: o storefront não lê
> mais o catálogo da Shopify — home, PLP, busca e PDP apontam todos para os
> loaders locais, e `BEST_SELLING` não existe para a tabela `products`. Com
> `user_events` no servidor, popularidade é um `COUNT(*) ... GROUP BY` de janela,
> mais barato que a alternativa que a regra mandava usar. Continua **proibido**
> um índice de popularidade que exija job, tabela materializada ou serviço
> próprio: é agregação em SQL na leitura, ou não é.

## Passo 2 — Decida onde o código mora

- **Domínio novo** (`src/platform/<dominio>/`) quando o agente tem tipos e server functions próprios.
- **Estender domínio existente** quando é mais uma capacidade sobre o mesmo dado. Estender é o default; domínio novo tem custo de barrel, import e revisão.
- **Nunca** um componente novo de UI se dá pra estender o existente. A spec é explícita: o `Searchbar` em `src/components/search/` é **estendido, não substituído** — nenhuma superfície nova pro usuário aprender.

## Passo 3 — Levante o vocabulário real antes de gerar

Para qualquer agente que produza filtros, enumere primeiro os query params que a PLP **de fato** aceita, lendo o código — não presuma. Esse levantamento restringe o espaço de saída do modelo; sem ele o agente devolve filtros plausíveis e inúteis, e o sintoma final é PLP vazia — exatamente o "zero resultados" que viemos consertar, agora com a nossa cara.

Vale como passo de código, não de documentação: a lista vira constante, e a saída do LLM é validada contra ela antes de virar URL.

## Passo 4 — Gere os arquivos

Espelhe `src/platform/cart/` — é o padrão real do repo, não preferência:

```
src/platform/<dominio>/
  <dominio>.types.ts     # interfaces puras, zero side effect
  <dominio>.actions.ts   # createServerFn — o que roda no servidor
  <dominio>.hooks.ts     # wrappers react-query pro client
  <dominio>.shopify.ts   # adapter nosso tipo <-> Shopify (só se falar com Shopify)
  index.ts               # barrel com exports nomeados explícitos
```

### `<dominio>.actions.ts`

```ts
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { MinhaSaida } from "./<dominio>.types";

export const minhaAcaoServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: { texto: string }) => input)
  .handler(async (ctx): Promise<MinhaSaida> => {
    const request = getRequest();
    // ...
  });
```

O que o validador cobra:

- Todo handler que lê `ctx.data` tem `.inputValidator()`. POST sem entrada (tipo `signOut`) não precisa.
- Actions retornam **nosso** tipo, nunca o payload cru da Shopify — a conversão fica no `.shopify.ts`. É isso que permite mexer na query da Shopify sem tocar em UI.

### `<dominio>.hooks.ts`

Exporte a query key como const (`export const AGENT_QUERY_KEY = ["agent"] as const`), senão quem precisa invalidar cache inventa a chave e erra.

### `index.ts`

Exports nomeados, um a um. `export *` esconde a API pública e quebra o `knip`.

### Se o agente logar consulta

`logAgentQuery` é chamado **de dentro** do mesmo server function que resolve a consulta. Nunca uma segunda ida à rede a partir do client: além do custo, o log dessincroniza do que o agente realmente decidiu e o ranking passa a mentir. E envolva em `try/catch` — telemetria não derruba o caminho do usuário.

## Passo 5 — Valide

```bash
node .claude/skills/agent-creator/scripts/validate-domain.mjs src/platform/<dominio>
```

Depois `npm run typecheck` e `npm run format`. O validador checa estrutura, barrel, contratos compartilhados e exclusões de escopo — rode antes de abrir PR, porque contrato que ninguém verifica não é contrato.

## Passo 6 — Reporte

Diga o que foi criado, o que ficou como stub e o que **não** foi feito por cruzar exclusão. Se algum pedaço do escopo ficou de fora, diga explicitamente — reduzir escopo em silêncio é o que faz a integração falhar depois.

---

## Referência: contratos compartilhados

Importe destes arquivos. Nunca redeclare — duas definições do mesmo tipo é o bug que só aparece na integração.

```ts
// src/platform/agent/agent.types.ts
export interface StructuredFilters {
  /** Handle de coleção, validado contra findCollectionHandles(). Não é texto livre. */
  category?: string;
  priceMin?: number;
  priceMax?: number;
  attributes?: Record<string, string>;  // { material: "thermal", use_case: "running" }
  /**
   * Emenda de 2026-08-07: era `sort: "BEST_SELLING"`, valor da Storefront API
   * que a PLP local não sabe honrar. Estes são os valores que
   * src/platform/catalog/catalog.plp.ts:23-33 de fato aceita. Ausente = relevance.
   * `popularity` entra aqui QUANDO a ordenação por user_events existir — não
   * emita antes, ou a PLP ignora em silêncio.
   */
  sort?: "relevance" | "price:asc" | "price:desc";
}

// src/platform/analytics/analytics.types.ts
export interface AgentQueryLog {
  id: string;
  timestamp: number;
  rawUserText: string;
  filters: StructuredFilters;  // importado de platform/agent
  topicKey: string;            // normalizado: "tenis-corrida"
}

export interface TopicRanking {
  topicKey: string;
  label: string;               // legível, gerado por LLM uma vez e cacheado
  count: number;
  windowDays: number;
}
```

`topicKey` costura os três consumidores. **Normalize sempre igual** — minúsculo, sem acento, hífen. Dois formatos significam ranking partido ao meio, e o sintoma é "o ranking está estranho", não um erro.

## Referência: política de modelo por passo

Maior alavanca de custo do projeto. Fica aqui, e não a critério de cada um, porque solto todo mundo usa o modelo mais caro em tudo.

| Passo | Modelo | Por quê |
|---|---|---|
| Extração texto → filtros, classificação, normalização | **Haiku** | tarefa fechada, alto volume, saída verificável |
| `label` de tópico | **Haiku**, cacheado | roda uma vez por `topicKey`; regerar a cada render é desperdício |
| Ranqueamento com julgamento, comparação de produtos | **Opus** | é onde a qualidade percebida é decidida |

Regra prática: resposta objetivamente certa ou errada → Haiku. Julgamento que um humano vai ler e avaliar → Opus.

## Referência: disciplina de fallback

A regra de segurança central da spec, e a mais fácil de esquecer no meio da implementação. Em todos os casos o usuário chega em algum lugar — agente que trava a busca é pior que busca burra.

| Situação | O que fazer |
|---|---|
| Extração com baixa confiança | cai na busca literal existente |
| Filtro válido, zero produtos | diz que não houve match exato e oferece o mais próximo — **nunca PLP vazia em silêncio** |
| Atributo desconhecido | mensagem explícita de indisponível |
| Agente lento ou com erro | busca literal como caminho imediato; a chamada não pode travar a digitação |

## Referência: armadilha de cache

A home tem TTL longo (perfil estático). Qualquer seção que dependa de dado fresco — `TrendingCollections` é o caso — precisa de override de TTL em `src/cache-config.ts` para o próprio fetch. Sem isso o "em alta" não muda dentro da janela da demo e parece quebrado. **É o bug mais provável de aparecer no dia da apresentação.**

## Checklist final

- [ ] Escopo passou pelo gate do Passo 1
- [ ] Estrutura espelha `src/platform/cart/`
- [ ] `StructuredFilters` / `AgentQueryLog` / `TopicRanking` importados, nenhum redeclarado
- [ ] `topicKey` normalizado igual em todo lugar
- [ ] Todo handler que lê `ctx.data` tem `.inputValidator()`
- [ ] Actions retornam nosso tipo, não payload cru da Shopify
- [ ] Barrel com exports nomeados, sem `export *`
- [ ] Filtros validados contra o vocabulário real antes de virar URL
- [ ] Todo caminho de falha cai na busca literal — testado com texto sem sentido e filtro impossível
- [ ] Nenhum import de carrinho/checkout no domínio do agente
- [ ] Modelo declarado por passo e coerente com a tabela
- [ ] `validate-domain.mjs`, `npm run typecheck` e `npm run format` passam

## Arquivos desta skill

- `scripts/validate-domain.mjs` — valida estrutura, barrel, contratos e exclusões
