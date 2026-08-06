# Catálogo: 136 produtos de vestuário

## O que é

O catálogo importado do Shopify tinha 32 produtos, com categorias de um e dois
itens — `bottoms` tinha **um** produto. A este catálogo foram somados 104
produtos de vestuário e acessórios gerados, com título, descrição, tipo,
coleção, tags, cor, tamanhos, preço e foto.

| | |
|---|---|
| Produtos | 136 (32 do Shopify + 104 gerados) |
| Variantes | 701 |
| Itens com algum tamanho esgotado | 29 (8 esgotados por inteiro) |
| Imagens | 231 (57 fotos distintas nos gerados) |
| `product_type` distintos | 40 |

## Por que

Para o agente da vitrine, e não para encher a loja.

A feature de back-in-stock captura "esta pessoa quis isto e não pôde levar", e
um agente lê esse sinal para montar uma vitrine com o que **está disponível** e
combina. Com um produto por categoria, não há o que recomendar: nenhum agente
monta "combina com" convincente sobre um catálogo de 32 itens em que metade das
categorias tem um só.

O efeito é mensurável. Para quem esperava o Classic Pullover Hoodie, a vitrine
saía com nota máxima 14 e **nenhum candidato do mesmo tipo** — porque só havia
um moletom no catálogo. Depois:

```
Classic Pullover Hoodie [M] esgotado ->
   24  mesmo tipo    6 tags  Zip-Through Hoodie
   21  mesmo tipo    5 tags  Eco Raglan Hoodie
   21  mesmo tipo    5 tags  Oversized Hoodie
   21  mesmo tipo    5 tags  Heavy Fleece Hoodie
```

## Onde se mexe

**`scripts/generate-apparel-catalog.ts` é a fonte de verdade.** A migration
`0011` tem 250 KB de SQL gerado — mudar o preço de uma peça ali significaria
caçar a linha certa entre milhares. No gerador, cada produto é uma linha:

```ts
["essential-cotton-tee", "Essential Cotton Tee", "T-Shirt", "shirts",
 ["White"], APP, 89, ["teeWhite"],
 ["unisex","basic","cotton","everyday","layering"],
 "A camiseta que resolve qualquer dia. Malha 100% algodão penteado de 180g…"],
```

O ciclo é:

```bash
npm run catalog:apparel -- --apply    # regera o SQL E aplica no banco
```

`--apply` existe porque **migration roda uma vez só** — o runner registra em
`schema_migrations`, então regerar a `0011` não muda um banco que já a aplicou.
O arquivo gerado começa apagando os próprios produtos (prefixo
`gid://catalog/`, sem tocar nos `gid://shopify/` importados), o que o torna
reaplicável. Roda em transação única: se um INSERT falhar no meio, o DELETE do
começo não fica aplicado sozinho, o que deixaria o catálogo vazio.

| O que mudar | Onde |
|---|---|
| Texto, preço, tamanhos, tags | tabela `P` |
| Trocar foto | mapa `IMG` + `COR` |
| Fotos intercambiáveis | `ALTERNATIVAS` |
| Tamanhos esgotados | `TAMANHOS_ESGOTADOS` |
| Itens esgotados por inteiro | `PRODUTOS_ESGOTADOS` |

## Fotos: a parte que deu mais trabalho

**Toda foto é verificada duas vezes** — que a URL responde 200 e que a imagem
**mostra a peça descrita**. A segunda checagem é manual, olhando cada uma. Não
há como automatizar: `source.unsplash.com`, o endpoint que servia foto aleatória
por palavra-chave, está **morto (503)**. Só funciona
`images.unsplash.com/photo-<id>`, que exige id real — e um id inventado ou
devolve 404 ou devolve uma paisagem no lugar de um moletom.

Fotos descartadas na inspeção: com marca de terceiro visível (Nike, Puma) e uma
com palavrão estampado na camiseta.

### O CDN da deco recusa URL externa

Descoberto testando, e é o tipo de coisa que só aparece em produção:

```
src=decocms/<uuid>/deco-logo.png        -> 200
src=https://images.unsplash.com/photo-… -> 403
```

`getOptimizedMediaUrl` manda toda URL que não seja Shopify, VTEX ou `data:`
para o CDN de imagem da deco, e ele **só serve arquivos do próprio
armazenamento**. As 127 imagens originais são todas do Shopify, que o framework
reescreve com o resize nativo e nunca toca no CDN — então esse caminho nunca
tinha sido exercitado. As fotos do Unsplash seriam as primeiras, e apareceriam
**todas quebradas**.

`src/components/ui/Image.tsx` deixou de ser um barril de reexport e passou a
envolver o `Image` do framework, desviando uma lista **explícita** de hosts
direto para o `<img>`, com o resize feito pela query string do próprio Unsplash.
A lista é explícita, e não uma heurística tipo "tudo que for externo", para que
nada mude nas imagens que já funcionam. O CSP em `src/server.ts` libera o host.

### Cor deriva da foto, nunca o contrário

Cada produto gerado tem **uma foto e uma cor**, e a cor sai do mapa `COR`,
indexado pela foto.

Antes cada produto declarava 2–3 cores e todas usavam a mesma imagem: a
variante "Black" de uma bolsa exibia a foto de uma bolsa bege. Derivar a cor da
foto torna a inconsistência **impossível por construção** — para ter uma cor
nova é preciso ter uma foto nova.

A cor vai no título (`Heavyweight Boxy Tee - Black`), onde fica visível na
vitrine e na busca, e como tag, para o agente. Não há seletor de Color: com uma
cor só, seria uma linha de um item, que não é escolha.

**Isso vale só para os produtos gerados.** Os importados do Shopify — como o
Organic Bucket Hat, que tem duas cores reais com fotos próprias — não foram
tocados.

### `ALTERNATIVAS` precisa ser a mesma peça

Há 57 fotos para 104 produtos, então alguma repetição é inevitável. Para
espalhar, cada foto declara alternativas — e elas **têm que ser a mesma peça**.

Uma primeira versão permitia alternativas por categoria, e o resultado foi pior
que a repetição: `Fleece Sweatpants` exibia foto de short jeans, `Kids Jogger
Pants` foto de jaqueta jeans, `Nylon Shoulder Bag` foto de mochila. Calça só
cai em calça, short só em short, boné só em boné.

## Esgotados

29 itens com algum tamanho esgotado e 8 esgotados por inteiro — destes, 4 são
declarados no gerador (`PRODUTOS_ESGOTADOS`) e 4 já vinham assim do catálogo
importado. Espalhados por camiseta, moletom, jaqueta, calça, vestido, tricô,
calçado e acessório.

A distribuição é deliberada: cada um é um ponto de entrada para o agente, e se
todos fossem moletom haveria um cenário só para demonstrar. **Item inteiro
esgotado** é o caso que força recomendação cruzada — o agente não tem outro
tamanho do mesmo item para oferecer.

## Bugs que o catálogo maior revelou

Nenhum foi introduzido pela população. Todos existiam e estavam invisíveis
porque o catálogo era pequeno demais para exercitá-los.

**Paginação 1-based vs 0-based.** Os blocos declaravam `"startingPage": 1` mas
o loader tratava `?page=` como 0-based e usava o número como multiplicador do
OFFSET. "Página 1" mostrava a segunda, e clicar na última pedia OFFSET além do
total — página vazia. Hoje tudo é 1-based, a primeira página é a ausência do
parâmetro, e página fora do intervalo grampeia na última existente.

**"Show more" não navegava.** `SearchPagination` passava só `next.to` ao
`Button`, e `to` carrega apenas o caminho — o `?page=` vive em `search`, que era
descartado. Ficou anos invisível porque nenhuma coleção passava de uma página.
Substituído por paginação numerada.

**`productType` aparecia como seletor na PDP.** `catalog.mapper.ts` sempre
anexou `productType` como `additionalProperty` de toda variante, e
`useVariantPossibilities` não distingue isso de opção real. Enquanto
`product_type` era vazio em 90% do catálogo, resolvia para zero entradas e caía
no filtro; ao preenchê-lo em 100%, virou uma linha de seletor inútil.

**Abas do menu não filtravam.** O bloco `PLP Loader` é compartilhado pela
Category Page (`/*`), então não há onde declarar uma coleção por rota, e o
loader só olhava `?collection=`. Toda aba mostrava o catálogo inteiro. Agora a
coleção vem do caminho, validada contra a whitelist de `findCollectionHandles`
— sem isso `/s` ou `/login` virariam filtro por coleção inexistente e a
listagem voltaria vazia, sem erro e sem log.

**Carrossel puxava a página.** `Slider.tsx` chamava
`dot.scrollIntoView({ block: "nearest" })` com um comentário afirmando que isso
nunca rola a página. Rola: `scrollIntoView` afeta todos os ancestrais roláveis,
inclusive o documento. Como o carrossel troca sozinho, bastava ter rolado para
baixo. Hoje só o `scrollLeft` da régua de indicadores é tocado.

## Conteúdo da home que apontava para o vazio

Estava fixo no decofile, herdado de outra loja:

- O **PromoGrid** tinha 6 cartas de loja de **celular** (Moto Watch, Razr,
  Edge 60 Fusion), e `?q=watch`, `?q=razr` e `?q=edge-60-fusion` devolviam zero
  resultados.
- O banner **"Capybara Helper"** anunciava um produto que não existia, com CTA
  para `/s?q=jeans` — era por isso que "comprar" caía nas calças. Hoje é
  produto de verdade, em acessórios, usando **a mesma arte do banner** como
  foto.
- No **Hero**, cada slide tem um produto anexado, mas `Hero.tsx:91` é explícito
  que o thumbnail nunca navega: o único link é o `href` do slide. Produto,
  headline e destino não concordavam — o slide "THE DENIM EDIT IS HERE" exibia
  um boné.

## O que continua limitado

**Tricô e moletom compartilham foto.** Seis e cinco produtos por imagem. Não
existem mais fotos verificadas dessas peças no conjunto; resolver exige buscar
mais fotos ou reduzir produtos nessas categorias.

**Alguns tênis têm logo de terceiro visível.** Foram usados com parcimônia por
falta de alternativa não-marcada. Para um catálogo real, precisam sair.

**As descrições são geradas.** Boas o bastante para o agente e para uma demo,
mas não são copy de loja de verdade.

**A verificação para no HTTP.** As páginas de PDP, categoria e busca têm todas
as sections em `Rendering/Lazy.tsx`, e `ProductShelf`/`ProductDetails` são
diferidas — o HTML do SSR é esqueleto por design. **Status 200 não é sinal de
saúde neste site**: um loader que falha vira section vazia e a página continua
200. Validar renderização exige navegador.

## Onde isto vive

Branch `feature/catalog-population`, no fork. A migração de infraestrutura
(Vercel + Supabase) está em `feature/deploy-vercel-supabase`, que é o PR para o
repositório do time e **não** inclui a `0011` nem o gerador — ver
`deploy-vercel-supabase.md`.
