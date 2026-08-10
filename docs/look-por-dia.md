# Um look por dia — por que o cron não era a peça certa

O objetivo: **o agente para de ser chamado a cada exibição de peça.** Uma
composição por dia basta, e a demo precisa de um jeito de forçar quando quiser.

A primeira versão deste documento propunha um cron de 24h. **Estava errado** — não
no diagnóstico, mas na conclusão. O que faltava não era um relógio; era parar de
deixar a chave do cache mudar sozinha.

---

## 1. O que estava acontecendo

`lookDaPeca` guarda o look sob uma chave, e procura por ela na visita seguinte.
Enquanto essa chave incluía as **sementes**, ela mudava a cada pageview:

- `marcarVisita` grava a peça aberta em `deco_recent` — **depois** de compor;
- `colherSementes` lê esse cookie;
- a chave incluía as sementes.

Logo:

| | Sementes | Chave | O que acontecia |
|---|---|---|---|
| 1ª visita à calça | `[]` | H1 | miss → **gera** · grava `calça` no cookie |
| refresh | `[calça]` | H2 | **miss → gera de novo** |
| refresh | `[calça]` | H2 | hit |
| abre o boné | `[calça]` | H3 | miss → gera |
| volta à calça | `[boné, calça]` | H4 | **miss → gera de novo** |

O segundo acesso a qualquer peça errava o cache **sempre**, porque a primeira
visita alterava o contexto depois de compor. Passar por N peças produzia da ordem
de N² gerações de ~80s.

Nada disso lançava, nada aparecia no `typecheck`. O diagnóstico já estava escrito
em `look.d1.ts:451`, como furo que a quarentena por peça contornava sem resolver:

> *"quem navega gera um contexto NOVO a cada página. Um par novo nunca teve
> marcador, e a quarentena não errava: ela simplesmente **nunca era consultada**."*

E a saída também já estava nomeada lá, adiada por ser decisão de produto:

> *"A alternativa sugerida na revisão — tirar `recent` do hash — também fecharia o
> furo, mas ao preço de servir a uma pessoa um look composto a partir das peças
> que outra viu. Isso é decisão de produto, não conserto de laço."*

Esta PR é essa decisão de produto sendo tomada.

---

## 2. A mudança

A chave passa a ser **(peça, pessoa, lugar, dia)**:

```ts
export const chaveDoDia = (email: string | null, local: Local, dia = diaDeHoje()): string =>
  fnv1a([email ?? "anon", dia, local.cidade, local.regiao, local.pais].join("|"));
```

As sementes saem da chave. Elas **continuam indo ao prompt e à persona** — o que
mudou é *quando* o look é recomposto, não com o quê.

O dia substitui as sementes como sinal de "isto envelheceu". Uma peça compõe uma
vez por dia por pessoa, e o resultado serve refresh, navegação e volta à mesma
PDP. À meia-noite UTC a chave vira sozinha: **sem cron, sem coluna de TTL e sem
job de limpeza** — o registro velho simplesmente deixa de ser procurado.

`mes` saiu porque o dia já o contém. `local.origem` ficou de fora de propósito:
ela distingue "o geo adivinhou" de "a pessoa escolheu no seletor", que é
procedência para a tela e não parte de onde ela está — se entrasse, reescolher a
**mesma** cidade no seletor recomporia o look.

## 2b. Sem sessão, o agente não é acionado

Achado abrindo a home deslogado durante o teste: **toda visita anônima disparava
uma composição.** Duas chaves novas apareceram no banco em 33 segundos, uma antes
de a sessão completar e outra depois.

A chave diária não protege disso. Ela garante uma composição por pessoa por dia —
e o visitante anônimo é **sempre outro**. Numa section que vive na home, isso é
bot, preview de link, health check e aba esquecida aberta, cada um custando ~80s
de modelo.

O guarda é uma linha em `lookDaPeca`, depois do cache miss:

```ts
if (!email) return null;
```

Não é economia de token: é a **regra 10 do §7** — o público é o usuário logado, e
sem identidade não há armário. O que sairia é um look montado a partir de nada,
que é o carrossel de relacionados que esta feature existe para contradizer.

**A leitura continua livre, e a assimetria é deliberada.** O `lerLook` roda
antes: um look aquecido aparece para quem não entrou — a home pública mostra a
feature — e ninguém anônimo paga por gerá-lo. Quem aquece é o `look:refresh`, que
é sempre gesto explícito de quem sabe o que está pedindo, e por isso continua
funcionando sem sessão.

### O que se ganha

| | antes | agora |
|---|---|---|
| Refresh | gera na 2ª vez | grátis |
| Navegar N peças | ~N² gerações | N gerações, uma por peça |
| Voltar a uma PDP | gera de novo | grátis |
| Dia seguinte | nunca expirava | recompõe uma vez |

### O que se perde, e é real

**Favoritar algo às 14h não muda o look até amanhã.** O armário entra na
composição, mas só na próxima vez que ela acontecer.

Isso importa especialmente para a demo da wishlist, que a #24 acabou de trazer:
mostrar o favorito mudando o look exige recompor no mesmo dia. É o que o
`look:refresh` existe para fazer.

---

## 3. `npm run look:refresh`

```bash
npm run look:refresh -- retro-code-tee --email 123@gmail.com
npm run look:refresh -- retro-code-tee --email 123@gmail.com --cidade "Porto Alegre,RS,BR"
```

Recompõe a peça para hoje e sobrescreve a linha do dia (`gravarLook` faz UPSERT na
chave), então rodar duas vezes não acumula lixo. Não toca em outro dia nem em
outra pessoa.

**Ele aquece o par que a demo vai ler** — o que o `look:warm` não conseguia fazer.
Aquele script documentava o próprio defeito:

> *"o que este comando aquece é o par (peça, conta sem histórico) — que não é caso
> de uso desta feature"*, e *"imprime `✓ … aquecida` […] inclusive quando compôs
> para o contexto que ninguém vai usar"*.

A causa era a chave conter as sementes: aquecer para outra pessoa exigiria
reproduzir o armário dela inteiro, e do terminal `donoDaVitrine()` devolve `null`.
Com a chave sendo (pessoa, lugar, dia), **basta nomear a pessoa** — por isso
`aquecerLook` ganhou `email` e `local` explícitos.

---

## 4. Por que não o cron

O cron resolveria "limitar chamadas por tempo". O problema real era "a chave muda
sozinha a cada pageview" — e um cron ao lado disso não teria segurado nada: as
gerações continuariam nascendo no clique, e ele acrescentaria mais.

Fica registrado o que a versão anterior propunha, caso o problema volte por outro
caminho: fechar a geração sob demanda por flag, uma rota protegida por segredo,
`crons` no `vercel.json` (1×/dia é o limite do plano Hobby) e um JSON de roteiro.
São quatro peças novas de infraestrutura. A chave do dia resolve o mesmo objetivo
com uma função e um script — e sem nada que possa estar fora do ar às 3h.

`acharVitrinesVencidas` no `shelf` continua sem ninguém que a execute. Se um cron
entrar algum dia, é por aquele domínio que ele começa, não por este.

---

## 5. Verificado

Seis asserções novas no `look:check`, bloco **7b** — o bug antigo não era pego por
nenhuma:

```
✓ duas chamadas seguidas dão a mesma chave
✓ e depende dos VALORES, não da identidade do objeto de lugar
✓ e a origem do lugar não entra na chave
✓ pessoas diferentes não dividem look
✓ cidades diferentes não dividem look
✓ amanhã é outra chave — é o que faz o look ser diário
✓ sem sessão todo mundo cai na mesma chave
```

`look:check` **58/58** · `typecheck` sem erro novo (fica o pré-existente de
`scripts/serve.ts`).

O `look:refresh` foi exercitado contra o Decopilot real: `vintage-wash-tee`
recomposta em 44.1s, 6 peças, e o `look:check` passou a achar a linha em seguida —
que é a prova de que a chave gravada é a mesma que a PDP procura.

---

## 6. Uma consequência a observar

**O cache existente ficou órfão.** Os 49 looks gravados sob a chave antiga não são
mais procurados; nada quebra, mas a primeira visita a cada peça recompõe. Se isso
incomodar antes da demo, `look:refresh` com a lista do roteiro resolve em um
comando.

**`scripts/db-snapshot.ts` reimplementa a chave antiga** para preservar looks
anônimos no snapshot (`hashSemSementes`, linha 84). Ele não quebra — passa a
preservar linhas que ninguém lê. Vale alinhar quando alguém mexer naquele script;
não fiz aqui para não misturar assuntos numa PR que já muda o cache.
