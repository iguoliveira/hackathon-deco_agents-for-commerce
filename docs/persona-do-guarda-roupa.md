# A persona do guarda-roupa

> **Implementado, não medido.** Substitui a pesagem de sementes por uma síntese
> que o próprio modelo faz — e que fica do lado do **fato observado**, nunca do
> gosto inferido.
>
> As seis peças do §6 estão no código e a `0019` está aplicada. O que **não**
> existe é evidência de que o retrato é melhor que a pesagem: o provedor está sem
> token, então nenhuma síntese real rodou. O §8 diz como medir quando der.
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

### O que a implementação descobriu: `FORCA` tinha dois empregos

Tirar a tabela expôs uma pergunta que ela vinha respondendo em silêncio. Além de
ordenar as seis vagas, ela **desempatava a mesma peça chegando por dois
caminhos** — favoritar e depois comprar é o percurso normal, não a exceção — e
esse desempate não some junto com o teto.

A saída não foi um critério de desempate melhor. Foi parar de desempatar:

```ts
kind:  SeedKind      →   kinds: SeedKind[]     // "comprou E já tinha favoritado"
```

Guardar as duas origens dissolve a pergunta em vez de respondê-la, e o que se
ganha é informação que **existia e estava sendo jogada fora**. As tags se unem
pelo mesmo motivo prático: um "avise-me" chega sem tags (`findWaitedItems` não as
carrega) e a mesma peça vinda de uma compra chega com elas.

E fecha um bug real que a versão anterior tinha. `look.agent.ts` exclui dos
candidatos o que a pessoa já comprou; com um `kind` só, uma compra **sombreada
por um `recent` mais novo** desaparecia, e a peça voltava a ser recomendada —
desfazendo exatamente o que o commit *"não recomendar o que a pessoa já
comprou"* tinha consertado. A união torna isso impossível por construção.

A ordenação que sobrou é **cronológica, não hierárquica**: o mais recente
primeiro, que é fato sobre os sinais e não julgamento sobre eles.

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

## 6. O que foi construído

| # | Peça | Onde | |
|---|---|---|---|
| 1 | `Persona`, `EixoDaPersona`, `Contexto.persona` | `look.types.ts` | ✅ |
| 2 | Prompt da síntese | `persona.prompt.ts` | ✅ |
| 3 | `derivarPersona` + `validarPersona` + `obterPersona` | `persona.agent.ts` | ✅ |
| 4 | Tabela `personas` + leitura, escrita e quarentena | `0019` + `look.d1.ts` | ✅ |
| 5 | `colherSementes` sem teto e sem `FORCA` | `look.seeds.ts` | ✅ |
| 6 | A persona entra em `montarMensagem` **no lugar** das sementes | `look.prompt.ts` | ✅ |
| + | `fnv1a` / `hashDosSinais`, para os dois hashes não divergirem | `look.hash.ts` | ✅ |
| + | `--persona` no `look:eval`, sem o qual o §8 não mede nada | `scripts/look-eval.ts` | ✅ |

### Onde a passada 1 roda

Em `gerarLook`, que é o caminho de **background** — `lookDaPeca` devolve `null`
na hora e nunca espera modelo. É sequencial (a composição precisa da persona para
montar o prompt, então não há o que paralelizar) e soma ~40s ao que já eram ~40s,
em quem não está olhando a tela. Da segunda PDP em diante a persona vem do cache
e a linha vira uma leitura indexada.

`obterPersona` é o único ponto de entrada de produção, e as três guardas estão
nesta ordem por um motivo: **cache** primeiro (caminho quente, uma leitura
indexada), **quarentena** depois (só interessa quando não há persona boa), e a
**síntese** por último, porque é a que custa 22-41s.

### A persona substitui as sementes, não se soma a elas

Os dois formatos no mesmo prompt empilhariam a mesma informação duas vezes e
tornariam a comparação do §8 inconclusiva — qualquer diferença seria atribuível
ao tamanho do prompt tanto quanto à síntese.

Cair nas sementes **não é degradação**: é o comportamento de hoje, e ele continua
correto para quem não tem persona (visitante novo) ou teve a síntese recusada.

### O que a `evidencia` faz em runtime

`validarPersona` descarta **o eixo inteiro** quando um título citado não está
entre os sinais recebidos, e descarta em vez de consertar. Casar por proximidade
(*"Pleated Chino"* ≈ *"Pleated Chinos"*) seria adivinhar qual peça o modelo quis
dizer, que é o erro que a validação existe para impedir. Um eixo que perdeu
metade da evidência é uma afirmação que perdeu metade do apoio.

### A tabela

```sql
CREATE TABLE IF NOT EXISTS personas (
  sinais_hash  TEXT PRIMARY KEY,  -- sem identidade: ver §4
  eixos        TEXT NOT NULL,     -- JSON, blob opaco: lido inteiro, nunca filtrado
  confianca    REAL NOT NULL DEFAULT 0,
  origem       TEXT NOT NULL,     -- 'agente' | 'falha'
  motivo       TEXT,              -- preenchido quando origem = 'falha'
  generated_at TEXT NOT NULL
);
```

Segue as decisões que `looks` já pagou: JSON em `TEXT` porque é blob opaco, sem
`FOREIGN KEY` para `products` (as migrations de seed apagam o catálogo), e
**marcador de falha com quarentena** — a lição da #20, que custou uma
indisponibilidade para ser aprendida. Sem ela, uma persona que não converge
vira o mesmo laço de pageview, e aqui pior que em `looks`: a síntese fica a
montante de **todas** as peças, então um provedor saturado receberia uma chamada
nova por PDP aberta, de toda pessoa que tenha sinais.

Duas diferenças para o marcador de `looks`, e as duas são simplificações:

- **Não há chave reservada a inventar.** O `HASH_DA_FALHA = "__falha__"` existe
  lá porque a chave é composta e o marcador é por peça; aqui ele ocupa a própria
  chave dos sinais, e `origem` sozinha o distingue.
- **`lerPersona` ignora tudo que não seja `'agente'`**, exatamente como `lerLook`.
  É o que torna seguro o marcador morar na mesma tabela: quem consome nunca
  aprende um terceiro estado, só persona ou nada.

O `WHERE personas.origem <> 'agente'` no UPSERT da falha impede que uma síntese
que falhou **apague** uma persona boa já gravada.

---

## 7. Riscos, ditos antes de codar (e o que a implementação fez com eles)

**Uma persona ruim envenena mais que uma semente ruim.** Hoje, um sinal
estranho é um entre seis e o modelo o ignora. Uma persona errada fica **a
montante de tudo** e afeta todos os looks daquela pessoa até os sinais mudarem.
Mitigação: `confianca` com piso, e ausência de persona é caminho válido — o look
compõe sem ela, como faz hoje para o visitante sem histórico. **Feito**, e com
duas guardas em vez de uma: `PISO_DA_PERSONA = 0.5` derruba o retrato inteiro,
e `validarPersona` derruba eixo por eixo quando a evidência não confere. Um
retrato pode chegar com confiança 0.9 e ainda assim ser descartado por sobrar
menos de dois eixos válidos.

**A cadeia fica mais longa para depurar.** Hoje, um motivo estranho se explica
olhando as seis sementes. Com persona, é preciso olhar a persona **e** os sinais
que a geraram. Mitigação: `evidencia` em cada eixo — ela é o rastro. **Feito**,
e ela é persistida junto (`personas.eixos` guarda o JSON inteiro), então o rastro
sobrevive à requisição que o gerou. O `--persona` do `look:eval` imprime os eixos
antes de cada condição pelo mesmo motivo.

**Duas chamadas para quem chega sem cache.** A primeira visita de uma pessoa
nova precisa de persona *e* look. Como as duas já rodam em background e a
section só aparece na visita seguinte, isso não piora o que o usuário vê — mas
dobra o tempo até a section existir. **Confirmado, e é o que o código faz**: as
duas passadas são sequenciais dentro de `gerarLook`, porque a composição precisa
da persona para montar o prompt. Quem paga é o `look:warm` do roteiro da demo.

**Um risco novo, que só apareceu ao codar: a quarentena tinha de ser por sinais,
não por pessoa.** O marcador de `looks` é por peça; se este fosse por identidade,
o visitante anônimo — que não tem identidade — nunca seria protegido, e é
justamente ele que gera mais tráfego. Por hash dos sinais, o anônimo entra na
mesma quarentena que todo mundo.

**Não sabemos se melhora.** É o risco honesto. A pesagem nunca foi medida, e a
persona também não será até rodar no `look:eval` — que hoje está bloqueado pelo
provedor sem tokens.

---

## 8. Como medir quando der

O `look:eval` já tem as quatro condições e o `--comparar`. O experimento:

```bash
npm run look:eval -- --rotulo pesagem --n 3              # sem o flag: sementes
npm run look:eval -- --rotulo persona --n 3 --persona    # com a passada 1
npm run look:eval -- --comparar pesagem persona
```

**Sem `--persona` as duas rodadas são idênticas.** O script chama `comporLook`
direto, e não `gerarLook`, então a síntese não entraria sozinha — a comparação
seria da pesagem contra ela mesma, e ela pareceria funcionar. O flag usa
`obterPersona`, não `derivarPersona`, de propósito: a persona fica em cache pelo
hash dos sinais, então as N repetições de uma condição pagam **uma** chamada. O
que se mede é a estabilidade da *composição* sob a mesma persona, não a
estabilidade da síntese.

Repare que a linha `persona:` impressa antes de cada condição pode dizer
`NENHUMA` — e aí aquela condição rodou pelas sementes. Uma comparação em que
metade das condições caiu para as sementes não mede o que o rótulo diz.

O número que decide **não** é "mudou": é a **estabilidade**. Se o núcleo estável
de peças subir com a persona, ela está dando ao modelo um sinal mais firme que
seis itens soltos. Se cair, a síntese está adicionando ruído — e a pesagem, por
mais arbitrária que seja, estava fazendo um trabalho.

E há um número que só o olho dá: **os motivos continuam citando peças reais?**
Se a persona fizer o texto virar generalidade, ela falhou mesmo com estabilidade
alta.

---

## 9. O que foi verificado sem um único token

Nenhuma síntese real rodou, então **nada aqui é evidência de que a persona
recomenda melhor**. O que dá para provar sem o provedor é o contrato, e ele foi
provado — a parte pura do desenho existe justamente para isso.

### `npm run look:check` — 45 asserções, todas verdes

A seção 8 do script é nova e não toca em modelo nem em rede:

| O que se afirma | Por que importa |
|---|---|
| eixo com evidência real sobrevive | o caminho feliz existe |
| eixo **sem evidência nenhuma** é descartado | *"estilo: minimalista"* é opinião sobre a pessoa |
| evidência **inventada** é descartada | alucinação com aparência de fundamento |
| evidência **parcialmente** inventada derruba o eixo inteiro | meia prova não é prova |
| eixo repetido não entra duas vezes | o segundo apareceria como observação nova |
| lixo no lugar dos eixos vira lista vazia | nada lança |
| o hash dos sinais **não depende da ordem** | senão a mesma pessoa sintetiza a cada pageview |
| mas **muda** quando um sinal novo chega na mesma peça | comprar o que era favorito é outro armário |
| o prompt da síntese não carrega `productGroupId` | id no prompt é convite para o modelo devolver um |

### O round-trip da tabela, contra o Postgres de verdade

Gravar → ler → conferir que a `evidencia` sobrevive ao JSON e a `confianca` ao
`REAL`; UPSERT idempotente; e as três propriedades da quarentena: uma falha
**entra**, ela **nunca vira persona na tela** (`lerPersona` a ignora), e uma
falha **não apaga** uma persona boa já gravada. Tudo verde, e as linhas de teste
foram removidas depois.

### O caminho de falha, ponta a ponta, de graça

Com o provedor sem token, `look:eval --persona` exercita exatamente a degradação
que interessa:

```
[persona] sem retrato — modelo indisponível ou com erro
    persona: NENHUMA — esta condição rodou pelas sementes
```

E na segunda execução, a prova de que a quarentena fecha o laço — a síntese
sequer é tentada:

```
[persona] gwiew7 em quarentena — compondo sem retrato
```

**Isto é o teste mais valioso que o provedor caído permitiu**, e ele não seria
fácil de montar de propósito: o modo de falha mais caro desta feature é
justamente "o provedor está fora e o sistema responde gerando mais carga".

### O que continua sem prova

- **Se o retrato é bom.** Só o §8 responde.
- **Se os motivos continuam citando peças reais** em vez de virar generalidade.
  Nenhuma asserção pega isso; é olho humano lendo a tela.
- **O build completo.** `npm run build` precisa de `bun`, que não está instalado
  nesta máquina. O `tsc --noEmit` passa (o único erro é o pré-existente de
  `Image.tsx`), e nenhum arquivo novo importa `node:crypto` — que é a armadilha
  específica que só o build do client pegaria.
