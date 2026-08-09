# As migrations descrevem o banco que temos?

> **Faltava uma migration, e ela está aqui. O replay foi feito.** Medido em
> 2026-08-09 contra o Supabase de produção, com `main` em `ca3d8f3`.
>
> **Resposta: sim, agora estão.** O replay das 21 migrations num schema limpo
> produz exatamente o banco de hoje — 135 produtos, 83 colunas, 30 índices,
> zero diferença.
>
> Duas correções foram precisas para chegar aí: a `0015_wishlist` que faltava
> (§2) e a `0020_remove_snap_case`, que escreve uma decisão que só existia como
> um `DELETE` feito à mão em produção (§4b).
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

## 2b. Os dados do agente: por que NÃO viraram uma migration

As migrations recriam o **catálogo**. Não recriam o que o agente produziu — e é
justamente o que a demo mostra:

| | Linhas | Recriável por migration? |
|---|---|---|
| Catálogo | 135 produtos, 700 variantes, … | **sim** |
| `looks` | 49 do agente | não |
| `shelves` | 4 | não |
| `orders` / `stock_alerts` / `wishlist_items` | 22 / 10 / 6 | não |

Num banco novo a section "Complete o look" não apareceria **em lugar nenhum** —
e com o provedor sem token, não haveria como regerar.

### A migration de INSERT quebra, e quebra em silêncio

Foi a primeira ideia. Ela falha por um detalhe: **a chave do cache embute o
mês**. `hashDoContexto` monta `[…sementes, cidade, regiao, pais, mes]` e roda
FNV-1a (`look.actions.ts:74`).

```
São Paulo, agosto    -> 1voeehx     ← a chave dos 29 looks da home hoje
São Paulo, setembro  -> 10yg6mx
```

Um `INSERT` de SQL gravaria `1voeehx`. Em setembro a PDP procuraria `10yg6mx` e
não acharia: o banco "tem" a demo e a tela mostra nada. Pior classe de bug —
silenciosa, com aparência de dado presente.

Reproduzir o hash em SQL exigiria FNV-1a em PL/pgSQL **e** os nomes dos meses em
português: duas cópias de lógica que já existe, que é exatamente o que
`look.hash.ts` foi criado para evitar.

### O que foi feito: snapshot que guarda o CONTEXTO, não a chave

```bash
npm run db:snapshot   # banco → db/seeds/snapshot.json  (commitado)
npm run db:restore    # snapshot.json → banco, recalculando o hash para HOJE
npm run db:setup      # migrate + restore — a máquina nova, em um comando
```

O snapshot guarda `{ ancora, cidade, regiao, pais, titulo, confianca, pecas }`.
O `--restore` resolve a âncora **pelo handle** (o `product_group_id` pode mudar
entre bancos; o handle é o contrato) e recalcula o hash com o mês corrente.
Sobrevive à virada do mês, que é o que a migration não faz.

**35 dos 49 looks entram.** Os outros 14 são de contexto com sementes — o
histórico de navegação de alguém —, e o hash deles depende de um conjunto de
sementes que nenhum visitante novo vai reproduzir. Restaurá-los seria escrever
chave que nunca é lida. Os 35 que entram são exatamente a rota da demo:

```
29  São Paulo/BR        4  Porto Alegre/BR
 1  Recife/BR           1  Lisboa/PT
```

Marcador de falha (`origem = 'falha'`) fica de fora por definição: é quarentena,
não conteúdo.

### O repositório é público — e o snapshot carregava e-mail pessoal

`snapshot.json` é commitado, e as quatro tabelas por pessoa (`shelves`,
`stock_alerts`, `orders`, `wishlist_items`) guardam o e-mail de quem usou o
site. Dois deles eram Gmail de gente de verdade. Commitar isso publica endereço
pessoal num lugar que o GitHub indexa, e `git rm` não desfaz: fica no histórico.

O snapshot **pseudonimiza na escrita**, derivando o apelido do próprio e-mail —
a mesma pessoa continua sendo a mesma pessoa entre as quatro tabelas, e uma
vitrine continua ligada ao alerta que a gerou. `@demo.local` passa direto, que é
o que `look:armarios` semeia. O `name` de `stock_alerts` também sai.

Conferido no arquivo inteiro por regex: **nenhum e-mail fora de `@demo.local`**.

Não custa nada à demo: os 35 looks são de contexto sem sementes, então não
dependem de identidade. O que é por e-mail só aparece para quem logar com aquele
e-mail.

### O restore é para banco NOVO, e há um guarda

Consequência direta do mascaramento: num banco que já tem os e-mails originais,
os pseudônimos não colidem — as linhas por pessoa entrariam **ao lado** das
reais, dobrando vitrines e pedidos em vez de sobrescrevê-los.

E o que esconderia o estrago é que só os `looks` sobreviveriam intactos (chave é
âncora + hash, sem identidade): a demo continuaria certa enquanto a tela de
pedidos duplicava.

Então `db:restore` **recusa** rodar se já houver look ou vitrine, e pede
`--force`. Conferido contra produção:

```
Este banco já tem dados: 84 look(s), 4 vitrine(s).
O restore foi feito para um banco NOVO. […]
Se é isso mesmo que você quer, repita com --force.
```

### Verificado

- **Idempotente.** Dois `db:restore` seguidos contra produção (antes de o
  mascaramento entrar, quando os e-mails ainda batiam), contagens inalteradas nas
  seis tabelas: `looks=84 shelves=4 stock_alerts=10 orders=22 order_items=22
  wishlist_items=6` antes e depois de cada um.
- **A resolução da âncora funciona**: 35 handles resolvidos, 0 sem produto.
- **A identificação do contexto confere**: `fnv1a("São Paulo|SP|BR|agosto")`
  devolve `1voeehx`, que é a chave dos 29 looks da home no banco de hoje.
- **Referência morta é pulada, nunca inserida quebrada.** Alerta, pedido e
  favorito apontam para `variant_id`; se o catálogo do destino não tiver aquela
  variante, a linha é pulada e contada. Um pedido apontando para variante
  inexistente sumiria no `INNER JOIN` de `comprasDe` e viraria sinal fantasma.
- Pedido que perdeu todos os itens não entra: pedido vazio aparece na tela de
  pedidos como uma compra que não comprou nada.

**O que ainda não foi exercitado:** o restore contra um banco de fato vazio. O
caminho de INSERT está provado (as duas rodadas acima) e a resolução de âncora
também, mas a corrida completa só acontece quando o projeto novo existir. Se
algo falhar lá, vai falhar alto — toda referência morta é contada, não engolida.

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

## 4b. O replay: a prova, e ela foi feita

```bash
npx tsx scripts/db-audit.ts --replay
```

Roda as 20 migrations num schema temporário (`_replay_audit`) **no mesmo banco**
e compara com o `public`. Cria no começo, destrói no fim, inclusive se falhar no
meio. O `public` não é tocado.

Três coisas foram conferidas antes de considerar isto seguro em produção:

1. **Nenhuma migration qualifica schema** — nada de `public.products`, então o
   `search_path` manda tudo para o schema temporário.
2. **Nada de `random()`, `gen_random_uuid()` ou `uuid_generate`** — o resultado é
   determinístico, então divergência é defeito, não sorte.
3. **Índices e constraints moram no schema da tabela** — os nomes não colidem.

### O veredito

**As 21 migrations executam, na ordem, sem erro.** ~530ms cada.

**O schema é idêntico**: mesmas tabelas, colunas, tipos, nulabilidade, defaults e
índices. Zero diferença.

**Os dados divergem em um produto:**

```
✗ products         replay= 136  produção= 135
    falta em produção: snap-case-for-iphone®  (Snap Case for iPhone®)
✗ variants         replay= 701  produção= 700
✗ product_images   replay= 231  produção= 228
✗ product_props    replay= 833  produção= 829
✗ variant_options  replay= 893  produção= 892
```

As quatro últimas são consequência da primeira — são as linhas daquele produto.

### A capa de celular: a produção contradizia a migration

Não foi descuido das migrations. A cadeia decide por ela três vezes:

| | |
|---|---|
| `0004_apparel_only` | *"capinha de iPhone **SAI**"* — apaga |
| `0007_restore_lifestyle_products` | traz **de volta** |
| `0008_enrich_catalog_attributes` | enriquece (`product_type = 'Phone Case'`) |
| `0010_remove_non_apparel` | *"O que fica de não-vestuário: bolsas, chapéus e **a capa de celular**"* — mantém |

Líquido: **as migrations querem a capa no catálogo.** Produção não tem. Alguém a
apagou à mão depois da `0010`, contra o que está escrito ali — e sem deixar
rastro em migration, commit ou doc.

**Um projeto novo ressuscitaria a capa.** Era a única divergência de dado, e uma
decisão de produto, não um defeito técnico.

**Decidido: produção está certa.** A `0020_remove_snap_case.sql` escreve isso
onde deveria ter sido escrito. Ela é **no-op em produção** (as linhas já não
existem, os `DELETE` não casam nada — conferido: 135 produtos antes e depois de
aplicá-la) e remove a capa num banco novo. Não muda o banco de hoje; faz o de
amanhã nascer igual a ele.

O comentário da `0010` fica superado neste ponto e **não foi editado**: migration
aplicada não deve mudar de texto. A versão vigente mora no cabeçalho da `0020`.

Conferido antes de escrever: `stock_alerts`, `order_items`, `wishlist_items`,
`looks.pecas`, `shelves.items` e o `snapshot.json` — **nenhum** referencia a
capa. Não há órfã a criar.

### Depois das duas correções

```
✓ products         replay= 135  produção= 135
✓ variants         replay= 700  produção= 700
✓ product_images   replay= 228  produção= 228
✓ product_props    replay= 829  produção= 829
✓ variant_options  replay= 892  produção= 892

✓ 83 colunas e 30 índices, idênticos

Um banco novo nasce igual a este.
```

E o `db:audit`: 21 arquivos × 21 registradas, listas idênticas, nenhum objeto
órfão.

### O falso positivo que o replay tem, e como ele é tratado

O default de coluna serial carrega o nome do schema:

```
produção  nextval('wishlist_items_id_seq'::regclass)
replay    nextval('_replay_audit.wishlist_items_id_seq'::regclass)
```

É artefato da técnica, não do banco — some junto com o schema temporário. A
comparação remove o prefixo antes de comparar. Sem isso, toda tabela com
`BIGSERIAL` apareceria como diferente.

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
