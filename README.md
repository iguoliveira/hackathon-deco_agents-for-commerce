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
| **vitrine** | `src/platform/vitrine/` · home | Recomenda **sem âncora**: parte da pessoa, não de um produto. Duas passadas — sintetiza a persona, depois recomenda. |
| **persona** | `src/platform/look/persona.agent.ts` | Lê os sinais e escreve um retrato do guarda-roupa. Cacheada por hash dos sinais; descartada quando a confiança fica abaixo de 0.5. |

Um terceiro agente, **shelf** (`src/platform/shelf/shelf.agent.ts`), compunha a
vitrine do "avise-me". Ele **não tem mais interface**: a section e o loader
foram removidos e nenhum bloco o referencia — só `npm run shelf:dryrun` ainda o
alcança. O que sobrevive daquele diretório é infraestrutura que todos usam:

```
shelf.identity     donoDaVitrine() — quem está olhando (sessão > cookie)
shelf.cookie       o cookie assinado que sustenta isso
shelf.decopilot    perguntar() — o cliente do modelo, de todos os agentes
shelf.agent        só o extrairJson(), utilitário de parsing
```

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

Quem dispara é o próprio loader da home, ao ler: no miss ele chama
`gerarVitrine` **sem esperar** e devolve `null`. Por isso a primeira visita do
dia nunca mostra a vitrine — ela aparece no carregamento seguinte, 60-150s
depois. `npm run vitrine:refresh` é a válvula para a demo.

---

## Rodando localmente

### 0. Pré-requisitos

| | Por quê |
|---|---|
| **Node ≥ 20.12** | os scripts usam `process.loadEnvFile`, que não existe antes disso |
| **bun** — [instalar](https://bun.sh) | **não é opcional**: cinco geradores o chamam direto, e `npm run build` encadeia quatro deles |

O `bun` é fácil de subestimar porque `npm run dev` funciona sem ele. O `build`
não: `generate:blocks`, `generate:sections`, `generate:loaders` e
`generate:schema` invocam `bun` na linha de comando e falham com
`bun: command not found`.

### 1. `.env`

```bash
cp .env.example .env
```

É **`.env`** — não `.dev.vars`. Se você encontrar esse outro nome em algum
comentário, é resíduo da época em que isto rodava em Cloudflare Workers; nada no
projeto abre esse arquivo hoje.

Só a `DATABASE_URL` é obrigatória. Sem as `STUDIO_*` o site sobe e navega
normalmente — os agentes é que não compõem. O `.env.example` explica cada uma.

> ⚠️ **A `DATABASE_URL` costuma apontar para uma instância compartilhada.**
> Numa demo em equipe, `npm run db:reset -- --confirm` apaga o banco de todo
> mundo, não o seu.

### 2. Dependências

```bash
bun install
```

> `npm install` também resolve a árvore, mas o `patchedDependencies` do
> `package.json` só é aplicado pelo bun. Ver *"O patch de imagens não está
> aplicando"* em Armadilhas — hoje ele não aplica **nem com bun**.

### 3. Banco e dev

```bash
npm run db:setup   # migrations + restore do snapshot + auditoria
npm run dev        # http://localhost:5173
```

`db:setup` é o caminho para um banco novo. Num banco que já existe,
`npm run db:migrate` basta — e o `predev` já o roda antes do `dev`.

### 4. Build de produção

```bash
npm run build && npm run preview   # http://localhost:3000
```

> As portas são diferentes e é fácil olhar a errada: **dev na 5173** (padrão do
> Vite) e **preview na 3000** (`PORT` no `scripts/serve.ts`). Rodando os dois,
> convivem sem conflito — e testar a mudança na aba errada custa caro.

---

## Vendo o agente funcionar

Subir o projeto **não** faz a vitrine aparecer, e isso é desenho, não defeito:
ela exige **identidade** e **cache quente**, e a primeira visita não tem nenhum
dos dois. Sem este roteiro a conclusão natural é "está quebrado".

**1. Semeie armários com sinais de sobra.**

```bash
npm run look:armarios
```

Quatro pessoas em `@demo.local`, com 5 a 7 sinais cada:

| | |
|---|---|
| `ana.escura@demo.local` | armário coeso, tons escuros |
| `bruno.solto@demo.local` | modelagem larga |
| `carla.tecnica@demo.local` | peças técnicas |
| `diego.disperso@demo.local` | **controle** — peças sem relação entre si |

O `diego` é o que mais importa: o esperado é `confianca < 0.5` e **nenhuma
vitrine**. Se ele receber um retrato confiante, a premissa da feature caiu.

**2. Componha a vitrine de uma delas.**

```bash
npm run vitrine:refresh -- ana.escura@demo.local
```

60-150s e duas chamadas de modelo. Exige as `STUDIO_*` no `.env`.

**3. Seja reconhecido como essa pessoa no navegador.**

`donoDaVitrine()` resolve **sessão Shopify primeiro, cookie assinado depois**.
Sem login, o caminho é o cookie: clique em **"avise-me"** em qualquer produto
esgotado usando o mesmo e-mail. Isso emite o cookie de identidade — e exige
`SHELF_COOKIE_SECRET` no `.env`, sem o qual o cookie não é emitido nem aceito,
em silêncio.

**4. Recarregue a home.** A vitrine aparece dentro da caixa verde, com uma linha
por peça dizendo por que ela entrou.

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
| `npm run db:reset -- --confirm` | **apaga tudo** — e o banco costuma ser compartilhado |

### Agentes

| Comando | O quê | Custo |
|---|---|---|
| `npm run vitrine:refresh -- <email>` | recompõe a vitrine de hoje (UPSERT) | 60-150s, 2 chamadas |
| `npm run look:armarios` | semeia 4 armários `@demo.local` (`--listar`, `--limpar`) | zero |
| `npm run look:check` | caminho de renderização e invariantes | **zero** — não chama o modelo |
| `npm run look:wishlist [email]` | a wishlist do banco virando semente | zero |
| `npm run shelf:dryrun -- <email>` | o agente do "avise-me", que já não tem tela | chama o modelo |

### Qualidade

`npm run typecheck` · `npm run format` · `npm run knip` · `npm run tailwind:lint`

---

## Estrutura

```
src/platform/<dominio>/      domínios: vitrine, look, shelf, catalog,
                             cart, orders, wishlist, alerts, user, address
src/loaders/                 o que as sections do CMS consomem
src/sections/                componentes de página
db/migrations/               numeradas, aplicadas uma vez cada
db/seeds/snapshot.json       dados de demo, versionados
docs/                        o desenho e as decisões
scripts/                     migrate, query, snapshot, dry runs, verificações
```

Cada domínio segue o mesmo formato: `types` · `d1` (SQL) · `actions` ·
`agent`/`prompt` quando fala com o modelo.

> `src/platform/look/` **não é** o agente de look, que foi aposentado. O nome
> sobreviveu ao dono: ali moram os sinais, a persona, os cookies e o hash — o
> que alimenta qualquer agente. Renomear seria um diff de centenas de linhas de
> import sem mudar comportamento; está registrado como dívida no `index.ts`.

### Docs que valem a leitura

| Arquivo | Sobre |
|---|---|
| [`vitrine-sem-ancora.md`](docs/vitrine-sem-ancora.md) | a recomendação partindo da pessoa — o desenho em vigor |
| [`persona-do-guarda-roupa.md`](docs/persona-do-guarda-roupa.md) | a síntese do armário, e por que não há tabela de pesos |
| [`agente-de-combinacoes.md`](docs/agente-de-combinacoes.md) | o agente de look, **aposentado** — vale pelas regras que valem para todos |
| [`deploy-vercel-supabase.md`](docs/deploy-vercel-supabase.md) | a migração e as armadilhas do runtime |
| [`auditoria-migrations.md`](docs/auditoria-migrations.md) | por que existe `db:audit` |

---

## Armadilhas conhecidas

**Status 200 não é sinal de saúde.** As sections são diferidas
(`Rendering/Lazy.tsx`): o HTML do SSR é esqueleto, e um loader que falha vira
section vazia com a página respondendo 200. **Valide no navegador, não no
`curl`** — e `curl` não dispara loader diferido nenhum.

**O patch de imagens não está aplicando.** O `patchedDependencies` fixa
`@decocms/blocks@7.20.7`, mas `dependencies` pede `^7.20.7` e o instalado é
`7.26.0` — o patch não alcança essa versão. Como é ele quem adiciona
`quality?: number | "original"` ao `ImageProps`, o resultado é o **único erro de
`npm run typecheck` do repositório**:

```
src/components/ui/Image.tsx(61,36): error TS2339:
  Property 'quality' does not exist on type 'ImageProps'.
```

Não é erro de ambiente e não é da sua branch: aparece igual na `main`. Vale
saber ao revisar um delta de typecheck.

**HMR não recarrega código de servidor.** Depois de mexer em `src/platform/**`,
reinicie o dev server. Um script rodando via `tsx` lê o fonte novo enquanto o
navegador ainda executa o módulo antigo, e os dois discordam sem avisar.

**A virada do dia é UTC.** 21h em Brasília. Uma vitrine aquecida às 22h já conta
como do dia seguinte.

**Sem cache quente, a section não aparece.** Não há fallback por SQL: ou existe
recomendação do agente, ou não existe section. Ver *"Vendo o agente funcionar"*.

**O provedor do modelo cai.** São duas quarentenas, com donos diferentes:

| Onde | Tempo | Chaveada por |
|---|---|---|
| vitrine (`vitrine.actions.ts`) | **60 min** | pessoa + dia |
| persona (`persona.agent.ts`) | **10 min** | hash dos sinais |

A section reaparece sozinha quando o provedor volta.

**Dados semeados são dados semeados.** `0006_out_of_stock_sizes.sql` marca duas
variantes como esgotadas para exercitar o "avise-me", e os armários
`@demo.local` existem para testar personas. Reverta antes de qualquer produção
real, e **diga no slide** o que foi semeado.

**O "avise-me" não envia e-mail.** A tela promete; nada é enviado. O que ele
faz de verdade é gravar o alerta e **emitir o cookie de identidade** — é por
isso que ele aparece no roteiro da demo.
