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

**Não existe banco remoto.** O `database_id` no `wrangler.jsonc` é um
placeholder deliberado: funciona em `vite dev`, falha de propósito em
`wrangler deploy`. Os dados existem só na máquina de quem rodou, e
`db:reset` / `dev:clean` / `clean` apagam tudo.

**Deslogado, ninguém é reconhecido de volta.** A identidade é o e-mail digitado,
que só existe no instante do envio. Um visitante anônimo que volta amanhã não
tem vitrine, e `useHasStockAlert` responde `false` para ele — não porque não
pediu, mas porque não há como saber. A solução seria um `visitor_id` em cookie
(o repo já usa esse padrão em `src/loaders/_cookie.ts` para wishlist e
newsletter) com fusão no login. Adiado de propósito.

**O endpoint é público e sem limite de taxa.** Dá para inundar a tabela com
pares e-mail/variante. A variante é validada contra o catálogo, então lixo puro
não entra, mas nada impede volume.

## O que limita a qualidade do agente

Levantado sobre o catálogo atual (31 produtos):

| | |
|---|---|
| Sem `product_type` | 28 de 31 (90%) |
| Com tags | 3 de 31 (10%) |
| Com coleção | 24 de 31 (77%) |
| Com descrição | 31 de 31 (100%) |

Os dois eixos óbvios de similaridade (tipo e tags) praticamente não existem. O
agente vai depender de **coleção** — que é grossa, já que uma coleção pode ser
quase o catálogo inteiro — e de **descrição**, que é texto livre e exige o
modelo ler prosa.

Some-se a isso que só entra na tabela quem clicou num produto esgotado, o que é
uma fração pequena dos visitantes. Um agente excelente sobre entrada pobre
produz vitrine que parece aleatória, e a conclusão fácil (errada) é culpar o
modelo. Se a qualidade decepcionar, **suspeite da entrada antes do agente**.
