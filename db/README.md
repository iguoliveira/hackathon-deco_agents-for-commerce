# Banco de dados (SQLite via D1)

O catálogo de produtos vive em SQLite. **D1 é o SQLite gerenciado da Cloudflare** —
não é um banco parecido com SQLite, é SQLite, rodando como binding do próprio Worker.

## Você não precisa fazer nada

`npm run dev` aplica as migrations antes de subir o servidor (hook `predev`).
Clonou o repo, rodou `npm run dev`, o banco já vem populado.

## Onde o banco fica

`.wrangler/state/v3/d1/**/*.sqlite` — arquivo SQLite comum, abrível no DB Browser,
DBeaver, ou `sqlite3`. **Não é versionado** (`.wrangler/` está no `.gitignore`).
O que se versiona é o SQL aqui em `db/migrations/`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run db:migrate` | Aplica migrations pendentes. Idempotente — rodar duas vezes é no-op. |
| `npm run db:reset` | Apaga o banco local e reconstrói do zero. |
| `npm run db:query "SELECT ..."` | Roda uma query avulsa. |
| `npm run catalog:generate` | Regera a migration de catálogo a partir do Shopify. |

> No Windows, pare o dev server antes do `db:reset` — ele segura o arquivo e o
> comando falha com `EPERM`.

```sh
npm run db:query "SELECT handle, title FROM products"
```

## As migrations

| Arquivo | O que faz |
|---|---|
| `0001_create_catalog.sql` | Schema: as 5 tabelas + índices |
| `0002_seed_catalog.sql` | Produto sintético de teste (removido pela 0003) |
| `0003_seed_full_catalog.sql` | Catálogo real da loja — 58 produtos. Gerada. |
| `0004_apparel_only.sql` | Remove 27 não-vestuário, deixando **31 produtos** |

## Atualizando o catálogo

A `0003` é **gerada**, não escrita à mão. Quando o catálogo da loja Shopify mudar:

```sh
npm run catalog:generate   # cria a PRÓXIMA migration (0005, 0006, …)
npm run db:migrate         # aplica
```

O script (`scripts/generate-catalog-migration.ts`) lê as credenciais de
`.deco/blocks/deco-shopify.json` — as mesmas que o app Shopify usa em runtime —,
pagina a Storefront API e escreve os INSERTs. Aceita `--dry-run` para conferir os
números sem escrever, e `--out <arquivo>` para escolher o destino.

Ele nunca sobrescreve uma migration existente: escreve sempre na próxima numeração
livre. Isso é de propósito, ver abaixo.

### O que fica de fora

A loja de origem é de brindes (vende sticker ao lado de camiseta); a demo é de
moda. **`scripts/catalog-denylist.ts`** lista os produtos que não entram —
stickers, pelúcias, papelaria, utilidades de casa —, e o gerador filtra por ela
antes de emitir SQL. O raciocínio completo, incluindo por que é lista explícita
em vez de filtro por categoria, está documentado naquele arquivo.

Divisão de responsabilidade entre as duas peças:

- a **`0004`** conserta bancos que já importaram o catálogo completo;
- a **denylist** impede que voltem num import futuro.

Para negar um produto novo: adicione o handle no grupo certo da denylist e rode
`npm run catalog:generate`.

## Mudando o schema

Crie uma migration nova — **nunca edite uma já aplicada**. O wrangler registra o
que rodou numa tabela `d1_migrations`; reescrever um arquivo já aplicado não o
reaplica, só faz o seu banco divergir do de quem já rodou. Para alterar uma tabela
existente, a migration nova leva o `ALTER TABLE`.

## Idempotência

As migrations de seed apagam **só o que elas governam** antes de inserir, em vez
de limpar as tabelas inteiras:

- a `0002` apaga pelo id do produto de demo;
- a `0003` apaga `WHERE product_group_id LIKE 'gid://shopify/%'`.

Efeito prático: um produto que você cadastre à mão com id de outro formato
**sobrevive** a um `npm run db:reset`.

## Como o dado vira produto na tela

O schema é relacional, mas o front consome `Product` (schema.org aninhado) de
`@decocms/apps-commerce/types`. Quem faz a ponte é `src/platform/catalog/`:

```
tabelas -> catalog.d1.ts -> catalog.mapper.ts -> Product -> loader -> bloco CMS -> ProductShelf
```

O mapper espelha campo a campo o `toProduct` do app Shopify
(`node_modules/@decocms/apps-shopify/src/utils/transform.ts:162-337`). É isso que
permite trocar a fonte sem tocar em nenhuma section — e é o que precisa ser
atualizado se aquele transform mudar.

## Escopo atual

Só a **vitrine da home** lê do SQLite (`.deco/blocks/Product%20List%20Loader.json`).
PDP, PLP e busca continuam no Shopify.
