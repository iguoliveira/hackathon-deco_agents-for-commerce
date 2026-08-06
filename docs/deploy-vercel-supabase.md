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

Crie um `.env` (ignorado pelo git) com uma linha:

```
DATABASE_URL=postgresql://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:6543/postgres
```

Pegue a string em **Supabase → Connect → Connection string → Transaction
pooler**. Tem que ser o pooler na **porta 6543**, não a conexão direta (5432):
o driver está configurado com `prepare: false` por causa do modo transação, e
no plano free a conexão direta só resolve em IPv6 — costuma dar timeout sem
dizer por quê. O host do pooler tem `pooler.supabase.com` e o usuário tem um
ponto (`postgres.<ref>`).

Cole a string **por cima da linha inteira**. Colar depois de um prefixo que já
estava lá produz `postgresql:postgresql://...`, que o parser aceita com host
vazio e vira um `ECONNREFUSED` que parece problema de rede. `scripts/db-url.ts`
detecta isso antes de conectar.

```bash
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

## Os bugs que só existiam no runtime da Vercel

Esta é a parte que vale ler antes de mexer no entry ou no banco. Quatro
problemas passaram por typecheck, build e pelo `npm run preview` e só
apareceram em produção — três deles porque o `preview` exercitava um caminho
*parecido* com o real, não o real.

**1. `request.headers.get is not a function`** (todas as páginas, 500)

O runtime Node da Vercel invoca a função como `(IncomingMessage,
ServerResponse)`, não com um `Request` da Web API. A primeira tentativa de
correção pôs a conversão numa casca em `api/index.mjs` — e o stack de produção
mostrou a Vercel chamando `dist/server/server.js` **direto**, sem passar por
ela. A conversão vive hoje dentro do próprio handler, em `src/server.ts`, e
`scripts/serve.ts` chama o handler no mesmo formato de produção em vez de
converter por conta própria. Era exatamente essa divergência que deixava o
preview passar enquanto a produção quebrava.

**2. Todo POST travava até o timeout** (GETs respondiam normalmente)

O launcher da Vercel consome e parseia o corpo **antes** de chamar o handler,
expondo em `req.body`. O stream chega drenado, e um `Readable.toWeb(req)` fica
esperando bytes que nunca vêm — sem erro, sem log, só pendurado. `readBody`
aceita as duas formas.

**3. `column "quantity" does not exist`** (PLP e busca)

Três exigências do Postgres que o SQLite perdoava, todas nas facetas de
`searchCatalog`:

- `HAVING` **não** enxerga alias da lista de SELECT (é avaliado antes dela) —
  o agregado precisa ser repetido por extenso. Era este o erro do log.
- Coluna não agregada fora do `GROUP BY` (`pp.value`, `vo.position`): o SQLite
  escolhia um valor qualquer do grupo, o Postgres recusa a query. Este nem
  tinha aparecido ainda — só surgiria depois de corrigir o primeiro.
- `ORDER BY`, ao contrário do `HAVING`, **aceita** alias de saída. Anotado no
  código para ninguém "corrigir" o que está certo.

**4. `GROUP_CONCAT` em `db/queries/waited-items.sql`** — função do SQLite; no
Postgres é `STRING_AGG`, e lá o separador é obrigatório. Passou batido porque
a varredura de dialeto cobriu `db/migrations/` e esqueceu `db/queries/`.

### A lição que mais custou tempo

**Status HTTP 200 não é sinal de saúde neste site, e HTML de SSR não é prova de
renderização.**

Quando um loader do CMS falha, o erro é registrado e a section renderiza vazia
— a página continua devolvendo 200. E as sections são **diferidas ou lazy**:
`ProductShelf` e `ProductDetails` têm `hasLoadingFallback: true`, e as páginas
de PDP (`/products/:slug`), categoria (`/*`) e busca (`/s`) têm **todas** as
suas sections dentro de `website/sections/Rendering/Lazy.tsx`. Só a home tem
sections diretas — é a única cujo HTML de SSR mostra produto.

Durante esta migração eu concluí duas vezes que algo estava quebrado a partir
de `curl`, e errei nas duas. Para validar render, use navegador. Para validar
dados, chame as funções de `platform/` direto ou leia o log de runtime.

## Estado da verificação

**No ar:** https://hackathon-deco-agents-for-commerces.vercel.app

Verificado em produção:

- home, PDP, busca, coleção e login respondem 200
- a home entrega 18 links de produto vindos do Supabase
- headers de segurança, CSP e `Vary: Accept-Encoding, User-Agent`
- o clique de "avise-me quando voltar" grava no Supabase (~370ms) e a leitura
  devolve `Size=M | Color=White` com a coleção
- variante inexistente é recusada
- log de runtime sem `PostgresError` nem falha de loader

Verificado contra o Supabase real, localmente — as 14 funções exportadas que
falam SQL, incluindo paginação, ordenação por preço, facetas combinadas,
idempotência do alerta e `findWaitedItems`.

Verificado contra o build de produção sob Node: desktop e mobile produzem HTML
diferente (prova de que o `RequestContext` está de pé), e o driver do Postgres
está ausente do bundle do client.

**Não verificado:** a renderização em si. Como as sections são lazy/diferidas,
isso exige navegador — confirme na tela que a PDP mostra o tamanho **M**
riscado e o formulário de aviso.

**Ruído pré-existente, não desta migração:** o log traz
`[CMS] No component registered for: site/sections/Session.tsx`. É referência
órfã em `.deco/blocks/site.json` a um arquivo que nunca existiu — nem no `main`
do time.

## Deploy

O projeto está em `igorfigueiredo28s-projects/hackathon-deco-agents-for-commerces`,
apontando para o fork `IgorFigueiredo28/hackathon-deco_agents-for-commerces`
(o `main` do fork carrega a migração; o `main` do repo do time não foi tocado).

Hoje o deploy é manual:

```bash
vercel --prod
```

Conectar o repositório na Vercel faria cada push virar deploy. Para atualizar a
variável do banco sem risco de cópia parcial — que foi a causa de dois erros
seguidos:

```bash
node -e "process.loadEnvFile('.env');process.stdout.write(process.env.DATABASE_URL)" \
  | vercel env add DATABASE_URL production --force
```
