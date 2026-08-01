# 🛍️ Agente de Vendas Conversacional
### Uma tese para o hackathon deco.cx

---

## O problema, em uma história

Imagina uma cliente entrando na loja e digitando: **"algo pra correr no frio"**.

A busca tradicional, que trabalha por palavra-chave exata, provavelmente retorna **zero resultados** — mesmo que a loja tenha exatamente o produto ideal no catálogo. A cliente desiste, sai, talvez compre em outro lugar.

Esse é só um dos três atritos que fazem uma loja vender menos do que poderia:

1. 🔍 **A busca não entende o que a pessoa quer dizer**, só o que ela digitou literalmente.
2. ❓ **Dúvidas não respondidas na hora** (tamanho, material, qual é o melhor pra mim) fazem o cliente sair da loja pra pesquisar em outro lugar — e nem sempre volta.
3. 🎯 **Ninguém guia o cliente até o produto certo entre 500 opções**, então ele vê uma vitrine genérica em vez de uma vitrine feita pra ele.

## A ideia

Em vez de criar uma caixinha de chat separada, a inteligência entra **direto na barra de busca que já existe no site**. O cliente digita o que quiser, do jeito que quiser — sem precisar aprender um "modo chat" novo — e por trás dos panos um agente entende a intenção e monta a vitrine certa pra ele.

A diferença importante: **o agente não compra nada por você**. Ele não mexe no carrinho, não decide sozinho. Ele faz o trabalho de "tradutor" — entende o que você digitou na busca, filtra o catálogo certo, e te leva pra lá. Quem escolhe e compra continua sendo você, como sempre.

**Exemplo de uso:**

> Cliente digita na busca: **"algo pra correr no frio, até uns 300 reais"**
> *(a página de produtos abre automaticamente, já filtrada — tênis de corrida com proteção térmica até R$ 300 — e ordenada dos mais procurados primeiro)*

Simples assim. Sem fricção, sem "zero resultados", sem o cliente precisando adivinhar as palavras exatas do catálogo — e sem nenhum elemento novo de interface pra aprender, porque é a mesma busca de sempre, só que mais esperta.

## Por que isso funciona

- **Reduz abandono na busca** — quase todo pedido em linguagem natural vira um filtro válido, então a taxa de "não encontrei nada" despenca.
- **Mostra o produto certo primeiro** — ordenando por popularidade dentro do filtro, o cliente vê logo de cara o que mais gente já comprou/procurou, o que aumenta a confiança na escolha.
- **É seguro e simples de construir** — como o agente só *leciona* o caminho até a vitrine (não escreve no carrinho), o risco técnico e o risco de "o robô errar uma compra" são bem menores.

## Como vamos construir (visão geral, sem jargão)

A loja já é construída em cima de uma plataforma (deco.cx) que se conecta à Shopify. Ou seja, a "prateleira" e o "carrinho" já existem e funcionam — nosso trabalho é só colocar um vendedor inteligente na frente dela.

**Passo a passo:**
1. Interceptar o que o cliente digita na barra de busca já existente (em vez de criar um componente novo de chat).
2. Ensinar o agente a entender esse texto livre e traduzir pra filtros (categoria, preço, característica do produto).
3. Conectar isso à busca que já existe na loja, pedindo pra ela ordenar do mais popular pro menos popular.
4. Quando o agente entende o pedido, ele já leva o cliente direto pra página de produtos filtrada — pronto, sem passo extra de confirmação numa janela de chat.

## Como vamos provar que funciona (pro time de negócio/banca)

- Quantas buscas que davam "zero resultado" agora encontram algo relevante.
- Se as pessoas que usam a busca inteligente compram mais do que as que usavam a busca antiga.
- Quantas buscas em linguagem natural realmente levam a uma página de produtos filtrada com sucesso (sinal de que a "tradução" fez sentido).

## Cronograma sugerido

| Quando | O que entregamos |
|---|---|
| Dia 1 | Estrutura técnica base + o agente "entendendo" pedidos simples digitados na busca |
| Dia 2 | Busca conectada à loja de verdade, levando pra vitrine filtrada |
| Dia 3 | Refinamento — sinônimos, preços implícitos ("baratinho"), casos difíceis |
| Dias seguintes | Polimento visual, números de impacto, ensaio da demo |

## Bônus: o painel admin e as coleções automáticas

Depois que o agente está no ar, ele começa a acumular uma informação valiosa: **o que as pessoas mais buscam**. Isso é ouro pra loja — e seria um desperdício deixar esse dado só passar batido.

A ideia é criar uma **página de admin**, separada da loja pública, onde o time enxerga:

- Quais tópicos as pessoas mais buscaram nos últimos dias ("tênis pra corrida no frio", "vestido até 200 reais"...)
- Se a busca antiga está falhando menos desde que o agente entrou
- Quanto a busca inteligente está de fato levando gente pra comprar

E, com base nesse ranking, a loja ganha uma seção nova na **página inicial**: uma coleção automática mostrando **os produtos mais procurados de cada tópico em alta**, montada sozinha — sem ninguém precisar editar a homepage manualmente toda semana.

Ou seja: o que os clientes buscam vira, automaticamente, vitrine pra quem só entrou na loja e nem digitou nada na busca. O agente vira também um "termômetro" de demanda em tempo real.

**Como isso vai funcionar na prática (versão do hackathon):** em vez de o agente reescrever a página inicial toda vez (o que seria arriscado de construir no prazo), criamos **uma seção especial** na homepage que já nasce "esperta" — toda vez que a página carrega, ela mesma consulta quais são os tópicos mais buscados no momento e monta a vitrine com os produtos mais procurados de cada um. Pro cliente, o efeito visual é idêntico a "o agente criou uma coleção nova" — só que de um jeito mais simples e seguro de construir a tempo da apresentação.

## O pitch de uma frase

> "Em vez de o cliente adivinhar as palavras certas pra achar o que quer, a própria busca do site adivinha por ele — e ainda mostra primeiro o que todo mundo já está comprando. E o que todo mundo busca vira, sozinho, vitrine pra quem nem usou a busca."
