# As migrations descrevem o banco que temos?

> **Faltava uma. Esta branch a traz.** Medido em 2026-08-09 contra o Supabase de
> produção, com `main` em `ca3d8f3`.
>
> A pergunta veio de uma decisão concreta: vamos criar um projeto novo do
> Supabase, e precisamos saber se `npm run db:migrate` nele reproduz o banco de
> hoje. Antes desta branch, reproduzia **12 das 13 tabelas**.
>
> ```
> antes   19 arquivo(s) em disco · 20 registrada(s) no banco
>         ✗ APLICADA MAS AUSENTE DO REPO: 0015_wishlist.sql
>         ✗ tabela órfã: wishlist_items
>
> depois  20 arquivo(s) em disco · 20 registrada(s) no banco
>         ✓ as duas listas são idênticas
>         ✓ nenhum — todo objeto do schema é nomeado por alguma migration
> ```

---

## 1. O achado (corrigido nesta branch)

```
1. schema_migrations × db/migrations/
  19 arquivo(s) em disco · 20 registrada(s) no banco
  ✗ APLICADA MAS AUSENTE DO REPO: 0015_wishlist.sql (em 2026-08-08T21:17:16Z)

3. objetos no banco que migration nenhuma menciona
  ✗ tabela órfã: wishlist_items
```

`0015_wishlist.sql` foi aplicada no banco em 08/08 e **não existe em `main`**.
Ela vive em três branches, nenhuma mergeada:

```
0015_wishlist.sql  <- origin/feature/wishlist          (PR #15)
0015_wishlist.sql  <- origin/feature/wishlist-no-agente
0015_wishlist.sql  <- origin/docs/anatomia-do-agente
```

O que ela cria:

```sql
CREATE TABLE IF NOT EXISTS wishlist_items (
  id               BIGSERIAL PRIMARY KEY,
  user_id          TEXT NOT NULL,
  product_id       TEXT NOT NULL,
  product_group_id TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX idx_wishlist_user_created ON wishlist_items (user_id, created_at DESC);
CREATE INDEX idx_wishlist_user_product ON wishlist_items (user_id, product_id);
```

### Quão grave é hoje: pouco. Amanhã: bloqueia uma PR.

**Nenhum código de `main` lê `wishlist_items`.** A wishlist em produção é o
cookie `deco_wishlist`, e a única menção à tabela no código é um comentário. Um
projeto novo sem ela funciona igual ao de hoje.

O problema é o depois: a **#24** (`feature/wishlist-no-agente`) existe justamente
para ler essa tabela. Ela foi escrita contra um banco que tem a tabela porque
alguém aplicou a migration à mão. Num projeto novo, ela quebraria — e quebraria
com "tabela não existe", que é o erro certo aparecendo tarde demais.

---

## 2. A correção: o arquivo entra, com o nome que o banco já registra

`db/migrations/0015_wishlist.sql` foi trazida **byte a byte** da #24
(`md5 607bfa471335d76a91d4252598652b3f`, conferido contra a origem). A versão
da #24 e a da #15 são idênticas, então não houve o que escolher.

### Por que NÃO renumerei para `0020_wishlist.sql`

Era a saída óbvia, já que a `0015` está ocupada em `main` por
`0015_fix_duplicate_images.sql`. Mas ela produz um banco *menos* fiel, não mais.

`schema_migrations` **já registra exatamente `0015_wishlist.sql`** — foi esse o
nome aplicado em 08/08. Mantê-lo faz três coisas de uma vez:

- **Produção não é tocada.** O runner pula o que já está no ledger. Conferido:
  `npm run db:migrate` respondeu *"Nada a aplicar — banco em dia"*. **Zero
  escrita**, e é a razão de este PR poder trazer uma migration sem risco.
- **O ledger do projeto novo fica igual ao de produção** — mesmos 20 nomes.
  Renumerar deixaria os schemas iguais e os ledgers diferentes, que é a forma de
  divergência mais chata de rastrear depois, porque não aparece no schema.
- **Não conflita com a #24 nem com a #15.** Mesmo caminho, mesmo conteúdo: o git
  resolve sozinho. Um `0020_` criaria duas migrations com o mesmo SQL, e a
  primeira a mergear deixaria a outra órfã.

Pelo mesmo motivo o arquivo entrou **sem comentário meu no topo**, contra o
costume do repositório: qualquer linha a mais reintroduz o conflito com as duas
PRs abertas. O porquê mora aqui.

### O que isso NÃO resolve

A #24 continua precisando entrar para o agente **ler** a tabela. Esta branch só
garante que a tabela **existe** num banco criado do zero — que era a pergunta.

---

## 3. Duas colisões de numeração, e por que importam

O runner (`scripts/migrate.ts`) ordena por **nome de arquivo**, não pelo número.
Hoje existem dois pares com o mesmo prefixo, em branches diferentes:

```
main                          branch não mergeada
0005_create_stock_alerts.sql  0005_create_search_log.sql   (feature/seed-search-log)
0015_fix_duplicate_images.sql 0015_wishlist.sql            (feature/wishlist)
```

Não quebra: `0015_fix_duplicate_images` < `0015_wishlist` em ordem alfabética, e
as duas rodariam. O que se perde é a garantia que o número existe para dar — **a
ordem passa a depender do nome depois do número**, que ninguém escolheu pensando
nisso. Uma terceira `0015_*` entraria no meio das duas sem aviso.

`0005_create_search_log.sql` **nunca foi aplicada** neste banco (a auditoria
achou um fantasma só). Se a branch dela for retomada, renumere antes.

---

## 4. Como foi medido

```bash
npm run db:audit
```

`scripts/db-audit.ts`, só leitura. Três blocos:

1. **`schema_migrations` × `db/migrations/`** — pega migration aplicada que sumiu
   do repositório (o caso 1, achado) e arquivo que este banco ainda não rodou.
2. **Inventário do schema vivo** — 13 tabelas, colunas, índices, extensões.
3. **Objetos órfãos** — tabela, coluna ou índice cujo nome não aparece no texto
   de migration nenhuma. Pega DDL feito à mão pelo SQL editor do Supabase, que
   não deixa rastro em lugar nenhum.

A busca do bloco 3 é **textual e conservadora**: procura o nome do objeto no
texto das migrations. Um `CREATE TABLE` montado por concatenação escaparia. Ela
serve para **acusar, não para absolver**.

### O que esta auditoria NÃO prova

Ela acha objeto **a mais** no banco. Não vê tipo trocado, `NOT NULL` que virou
nulo, default diferente nem índice ausente — porque não tem com o que comparar:
derivar o schema esperado parseando 20 arquivos de SQL seria construir meio
Postgres para responder a uma pergunta que o Postgres responde de graça.

---

## 5. A prova completa, no projeto novo

O jeito de fechar a garantia é comparar dois bancos **reais** — e o projeto novo
é o lugar certo para o replay acontecer, porque é uma etapa que vai acontecer de
qualquer forma e não escreve nada em produção.

```bash
# 1. o banco de hoje, como referência
npx tsx scripts/db-audit.ts --json > atual.json

# 2. crie o projeto, aponte o .env para ele e rode as migrations
npm run db:migrate
npx tsx scripts/db-audit.ts --json > novo.json

# 3. a prova
npx tsx scripts/db-audit.ts --comparar atual.json novo.json
```

O `--comparar` confere tabelas, colunas, **tipos, nulabilidade, defaults**,
índices e extensões. Sai 0 quando são idênticos.

Dados ficam de fora de propósito: um projeto novo nasce com o catálogo que as
migrations de seed inserem, e comparar contagem de linhas acusaria diferença em
toda tabela que a operação escreveu — pedidos, alertas, looks. O que precisa
bater é o schema.

**Esperado com esta branch: nenhuma diferença.** Se aparecer qualquer uma, é
achado novo — e o `--comparar` sai com código 1, então dá para pôr no CI.

(Sem esta branch o esperado seria `tabela só em A: wishlist_items`.)

### Que o comparador de fato morde

Testado contra a produção adulterada de seis formas, e as seis foram pegas:

```
✗ tabela só em A: personas
✗ tipo difere: looks.titulo — A=text B=integer
✗ coluna só em A: looks.confianca (real)
✗ nulabilidade difere: looks.pecas — A=NO B=YES
✗ índice só em A: CREATE UNIQUE INDEX looks_pkey ON public.looks USING btree (...)
✗ extensão só em A: vector
```

Contra si mesmo, dá idêntico. Um comparador que nunca acusa passa em todo teste
que não seja este.

---

## 6. O inventário, para referência

13 tabelas em `public`, 20 migrations registradas:

| Tabela | Colunas | Índices | Criada por |
|---|---|---|---|
| `products` | 12 | 4 | `0001` (+ `0018` a cor) |
| `variants` | 11 | 2 | `0001` |
| `product_images` | 5 | 2 | `0001` |
| `product_props` | 6 | 2 | `0001` |
| `variant_options` | 5 | 2 | `0001` |
| `stock_alerts` | 5 | 3 | `0005` |
| `shelves` | 10 | 2 | `0012` |
| `looks` | 8 | 2 | `0014` |
| `orders` | 5 | 3 | `0014` (+ `0017`) |
| `order_items` | 5 | 2 | `0017` |
| `personas` | 6 | 2 | `0019` |
| `schema_migrations` | 2 | 1 | o runner, não um arquivo |
| `wishlist_items` | 5 | 4 | `0015_wishlist.sql` — **trazida nesta branch** |

Extensões: `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`,
`uuid-ossp`, `vector`.

**Só uma delas é nossa.** `db/migrations/0009_similarity_search.sql:35` tem
`CREATE EXTENSION IF NOT EXISTS vector`, então o projeto novo a habilita
sozinho ao rodar as migrations — verificado, e é a única linha `CREATE
EXTENSION` do repositório inteiro.

As outras cinco vêm ligadas de fábrica num projeto Supabase. A comparação as
inclui mesmo assim, porque o custo é zero e o dia em que uma delas não vier é
justamente o dia em que ninguém pensaria em conferir.
