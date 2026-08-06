# hackathon-deco-agents-for-commerce

Storefront demo migrado para **Vercel (Node)** + **Supabase (Postgres)**.

---

## Rodando localmente

### 0. Crie ou use um projeto Supabase existente com uma aplicação

### 1. Configure o `.env`

Crie `.env` na raiz com a **connection string do Transaction Pooler** (porta 6543):

```bash
DATABASE_URL=postgresql://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:6543/postgres
```

> Pegue em: **Supabase → Connect → Connection string → Transaction pooler**  
> (Não use a "Direct connection" porta 5432)

### 2. Instale dependências (obrigatório **bun**)

```bash
bun install
```

> ⚠️ Se usar `npm install`, rode `bun install` depois — o patch de imagens (`quality=original`) só é aplicado pelo bun.

### 3. Rode as migrations

```bash
npm run db:migrate
```

### 4. Desenvolvimento

```bash
npm run dev
```

### 5. Build + Preview de produção (recomendado antes de deploy)

```bash
npm run build && npm run preview
# http://localhost:5173
```

---

## Comandos úteis

| Comando | Descrição |
|---------|-----------|
| `npm run db:list` | Lista migrations aplicadas/pendentes |
| `npm run db:alerts` | Mostra `stock_alerts` cruzados com catálogo |
| `npm run db:query -- "SELECT ..."` | SQL avulso |
| `npm run db:reset -- --confirm` | **Apaga tudo** (inclui histórico de alertas) |
| `npm run typecheck` | TypeScript check |
| `npm run format` | Prettier write |

---

## Notas

- **Sections são lazy**: PDP/PLP/busca renderizam via `Rendering/Lazy.tsx` — HTML do SSR é esqueleto. Valide no navegador, não no `curl`.
- `0006_out_of_stock_sizes.sql` marca 2 variantes como esgotadas para testar "avise-me". **Reverta antes de produção real**.
- A tela "avise-me" promete e-mail que **não é enviado** (feature de hackathon).
