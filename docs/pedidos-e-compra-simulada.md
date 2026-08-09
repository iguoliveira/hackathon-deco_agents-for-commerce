# Pedidos e compra simulada

> **Em vigor.** Descreve o que foi construído na branch `feature/orders`.
> Complementa [`agente-de-combinacoes.md`](agente-de-combinacoes.md), que segue
> sendo o documento da feature — este cobre a quarta semente (`comprou`), que
> aquele listava como *falta*.

A pessoa adiciona qualquer produto disponível ao carrinho, finaliza, e a compra
vira histórico no banco. **Não há pagamento**, e isso vai dito no slide — fingir
pipeline de compra é o tipo de coisa que um jurado de e-commerce reconhece na
hora, e a honestidade sobre métrica já é regra do time
([`tese-admin-agentes.md`](tese-admin-agentes.md) §11).

O ponto não é o checkout. É que **a compra é o sinal mais forte que a loja tem**,
e até aqui o agente não tinha nenhum: `orders` existia desde a `0014` e estava
vazia.

---

## 1. O que já existia e por que não funcionava

A interface inteira estava pronta: `ProductActions.tsx` tem o botão,
`Minicart.tsx` e `Bag.tsx` estão no header, tudo ligado por `useAddToCart`.

O que faltava era o encanamento. `cart.actions.ts` falava com **Shopify**
(`addItems`, `getCart` de `@decocms/apps-shopify`) enquanto o catálogo migrou
para o Postgres local. Um `gid://catalog/Variant/909100` não existe do lado de
lá — o botão não tinha o que chamar.

A troca não encostou na interface, e isso não foi sorte: `CartState` e `CartItem`
já eram **neutros**, sem um tipo do Shopify sequer, e `cart.hooks.ts`,
`Minicart`, `Bag` e `ProductActions` só conhecem esses dois. Todo o acoplamento
estava confinado em `cart.actions.ts` e `cart.shopify.ts` — **93 linhas**, das
quais o segundo arquivo saiu inteiro.

---

## 2. O carrinho mora num cookie

`[[variantId, quantidade], ...]` em `deco_cart`, `HttpOnly`, 7 dias. Sem tabela,
por três motivos:

1. **Carrinho é efêmero.** Uma tabela exigiria dono, e dono exigiria login — o
   que impediria montar o carrinho antes de entrar, que é o percurso normal.
2. **Só o pedido é histórico.** É ele que precisa sobreviver.
3. É o padrão que o repositório já usa para `deco_wishlist` e `deco_recent`.

**Guarda id e quantidade, nada mais.** Preço, título e foto são resolvidos a cada
leitura por `findCartLines`. Um snapshot no cookie ficaria mostrando o catálogo
de ontem — e não é hipótese: 47 fotos e 9 cores mudaram numa tarde
(`0015`/`0016`).

`findCartLines` **não filtra por disponibilidade**, deliberadamente. Um item que
esgotou depois de entrar no carrinho precisa APARECER, marcado, para a pessoa
entender por que não consegue finalizar. Sumir em silêncio é o comportamento que
faz alguém achar que o site comeu o pedido.

---

## 3. A modelagem do pedido

A `orders` da `0014` nasceu como tabela de **semente**, não de pedido: uma linha
por variante comprada, sem preço, sem quantidade, sem status. Servia para o
agente saber o que a pessoa tem; não serve para mostrar um pedido na tela.

```sql
orders       (id, email, status, total, created_at)
order_items  (order_id, variant_id, quantity, unit_price, title_snapshot)
```

### A regra que divide o que fica gravado e o que sai por JOIN

> O que foi **TRANSACIONADO** vira snapshot. O que **DESCREVE** o produto vira
> referência.

Não é preferência de modelagem, é consequência observada. Se o pedido tivesse
copiado `cor: 'Tan'` no momento da compra, o agente hoje escreveria *"combina com
a bolsa tan que você comprou"* enquanto o site mostra uma bolsa preta — a cor
mudou na `0015`. O comentário da `0014` já avisava que copiar atributo descritivo
*"criaria uma segunda verdade que envelhece no próximo seed"*.

O inverso quebra igual: sem `unit_price` congelado, o recibo não sabe quanto a
pessoa pagou. Um pedido que não sabe o valor pago não é um pedido.

| Dado | Onde | Por quê |
|---|---|---|
| preço pago, quantidade, título | **no pedido** | fato de um evento; não pode mudar depois |
| tipo, tags, coleção, imagem, disponibilidade | **por JOIN** | o agente precisa da verdade de agora |

Por isso `comprasDe` parte de `order_items.variant_id` e faz JOIN com o catálogo
vivo, enquanto `/meus-pedidos` lê só as duas tabelas e nunca toca em `products`.

O **handle não muda** com a cor (`leather-belt-bag`, não
`leather-belt-bag-tan`), então renomear a cor de um produto não quebra URL nem os
handles guardados em `shelves` e `looks`.

---

## 4. Identidade: onde a trava fica

**Carrinho aberto a todos. Finalizar exige sessão.**

Travar o "adicionar" não protegeria nada — o cookie não carrega identidade e nada
é persistido — e faria a pessoa perder o carrinho ao entrar.

A identidade do pedido vem de **`readShopperIdentity`** (a sessão verificada pelo
Shopify), **nunca de `donoDaVitrine()`**, mesmo sendo esta mais conveniente.
`shelf.identity.ts` já delimitava:

> *"A sessão é verificada pelo Shopify; o cookie é só assinado por nós, o que
> prova que **nós** o emitimos — não que quem o apresenta é a pessoa. Para uma
> vitrine de recomendação isso basta; para qualquer coisa com dado de pedido ou
> pagamento, não bastaria."*

A diferença de consequência decide: forjar identidade numa vitrine mostra a você
as sugestões de outra pessoa; forjar num pedido **grava uma compra no nome de
outra pessoa**.

`checkoutServerFn` **não recebe nada do cliente**: itens do cookie, preços do
banco no mesmo instante, e-mail da sessão. Aceitar preço do navegador deixaria
qualquer pessoa comprar por R$1.

---

## 5. A compra chegando ao agente

Ligar `comprasDe` a `order_items` fez a compra alimentar o agente. Mas ela
chegava ao modelo assim:

```json
{ "titulo": "Wide Leg Trousers - Black", "tipo": "Trousers", "sinal": "comprou" }
```

Três campos. Cada **candidato**, em comparação, já recebia `tagsEmComum`,
`mesmaColecao`, `opcoesDisponiveis`, `preco` e `descricao`.

**A assimetria era o problema: o guarda-roupa era rótulo, não dado.** Quando o
modelo escreveu *"combina com o tênis branco que você comprou"*, ele leu "White"
da string do título — era a única inferência que o dado permitia.

`Semente` passou a carregar `tags`, e dois sinais são calculados **em código**:

| campo | o que responde |
|---|---|
| `combinaComOGuardaRoupa` | tags que o candidato divide com o que a pessoa **tem** |
| `jaTemDesteTipo` | peças do mesmo tipo que ela já possui |

Em código, e não deixado para o modelo cruzar de cabeça, pela mesma razão que
`tagsEmComum` já era: o prompt manda usar os sinais prontos em vez de
recalculá-los, e cruzar 18 candidatos contra N peças possuídas é exatamente o
tipo de trabalho em que um modelo erra em silêncio.

### O que foi medido

Compra gravada de verdade — *Wide Leg Trousers - Black* e *Canvas Low Sneakers -
White* —, âncora *Essential Cotton Tee - White*, Porto Alegre em agosto:

- **5 dos 18 candidatos** ativaram `combinaComOGuardaRoupa`
- **1** ativou `jaTemDesteTipo` (Canvas High Tops, "já tem: Canvas Low Sneakers")
- as peças compradas **saem do pool** — conferido nas duas pontas
- sem a compra a lista abria com *Slim Stretch Jeans*; com ela, o topo virou
  camada externa e o título mudou de *"O que veste com a camiseta branca"* para
  *"Complete o look para o frio em POA"*

A linha de base sem compra não é cerimônia: sem ela não dá para atribuir a
diferença à compra em vez de à variação do modelo entre execuções.

### Redundância de camadas externas

O agente vinha devolvendo hoodie + jaqueta jeans + bomber em cinco vagas, com o
terceiro admitindo no próprio texto ser *"alternativa"* — e alternativa é
substituição, não composição. O prompt ganhou a regra **NÃO EMPILHE PEÇAS
INTERCAMBIÁVEIS**, e o resultado passou a ter cinco funções distintas, com a
camada intermediária se justificando em relação à externa (*"leve para usar sob a
jaqueta"*).

**Quem resolveu foi a regra de texto, não o cálculo** — e isso é uma fraqueza,
não um detalhe. `jaTemDesteTipo` compara `product_type`, e o pool tem **15 tipos
para ~6 funções**: `Bomber Jacket`, `Leather Jacket`, `Denim Jacket` e `Blazer`
são quatro tipos e uma função. Foi por isso que ele não disparou quando o agente
ofereceu uma segunda calça a quem comprou calça (`Trousers` ≠ `Jeans`).

O sinal estrutural só fica confiável com uma noção de **função** acima de
`product_type`. Isso não cabe como literal em `src/platform/look/` — é a regra 4
de `agente-de-combinacoes.md` §7. O caminho seria derivar de tag.

---

## 6. Três defeitos pré-existentes que apareceram no caminho

Nenhum tem relação com pedidos. Os três estavam quebrando o site.

### 6.1 O header derrubava toda página para quem estava logado

```
Hydration failed because the server rendered text didn't match the client
  <SignIn variant="desktop">
    - href="/account" ... - Account     (servidor)
    + href="/login"   ... + Login       (cliente)
```

`useUser()` responde **diferente nos dois lados**: no servidor a sessão resolve,
no cliente a query começa em `placeholderData: null`. Quem ramifica markup nisso
produz HTML divergente, e o React não conserta — descarta a árvore inteira.

Como `SignIn` vive no header, **toda página abria em branco**: categoria, PDP,
home. E só para quem estava **logado** — deslogado os dois lados concordam em
`/login`, que é por que ninguém tinha visto antes de alguém entrar para testar o
checkout.

O conserto é um hook, `useUserAfterHydration`, e não um `if` em cada lugar:
servidor e primeira renderização do cliente sempre veem `null`, o estado real
entra depois da montagem. Custa um quadro com o rótulo de deslogado.

> **Regra que fica:** use `useUser()` para lógica; use `useUserAfterHydration()`
> para qualquer coisa que vire markup. `WishlistButton` usa `isAuthenticated`
> dentro do `onClick` — isso é seguro.

### 6.2 A home levava 6,5 segundos

`6469ms` em dev e `6466ms` no build de produção, com TTFB igual ao total — o
servidor segurava a resposta inteira antes de mandar um byte.

Medido contra o Supabase real:

| | |
|---|---|
| `SELECT 1` (aquecido) | 130ms ← a latência de rede |
| `findCatalogRecords({count:12})` | **1589ms** |
| `findCatalogRecordByHandle` | **1582ms** |

Um `COUNT` custa 130ms e um loader custa 1,5s: **o problema não é o banco ser
lento, é a quantidade de idas e voltas em série.** `db.batch()`
(`db.postgres.ts:196`) roda os statements sequencialmente **dentro de uma
transação** — `BEGIN` + 3 consultas + `COMMIT` são cinco viagens.

E a home era a única página que esperava por isso: das 11 sections, só as duas
`PersonalShelf` eram diferidas. `Hero` resolvia **três** `catalogProductByHandle`
e `ProductShelf` mais um. Na PDP e na PLP tudo é diferido, e por isso elas já
respondiam em 11–29ms.

Diferidas as duas: **6469ms → 25ms**.

Troca consciente: o herói é o LCP e agora chega depois. Contra 6,5s de tela
branca, não é discutível.

### 6.3 `SearchResult` era a única section eager sem `sync`

O decofile envolve toda section em `Rendering/Lazy.tsx`, então mesmo uma section
`eager` passa pelo caminho diferido. `Header`, `Footer` e `Theme` sobrevivem
porque declaram `sync = true` **e** exportam `LoadingFallback`. `SearchResult` não
tinha nenhum dos dois.

> **Correção de registro:** o commit `3e47264` atribui a tela branca da PLP a
> este item. **O diagnóstico está errado** — a causa era a §6.1. A mudança
> continua defensável (o framework avisa a cada renderização, e as outras três
> eager sempre tiveram os dois), mas a causalidade afirmada ali não se sustenta.

---

## 7. O que foi verificado, e o que não foi

| | |
|---|---|
| `npm run typecheck` | limpo |
| `npm run build` | passa — nenhum vazamento de servidor no bundle |
| `criarPedido` | transação, total conferido (89+89=178), `CASCADE` limpando itens |
| `comprasDe` enxerga a compra | sim, deduplicada por produto |
| Sinal novo chega com dado | sim — 5 candidatos, conferido imprimindo o prompt |
| Home / PLP / PDP / `/meus-pedidos` | respondem |

**Não verificado por mim: a hidratação no navegador.** A extensão do Chrome não
alcança `localhost`, e quem confirmou foi o autor recarregando. Foi também o
console dele que entregou o `#418` — eu tinha passado tempo demais supondo, e
inclusive filtrei `[CMS-DEBUG]` do log logo no começo, que é onde loaders
reportam falha.

**Nem toda medição de produção foi no lugar certo:** cheguei a testar
`hackathon-deco-agents-for-commerce**s**` (o deploy do fork) e concluir que a
produção estava quebrada.

---

## 8. O que fica de fora

- **`db.batch()` em série dentro de transação.** Tirar a transação das leituras
  beneficiaria o site inteiro, inclusive as PLPs. Mexe em infra compartilhada.
- **`jaTemDesteTipo` por `product_type`** — não enxerga função (§5).
- **Cancelar pedido.** A coluna `status` existe e `comprasDe` já ignora
  `cancelled`; não há botão.
- **Quantidade > 1 no botão da PDP.** O stepper da sacola faz.
- **Carrinho é por navegador, não por usuário.** Duas pessoas no mesmo navegador
  compartilham o carrinho; o pedido, não.
- **Sementes `waited` sem tags.** `WaitedItem` não as carrega e buscá-las custaria
  uma consulta a mais na PDP. Elas ainda chegam com título e tipo.

---

## 9. Migrations

| | |
|---|---|
| `0017_orders_with_items.sql` | `orders` ganha `status`/`total`, perde `variant_id`; nasce `order_items` |

Seguro remover a coluna porque a tabela estava vazia (0 linhas, verificado antes
de escrever). Se não estivesse, o passo teria de copiar para `order_items` antes.
