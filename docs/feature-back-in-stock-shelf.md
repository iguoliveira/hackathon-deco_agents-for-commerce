# Feature: sinal de desejo → vitrine personalizada

## O que é

Quando alguém escolhe um tamanho esgotado e clica em **"avise-me quando voltar"**,
o par (comprador, variante) é gravado. Essa linha não existe para disparar
e-mail: ela é a **entrada de um agente** que monta uma vitrine com produtos
**disponíveis** parecidos com o que a pessoa quis e não pôde levar.

Ou seja, o botão herdado de "back in stock" foi reaproveitado como captura de
intenção. O valor não está em avisar quando o item volta — está em não perder a
informação de que alguém queria aquilo.

## Por que assim

Um cliente que tentou comprar e falhou é o sinal de intenção mais forte que uma
loja recebe: mais específico que um clique, mais barato que um carrinho
abandonado, e explicitamente declarado pelo próprio usuário. Hoje esse sinal é
descartado — a pessoa vê "você está na lista" e a loja não faz nada com isso até
(e se) o estoque voltar.

A aposta da feature é inverter isso: em vez de esperar o item voltar, usar o que
ele revela sobre o gosto da pessoa para mostrar o que **já existe** em estoque.

## Estado atual (o que está pronto)

- [x] O clique persiste em SQLite (`stock_alerts`)
- [x] Identidade vem da sessão quando o comprador está logado
- [x] Tamanhos esgotados aparecem riscados no seletor da PDP
- [x] Quem já pediu vê que pediu ao voltar (logado)
- [x] `findWaitedItems` devolve o desejo já cruzado com o catálogo
- [ ] **O agente que monta a vitrine** — próximo passo, ainda não existe
- [ ] Envio de e-mail — não existe e não está planejado (ver *Armadilhas*)

## Como funciona

```
PDP de variante esgotada
  └─ OutOfStock.tsx  ──POST /deco/invoke/site/actions/notifyMe/subscribe──┐
                                                                          │
  src/actions/notifyMe/subscribe.ts                                       │
    ├─ identidade: sessão (logado) OU e-mail do formulário (deslogado)  ◄──┘
    └─ createStockAlert() ──► tabela stock_alerts
                                    │
                                    ▼
                          findWaitedItems(email)
                            (JOIN com o catálogo)
                                    │
                                    ▼
                      [AGENTE DA VITRINE — a construir]
```

### Arquivos

| Caminho | Papel |
|---|---|
| `db/migrations/0005_create_stock_alerts.sql` | A tabela |
| `db/migrations/0006_out_of_stock_sizes.sql` | Dado de teste (ver *Armadilhas*) |
| `db/queries/waited-items.sql` + `npm run db:alerts` | Inspeção manual |
| `src/platform/alerts/` | Escrita, leitura e identidade |
| `src/actions/notifyMe/subscribe.ts` | Endpoint público do clique |
| `src/components/product/OutOfStock.tsx` | O formulário / confirmação |
| `SizePill.tsx`, `pdp/ProductVariantSelector.tsx` | Tamanho esgotado riscado |

## Decisões que não são óbvias no código

**Só o `variant_id` é guardado.** Ele já identifica item + tamanho + cor.
Tamanho, tipo, coleções e tags saem por JOIN na leitura. Copiar esses campos
para dentro de `stock_alerts` criaria uma segunda verdade que envelhece sozinha
na próxima vez que o catálogo mudar.

**Sem FOREIGN KEY para `variants`.** As migrations de seed apagam e reinserem o
catálogo; um `ON DELETE CASCADE` destruiria o histórico de demanda a cada
`db:reset`. Quem decide o que ainda faz sentido mostrar é a leitura — o INNER
JOIN de `findWaitedItems` descarta desejos cuja variante saiu do catálogo,
porque para esses não há substituto a oferecer.

**A sessão vence o e-mail do corpo.** O endpoint é público. Confiar no e-mail
enviado pelo cliente deixaria qualquer um cadastrar alertas no endereço de
outra pessoa — e a vitrine construída a partir dessas linhas é pessoal.

**Tamanho esgotado continua clicável.** Clicar nele é como se chega ao
formulário; desabilitar o link removeria a única porta de entrada da feature.

## Armadilhas para quem chegar depois

**A tela promete um e-mail que ninguém envia.** Depois de enviar, aparece
*"We'll email you when this product is back in stock"* — mas **não existe
provedor de e-mail configurado** e nada é disparado. Isso foi apontado e mantido
conscientemente para o hackathon. Se esta feature for para produção, ou o envio
passa a existir, ou o texto precisa mudar.

**`0006_out_of_stock_sizes.sql` é dado de teste com efeito real.** Ele marca
*Eco Raglan Hoodie M* e *Retro Code Tee L* como esgotados, porque no catálogo
importado nenhuma variante **com tamanho** estava fora de estoque — sem isso o
par (item, tamanho) não podia ser exercitado. Migration roda em qualquer
ambiente onde o banco for aplicado, então **precisa ser revertida antes de o
catálogo ser real**, ou dois produtos ficam artificialmente esgotados.

**O banco agora é remoto e compartilhado.** Isto mudou: o D1 local deu lugar ao
Postgres do Supabase (ver `docs/deploy-vercel-supabase.md`). A consequência para
esta feature é que `stock_alerts` deixou de ser um arquivo na máquina de quem
rodou e passou a ser dado que todo mundo enxerga — e que `npm run db:reset`
apaga de verdade, para todos. Por isso o reset passou a exigir `--confirm`.

**Deslogado, ninguém é reconhecido de volta.** A identidade é o e-mail digitado,
que só existe no instante do envio. Um visitante anônimo que volta amanhã não
tem vitrine, e `useHasStockAlert` responde `false` para ele — não porque não
pediu, mas porque não há como saber. A solução seria um `visitor_id` em cookie
(o repo já usa esse padrão em `src/loaders/_cookie.ts` para wishlist e
newsletter) com fusão no login. Adiado de propósito.

**O endpoint é público e sem limite de taxa.** Dá para inundar a tabela com
pares e-mail/variante. A variante é validada contra o catálogo, então lixo puro
não entra, mas nada impede volume.

## A entrada do agente (resolvido nas migrations 0007–0009)

Este diagnóstico já foi endereçado. O estado antes e depois:

| | antes | depois |
|---|---|---|
| Produtos | 31 | **41** |
| Com `product_type` | 3 (10%) | **41 (100%)** |
| Com tags | 3 (10%) | **41 (100%)** |
| Com coleção | 24 (77%) | **41 (100%)** |
| Com descrição | 31 (100%) | 41 (100%) |

O problema nunca foi falta de informação — as descrições têm média de 866
caracteres e já diziam público, material, estilo e motivo. Estava tudo em
prosa, e os campos estruturados, vazios.

- **0007** devolveu 10 itens de lifestyle que a 0004 tinha removido. O catálogo
  de vestuário era raso demais para "combina com" (`bottoms` tem 1 produto,
  `jackets` tem 2); recomendação cruzada é a única com variedade suficiente
  para não parecer aleatória.
- **0008** promoveu a campo o que a descrição já dizia, e corrigiu coleções —
  4 produtos estavam em `stickers` (item que saiu do menu) e calçados e
  infantil não tinham coleção nenhuma.
- **0009** preparou similaridade: índice full-text e a extensão `pgvector` com
  a coluna de embedding, ainda vazia.

`findSimilarAvailable` (em `catalog.d1.ts`) é a consulta que alimenta o agente.
Ela devolve **os componentes da nota, não só a nota** — `sameType`,
`sameCollection`, `sharedTags` — porque o agente precisa saber se cada
candidato é *alternativa* (mesmo tipo) ou *complemento* (tipo diferente, tags
em comum) para montar a vitrine e justificá-la em texto. Só entram produtos com
variante disponível.

Para quem esperou o Eco Raglan Hoodie M, ela devolve hoje:

```
14  mesma coleção  basic,cotton,layering,winter   Hoodie
14  mesma coleção  basic,cotton,layering,winter   Women's Sweatshirt
12  —              unisex,basic,cotton,winter     Winter Hat
11  mesma coleção  unisex,cotton,winter           The Future of Web Dev Sweatshirt
 9  —              unisex,layering,winter         All-Over Print Bomber Jacket
```

Alternativas no topo, complemento cruzado logo abaixo — e cada linha
explicável sem recorrer a embedding.

## O que ainda limita

**Embeddings não estão populados.** A coluna existe (`products.embedding`,
1536 dimensões), a extensão está habilitada, mas preencher exige um provedor
externo — a Anthropic não serve embeddings; OpenAI, Voyage ou o `gte-small` do
próprio Supabase servem. Com estrutura em 41/41, a ordenação por SQL já cobre
a maior parte; vale medir a vitrine antes de decidir que precisa de vetor.

**Só entra na tabela quem clicou num produto esgotado**, que é uma fração
pequena dos visitantes. Um agente excelente sobre entrada pobre produz vitrine
que parece aleatória, e a conclusão fácil (errada) é culpar o modelo. Se a
qualidade decepcionar, **suspeite da entrada antes do agente**.
