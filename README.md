# hackathon-deco · agents for commerce

Storefront demo em **Vercel (Node)** + **Supabase (Postgres)**, com agentes de IA
que recomendam produtos a partir de quem a pessoa é — não do que ela clicou.

A pergunta que o projeto persegue: **"o que ESTA pessoa deveria ver?"**, em vez
de "o que combina com isto?". Cada peça recomendada vem com uma linha dizendo
por que entrou, escrita pelo modelo sabendo do armário de quem está olhando.

---

## Os agentes

| Agente | Onde | O que faz |
|---|---|---|
| **vitrine** | `src/platform/vitrine/` · home | Recomenda **sem âncora**: parte da pessoa, não de um produto. Duas passadas — sintetiza a persona, depois recomenda. Até 5 peças (`MAX_PECAS`, no prompt). |
| **persona** | `src/platform/look/persona.agent.ts` | Lê os sinais e escreve um retrato do guarda-roupa. Cacheada por hash dos sinais; descartada quando a confiança fica abaixo de 0.5. |
| **shelf** | `src/platform/shelf/` | **Sem consumidor desde a #35.** Era a vitrine do "avise-me"; as sections saíram quando a recomendação por IA passou a viver numa vitrine só. Ver abaixo. |

### O shelf está dormente, não morto

A #35 removeu `PersonalShelf.tsx` e `loaders/personalShelf.ts`, e com eles todo
caminho até `shelf.agent`, `shelf.candidates`, `shelf.prompt` e a tabela
`shelves`. O código ficou porque é uma feature inteira e documentada — a decisão
de aposentá-la é de quem a construiu. `npm run shelf:dryrun` é o único jeito que
sobrou de executá-la.

Três peças do domínio **seguem em uso** e não são do agente: `shelf.identity`
(`donoDaVitrine()`, a identidade que a vitrine recomendada lê), `shelf.cookie`
(o cookie assinado que a sustenta) e `shelf.decopilot` (`perguntar()`, o cliente
do modelo que **todos** os agentes usam).

### A vitrine na home

Ela vive numa caixa com borda e véu no verde da marca, e não por enfeite: a home
tem uma `ProductShelf` comum logo ao lado, visualmente idêntica. Sem marcação, a
única diferença perceptível seria o texto sob cada card — a pessoa teria de ler
para descobrir que uma foi composta para ela.

O título da tela (`"Recomendações com a sua cara"`) vem do **CMS**, não do
modelo. O agente escreve `vitrine.titulo` e ele fica fora da tela, gravado como
registro do que ele achou que estava montando: título vindo do modelo faria a
home mudar de nome sozinha entre visitas.

### Os sinais

Tudo que a pessoa já declarou querer alimenta os agentes:

```
comprou     orders + order_items
avise-me    stock_alerts
favoritou   wishlist_items (logado) ∪ cookie deco_wishlist
viu         cookie deco_recent
```

Eles são **unidos, não pesados** — uma peça comprada e favoritada chega ao modelo
como *"comprou e favoritou"*, e não há tabela de pesos escolhendo vencedora.
A ordem é cronológica, que é fato sobre os sinais e não julgamento sobre eles.

### A chave do cache: uma pessoa, um dia

A vitrine é composta **uma vez por pessoa por dia**. Refresh, navegação e voltar
à mesma página não disparam nada; à meia-noite **UTC** (21h de Brasília) a chave
vira sozinha, sem cron nem job de limpeza.

Isso tem um preço, e ele aparece na demo: favoritar às 14h não muda a vitrine até
amanhã. `npm run vitrine:refresh` é a válvula.

---

## Rodando localmente

### 1. `.env` — tudo num arquivo só

O banco:

```bash
DATABASE_URL=postgresql://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:6543/postgres
```

> Supabase → Connect → Connection string → **Transaction pooler** (porta 6543).
> Não use a "Direct connection" na 5432.

E o modelo. Sem estas o site sobe e funciona; os agentes é que não compõem.

```bash
STUDIO_BASE_URL=...
STUDIO_ORG=...
STUDIO_AGENT_ID=...
STUDIO_API_KEY=...
SHELF_COOKIE_SECRET=...   # assina o cookie de identidade da vitrine
```

> ⚠️ **No `.env`, não no `.dev.vars`.** O `.dev.vars` é herança do wrangler e
> ninguém o carrega automaticamente — quem lê env sob o Vite é o `loadEnvPlugin`
> do TanStack Start, e ele só olha para o `.env`. O único arquivo que ainda
> consulta o `.dev.vars` é `scripts/shelf-dryrun.ts`, e só como preenchimento do
> que o `.env` não trouxe. Pôr as credenciais lá deixa os agentes mudos, e o
> sintoma (section some da home) é idêntico ao de não ter cache quente.

### 2. Dependências — **bun obrigatório**

```bash
bun install
```

> ⚠️ Se usar `npm install`, rode `bun install` depois: o patch de imagens
> (`quality=original`) só é aplicado pelo bun.

### 3. Os blocos do CMS

```bash
npm run generate:blocks
```

`.deco/blocks.gen.json` é **gitignored** — num clone novo ele não existe, e sem
ele a home sobe sem as sections do CMS. Uma página em branco aqui é este passo
faltando, não banco vazio. O `build` já o roda; o `dev` não.

### 4. Banco e dev

```bash
npm run db:setup   # migrations + restore do snapshot + auditoria
npm run dev        # http://localhost:5173
```

`db:setup` é o caminho para um banco novo. Num banco que já existe,
`npm run db:migrate` basta — e o `predev` já o roda antes do `dev`.

### 5. Build de produção

```bash
npm run build && npm run preview   # http://localhost:3000
```

> As portas são diferentes e é fácil olhar a errada: **dev na 5173** (padrão do
> Vite) e **preview na 3000** (`PORT` no `scripts/serve.ts`). Rodando os dois,
> convivem sem conflito — e testar a mudança na aba errada custa caro.

---

## Comandos

### Banco

| Comando | O quê |
|---|---|
| `npm run db:setup` | migrations + snapshot + auditoria — o caminho do zero |
| `npm run db:migrate` · `db:list` | aplica / lista o que já rodou |
| `npm run db:snapshot` · `db:restore` | grava / restaura `db/seeds/snapshot.json` (e-mails pseudonimizados) |
| `npm run db:audit` | confere se as migrations refletem o banco |
| `npm run db:query -- "SELECT ..."` | SQL avulso |
| `npm run db:alerts` | `stock_alerts` cruzados com o catálogo |
| `npm run db:reset -- --confirm` | **apaga tudo**, inclusive histórico de alertas |

### Agentes

| Comando | O quê | Custo |
|---|---|---|
| `npm run vitrine:refresh -- <email>` | recompõe a vitrine de hoje (UPSERT) | 60-150s, 2 chamadas |
| `npm run look:check` | caminho de renderização e invariantes | **zero** — não chama o modelo |
| `npm run look:wishlist [email]` | a wishlist do banco virando semente | zero |
| `npm run look:armarios` | semeia 4 armários `@demo.local` para testar personas | zero |
| `npm run shelf:dryrun -- <email>` | o agente dormente do shelf — único caminho que ainda o alcança | chama o modelo |

### Build e qualidade

| Comando | O quê |
|---|---|
| `npm run generate:blocks` | recria `.deco/blocks.gen.json` (gitignored) — **exige bun** |
| `npm run typecheck` · `format` · `knip` · `tailwind:lint` | as verificações |

---

## Estrutura

```
src/platform/<dominio>/      domínios: vitrine, look, shelf, catalog, cart,
                             orders, wishlist, alerts, user, address, db
src/loaders/                 o que as sections do CMS consomem
src/sections/                componentes de página
db/migrations/               numeradas, aplicadas uma vez cada
db/seeds/snapshot.json       dados de demo, versionados
docs/                        o desenho e as decisões
scripts/                     migrate, query, snapshot, dry runs, verificações
```

Cada domínio segue o mesmo formato: `types` · `d1` (SQL) · `actions` ·
`agent`/`prompt` quando fala com o modelo.

### Docs que valem a leitura

| Arquivo | Sobre |
|---|---|
| [`vitrine-sem-ancora.md`](docs/vitrine-sem-ancora.md) | a recomendação partindo da pessoa — o desenho em vigor |
| [`persona-do-guarda-roupa.md`](docs/persona-do-guarda-roupa.md) | a síntese do armário, e por que não há tabela de pesos |
| [`agente-vitrine.md`](docs/agente-vitrine.md) | o agente ponta a ponta, e onde as credenciais moram |
| [`agente-de-combinacoes.md`](docs/agente-de-combinacoes.md) | o agente de look, com as regras que valem para todos |
| [`deploy-vercel-supabase.md`](docs/deploy-vercel-supabase.md) | a migração e as armadilhas do runtime |
| [`auditoria-migrations.md`](docs/auditoria-migrations.md) | por que existe `db:audit` |

---

## Armadilhas conhecidas

**Status 200 não é sinal de saúde.** As sections são diferidas
(`Rendering/Lazy.tsx`): o HTML do SSR é esqueleto, e um loader que falha vira
section vazia com a página respondendo 200. **Valide no navegador, não no
`curl`** — e `curl` não dispara loader diferido nenhum.

**HMR não recarrega código de servidor.** Depois de mexer em `src/platform/**`,
reinicie o dev server. Um script rodando via `tsx` lê o fonte novo enquanto o
navegador ainda executa o módulo antigo, e os dois discordam sem avisar.

**A virada do dia é UTC.** 21h em Brasília. Uma vitrine aquecida às 22h já conta
como do dia seguinte.

**Sem cache quente, a section não aparece.** Não há fallback por SQL: ou existe
recomendação do agente, ou não existe section. A primeira visita de um par novo
dispara a composição em background e mostra a página sem ela — por isso
`vitrine:refresh` faz parte do roteiro da demo, não é enfeite.

**O provedor do modelo cai.** Falha põe em quarentena o **conjunto de sinais** —
não a peça — para que "o provedor está fora" não vire mais carga. São **60
minutos na vitrine** e **10 minutos na persona**, e a diferença é deliberada: a
persona é a montante de tudo e precisa se recuperar dentro de uma demo, enquanto
uma vitrine que acabou de falhar só repetiria a falha se tentasse de novo logo.
`vitrine:refresh` ignora as duas.

**Dados semeados são dados semeados.** `0006_out_of_stock_sizes.sql` marca duas
variantes como esgotadas para exercitar o "avise-me"; os armários `@demo.local`
existem para testar personas; e a `0023_seed_pedidos_3211.sql` grava os pedidos
de `3211@gmail.com`. Reverta antes de qualquer produção real, e **diga no slide**
o que foi semeado.

**Para ver a vitrine logado, use `3211@gmail.com`.** Os quatro armários
`@demo.local` têm sinais, mas são e-mails de seed sem conta de autenticação —
ninguém consegue logar como eles, e a vitrine só aparece para quem está na tela.
`3211@gmail.com` é conta real, com senha, e a `0023` existe justamente para que
os pedidos dela sobrevivam a um `db:reset`.

**O "avise-me" não envia e-mail.** A tela promete; nada é enviado.
