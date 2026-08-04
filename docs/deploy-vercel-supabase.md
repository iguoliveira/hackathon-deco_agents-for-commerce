# Deploy: Vercel + Supabase

## O que mudou e por quê

O site rodava em Cloudflare Workers com o catálogo em D1 (SQLite). Passou a
rodar na Vercel (Node) com o catálogo no Postgres do Supabase.

A motivação não foi "sair da Cloudflare": foi **poder deployar** — o
`database_id` no `wrangler.jsonc` era um placeholder e nunca existiu banco
remoto — e abrir caminho para **pgvector**, já que o agente da vitrine vai
depender de similaridade por descrição (90% do catálogo não tem `product_type`
e só 10% tem tags; ver `feature-back-in-stock-shelf.md`).

A decisão de ir para a Vercel *junto* com o Supabase veio de uma constatação:
o problema difícil de "Postgres na Cloudflare" (Workers não abrem TCP; exige
Hyperdrive) é um problema **do Workers**, não do Supabase. No runtime Node da
Vercel ele simplesmente não existe.

## O que foi perdido de propósito

Tudo isto vinha de `createDecoWorkerEntry`, no antigo `src/worker-entry.ts`, e
foi descartado com a decisão de **não editar mais o site pela Studio**:

| Perdido | Consequência prática |
|---|---|
| Protocolo de admin (`handleMeta`, `handleRender`, …) | O editor visual da Studio não funciona mais |
| Fast Deploy (`DECO_KV`) | Publicar exige redeploy |
| `withABTesting` (`SITES_KV`) | Sem split de tráfego |
| `instrumentWorker` + tail worker | Sem OTel, sem traces |
| Cache de borda segmentado (`buildSegment`) | Ver *Vary* abaixo |

Editar conteúdo agora é: alterar o JSON em `.deco/blocks/`, commit, redeploy.
O decofile é bundlado no build (`src/setup.ts` importa `.deco/blocks.gen`
estaticamente), então a vitrine renderiza normalmente sem a Studio.

## O que precisou ser reimplementado

`src/server.ts` é o novo entry. Ele não é um `createStartHandler` pelado — três
coisas que vinham de graça do Worker tiveram que voltar à mão:

**`RequestContext.run(request, ...)`** — a mais importante e a mais silenciosa.
`useDevice()` resolve o device a partir do user-agent guardado no
RequestContext. Sem esse wrapper ele cai no fallback `"desktop"` e
`Header.tsx`, `Carousel.tsx` e `DeviceVisible.tsx` renderizam layout de desktop
no celular — **sem erro e sem log**.

**App middleware** (`getAppMiddleware()`) — injeta o estado dos apps no
`RequestContext.bag` e encaminha cookies. Sem ele o login não sobrevive.

**Dedup de `Set-Cookie` + headers de segurança** — eram do framework.

## `Vary: User-Agent` não é otimização

As sections renderizam markup diferente por device, e a resposta sai
`public, s-maxage=900`. Na Cloudflare isso era seguro porque o `buildSegment`
colocava o device na chave do cache. **Fora dela, nada faz isso.** Sem
`Vary: User-Agent`, o primeiro visitante popula o cache e todo mundo recebe o
layout dele por 15 minutos.

O custo é real: user-agent tem cardinalidade altíssima, então o cache
compartilhado quase para de acertar. A saída melhor é normalizar o device num
cookie em middleware e dar `Vary` nele — duas variantes em vez de milhares.
Ficou para depois.

## Armadilhas

**`installCommand: "bun install"` no `vercel.json` é obrigatório.** O
`package.json` tem `patchedDependencies`, que é campo do **bun** — o patch de
`@decocms/blocks` força `quality=original` no CDN de imagens, sem o qual o CDN
quantiza PNG para 16 cores e as fotos de produto saem com banding visível. Se a
Vercel rodar `npm install`, o patch não é aplicado e o site fica feio de um
jeito que ninguém associa ao gerenciador de pacotes. O `npm run build` também
chama `bun` diretamente nos passos de `generate:*`.

**Existem dois lockfiles** (`bun.lock` e `package-lock.json`). Quem instalar
dependência com `npm` precisa rodar `bun install` depois, ou a Vercel instala
um conjunto diferente do que foi testado.

**O driver do Postgres precisa de stub no client.** `postgres` importa builtins
do Node e chega ao grafo do browser pelos dynamic imports de loaders em
`setup.ts` — o mesmo caminho que obrigava o stub de `cloudflare:workers`. O
plugin `deco-stub-postgres` no `vite.config.ts` resolve; sem ele o build do
client falha em "perf_hooks não pode ser resolvido".

**Diferenças de dialeto que não dão erro, só resultado errado** (todas já
tratadas, listadas para quem for mexer):

- `LIKE` → `ILIKE`. No SQLite o `LIKE` era case-insensitive de graça.
- `price` é `DOUBLE PRECISION`, não `REAL` (no Postgres `REAL` é float4 e
  arredonda preço) e não `numeric` (voltaria como string para dentro do
  schema.org em `catalog.mapper.ts`).
- `available` continua `INTEGER`, não `boolean` — `alerts.d1.ts` compara
  `=== 1`.
- `created_at` continua `TEXT` ISO-8601, não `timestamptz` — `WaitedItem.waitedAt`
  é `string`, e um timestamptz voltaria como `Date`.

## Como as queries continuaram iguais

`src/platform/db/` expõe o Postgres com a **mesma superfície do D1**
(`prepare().bind().first()/.all()/.run()`, `batch()`) e traduz `?` para
`$1..$n`. Foi o que permitiu portar `catalog.d1.ts` (328 linhas) e
`alerts.d1.ts` (230) sem reescrever query nenhuma — só o `getDb()` e os dois
`ILIKE`. Os arquivos mantiveram o nome `.d1.ts` porque renomear trocaria
imports em vários lugares sem mudar o que fazem.

## Rodando

```bash
cp .env.example .env      # preencha DATABASE_URL (pooler do Supabase, porta 6543)
npm run db:migrate        # aplica db/migrations/*.sql
npm run dev
```

Inspeção e manutenção:

```bash
npm run db:list                    # o que já rodou / o que falta
npm run db:alerts                  # os desejos, cruzados com o catálogo
npm run db:query -- "SELECT ..."   # SQL avulso
npm run db:reset -- --confirm      # APAGA tudo, inclusive stock_alerts
```

Ver o build de produção localmente — vale a pena antes de qualquer deploy,
porque `vite preview` só serve assets e não executa SSR:

```bash
npm run build && npm run preview   # http://localhost:3000
```

## Estado da verificação

Verificado localmente contra o build de produção rodando sob Node:

- home, PDP e busca respondem 200
- desktop e mobile produzem HTML diferente (prova de que o `RequestContext` está
  de pé)
- headers de segurança, CSP e `Vary: User-Agent` presentes só em HTML
- `Set-Cookie` sendo escrito
- driver do Postgres ausente do bundle do client
- tradução `?` → `$n` conferida contra as queries reais

**Não verificado:**

- nenhuma query rodou contra um Postgres real — falta `DATABASE_URL`. Os 200
  acima são o fallback de catálogo vazio, por design.
- o deploy na Vercel em si (`vercel.json` + `api/index.mjs`) nunca foi executado.
