# Agente da vitrine

Quem tentou comprar uma peça e não pôde, porque o tamanho estava esgotado,
ganha duas vitrines montadas por IA **a partir daquele item**: o que substitui
o que faltou, e o que se veste junto.

O sinal de entrada — o clique em "avise-me quando voltar" — e por que ele vale
mais que um e-mail estão em
[`feature-back-in-stock-shelf.md`](feature-back-in-stock-shelf.md).

## Como rodar

```bash
npm run shelf:dryrun -- ams.igorfigueiredo@gmail.com              # imprime, não grava
npm run shelf:dryrun -- ams.igorfigueiredo@gmail.com --candidatos # mostra os pools
npm run shelf:dryrun -- ams.igorfigueiredo@gmail.com --gravar     # grava em `shelves`
```

O dry run é a única forma prática de olhar a saída do agente. As sections são
diferidas: o HTML do SSR é esqueleto, e **status 200 não é sinal de saúde neste
site** — um loader que falha vira section vazia e a página continua 200. Foi
escrito antes da persistência e da tela de propósito.

## O caminho completo

```
PDP de variante esgotada
  └─ clique em "avise-me"
       └─ src/actions/notifyMe/subscribe.ts
            ├─ createStockAlert()            grava o desejo
            ├─ marcarDonoDaVitrine(email)    cookie assinado, para reconhecer depois
            └─ gerarVitrine(email)           SEM await — responde na hora
                  │
                  ▼
            ┌───────────────────────────────────────────┐
            │ etapa 1  findWaitedItems                  │ sem modelo
            │          findSimilarAvailable      →  alternativas
            │          findComplementsAvailable  →  complementos
            ├───────────────────────────────────────────┤
            │ etapa 2  UMA chamada ao Decopilot         │ ~35-60s
            ├───────────────────────────────────────────┤
            │ etapa 3  resolve handles contra os pools  │ sem modelo
            └───────────────────────────────────────────┘
                  │
                  ▼
            tabela `shelves`  (uma linha por comprador)
                  │
                  ▼
       site/loaders/personalShelf.ts  →  PersonalShelf.tsx
       (reconfere estoque a cada render)
```

Cron a cada 3 dias como refresh — **ainda não construído**, ver *O que falta*.

## Arquivos

| Caminho | Papel |
|---|---|
| `src/platform/shelf/shelf.candidates.ts` | etapa 1: os dois espaços de escolha |
| `src/platform/shelf/shelf.prompt.ts` | **a instrução do agente** e a montagem da mensagem |
| `src/platform/shelf/shelf.decopilot.ts` | etapa 2: o único arquivo que fala HTTP com o modelo |
| `src/platform/shelf/shelf.agent.ts` | etapa 3, orquestração e fallback |
| `src/platform/shelf/shelf.d1.ts` | único arquivo com SQL de `shelves` |
| `src/platform/shelf/shelf.cookie.ts` | assinatura do cookie de identidade (sem framework) |
| `src/platform/shelf/shelf.identity.ts` | sessão ou cookie → dono da vitrine |
| `src/platform/shelf/shelf.actions.ts` | o que a section consome |
| `src/loaders/personalShelf.ts` | loader do CMS, prop `lista` |
| `src/sections/Product/PersonalShelf.tsx` | a section, com "ver todos" |
| `db/migrations/0012`, `0013` | a tabela e a segunda lista |
| `scripts/shelf-dryrun.ts` | o dry run |
| `.deco/blocks/pages-minha-vitrine*.json` | as páginas cheias |

**A instrução vive em `shelf.prompt.ts`, não neste doc.** Duas cópias
divergiriam, e a divergência apareceria como "o agente parou de obedecer". O
doc explica o porquê; o código é o texto que roda.

## O domínio é `shelf`, não `agent`

`src/platform/agent/` e `src/platform/analytics/` **já existem, construídos, na
branch `origin/feature/agente-vendas-ia-phase1`** (2028 linhas, não mergeada).
Criar os mesmos diretórios aqui garantiria conflito.

Aquela branch também mexe em `src/worker-entry.ts`, `wrangler.jsonc` e
`migrations/` na raiz — arquivos que a migração para Vercel + Supabase apagou ou
moveu. **O merge dela vai doer, e não é este PR que resolve.** O que dá para
fazer daqui é não piorar.

## Decisões que não são óbvias no código

### A vitrine é ancorada no item esgotado, não na loja

É a decisão que define o produto, e a mais fácil de perder quando alguém for
"melhorar" o agente. A vitrine **não** é "os mais vendidos" nem "o que combina
com o seu perfil". É: *você quis esta peça e ela não tinha o seu tamanho —
estas aqui têm*.

Na prática isso proíbe qualquer consulta geral ao catálogo: os pools saem
sempre de `findSimilarAvailable(variantId)` e `findComplementsAvailable(
variantId)`. Um agente que recebesse a loja inteira produziria uma vitrine
plausível e genérica — exatamente o que qualquer loja já tem, e que não usa o
sinal que esta feature captura.

### Duas listas, duas perguntas

```
itens     "no lugar do que você queria"   mesmo tipo
combinam  "para usar junto"               outro tipo, mesmo estilo
```

A primeira versão misturava as duas numa lista só, e o resultado era uma
prateleira onde o boné no meio de quatro camisetas parecia erro de ordenação em
vez de sugestão de look.

`findComplementsAvailable` é **consulta separada**, não filtro sobre a outra:
aquela soma +4 para mesmo tipo, então o topo dela é sempre alternativa. Medido
antes de separar: de 16 candidatos, 12 eram camiseta.

### O equilíbrio por tipo fica em TS, não em SQL

Um `DISTINCT ON (product_type)` escolheria o melhor de cada tipo **antes** de
saber quantos tipos entram, e descartaria o segundo melhor tênis mesmo quando
ele é melhor que a melhor bolsa. `equilibrarPorTipo` faz duas passadas —
variedade primeiro, qualidade depois — porque enxerga a lista inteira.

### O gatilho é o clique, e sem `await`

O agente leva ~35–60s, e às vezes 120s. Segurar o clique por isso é
inaceitável: a pessoa não está esperando vitrine, está esperando "recebemos seu
pedido".

É **melhor esforço**, e é honesto dizer por quê: sem `waitUntil` a Vercel pode
congelar a invocação assim que a resposta sai. Não é problema porque
`acharVitrinesVencidas` inclui, por LEFT JOIN, quem tem alerta e **nenhuma**
vitrine — o caso exato de uma geração interrompida. Pior cenário: aparece na
próxima passada. `@vercel/functions` tornaria isto garantido; vale medir antes
de trazer dependência.

### A seleção persiste; a disponibilidade não

O agente grava handles, motivos e títulos. **A conferência de estoque acontece
no render**, em `findAvailableCatalogRecordsByHandles`.

A vitrine passa dias envelhecendo enquanto o estoque muda. Uma vitrine cuja
premissa é *"não te mostro o que você não pode comprar"* recomendando item
esgotado é o pior resultado possível desta feature — e passaria despercebido,
porque a página continuaria respondendo 200.

Essa consulta também **preserva a ordem pedida**: a ordem é o julgamento do
agente, e um `ORDER BY p.position` jogaria fora exatamente o que se pagou um
minuto de LLM para obter.

### A vitrine do SQL é estado válido, não só falha

Quando o modelo cai, o fallback é a ordenação determinística, sem motivos — e
ela **também é gravada**. Não gravar deixaria o comprador sem vitrine nenhuma
sempre que o provedor estivesse saturado. Como o cron reescreve depois, uma
geração que caiu hoje vira vitrine do agente na próxima passada.

O produto degrada de "vitrine explicada" para "vitrine sem texto" — nunca para
vazia, nunca para erro.

### O cookie de identidade é assinado, e falha fechado

**O problema não era capturar, era reconhecer de volta.** O e-mail existe no
instante do clique, mas `readShopperIdentity` só responde para quem tem sessão
do Shopify, e quem clica nesse botão costuma estar deslogado.

O cookie decide de quem é a vitrine que a página mostra. Sem assinatura,
qualquer um edita o valor para o e-mail de outra pessoa e vê o que ela quis
comprar. HMAC, `HttpOnly`, comparação em tempo constante — `===` vazaria
quantos caracteres iniciais estavam certos, o que permite forjar byte a byte.

**Sem `SHELF_COOKIE_SECRET` o cookie não é emitido nem aceito**, degradando para
identidade por sessão. Emitir sem assinar seria trocar segurança por
conveniência em silêncio.

### O corte de 6 é de exibição, não de geração

O agente escolhe até 10 alternativas e 8 complementos; a home mostra 6 e o
resto fica atrás do "Ver todos os N", que leva a `/minha-vitrine`. O link só
aparece quando sobrou algo — um "ver mais" que leva à mesma lista é pior que
nenhum.

### O agente não escreve `.deco/blocks/*.json`

A section é um bloco que um humano posiciona uma vez; o conteúdo vem de uma
linha no Postgres. O motivo é rollback: reverter uma vitrine ruim tem que ser um
`UPDATE`, não um revert de commit num arquivo que o próximo build sobrescreve.
É também exclusão declarada na skill do time (`agent-creator`, Passo 1).

> **A linha:** o deco é dono de *onde* a vitrine aparece. O agente é dono do
> *que* entra nela.

## O provedor: Decopilot

É o que funciona. O handoff do agente de busca documenta cinco caminhos que não
funcionam (chave tratada como Anthropic → 401; `api.decocms.com` → NXDOMAIN;
gateway oficial → 404; conexão MCP → 500; endpoints estilo OpenAI → 405).

Protocolo verificado nesta branch, com as nossas credenciais:

```
1. POST {ROOT}/api/{org}/tools/COLLECTION_THREADS_CREATE
     { data: { title, virtual_mcp_id: <STUDIO_AGENT_ID> } }
     -> 200 { item: { id: "thrd_…" } }     ← o id gerado, NÃO o que você mandar
2. GET  {ROOT}/api/{org}/decopilot/threads/{id}/stream    SSE, ANTES do POST
3. POST {ROOT}/api/{org}/decopilot/threads/{id}/messages  -> 202
     { messages: [{ role, parts: [{ type:"text", text }] }], agent: { id } }
4. ler os eventos `text-delta` até `finish`
```

**O passo 1 é a peça que faltava no handoff**, que usava um `threadId` fixo sem
dizer de onde vinha. Thread inexistente falha de dois jeitos e nenhum diz "crie
a thread": o stream devolve `404 Thread not found` e o POST devolve **500 com
violação de foreign key** em `thread_message_parts_thread_id_fkey`.

Duas armadilhas de transporte:

- O corpo de `messages` é validado por zod estrito: aceita **exatamente**
  `{ messages, agent }`. Não há como criar a thread por ali.
- Existe MCP em `/api/{org}/mcp`, **mas ele rejeita os nomes do próprio
  catálogo** (`unknown namespace "COLLECTION"`). O que funciona é o transporte
  REST `POST /api/{org}/tools/{NOME}`. `GET /api/{org}/tools` lista as 163
  ferramentas.

| | |
|---|---|
| Org | `igor-deco-core` |
| Modelo | `anthropic/claude-sonnet-5` |
| Credencial | `aik_ryREhrnwoXZOzgZTebCDv` |
| Sobrecarga por thread nova | ~15.900 tokens de entrada |
| Vitrine real | 35–60s, ~21k entrada, ~1,1k saída |

**Uma thread por execução.** O histórico acumula — medido: a mesma pergunta
trivial custou 15.940 tokens numa thread nova e 21.191 numa usada. Reaproveitar
faria o custo crescer sem teto e deixaria os dados de um comprador no contexto
do próximo.

**Sem cache de prompt e sem saída estruturada garantida.** O Decopilot tem
prompt de sistema próprio, que briga com "responda só JSON". Daí o parsing por
balanceamento de chaves em `extrairJson`, e o `confianca` como rede: resposta
que não parseia é tratada como confiança zero.

### `waiting-capacity` é normal

Meia hora depois de um teste bem-sucedido, a mesma chamada passou a estourar o
timeout. Não era o código nem o tamanho do prompt — mensagem trivial falhava
igual:

```
[11286ms] waiting-runner
[11746ms] starting-run
[12089ms] waiting-capacity
[42088ms] waiting-capacity      <- preso até o timeout
```

**É fila do lado deles**, e nada no HTTP indica: a thread cria, o stream abre
com 200, o POST devolve 202. Só o evento de status conta. Se a taxa de fallback
subir na demo, o lugar de olhar é este, não o nosso cliente.

## O que foi verificado

Contra o Supabase e o Decopilot reais, não em teste sintético.

**Vitrines geradas** com três desejos de tipos diferentes e com um só. Última
execução: 9 alternativas e 5 complementos de cinco tipos distintos (camiseta,
manga longa, sobrecamisa, calça de moletom, gorro).

**Zero handles inventados** em todas as execuções.

**Zero alucinação de cor**, conferindo item a item: o modelo afirmou "cinza" só
nas peças cujo título traz `- Grey`, e **não citou cor** nas azuis e brancas.

**As nove afirmações de tamanho conferidas uma a uma.** As seis peças que têm M
foram citadas como tendo; as duas que **não** têm foram sinalizadas
("Classic Pullover Hoodie… **sem** o M disponível" — real: S, XL, XS) ou tiveram
o tamanho omitido.

**Cookie**: legítimo aceito; forjado, sem assinatura e assinado com outro
segredo, todos rejeitados.

**Gatilho**: `POST /deco/invoke/…/notifyMe/subscribe` devolve `{"success":true}`
na hora com o `Set-Cookie`, e a geração completa em segundo plano
(`generated_at` avançou de 20:16 para 20:30).

**Persistência e releitura**: 6 de 6 handles ainda disponíveis, ordem
preservada.

**Rotas**: `/minha-vitrine` casa `pages-minha-vitrine`, `/minha-vitrine/combina`
casa `pages-minha-vitrine-combina`, e as duas diferem no `propsHash` da section
— prova de que a prop `lista` chega distinta.

**Não verificado: o render.** As sections são diferidas e dependem de identidade
— precisa de navegador, logado ou com o cookie `deco_shelf`.

## Armadilhas para quem chegar depois

**`pkill` não mata o Vite neste ambiente.** A linha de comando real é
`node .../vite.js dev`, então `pkill -f "vite dev"` não casa nada. Chegaram a
existir **seis** dev servers em paralelo, e a porta 5173 ficou com o mais
antigo — o que fez rotas novas parecerem quebradas por um bom tempo. Use
PowerShell filtrando `CommandLine` pelo diretório do projeto.

**`node:crypto` vaza para o bundle do cliente.** O dynamic import de
`site/loaders/personalShelf` em `setup.ts` arrasta
`shelf.actions → shelf.identity → shelf.cookie → node:crypto`, e o Rollup falha
com `"createHmac" is not exported by "__vite-browser-external"`. Typecheck e dev
**não pegam** — só o build do client. Há stub em `vite.config.ts`, e ele
**lança** em vez de devolver no-op: assinatura de cookie não tem degradação
aceitável.

**Excluir dos complementos o que já é alternativa mata a segunda vitrine.**
Parece obviamente certo e está errado: `findSimilarAvailable` não filtra por
tipo, então boné e camiseta chegam como "alternativa" e o pool de composição
esvazia (medido: 2 complementos). A não-repetição é imposta na **saída**, via
`jaUsados` em `validar`.

**As credenciais vivem no `.env`, não no `.dev.vars`.** O dev server só lê
`.env` — `.dev.vars` é herança do wrangler. Quem ainda o lê é só o
`scripts/shelf-dryrun.ts`, como fallback. Editar só o `.dev.vars` muda o dry run
e não muda o site.

**A entrada é pobre, e isso não é culpa do agente.** Só entra em `stock_alerts`
quem clicou num produto esgotado. Um agente excelente sobre entrada pobre produz
vitrine que parece aleatória, e a conclusão fácil (errada) é culpar o modelo.
Com **um** desejo só, a procedência (`paraODesejo`) nunca aparece nos motivos —
ela existe para o texto dizer "para a calça que você queria", e isso exige dois
ou três desejos de tipos diferentes.

## Variáveis de ambiente

| Variável | Sem ela |
|---|---|
| `STUDIO_BASE_URL`, `STUDIO_ORG`, `STUDIO_AGENT_ID`, `STUDIO_API_KEY` | o agente cai no fallback por SQL |
| `SHELF_COOKIE_SECRET` | a vitrine só aparece para quem está logado |
| `DATABASE_URL` | nada funciona |

As cinco primeiras foram adicionadas na Vercel (production e preview).

> A `STUDIO_API_KEY` em uso já apareceu em texto puro no histórico de trabalho.
> Vale rotacionar — junto com a senha do Supabase, pelo mesmo motivo.

## O que falta

**O cron de refresh.** `acharVitrinesVencidas` está escrito e testado, mas não
há `crons` no `vercel.json` nem endpoint que o chame. No plano Pro,
`maxDuration` de ~300s a ~60s por comprador dá ~5 por execução — o suficiente
para a demo, e o cron precisa de **prazo e retomada**: processa até o orçamento
acabar e para, ordenando pela vitrine mais antiga. É isso que o torna
auto-recuperável sem fila.

**O e-mail.** O passo que fecha a hipótese — e a tela promete hoje um e-mail que
ninguém envia. Bloqueado em **domínio**: `vercel.app` não permite SPF/DKIM/DMARC
porque não controlamos a zona DNS. Recomendação: e-mail curto com link para
`/minha-vitrine` em vez da vitrine embutida (esquiva do HTML de e-mail, e o
token no link resolve a identidade do deslogado de graça).

**O visitante anônimo.** Hoje o cookie só nasce no clique. Quem nunca clicou não
tem vitrine, e isso está certo; quem clicou em outro navegador também não, e
isso é limitação.

**Embeddings.** `products.embedding` existe e está vazia. Com `product_type` e
tags em 100% do catálogo, a ordenação por SQL já entrega — vale medir antes de
decidir que precisa de vetor.
