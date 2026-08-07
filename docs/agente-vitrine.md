# Agente da vitrine — decisões e problemas em aberto

Documento de trabalho da branch `feature/agente-vitrine`. Registra **o que foi
decidido e por quê** antes de existir código, para que nenhuma dessas escolhas
precise ser redescoberta por tentativa e erro.

O que a feature é, e por que o sinal de "avise-me" vale mais que um e-mail, está
em [`feature-back-in-stock-shelf.md`](feature-back-in-stock-shelf.md) — não
repito aqui.

## Em uma linha

Quem tentou comprar uma peça e não pôde, por causa do tamanho esgotado, ganha
uma vitrine montada a partir **daquele item** — alternativas e complementos que
estão em estoque agora.

## O que já existe (não reimplemente)

| O quê | Onde | Estado |
|---|---|---|
| Captura do desejo | `src/actions/notifyMe/subscribe.ts` → `stock_alerts` | pronto |
| Desejo cruzado com catálogo | `findWaitedItems(email)` em `alerts.d1.ts` | pronto |
| **Candidatos para a vitrine** | `findSimilarAvailable(variantId)` em `catalog.d1.ts` | pronto |
| Identidade pela sessão | `alerts.session.ts` | pronto |
| A section que renderiza | `src/sections/Product/ProductShelf.tsx` | pronto |
| Catálogo com massa | 136 produtos, 29 com tamanho esgotado, 8 esgotados por inteiro | pronto |

`findSimilarAvailable` é a peça central e já foi construída para este consumidor
específico: ela devolve **os componentes da nota, não só a nota** — `sameType`,
`sameCollection`, `sharedTags` — porque o agente precisa saber se cada candidato
é *alternativa* ou *complemento* para montar a vitrine e justificá-la em texto.
Só entram produtos com ao menos uma variante disponível.

## Onde a vitrine vai aparecer

No lugar do **"Hottest Deals"** da home — hoje um `ProductShelfTabbed.tsx`
dentro de `website/sections/Rendering/Lazy.tsx`, sétima seção de
`.deco/blocks/pages-home.json`. Ele é uma vitrine tabulada por coleção
(Accessories / Fashion / …), ou seja, exatamente o "genérico baseado em
comportamento coletivo" que esta feature existe para substituir.

Estar dentro de `Lazy.tsx` confirma o que já valia: **o HTML do SSR é esqueleto
por design**, e status 200 não diz nada sobre a vitrine ter renderizado.

**Usuário de teste: `ams.igorfigueiredo@gmail.com`.**

## Conexão verificada

Round trip completo contra o Decopilot, com candidatos reais do Supabase, antes
de escrever qualquer código de produção.

| | |
|---|---|
| Org | `igor-deco-core` |
| Modelo | `anthropic/claude-sonnet-5` |
| Credencial | `aik_ryREhrnwoXZOzgZTebCDv` (provisionada, funcionando) |
| Sobrecarga por thread nova | ~15.900 tokens de entrada |
| Vitrine real (12 candidatos, prompt de 10 KB) | **32,8s**, 20.888 entrada, 1.119 saída |

Resultado com `Classic Pullover Hoodie - Grey [M]` esgotado:

```
titulo: Enquanto o seu tamanho não volta   confianca: 0.85
  zip-through-hoodie    Mesmo tipo de moletom, no seu tamanho, com zíper…
  heavy-fleece-hoodie   Moletom cinza como o que você queria, disponível…
  oversized-hoodie      Outro moletom com capuz no seu tamanho, corte mais amplo.
  raglan-sweatshirt     Mesmo cinza e mesmo tamanho, para usar como camada por baixo.
  winter-hat            Peça para usar junto com o moletom nos dias mais frios.
```

Três coisas que este teste provou, e que valem mais que o "funciona":

- **JSON puro, sem preâmbulo.** O Decopilot tem persona própria e tende a
  conversar; pôr o contrato de formato como **primeira seção** da instrução
  (e não como regra no fim) foi o que resolveu.
- **Zero handles inventados** entre os 5 escolhidos.
- **Zero alucinação de cor**, e de um jeito que só se vê conferindo: ele
  afirmou "cinza" nos dois candidatos que são de fato cinza
  (`Heavy Fleece Hoodie - Grey`, `Raglan Sweatshirt - Grey`) e **não citou cor**
  nos que não eram (`Zip-Through Hoodie - Blue`,
  `Oversized Hoodie - White`). A regra "não afirme o que não está escrito"
  está pegando.

O que o teste **não** prova: qualidade sobre um comprador com histórico, porque
não há histórico. Ver *A entrada é pobre*.

## Decisões

### 1. A vitrine é ancorada no item esgotado, não na loja

Esta é a decisão que define o produto, e é fácil de perder de vista quando o
código começa. A vitrine **não** é "os produtos em alta", "os mais vendidos" nem
"o que combina com o seu perfil". É: *você quis esta peça e ela não tinha o seu
tamanho — estas aqui têm*.

Na prática isso significa que o pool de candidatos vem de
`findSimilarAvailable(variantId)`, ancorado na variante desejada, e **nunca** de
uma consulta geral ao catálogo. Um agente que recebesse o catálogo inteiro
produziria uma vitrine plausível e genérica, que é exatamente o que já existe em
qualquer loja e não usa o sinal que a feature captura.

### 2. O gatilho é o clique, não o relógio

**A execução principal acontece no ato do clique em "avise-me"**, fora do
caminho da request (a pessoa não espera por ela). O cron a cada 3 dias é
**refresh**, não gatilho.

Isso mudou depois de uma conversa sobre o e-mail. Três razões que se somam:

1. **É o pico de intenção.** A pessoa acabou de declarar que quer aquilo. Em
   24h já esfriou; em 3 dias, muito.
2. **É o e-mail que a loja já promete.** A tela diz hoje *"We'll email you when
   this product is back in stock"* e **nada é enviado** — dívida registrada em
   [`feature-back-in-stock-shelf.md`](feature-back-in-stock-shelf.md). O
   e-mail de confirmação com a vitrine dentro entrega a hipótese e fecha a
   mentira na mesma ação, sem precisar inventar um e-mail de marketing à parte.
3. **Consentimento limpo.** Confirmação de "avise-me" é transacional e
   esperada. Uma recomendação avulsa três dias depois é outra coisa.

Nunca no render, em nenhum dos dois casos: **medido em 32,8s** para uma vitrine
de verdade (ver *Conexão verificada*). Foi essa latência que travou o agente de
busca em stub.

**A cadência do e-mail não é a cadência da vitrine.** A vitrine pode regenerar
a cada 3 dias sem incomodar ninguém — ela só regrava uma linha. E-mail a cada 3
dias sobre o mesmo moletom esgotado é como se consegue marcação de spam, que
estraga a entrega para todo mundo depois. **Um e-mail por alerta.**

### 3. O provedor de LLM é o Decopilot do deco

Não por preferência — é o único que funciona. O handoff do agente de busca
documenta cinco tentativas fracassadas (chave tratada como Anthropic → 401;
`api.decocms.com` → NXDOMAIN; app oficial do gateway → 404; conexão MCP → 500;
endpoints compatíveis com OpenAI no studio → 405).

O protocolo abaixo foi **verificado nesta branch, com as nossas credenciais**
(`.dev.vars` → `STUDIO_*`, org `igor-deco-core`) — que são diferentes das da
branch do agente de busca:

```
1. POST {ROOT}/api/{org}/tools/COLLECTION_THREADS_CREATE
     body: { data: { title, virtual_mcp_id: <STUDIO_AGENT_ID> } }
     -> 200 { item: { id: "thrd_…" } }        ← o id gerado, NÃO o que você mandar
2. GET  {ROOT}/api/{org}/decopilot/threads/{id}/stream    SSE, ANTES do POST
3. POST {ROOT}/api/{org}/decopilot/threads/{id}/messages  -> 202
     body: { messages: [{ role, parts: [{ type:"text", text }] }], agent: { id } }
4. ler os eventos `text-delta` até `finish`
```

**O passo 1 é a descoberta que faltava.** O handoff usava um `threadId` fixo,
criado à mão pela UI do Studio, e não registrava de onde ele vinha. Uma thread
inexistente falha de dois jeitos distintos e nenhum deles diz "crie a thread":
o stream devolve `404 Thread not found`, e o POST de mensagem devolve **500 com
violação de foreign key** em `thread_message_parts_thread_id_fkey`.

Duas armadilhas de transporte, ambas custaram tempo:

- O corpo de `messages` é validado por zod em modo estrito: aceita **exatamente**
  `{ messages, agent }` e rejeita qualquer outra chave. Não há como criar a
  thread por ali.
- Existe um endpoint MCP em `/api/{org}/mcp`, **mas ele não aceita os nomes
  do catálogo** (`COLLECTION_THREADS_CREATE` → `unknown namespace "COLLECTION"`).
  O que funciona é o transporte REST: `POST /api/{org}/tools/{NOME_DA_TOOL}`
  com os argumentos direto no corpo. `GET /api/{org}/tools` lista as 163
  ferramentas disponíveis.

A chamada sai do servidor para fora. Não depende de `/deco/meta`, de
`/deco/render` nem do Fast Deploy que a migração para a Vercel removeu, e o CSP
é irrelevante porque nada disso passa pelo navegador.

**Uma thread por execução.** Verificado: o histórico acumula. A mesma pergunta
trivial custou **15.940** tokens de entrada numa thread nova e **21.191** numa
já usada. Reaproveitar thread entre compradores faria o custo crescer sem teto
e — pior — deixaria os dados de um comprador no contexto do próximo. Criar
thread é uma chamada barata; crie sempre.

**O que se perde ao usar o Decopilot**, e que precisa ser compensado em código:

- **Sem cache de prompt.** Os ~50 mil tokens de entrada por chamada (o
  assistente carrega persona própria e 21 ferramentas) deixam de importar a 2
  chamadas por dia; importariam muito a 2 por segundo. É outro argumento para o
  lote.
- **Sem saída estruturada garantida.** Ele tem prompt de sistema próprio, que
  briga com "responda só JSON". Consequência direta: **parsing defensivo
  obrigatório** — extrair o primeiro bloco JSON válido da resposta, nunca
  `JSON.parse` no texto inteiro. Resposta que não parseia é tratada como
  confiança zero e cai no fallback (decisão 6).

### 4. O agente escolhe de uma lista; nunca consulta o catálogo

Pipeline em três etapas, com o modelo tocando só o meio:

| Etapa | Modelo? | O quê |
|---|---|---|
| 1 | não | `findWaitedItems` + `findSimilarAvailable` → candidatos |
| 2 | **sim** | quais entram, em que ordem, título da vitrine, motivo por item |
| 3 | não | cada `handle` volta a ser resolvido contra a lista da etapa 1 |

A etapa 3 é o que torna alucinação de produto **estruturalmente impossível** em
vez de mitigada: um handle fora da lista é descartado, nunca corrigido. Sem ela,
o sintoma seria uma vitrine bonita cheia de links 404.

### 5. A seleção persiste; a disponibilidade não

O agente grava handles, motivos e título. **A conferência de estoque acontece no
render**, não na geração.

Com 3 dias de cadência a vitrine passa 72h envelhecendo enquanto o estoque muda.
Uma vitrine cuja premissa inteira é *"não te mostro o que você não pode
comprar"* recomendando item esgotado é o pior resultado possível desta feature —
e é o bug mais provável de aparecer no dia da apresentação.

O loader da section refaz o filtro de disponibilidade em todo pageview (um
`EXISTS` sobre 4–6 handles, barato) e, se sobrarem menos de 3 itens, completa
com o topo de `findSimilarAvailable` sem copy. Vitrine mirrada é pior que
vitrine parcialmente sem justificativa.

### 6. Todo caminho de falha tem saída

Três saídas em cascata, uma função só:

| Situação | O que renderiza |
|---|---|
| Agente respondeu e a etapa 3 validou | a vitrine com copy |
| Falha, timeout, parsing quebrado, ou `confianca < 0.5` | top-6 de `findSimilarAvailable`, sem copy, título fixo |
| Sem candidatos | nada — a section some |

O terceiro caso já sai de graça: `ProductShelf.tsx` retorna `null` quando
`products` é vazio. O que **não pode** existir é erro do agente virando section
vazia com espaço reservado na página.

O campo `confianca` no schema de saída existe justamente para o agente **poder
se recusar**. Vitrine fraca declarada é melhor que vitrine fraca apresentada
como boa.

### 7. O agente não escreve `.deco/blocks/*.json`

A section é um bloco que um humano posiciona **uma vez**; o conteúdo vem de uma
linha no Postgres que o agente reescreve a cada 3 dias.

O motivo é rollback, não organização: reverter uma vitrine ruim tem que ser um
`UPDATE`, não um revert de commit num arquivo versionado que o próximo build
sobrescreve. É também exclusão de escopo declarada na skill do time
(`agent-creator`, Passo 1: "Escrever bloco CMS → **Pare**").

> **A linha:** o deco é dono de *onde* a vitrine aparece. O agente é dono do
> *que* entra nela.

Isso vale independentemente de não usarmos o editor visual da Studio. "Studio
como base" nesta feature significa **o Decopilot como provedor de LLM** e o
decofile como substrato de composição — não o editor.

### 8. O domínio é `src/platform/shelf/`, não `agent/`

`src/platform/agent/` e `src/platform/analytics/` **já existem, construídos, na
branch `origin/feature/agente-vendas-ia-phase1`** (2028 linhas, não mergeada).
Criar os mesmos diretórios aqui garantiria conflito.

Essa branch também mexe em `src/worker-entry.ts`, `wrangler.jsonc` e
`migrations/` na raiz — arquivos que a migração para Vercel + Supabase apagou ou
moveu. **O merge dela vai doer, e não é este PR que resolve isso.** O que dá
para fazer daqui é não piorar: domínio com nome próprio, migration em
`db/migrations/` com a numeração corrente, nada em `wrangler.jsonc`.

### 9. Só comprador logado, por enquanto

A identidade é a sessão. Visitante anônimo não tem vitrine — não porque não
pediu, mas porque não há como reconhecê-lo de volta três dias depois.

Adiado de propósito, e a ordem importa: a mudança é puramente **aditiva** (altera
*quem tem identidade*, não *o que o agente faz* — o agente recebe uma chave e
devolve uma vitrine, sem saber se veio de sessão ou de cookie). Fazer depois
significa que, quando a vitrine estiver estranha, já se sabe que não é a
identidade. Ver *Deslogado* em Problemas em aberto.

## Problemas em aberto

### Comprador com mais de um item esperado

`findWaitedItems` devolve até 20. Uma pessoa que esperou por três peças gera
três pools de candidatos — e ninguém decidiu ainda se isso vira três vitrines,
uma vitrine, ou uma vitrine com o item mais recente dominando.

**Default proposto** (a confirmar quando houver dado real): **uma vitrine por
comprador**, ancorada no desejo mais recente, com os demais contribuindo
candidatos. Cada candidato carrega a **procedência** — de qual item esperado ele
veio — para o motivo poder dizer "para a calça que você queria" em vez de um
"combina com você" genérico que não se sustenta.

Três vitrines empilhadas foi descartado por ser pior de ler e triplicar o custo
de LLM sem triplicar o valor.

### Orçamento do cron

Plano Pro: `maxDuration` da ordem de 300s por function (configurável em
`vercel.json`), cron com granularidade fina. A ~20s por comprador, isso é ~14
por execução com folga.

Mesmo assim o cron precisa de **prazo e retomada**, porque o teto existe e
estourá-lo falha em silêncio, deixando metade das vitrines geradas e nenhuma
indicação de onde parou:

```
cron
  └─ SELECT compradores com vitrine mais velha que 3 dias
     ORDER BY a mais antiga primeiro
  └─ enquanto (agora - início) < orçamento:
       roda, grava, marca generated_at
  └─ acabou o orçamento? para. O próximo cron continua.
```

Ordenar pela vitrine mais antiga é o que torna isso auto-recuperável sem tabela
de controle nem fila: quem ficou de fora hoje é o primeiro amanhã.

### A entrada é pobre, e isso não é culpa do agente

Só entra em `stock_alerts` quem clicou num produto esgotado — fração pequena dos
visitantes. **Um agente excelente sobre entrada pobre produz vitrine que parece
aleatória, e a conclusão fácil (errada) é culpar o modelo.**

Antes de julgar qualquer saída, semeie. O catálogo tem 29 itens com tamanho
esgotado e 8 esgotados por inteiro, espalhados de propósito por camiseta,
moletom, jaqueta, calça, vestido, tricô, calçado e acessório — são 8 âncoras
distintas prontas para exercitar a vitrine em cenários diferentes.

### Verificação exige navegador

A section vai ser diferida, como as outras. **Status 200 não é sinal de saúde
neste site**: um loader que falha vira section vazia e a página continua 200.
Isso já produziu duas conclusões erradas durante a migração.

A ferramenta que substitui o curl é um **dry run em terminal** — a mesma função
que o cron chama, imprimindo a vitrine escolhida com os motivos. Vale escrever
**primeiro**, não por último: é ferramenta de desenvolvimento antes de ser
feature, e é o que permite iterar no prompt sem subir nada.

### Deslogado

O trabalho, quando for a hora (~meia diária), e o repo já tem o padrão em
`src/loaders/_cookie.ts`, usado por wishlist e newsletter:

1. `visitor_id` (UUID) em cookie httpOnly, na primeira visita
2. coluna `visitor_id` em `stock_alerts`, nullable, gravada junto com o e-mail
3. `readShopperIdentity` devolve `{ email }` **ou** `{ visitorId }`
4. no login, `UPDATE stock_alerts SET email = ? WHERE visitor_id = ?`

O passo 4 é onde moram os bugs — é o único que permite uma pessoa acabar com
duas vitrines.

Ressalva de valor: com cadência de 3 dias, vitrine gerada para cookie anônimo
pode nunca ser vista — o visitante some, o cookie expira, e gastamos 50 mil
tokens por ninguém. Se for para deslogado, gere **só na escrita** para anônimos
e reserve o cron para quem tem conta.

### `AGENTS.md` está desatualizado

Diz *"deployed to Cloudflare Workers via wrangler"*. Depois da migração isso é
falso, e é o primeiro arquivo que uma ferramenta de IA lê neste repo — vai gerar
código para o runtime errado. Correção de duas linhas, mas antes de alguém
gerar código aqui.

## A instrução do agente

Versão validada no dry run acima. Quatro escolhas que não são óbvias e que
sairiam se alguém "limpasse" o texto:

- **O contrato de formato vem primeiro**, não no fim. O Decopilot carrega
  persona própria e quer conversar; a regra de formato como última seção não
  segura, como primeira segura.
- **`confianca` existe para o agente poder se recusar.** Vitrine fraca
  declarada é melhor que vitrine fraca apresentada como boa.
- **O `motivo` pede relação, não elogio.** É a diferença entre uma vitrine que
  explica e uma que faz propaganda.
- **A marca é proibida explicitamente.** A loja é de marca única
  (`vendor = 'Deco Store'` em 136 produtos), então "da mesma marca" é verdade
  vazia — e sem a proibição o modelo usa isso como motivo.

````text
Você monta uma vitrine de recomendação para uma pessoa que acabou de tentar
comprar uma peça de roupa e não conseguiu: o tamanho que ela queria está
esgotado. Ela clicou em "avise-me quando voltar", e é esse o momento em que
você é chamado.

Sua saída aparece em dois lugares: numa vitrine do site e num e-mail enviado
logo em seguida. Escreva de modo que cada linha se sustente sozinha, sem o
resto da página em volta.

## FORMATO DA RESPOSTA — leia antes de tudo

Responda com UM único objeto JSON e mais nada. Sem saudação, sem explicação,
sem markdown, sem bloco de código, sem comentário depois. Não use ferramentas,
não consulte nada: tudo de que você precisa está nesta mensagem.

{
  "titulo": "string, até 45 caracteres",
  "confianca": 0.0,
  "itens": [
    { "handle": "string, copiado exatamente dos CANDIDATOS", "motivo": "string, até 90 caracteres" }
  ]
}

## REGRAS RÍGIDAS

1. Escolha SOMENTE handles que aparecem na lista CANDIDATOS, copiados
   caractere por caractere. Um handle que você invente ou corrija vira uma
   página que não existe, e eu descarto o item inteiro. Na dúvida, escolha
   menos.
2. Não afirme material, gramatura, medida, composição, origem ou cuidado que
   não esteja escrito no candidato. Você não tem essa informação. Omitir é
   sempre melhor que inventar.
3. Não prometa reposição, prazo, desconto, frete ou aviso futuro. Você não
   controla nada disso.
4. Não peça desculpas nem lamente o esgotamento. A pessoa já sabe. Fale do
   que ela pode levar agora.
5. Todos os candidatos já estão disponíveis. Nunca escreva que algo "ainda
   está em estoque" ou "corre que está acabando" — é urgência falsa.
6. Ignore a marca. A loja inteira é de uma marca só; dizer que algo é "da
   mesma marca" não informa nada.

## COMO LER OS CANDIDATOS

Cada candidato traz os sinais já calculados. Use-os, não os recalcule:

  mesmoTipo: true   -> ALTERNATIVA. Serve no lugar do que ela queria.
  tagsEmComum: [..] -> afinidade real, nominal. Quanto mais tags, mais forte.
  mesmaColecao      -> mesmo território da loja. Sinal fraco sozinho;
                       nunca use isso como único motivo.
  tamanhosDisponiveis -> o que dá para comprar hoje.

Três papéis, e uma vitrine boa mistura pelo menos dois:

  ALTERNATIVA  mesmoTipo = true
  PARECIDO     tipo diferente, mas 2+ tags em comum
  COMPLEMENTO  tipo diferente que se veste JUNTO com o desejado
               (calça com moletom, boné com jaqueta, bolsa com vestido)

## COMO COMPOR

- Entre 4 e 6 itens. Menos de 4 só se os candidatos forem realmente ruins.
- Comece por ALTERNATIVAS. Quem queria um moletom quer, antes de tudo, outro
  moletom.
- Inclua ao menos um COMPLEMENTO quando existir um que faça sentido vestir
  junto. É o que faz a vitrine parecer montada por alguém em vez de filtrada
  por máquina.
- Não repita o mesmo tipo mais de três vezes.
- Ordene por quanto você acredita em cada um, não por preço.

## O MOTIVO

Uma linha, em português do Brasil, até 90 caracteres. Diga a RELAÇÃO com o
que a pessoa quis — não elogie o produto.

  bom   "Mesmo corte e mesmo peso do moletom que você queria."
  bom   "Veste por baixo do moletom sem apertar."
  bom   "A calça que fecha esse look, e tem o seu tamanho."
  ruim  "Uma peça incrível que você vai amar!"        (elogio, não relação)
  ruim  "Moletom de algodão premium 400g."            (você não sabe disso)
  ruim  "Também é da coleção de inverno."             (coleção sozinha não é motivo)
  ruim  "Aproveite antes que acabe!"                  (urgência falsa)

Não repita o nome do produto no motivo — ele já aparece na vitrine.

## O TÍTULO

Até 45 caracteres. Fale com a pessoa, não sobre o algoritmo.

  bom   "Enquanto o seu tamanho não volta"
  bom   "Perto do que você queria, e disponível"
  ruim  "Produtos similares recomendados"
  ruim  "Baseado no seu interesse"

## CONFIANÇA

Um número de 0 a 1: quanto os candidatos realmente respondem ao que a pessoa
quis.

  0.8+  há alternativas do mesmo tipo, com tamanho, e um complemento coerente
  0.5   dá para montar algo defensável, mas sem alternativa direta
  <0.5  os candidatos não têm relação real com o desejo

Abaixo de 0.5 eu descarto o seu texto e mostro a ordenação por SQL. Declarar
confiança baixa é a resposta certa quando ela é baixa — não é fracasso.
````

Cada candidato é entregue já reduzido ao que importa — não o `CatalogRecord`
inteiro, que multiplicaria o prompt sem informar mais:

```json
{
  "handle": "heavy-fleece-hoodie",
  "titulo": "Heavy Fleece Hoodie - Grey",
  "tipo": "Hoodie",
  "preco": 249.9,
  "mesmoTipo": true,
  "mesmaColecao": true,
  "tagsEmComum": ["unisex", "basic", "cotton", "winter", "layering"],
  "tamanhosDisponiveis": ["XS", "S", "M", "L", "XL"],
  "descricao": "…160 primeiros caracteres…"
}
```
