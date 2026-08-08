# Agente de combinações

> **Este é o documento em vigor para a feature do hackathon.** Onde ele
> discordar de qualquer outro em `docs/`, ele ganha. O estado de cada um dos
> outros está em [§9](#9-o-estado-dos-outros-documentos).

Você abre uma camisa preta básica. O agente monta **a roupa inteira em volta
dela** — a calça, o tênis, a peça de cima —, escolhendo com base no que você já
favoritou, esperou, viu e comprou, e no **lugar onde você mora**. Cada peça vem
com uma linha dizendo por que ela entrou.

Não é "quem viu isto também viu". É **composição**, e ela é assinada.

---

## 1. Por que esta feature e não a do `personal-shopping-agent-proposta.md`

Aquele documento (§3) desenha o agente raciocinando **offline**, em duas
passadas sobre os 136 produtos, gravando `product_affinity` como migration
revisada à mão. O raciocínio era bom e a conclusão envelheceu por um motivo
simples: **enquanto ele era escrito, o agente de runtime foi construído e
verificado** (`docs/agente-vitrine.md`).

O que existe hoje em `src/platform/shelf/` já é o pipeline
determinístico → modelo → determinístico, com validação de handle, fallback por
SQL e persistência. Rodar duas passadas offline para produzir uma tabela que
responde a mesma pergunta seria construir o mesmo agente duas vezes, e a
segunda versão perderia o que a primeira tem de melhor: **o motivo escrito
sabendo quem é a pessoa**. Um `reason` gravado no sábado não pode dizer "para o
frio de Porto Alegre em agosto"; ele foi escrito antes de existir alguém.

O que se herda daquele documento e continua valendo integralmente:

- **as sementes** (`wishlist ∪ avise-me ∪ vistos ∪ comprou`) — §4 e §10 dele
- **genérico por construção** — nenhum literal de catálogo no código
- **disponibilidade nunca é afirmação do modelo** — é `JOIN` com `variants`
- **`ocasiao` é `string`**, não união de literais

O que cai: as passadas A e B, `product_affinity`, e as migrations 0012/0013/0014
como ele as numera — **0012 e 0013 já estão ocupadas** por `create_shelves` e
`shelf_complements`.

---

## 2. O que já existe e não vai ser reescrito

Levantado lendo o código, não os docs.

| Peça | Onde | Serve como |
|---|---|---|
| Pool de complementos ancorado numa peça | `catalog.d1.ts:468` `findComplementsAvailable` | **a etapa 1 inteira** — exclui mesmo tipo, exige afinidade real |
| Pool de alternativas | `catalog.d1.ts:549` `findSimilarAvailable` | o `similar` de graça |
| Equilíbrio por tipo | `shelf.candidates.ts:102` `equilibrarPorTipo` | é o que impede "seis calças" virarem um look |
| Transporte até o modelo | `shelf.decopilot.ts` `perguntar()` | thread nova por execução, SSE, verificado |
| Parsing tolerante | `shelf.agent.ts:44` `extrairJson` | o Decopilot não garante saída estruturada |
| Validação contra os candidatos | `shelf.agent.ts:90` `validar` | descarta, nunca conserta |
| Favoritos | cookie `deco_wishlist` — `_cookie.ts:6` | semente, **hoje ninguém lê como tal** |
| Avise-me | `stock_alerts` — `alerts.d1.ts` `findWaitedItems` | semente |
| Reconferir estoque no render | `catalog.d1.ts:390` | preserva a ordem pedida |

**Três dessas são reusadas por import direto.** O domínio novo não copia código
do `shelf`; ele importa `findComplementsAvailable`, `perguntar` e `extrairJson`.

## 3. O que não existe

Semente de favorito lida no servidor · cookie de vistos · tabela de pedidos ·
**qualquer noção de onde a pessoa está** · cache de look.

---

## 4. A arquitetura

```text
              PDP: a pessoa abre uma peça
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
        ▼                                   ▼
  ÂNCORA (a peça aberta)            CONTEXTO (quem está olhando)
  findComplementsAvailable          sementes: deco_wishlist ∪ stock_alerts
  findSimilarAvailable                       ∪ deco_recent ∪ orders
        │                           local:   x-vercel-ip-city / cookie
        │                           mês:     new Date()
        └─────────────────┬─────────────────┘
                          ▼
                  hash do contexto
                          │
              ┌───────────┴───────────┐
              │                       │
         CACHE HIT                CACHE MISS
              │                       │
              │            ┌──────────┴──────────┐
              │            ▼                     ▼
              │      responde JÁ com        dispara o agente
              │      a ordem do SQL         SEM await
              │      (sem motivos)               │
              │                                  ▼
              │                        ┌──────────────────┐
              │                        │ UMA chamada ao   │  ~35-60s
              │                        │ Decopilot        │
              │                        └────────┬─────────┘
              │                                 ▼
              │                        resolve handles contra
              │                        os pools (sem modelo)
              │                                 ▼
              │                          grava em `looks`
              └───────────┬─────────────────────┘
                          ▼
              JOIN com variants (disponibilidade AGORA)
                          ▼
        blocos por `ocasiao`, cada peça com o seu motivo
```

### A decisão que define esta feature

> **O código não sabe o que é inverno. O agente sabe.**

O local vai para o prompt como texto cru — `"Porto Alegre, RS, BR"` e
`"agosto"` — e **o modelo** conclui que é frio, que pede camada externa, que um
linho não serve. Não existe tabela de clima, não existe
`estacao: "inverno" | "verao"`, não existe `if (cidade === ...)`.

Isso não é elegância: é a regra de genericidade da §1 de
`personal-shopping-agent-mudancas.md` sobrevivendo ao recurso mais tentador de
todos para violá-la. Trocar o catálogo por um de vinho e a mesma linha de código
continua produzindo "para o calor de Recife, um branco gelado" sem nenhuma
edição.

### Por que cache + geração em background, e não chamada síncrona

O Decopilot leva 35-60s, e às vezes trava em `waiting-capacity` até o timeout
(`docs/agente-vitrine.md`). Uma PDP não segura isso, e um spinner de 40s no
telão do pitch é pior que não ter a feature.

O padrão já é o do repo: `subscribe.ts` dispara `gerarVitrine(email)` **sem
`await`** e responde na hora. Aqui é o mesmo, com uma melhora — no miss a
pessoa não vê nada quebrado, vê a ordenação do SQL sem motivos. O produto
degrada de **look explicado** para **look sem texto**, nunca para vazio.

**Consequência que precisa ir para o roteiro:** os produtos da demo são
pré-aquecidos antes do pitch. Isso é o que qualquer loja faria e vale dizer no
slide — o que não vale é descobrir isso ao vivo.

### A chave do cache

`(anchor_id, contexto_hash)`, onde o hash cobre sementes + local + mês. Duas
pessoas diferentes na mesma peça recebem looks diferentes, e é **isso** que
prova personalização — não o número de produtos mudando.

---

## 5. Modelo de dados — uma migration

`db/migrations/0014_looks_and_orders.sql`. **0012 e 0013 estão ocupadas.**

```sql
CREATE TABLE IF NOT EXISTS looks (
  anchor_id     TEXT NOT NULL,   -- product_group_id da peça aberta
  contexto_hash TEXT NOT NULL,   -- sementes + local + mês
  titulo        TEXT NOT NULL,
  confianca     REAL NOT NULL,
  pecas         TEXT NOT NULL,   -- JSON [{handle, motivo, ocasiao, position}]
  origem        TEXT NOT NULL,   -- 'agente' | 'sql'
  generated_at  TEXT NOT NULL,
  PRIMARY KEY (anchor_id, contexto_hash)
);

CREATE TABLE IF NOT EXISTS orders (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

**`pecas` é JSON num TEXT de propósito.** É blob opaco: só é lido inteiro, nunca
filtrado em SQL. Normalizar custaria uma tabela e um JOIN para não comprar nada
— mesmo argumento que a spec aprovada usa para `Proposal.evidence`.

**Nenhuma das duas tem `FOREIGN KEY` para `products`.** É a regra da `0005`: as
migrations de seed apagam e reinserem o catálogo, e um `ON DELETE CASCADE`
destruiria histórico a cada `db:reset`. `looks` é cache — perder é barato — e
`orders` é comportamento, que não pode sumir. Quem descarta linha morta é a
leitura, pelo `JOIN`.

> Isto é o **oposto** do que `personal-shopping-agent-proposta.md` §4 decide para
> `product_affinity`, e os dois estão certos: aquela tabela é **derivada do
> catálogo** e deve cair junto; estas duas não são.

### As sementes não precisam de tabela

| Semente | Onde já está | Falta |
|---|---|---|
| Favoritos | cookie `deco_wishlist`, TTL 1 ano | ler no servidor |
| Avise-me | `stock_alerts` | nada |
| Vistos | — | cookie `deco_recent`, ~30 min |
| Comprou | — | `orders`, semeada para as personas |

`orders` é semeada e **isso vai dito no slide**. Não existe checkout no
repositório e fingir pipeline de compra é o tipo de coisa que um jurado de
e-commerce reconhece na hora.

---

## 6. O domínio novo

```
src/platform/look/
  look.types.ts        Semente, SeedKind, Local, Contexto, PecaDoLook, Look
  look.cookies.ts      deco_recent (vistos) e deco_local (seletor)
  look.local.ts        headers da Vercel + cookie → Local
  look.seeds.ts        wishlist ∪ alerts ∪ recent ∪ orders → Semente[]
  look.candidates.ts   etapa 1: pools ancorados na peça aberta
  look.prompt.ts       a instrução do agente
  look.agent.ts        etapas 2 e 3, validação e fallback
  look.d1.ts           único arquivo com SQL de `looks` e `orders`
  look.actions.ts      o que o loader consome
  index.ts
```

Espelha `src/platform/shelf/`, que é o padrão que o validador de
`.claude/skills/agent-creator/` cobra. O nome é `look` e não `agent` porque
`src/platform/agent/` está construído na branch
`feature/agente-vendas-ia-phase1` e criar o diretório aqui garantiria conflito
— mesma razão que fez `shelf` se chamar `shelf`.

### Arquivos existentes a modificar

| Arquivo | Mudança | Risco |
|---|---|---|
| `src/loaders/` | `completeTheLook.ts` novo | baixo |
| `src/setup.ts` | registrar o loader | baixo — copiar de `personalShelf` |
| `src/sections/Product/` | `CompleteTheLook.tsx` | baixo |
| `src/components/header/` | seletor de local | baixo |
| `src/server.ts` | grava `deco_recent` | **médio** — é o entry; `RequestContext.run` e a dedup de `Set-Cookie` não podem quebrar |
| `.deco/blocks/` | posicionar a section na PDP | conteúdo |

---

## 7. As regras que não podem cair

Herdadas da spec aprovada e do agente da vitrine. Cada uma já custou caro uma
vez.

1. **O modelo escolhe de uma lista, nunca inventa.** Handle fora dos candidatos
   é descartado, jamais corrigido por proximidade.
2. **Disponibilidade é do banco, não do modelo.** `JOIN variants` no render.
3. **`ocasiao` é `string`.** Uma união de literais trava o sistema em moda para
   sempre, e de forma silenciosa.
4. **Nenhum literal de catálogo em `src/platform/look/`.** Sem `"T-Shirt"`, sem
   `"inverno"`, sem `Size`.
5. **Nada de carrinho ou checkout.** O agente é read-only — exclusão da spec.
6. **Nenhuma UI de chat.** O motivo é texto no card.
7. **A section busca dados client-side.** O HTML da PDP tem TTL longo; renderizar
   no servidor congela a personalização dentro da janela do pitch e parece
   quebrado. É o bug mais provável de aparecer no dia.
8. **Nada lança.** Todo caminho de falha termina num look — o do agente ou o do
   SQL.

---

## 8. Plano de execução

| # | Passo | Prova de que funcionou | ~h |
|---|---|---|---|
| 1 | `0014` + `look.d1.ts` | `db:migrate` roda duas vezes sem erro | 30min |
| 2 | `look.local.ts` + seletor | trocar a cidade muda o `Local` no JSON | 1h |
| 3 | `look.seeds.ts` | uma persona devolve os 4 `SeedKind` numa lista só | 1h30 |
| 4 | `look.candidates.ts` | abrir qualquer peça dá ≥ 8 complementos de ≥ 4 tipos | 1h |
| 5 | `look.prompt.ts` + `look.agent.ts` | dry run: JSON puro, zero handle inventado | 2h |
| 6 | loader + section na PDP | **abrir a camisa preta e o look aparecer com os motivos** | 2h |
| 7 | pré-aquecer o roteiro | os produtos da demo respondem do cache | 30min |
| 8 | trocar cidade ao vivo | **mesma peça, cidade diferente, look diferente** | — |

**O corte é o passo 5.** Com o agente respondendo e gravando, existe demo. O
passo 8 não custa hora nenhuma porque cai de graça do passo 2 — e é o momento
mais forte do pitch.

**Ordem de corte se o tempo apertar:** 8 → 7 → 3 (as sementes viram só
`deco_wishlist`, e o look ainda é pessoal). Do 1 ao 6 não há o que cortar.

### O dry run vem antes da section

`npm run look:dryrun -- <handle>` imprime o look sem gravar. É a única forma
prática de olhar a saída do agente: as sections são diferidas, e **status 200
não é sinal de saúde neste site** — um loader que falha vira section vazia e a
página continua 200. A lição está em `docs/agente-vitrine.md` e não precisa ser
aprendida de novo.

---

## 9. O estado dos outros documentos

| Documento | Estado |
|---|---|
| `agente-vitrine.md` | **em vigor** — descreve o agente construído, que esta feature reusa |
| `feature-back-in-stock-shelf.md` | **em vigor** — o sinal de "avise-me", que aqui vira uma das quatro sementes |
| `catalog-population.md` | **em vigor** — o catálogo de 136, que é o que torna a composição possível |
| `deploy-vercel-supabase.md` | **em vigor** — infra |
| `tese-agente-vendas-ia.md` r6 | **normativa e parcialmente ociosa**: o agente de busca que ela especifica está fora do fim de semana. As `explicit_exclusions` continuam valendo |
| `personal-shopping-agent-proposta.md` | **parcialmente superado** — §§1-2 e 12 valem; §3, §4, §5, §7 e §11 foram substituídos por este arquivo |
| `personal-shopping-agent-mudancas.md` | **parcialmente superado** — §1 (genérico) e §10 (o que não muda) valem; §§3-4 e 8 substituídos |
| `tese-admin-agentes.md` | **fora do escopo do fim de semana** — nenhuma tela de admin é construída |
| `personal-shopping-agent-mvp.md` | revogado |
| `personal-shopping-agent-optimization.md` | revogado |
| `personal-shopping-agent-pre-changes.md` | histórico |
