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

### 2. Roda fora do caminho da request

Cron periódico (a cada 3 dias por comprador) **mais** uma execução na escrita do
alerta. Nunca no render.

O motivo é medido, não estimado: o Decopilot leva **15–21s por chamada** (três
execuções registradas no handoff do agente de busca). Isso é inviável num
caminho bloqueante — foi o que travou o agente de busca em stub — e é
irrelevante num lote.

A execução na escrita existe porque, só com o cron, quem clica em "avise-me"
hoje esperaria até 3 dias para ver qualquer coisa. É a mesma função chamada de
dois lugares; `generated_at` resolve a idempotência entre elas.

### 3. O provedor de LLM é o Decopilot do deco

Não por preferência — é o único que funciona. O handoff do agente de busca
documenta cinco tentativas fracassadas (chave tratada como Anthropic → 401;
`api.decocms.com` → NXDOMAIN; app oficial do gateway → 404; conexão MCP → 500;
endpoints compatíveis com OpenAI no studio → 405) e uma que responde:

```
Host: studio.decocms.com          (NÃO api.decocms.com)
Org:  gustavo-baltazar            (slug, não o id interno)

1. GET  /api/{org}/decopilot/threads/{id}/stream    → SSE, abrir ANTES do POST
2. POST /api/{org}/decopilot/threads/{id}/messages  → 202 {taskId}
3. ler os eventos `text-delta` do stream até `finish`
```

Protocolo verificado e salvo em `scripts/deco-decopilot-probe.mjs`, **na branch
`feature/agente-vendas-ia-phase1`** — vale portar o script antes de escrever
cliente novo.

A chamada sai do servidor para fora. Não depende de `/deco/meta`, de
`/deco/render` nem do Fast Deploy que a migração para a Vercel removeu, e o CSP
é irrelevante porque nada disso passa pelo navegador.

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

## Instruções do agente — primeira versão

Sujeito a mudar assim que houver saída real para julgar. As escolhas menos
óbvias: o campo `confianca` existe para o agente poder se recusar, e o `motivo`
pede **relação**, não elogio — é a diferença entre uma vitrine que explica e uma
que faz propaganda.

```
Você monta uma vitrine para uma pessoa que tentou comprar uma peça de roupa
e não pôde: o tamanho que ela queria estava esgotado.

Seu trabalho é escolher, entre os produtos DISPONÍVEIS que eu te der, quais
mostrar para ela agora — e dizer, em uma linha por produto, por que aquele.

REGRAS RÍGIDAS
- Escolha SOMENTE handles da lista CANDIDATOS. Um handle fora da lista é
  uma página que não existe. Se está em dúvida, escolha menos.
- Nunca afirme material, medida, composição ou origem que não esteja no
  texto do candidato. Você não tem essa informação; inventá-la é pior que
  omiti-la.
- Nunca prometa reposição, prazo ou aviso futuro. Ninguém envia esse e-mail.
- Não mencione que o item desejado está esgotado com tom de desculpa. A
  pessoa já sabe. Fale do que ela pode levar.

COMO LER OS CANDIDATOS
Cada um vem com:
  sameType=true    → é ALTERNATIVA: serve no lugar do que ela queria
  sharedTags=[...] → é COMPLEMENTO: combina com o que ela queria
  sameCollection   → mesmo território da loja, sinal fraco sozinho

COMO COMPOR
- 4 a 6 itens.
- Comece por alternativas. Quem queria um moletom quer, antes de tudo,
  outro moletom.
- Inclua ao menos um complemento se houver com 2+ tags em comum. É o que
  faz a vitrine parecer montada por alguém, e não filtrada por máquina.
- Não repita o mesmo product_type mais de três vezes.
- Uma cor só por peça: a cor está no título e é a única que existe.

O MOTIVO (uma linha, português, até 90 caracteres)
Diga a relação com o que a pessoa quis, não a qualidade do produto.
  bom:  "Mesmo peso e mesmo corte do que você esperava, no seu tamanho."
  bom:  "Fecha o look da calça que você queria."
  ruim: "Uma peça incrível que você vai amar!"     (elogio, não relação)
  ruim: "Moletom de algodão premium 400g."          (você não sabe disso)

TÍTULO DA VITRINE (até 45 caracteres)
Fale com a pessoa, não sobre o algoritmo.
  bom:  "Enquanto o seu tamanho não volta"
  ruim: "Produtos similares recomendados"

CONFIANÇA
Devolva confianca < 0.5 quando os candidatos não têm relação real com o
que a pessoa quis. Vitrine fraca declarada é melhor que vitrine fraca
apresentada como boa — abaixo de 0.5 eu mostro a ordenação por SQL e
descarto seu texto.
```

Saída esperada:

```json
{
  "titulo": "string",
  "confianca": 0.0,
  "itens": [{ "handle": "string", "motivo": "string" }]
}
```
