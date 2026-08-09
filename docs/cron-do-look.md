# O cron do look — uma janela por dia, e um botão para a demo

> **Desenho, não implementação.** Este documento existe para que as decisões de
> §5 sejam tomadas antes de escrever código, e não descobertas depois. Nada aqui
> está no repositório ainda.

O objetivo declarado: **as chamadas ao agente acontecem no máximo a cada 24h**, e
existe um gatilho manual para executar a qualquer momento durante a demo.

---

## 1. O gatilho hoje não é tempo — é mudança de contexto

Esta é a razão de o documento existir, e ela desloca o desenho inteiro.

`lookDaPeca` **já** não chama o agente duas vezes para o mesmo par (peça,
contexto): há cache indexado por `hashDoContexto`, e ele não expira. O que abre
uma geração nova é um **contexto diferente** — e o hash inclui as sementes:

```ts
// look.actions.ts:75
...contexto.sementes.map((s) => `${[...s.kinds].sort().join(",")}:${s.productGroupId}`).sort(),
contexto.local.cidade, contexto.local.regiao, contexto.local.pais, contexto.mes
```

Cada favorito novo, cada `avise-me`, cada PDP visitada (`deco_recent` entra nas
sementes) produz um hash inédito e, com ele, uma geração de ~80s desde que a #26
somou a passada da persona.

**Consequência:** o número de chamadas cresce com a atividade da pessoa, não com
o relógio. Um cron de 24h posto ao lado disso não segura nada — as chamadas
continuam nascendo no clique, e o cron só acrescenta mais.

Um teto de 24h exige **duas** peças, e o cron é a segunda:

| | |
|---|---|
| **Fechar** a geração sob demanda | senão o clique continua sendo o gatilho |
| **Abrir** uma janela controlada | o cron, com alvo explícito |

---

## 2. O que já existe e não deve ser reescrito

**O padrão de vencimento, no `shelf`.** `acharVitrinesVencidas(dias = 3, limite =
20)` devolve os vencidos, mais antigos primeiro, com teto — e o comentário
explica por que a ordem torna o cron auto-recuperável *sem fila e sem tabela de
controle*: quem ficou de fora por orçamento hoje é o primeiro amanhã.

**Ninguém executa essa função.** O cron do shelf é planejado em três comentários
(`subscribe.ts:73`, `shelf.agent.ts:158`, `shelf.d1.ts:119`) e nunca existiu. Um
`acharLooksVencidos` espelhando a mesma consulta é trabalho pequeno — e vale
considerar se o mesmo cron atende os dois domínios.

**A quarentena por falha.** `TTL_FALHA_MINUTOS = 10` em `look.actions.ts`
impede que um par que falhou vire laço. Continua valendo e não conflita com nada
aqui.

---

## 3. A armadilha: o `look:warm` aquece o contexto errado

O script que pré-aquece já existe, e o próprio arquivo documenta o defeito:

> *"O contexto é o de quem roda, e do terminal ele é o errado. `aquecerLook` lê
> identidade e local da requisição corrente; fora de uma, `donoDaVitrine()`
> devolve `null` e `localDaRequisicao()` cai em São Paulo. O que este comando
> aquece, portanto, é o par (peça, conta sem histórico) — que **não é caso de uso
> desta feature**."*

E, pior para quem confia no verde:

> *"Este script imprime `✓ … aquecida` sempre que o agente compõe, inclusive
> quando compôs para o contexto que ninguém vai usar. Sucesso aqui não é sinal de
> que a demo está pronta."*

**Um cron herda esse defeito inteiro**, porque também roda sem requisição. Um cron
construído sobre o `look:warm` de hoje gastaria ~80s por peça para gravar looks
sob um hash que a PDP da persona nunca vai ler — e reportaria sucesso.

**Portanto `--email` e `--cidade` no `look:warm` são pré-requisito, não
melhoria.** O próprio arquivo já os aponta como *"a melhoria de maior retorno que
ficou pendente neste script"*. Eles rendem sozinhos, antes de o cron existir:
permitem aquecer o roteiro à mão.

---

## 4. O desenho proposto

### 4.1 Fechar a porta

Uma flag — `LOOK_SOB_DEMANDA=false` — faz `lookDaPeca` servir só do cache e
nunca disparar `gerarLook`.

Ganho colateral que importa na demo: a PDP fica **determinística**. Hoje, quem
cai num contexto frio vê a section sumir enquanto o agente compõe atrás. Com a
porta fechada, ou o look está aquecido e aparece, ou não está e nunca aparece —
sem o meio-termo que depende de quantos segundos alguém esperou.

### 4.2 O alvo é explícito

Como o contexto depende do usuário, **não existe "aquecer todos os looks
vencidos"** que sirva: cada persona tem hash próprio. O cron precisa de uma lista
de pares (peça, persona) — o roteiro da demo.

Preferência: um **JSON versionado** no repo, não uma tabela. O roteiro é decisão
de apresentação, muda junto com o pitch e merece histórico no git.

### 4.3 O cron, e o botão, sendo o mesmo código

Uma rota dedicada, protegida por segredo em header. O `vercel.json` de hoje só
tem o rewrite catch-all para `/api`, então a rota é nova.

- **Vercel Cron**, `crons` no `vercel.json`, 1×/dia — que é exatamente o limite do
  plano Hobby, e casa com o requisito.
- **O gatilho manual bate na mesma rota.** Um `npm run look:cron` com o segredo.

Isto é deliberado: o que você aperta na demo é **literalmente** o que roda de
madrugada. Um caminho paralelo de teste diverge do de produção no pior momento
possível.

### 4.4 A janela de background continua sendo o risco

A #26 registrou que `gerarLook` dispara sem `await` e que a Vercel pode congelar
a invocação assim que a resposta sai — eram ~40s, com as duas passadas são ~80s.
Num cron isso pesa mais, porque ele processa vários alvos em sequência.

`waitUntil` do `@vercel/functions` estava marcado como *"vale medir antes de
trazer dependência"*. Com o cron, passa a valer.

---

## 5. As decisões abertas

Nenhuma linha de código antes destas três.

### 5.1 O teto de 24h é por par ou global?

| | por par (peça, persona) | global |
|---|---|---|
| Robustez | cada alvo se protege sozinho | uma execução gasta a janela |
| Demo | apertar o botão 3× não fura nada | o 2º clique fura o próprio limite |
| Complexidade | precisa de `gerado_em` por alvo | um carimbo só |

**Recomendação: por par**, com o manual podendo forçar via parâmetro explícito.
É o mesmo formato de `acharVitrinesVencidas`, então não inventa padrão novo.

### 5.2 Fechar a geração sob demanda vale para produção ou só para a demo?

Fechada, quem abre uma PDP em contexto não aquecido **nunca** vê a section.
Aceitável num hackathon com roteiro conhecido; discutível num site real, onde o
visitante não está na lista.

Uma saída intermediária, se a resposta for "produção também": manter sob demanda
apenas para quem está logado, que é o público declarado da feature pela regra 10
do §7 de [`agente-de-combinacoes.md`](agente-de-combinacoes.md).

### 5.3 O `look:warm` ganha `--email`/`--cidade` agora?

**Recomendação: sim, e primeiro.** É pré-requisito do cron (§3), rende sozinho
antes dele, e é a única parte deste documento que já estava escrita como pendência
no próprio código.

---

## 6. Ordem sugerida

1. `--email` / `--cidade` no `look:warm` — desbloqueia todo o resto
2. O JSON do roteiro
3. A rota protegida + `npm run look:cron`
4. `crons` no `vercel.json`
5. A flag que fecha a porta
6. `waitUntil`, se a medição do passo 3 mostrar corte

Os passos 1 e 2 têm valor mesmo que o cron nunca entre: com eles, aquecer o
roteiro antes da demo passa a ser um comando, e não um roteiro manual de abrir
PDPs logado como cada persona.
