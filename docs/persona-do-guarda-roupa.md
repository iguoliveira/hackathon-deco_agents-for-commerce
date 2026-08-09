# A persona do guarda-roupa

> **Desenho, não implementação.** Substitui a pesagem de sementes por uma
> síntese que o próprio modelo faz — e que fica do lado do **fato observado**,
> nunca do gosto inferido.
>
> Depende de `anatomia-do-agente.md`, que descreve o pipeline atual e de onde
> saem os números de custo citados aqui.

---

## 1. O que muda

**Hoje**, as sementes disputam seis vagas por uma tabela de pesos:

```ts
const FORCA = { purchased: 4, waited: 3, wishlist: 2, recent: 1 };
```

Esses números nunca foram medidos. Eles respondem a uma pergunta de
**truncamento** — *quais sinais cabem no prompt?* — e não a uma pergunta de
recomendação. Quem tem quatro compras e três "avise-me" enche as seis vagas
antes de qualquer favorito chegar, e ninguém sabe se isso produz look melhor.

**Proposta:** o modelo recebe **todos** os sinais e sintetiza um retrato do
guarda-roupa. A composição passa a partir desse retrato.

```
hoje    4 fontes → consolidar(peso, recência) → 6 sementes → compor
depois  4 fontes → TODOS os sinais → PERSONA → compor
```

A tabela de pesos **desaparece do código**. O que cada tipo de sinal significa
já está escrito no prompt (*comprou* é posse, *favoritou* é desejo declarado,
*viu* é fraco), e é o modelo que decide quanto isso pesa — com o contexto todo
na frente, em vez de um número fixo decidido uma vez.

---

## 2. A regra que dá forma ao desenho

`look.prompt.ts:183` proíbe, hoje, exatamente o que uma "persona" costuma ser:

> *"Que alguém tenha comprado três peças pretas não prova que goste de preto —
> pode ser básico, presente, ou a única cor que havia."*
>
> ❌ *"Você prefere neutros"* · ❌ *"Do seu estilo"*

A regra entrou com medição: `black` é a segunda tag de cor mais frequente do
catálogo. Se quase todo mundo compra preto porque preto é o que mais existe,
"você prefere preto" é quase vazio.

**A persona não reverte isso. Ela obedece.**

| ❌ Persona de preferência | ✅ Persona de guarda-roupa |
|---|---|
| "Prefere neutros" | "Guarda-roupa concentrado em preto e cinza" |
| "Estilo streetwear" | "Caimento solto em quatro das seis peças" |
| "Gosta de algodão" | "Algodão em tudo que comprou" |

A diferença não é de estilo de texto: a coluna da direita é **verificável** e a
da esquerda não. E o motivo que chega à tela continua auditável — *"combina com
as peças escuras que você já tem"* aponta para peças que existem.

---

## 3. A forma da persona

```ts
interface EixoDaPersona {
  /** Como o modelo chamou o eixo. `string`, nunca união de literais. */
  eixo: string;
  /** O que ele observou nesse eixo. */
  valor: string;
  /** Os títulos das peças que sustentam a afirmação. É o que a torna fato. */
  evidencia: string[];
}

interface Persona {
  eixos: EixoDaPersona[];
  /** Abaixo do piso, não há persona — o look compõe sem ela. */
  confianca: number;
}
```

### Por que `eixo` é `string`

Pela mesma razão que `ocasiao` é. Fixar `{ cor, tom, modelo, tipo, estilo }`
cravaria vocabulário de moda no domínio e violaria a regra 4 — a que já foi
defendida contra o clima (`estacao: "inverno" | "verao"`) e contra os tamanhos
(`Size`).

Com o eixo livre, o mesmo código num catálogo de vinho emite
`{"eixo": "corpo", "valor": "encorpados", "evidencia": [...]}` sem uma edição.

### Por que `evidencia` não é opcional

Ela é o que separa esta persona da que a regra proíbe. Um eixo sem evidência é
uma opinião sobre a pessoa; com evidência, é uma descrição do que ela tem. E ela
resolve um problema prático: **é dela que sai a citação concreta no motivo**.
Sem isso, a composição perderia o *"o cardigã que você comprou"* e ficaria só
com generalidades.

---

## 4. Duas passadas, e por quê

```
passada 1  TODOS os sinais            →  persona     (sumarizar)
passada 2  persona + âncora + pool    →  look        (compor)
```

**O teto de seis deixa de existir**, e isso resolve uma tensão que estava
escondida. O comentário do teto diz:

> *"acima disso o modelo começa a compor 'para todo mundo' — dez sinais de tipos
> diferentes descrevem um guarda-roupa, não uma pessoa montando uma roupa"*

Repare que o problema é **de composição**. Para sintetizar, descrever o
guarda-roupa é exatamente o objetivo. Separando as tarefas, cada uma recebe o
que precisa: a passada 1 quer o armário inteiro, a passada 2 quer um retrato
compacto.

### A persona é por pessoa, não por peça aberta

É a consequência mais importante do desenho, e ela **reduz** trabalho.

Hoje, as sementes são reprocessadas e reenviadas ao modelo **a cada PDP**. Uma
persona serve para todas as peças que aquela pessoa abrir — deriva uma vez,
reusa em todas.

**Chave de cache: o hash dos sinais, sem identidade.** Duas pessoas com o mesmo
guarda-roupa compartilham a persona, o que é inócuo (ela é derivada só daqueles
sinais, e não há nada de uma pessoa que a outra já não tenha) e faz o cache
esquentar mais rápido. Quando um sinal muda, o hash muda, e a persona é
rederivada — mesma mecânica de `looks`.

---

## 5. Custo

Com os números medidos em `anatomia-do-agente.md` §5:

| | Hoje | Com persona |
|---|---|---|
| Sinais no prompt de composição | 6 sementes, ~132 tok | persona, ~150 tok |
| Chamadas por PDP aberta | 1 | 1 |
| Chamadas por **pessoa** | — | +1, amortizada em todas as PDPs dela |

A passada 1 custa mais que uma semente por sinal (~22 tok cada), mas roda **uma
vez por conjunto de sinais**, não uma vez por peça. Alguém que abre cinco
produtos hoje paga cinco vezes pelo reenvio das sementes; com persona, paga uma
vez pela síntese e cinco vezes por um retrato menor.

**O empate acontece na segunda PDP.** A partir da terceira, é economia.

---

## 6. O que precisa ser construído

| # | Peça | Onde |
|---|---|---|
| 1 | `Persona`, `EixoDaPersona` | `look.types.ts` |
| 2 | Prompt da síntese | `persona.prompt.ts` |
| 3 | `derivarPersona(sinais)` | `persona.agent.ts` — reusa `perguntar` e `extrairJson` |
| 4 | Tabela `personas` + `lerPersona`/`gravarPersona` | migration + `look.d1.ts` |
| 5 | `colherSementes` sem teto e sem `FORCA` | `look.seeds.ts` |
| 6 | A persona entra em `montarMensagem` no lugar das sementes | `look.prompt.ts` |

### A tabela

```sql
CREATE TABLE IF NOT EXISTS personas (
  sinais_hash  TEXT PRIMARY KEY,
  eixos        TEXT NOT NULL,   -- JSON, blob opaco: lido inteiro, nunca filtrado
  confianca    REAL NOT NULL,
  origem       TEXT NOT NULL,   -- 'agente' | 'falha'
  generated_at TEXT NOT NULL
);
```

Segue as decisões que `looks` já pagou: JSON em `TEXT` porque é blob opaco, sem
`FOREIGN KEY` para `products` (as migrations de seed apagam o catálogo), e
**marcador de falha com quarentena** — a lição da #20, que custou uma
indisponibilidade para ser aprendida. Sem ela, uma persona que não converge
vira o mesmo laço de pageview.

---

## 7. Riscos, ditos antes de codar

**Uma persona ruim envenena mais que uma semente ruim.** Hoje, um sinal
estranho é um entre seis e o modelo o ignora. Uma persona errada fica **a
montante de tudo** e afeta todos os looks daquela pessoa até os sinais mudarem.
Mitigação: `confianca` com piso, e ausência de persona é caminho válido — o look
compõe sem ela, como faz hoje para o visitante sem histórico.

**A cadeia fica mais longa para depurar.** Hoje, um motivo estranho se explica
olhando as seis sementes. Com persona, é preciso olhar a persona **e** os sinais
que a geraram. Mitigação: `evidencia` em cada eixo — ela é o rastro.

**Duas chamadas para quem chega sem cache.** A primeira visita de uma pessoa
nova precisa de persona *e* look. Como as duas já rodam em background e a
section só aparece na visita seguinte, isso não piora o que o usuário vê — mas
dobra o tempo até a section existir.

**Não sabemos se melhora.** É o risco honesto. A pesagem nunca foi medida, e a
persona também não será até rodar no `look:eval` — que hoje está bloqueado pelo
provedor sem tokens.

---

## 8. Como medir quando der

O `look:eval` já tem as quatro condições e o `--comparar`. O experimento:

```bash
npm run look:eval -- --rotulo pesagem  --n 3
npm run look:eval -- --rotulo persona  --n 3
npm run look:eval -- --comparar pesagem persona
```

O número que decide **não** é "mudou": é a **estabilidade**. Se o núcleo estável
de peças subir com a persona, ela está dando ao modelo um sinal mais firme que
seis itens soltos. Se cair, a síntese está adicionando ruído — e a pesagem, por
mais arbitrária que seja, estava fazendo um trabalho.

E há um número que só o olho dá: **os motivos continuam citando peças reais?**
Se a persona fizer o texto virar generalidade, ela falhou mesmo com estabilidade
alta.
