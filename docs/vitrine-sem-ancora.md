# A vitrine sem âncora

> **Desenho, não implementação.** Tira o produto do centro da recomendação e põe
> a pessoa. O agente deixa de completar um look em volta de uma peça aberta e
> passa a montar uma vitrine de produtos recomendados a partir do que a pessoa é.
>
> Depende de `persona-do-guarda-roupa.md`, que já construiu metade disto sem
> saber.

---

## 1. Por que a ideia está certa, e o motivo é mais forte que "não queremos look"

**Todo agente deste repositório ancora.** Não é coincidência, é uma premissa que
nunca foi questionada:

| Agente | Âncora | O que devolve |
|---|---|---|
| `shelf` | o item esgotado do "avise-me" | substitutos + complementos |
| `look` | a peça aberta na PDP | a roupa em volta dela |

`shelf.candidates.ts:4` diz isso como decisão de produto: *"Aqui está a decisão
que define o produto: os candidatos vêm sempre ancorados"*.

A consequência é que **nada hoje responde "o que ESTA pessoa deveria ver?"**.
Todo caminho responde "o que combina com ISTO?". A pergunta da loja
personalizada nunca foi feita.

### E o argumento que fechou, mesmo tendo mudado de forma

Este desenho nasceu quando a geração seria por **cron**, e o argumento era: um
job das 3h não tem PDP aberta, então não existe âncora para ancorar — rodar o
agente atual por cron exigiria escolher uma peça do histórico e fingir que a
pessoa está olhando para ela.

**O cron caiu** (a #30 mostrou que o problema não era falta de relógio, era a
chave do cache mudando a cada pageview), mas o argumento sobrevive intacto numa
forma mais forte: se a recomendação é sobre a PESSOA, ela não pode depender de
qual peça ela abriu por último. A âncora era um acidente do caminho, não um
requisito da pergunta.

---

## 2. Metade já está pronta

A #26 construiu a persona: o modelo lê **todos** os sinais da pessoa e devolve um
retrato com eixos e evidência. Três propriedades dela foram desenhadas para o
look e servem melhor aqui:

- **É por pessoa, não por peça aberta.** A chave é `hashDosSinais` — o hash não
  tem âncora dentro. Já é a chave certa para uma vitrine.
- **Não tem identidade.** Duas pessoas com o mesmo armário compartilham o
  retrato. Duas pessoas com o mesmo armário pagam uma síntese só.
- **Carrega `evidencia`** — os títulos das peças que sustentam cada eixo. É o que
  vai permitir o motivo continuar concreto **sem âncora para citar**.

Aquele último ponto é o que salva a feature. Hoje o motivo diz *"fecha com o
cardigã que você comprou"* porque existe uma peça aberta para relacionar. Sem
âncora, o motivo teria virado generalidade — se não fosse a evidência da persona
dar peças reais para citar.

---

## 3. A pergunta difícil: qual é o pool sem âncora?

É a única coisa que a ideia esconde. Hoje o pool sai de
`findComplementsAvailable(variantId)` — 30 do banco, cortados para 18. Tudo
ancorado. Sem âncora, `variantId` não existe e o pool não tem de onde sair.

Três saídas possíveis, e **a medição resolve a discussão**:

```
produtos disponíveis: 127

catálogo INTEIRO, formato de hoje   ~ 10.279 tokens
catálogo INTEIRO, sem descrição     ~  4.712 tokens
os 18 candidatos de hoje            ~  1.496 tokens
```

**O catálogo inteiro cabe.** Sem descrição são ~4.7k tokens, cerca de 3× o
prompt atual — e o prompt atual já roda em background, sem ninguém esperando.

> **Medido depois de construído: ~8,7k tokens**, não 4,7k. A estimativa não
> contava as anotações por pessoa (`combinaComOGuardaRoupa`, `combinaComOQueQuer`,
> `jaTemDesteTipo`) nem as opções de variante, que juntas quase dobram o pool.
> Continua cabendo e continua rodando em background — mas o número certo é este.

Isso elimina a etapa que seria a mais arriscada de projetar: **não há critério de
pré-seleção para inventar.** Qualquer filtro em código antes do modelo seria o
código decidindo o que a pessoa pode ver, que é exatamente a classe de decisão
que a #26 tirou do código quando matou a tabela de pesos.

> **A regra 11 do §7 vale aqui inteira:** nenhuma tabela de pesos, nenhum número
> escolhido a olho. Se o catálogo cabe, mandar o catálogo é a única opção que não
> reintroduz um critério não medido.

A descrição sai do candidato porque é ela que triplica o custo (10.3k → 4.7k) e
é o campo que menos decide escolha — o modelo escolhe por tipo, tags e preço. Se
a descrição fizer falta, ela volta só para as peças escolhidas, numa segunda
passada barata.

**Quando o catálogo não couber mais**, a saída não é filtrar por regra: é dar ao
modelo o catálogo em duas etapas (ele pede o que quer ver), ou paginar por tipo.
Fica registrado para não ser reinventado sob pressão.

---

## 4. O que morre, o que sobrevive, o que muda de sentido

| | Hoje | Depois |
|---|---|---|
| `Ancora`, `acharAncora`, `buscarAncora` | a peça aberta | **morre** |
| `tagsEmComum` | tags em comum com a âncora | **morre** — não há contra o quê |
| `mesmaColecao` | mesma coleção da âncora | **morre** |
| `montarCandidatos(variantId, …)` | pool ancorado | vira `catalogoDisponivel()` |
| `looks.anchor_id` | parte da chave | **sai da chave** |
| `combinaComOGuardaRoupa` | tags que o candidato divide com o que a pessoa tem | **sobrevive e vira o sinal principal** |
| `jaTemDesteTipo` | freio: "não repita o tipo" | sobrevive como **fato**, não como freio — ver §5 |
| "não recomende peças parecidas" | 1ª linha do prompt | **morre** — proíbe o que agora se quer |
| "não empilhe intercambiáveis" | máx. 2 camadas, uma calça só | **morre** — lógica de look pura |
| `motivo` | relação com a âncora | relação com **a pessoa** |
| `ocasiao` | função no look (calça, calçado, camada) | **morre** — lista única, ver §5 |
| persona | entrada da composição | **entrada única** |

### O caso do `combinaComOGuardaRoupa` — o passo 0

Ele e calculado contra as sementes e era o segundo sinal, atras de `tagsEmComum`.
Sem ancora, **ele passa a ser o primeiro** — e o unico que relaciona candidato e
pessoa.

E ele esta quebrado. `comOGuardaRoupa` (`look.candidates.ts:237`) recebe
`contexto.sementes` **inteiro** e trata as quatro origens como posse:

| origem | o que e | e posse? |
|---|---|---|
| `purchased` | comprou | sim |
| `wishlist` | favoritou | **nao** — quer |
| `waited` | pediu avise-me | **nao** — espera |
| `recent` | viu numa PDP | **nao** — olhou |

O prompt promete o contrario, e nominalmente (`look.prompt.ts:117`):

> *"`combinaComOGuardaRoupa` -> tags que esta peca divide com o que a pessoa **JA
> TEM**. [...] **nao e "parece com o que ela olha"**, e "funciona com o que ela
> possui"."*

`recent` e literalmente "o que ela olha". O prompt antecipa o erro e o proibe; o
codigo o comete.

**Medido**, com uma pessoa que nao comprou nada — so viu um gorro e favoritou
uma jaqueta:

```
Winter Hat  [Beanie]     jaTemDesteTipo: Ribbed Beanie
Chambray Work Shirt      combinaComOGuardaRoupa: classic, layering
Eco Raglan Hoodie        combinaComOGuardaRoupa: basic, layering, winter
...10 candidatos marcados como "combina com o que ela ja tem"
```

Ela nao tem nada. O modelo recebe dez fatos falsos e e instruido a preferir os
candidatos por causa deles.

**Por que vira bloqueante aqui.** Hoje e um sinal entre varios, e `tagsEmComum`
carrega a decisao. Na vitrine sem ancora, `tagsEmComum` nao existe —
`combinaComOGuardaRoupa` e *o* eixo. Entrar com ele quebrado nao e herdar um
defeito: e construir a feature inteira sobre um fato falso.

Achado e documentado pelo @gustavobaltazar na #24.

---

## 5. A forma do resultado

```ts
interface Vitrine {
  titulo: string;
  confianca: number;
  /** Lista única, na ordem em que o agente acredita nelas. Sem agrupamento. */
  pecas: PecaRecomendada[];
}

interface PecaRecomendada {
  handle: string;
  /** Por que ESTA pessoa, não por que esta peça. */
  motivo: string;
  position: number;
}
```

### `ocasiao` morre, e a regra que ela demonstrava não

Decidido: **lista única**. O agrupamento por `ocasiao` existia porque um look tem
partes — calça, calçado, camada. Sem look, ele seria cerimônia herdada, e é mais
uma coisa que o modelo pode errar sem ganho.

Vale registrar o que se perde junto, para não parecer descuido: `ocasiao` era o
exemplo de referência da **regra da genericidade** — vocabulário do modelo, nunca
união de literais, o que mantém o sistema portátil para um catálogo que não seja
de roupa. A regra continua valendo e continua demonstrada: `EixoDaPersona.eixo`
é `string` pelo mesmo motivo e pelo mesmo argumento. O exemplo mudou de lugar,
não sumiu.

### Variedade NAO e requisito — e o prompt de hoje proibe o contrario

Oito camisetas e resultado valido. Oito tenis tambem. A vitrine recomenda
**produtos**, e se o que serve aquela pessoa sao oito camisetas, a vitrine sao
oito camisetas.

Isso separa esta feature da anterior, e o prompt atual diz o oposto **na primeira
linha**:

> *"Voce compoe. [...] montar a roupa inteira em volta dela: o que se veste
> junto, formando um conjunto que funciona.*
> *Voce nao recomenda pecas parecidas. **Outra camiseta nao completa uma
> camiseta.**"*

E uma secao inteira reforca:

> *"## NAO EMPILHE PECAS INTERCAMBIAVEIS — Um look e feito de pecas com FUNCOES
> diferentes [...] Escolha NO MAXIMO DOIS deles [...] O mesmo vale para baixo:
> uma calca basta."*

Essas duas passagens sao a definicao de "look" em texto. **Elas morrem**, nao sao
adaptadas — reescrever "no maximo dois casacos" para "no maximo tres" seria
manter a premissa e mexer no numero.

### O que sobra de `jaTemDesteTipo`

Ele **nao** vira guarda de variedade, porque variedade nao e objetivo. Sobra como
**fato sobre a pessoa**, util por outro motivo: recomendar a quarta calca preta
para quem ja tem tres e gastar a vaga com o que ela efetivamente ja tem.

A diferenca e quem decide. O prompt de hoje manda evitar (*"quem ja tem duas
calcas raramente precisa da terceira"*). O novo apenas informa — e se o retrato
disser que a pessoa acumula camisetas, acumular mais uma e a recomendacao certa.

**Consequencia:** some o unico freio estrutural contra monotonia, e isso e
deliberado. O que resta contra uma vitrine ruim e a persona; nao ha regra de
composicao para se apoiar.

### A chave: uma pessoa, um dia

```ts
export const chaveDoDia = (email: string, dia = diaDeHoje()): string =>
  fnv1a([email, dia].join("|"));
```

**Esta seção dizia `hashDosSinais(sementes)`, e estava errada.** A #30 achou o
defeito no `look` e ele valia aqui igual: as sementes incluem `recent`, que sai
do cookie `deco_recent` gravado a cada PDP aberta — então **abrir qualquer peça
mudava a chave da vitrine**, e a gravada virava inalcançável. A section apareceria
uma vez e sumiria.

Com cron seria pior: o job calcularia o hash de madrugada e a pessoa chegaria de
manhã com outro. A vitrine existiria no banco e nunca na tela.

**Sem cidade nem mês**, ao contrário da chave do look. Aquele compõe a partir do
clima; esta recomenda a partir de quem a pessoa é, e o prompt daqui não recebe
lugar nenhum — pôr cidade na chave recomporia por nada.

**Sem `"anon"`.** O look usa `email ?? "anon"` porque a âncora também está na
chave dele. Aqui não há âncora: um `"anon"` faria todos os visitantes deslogados
dividirem uma vitrine só — a recomendação de uma pessoa mostrada a outra, numa
feature cujo ponto é ser de alguém. **Sem sessão, o agente não é acionado.**

As sementes seguem indo ao prompt e à persona. O que mudou é *quando* a vitrine é
recomposta, não *com o quê*.

---

## 6. As três decisões, tomadas

### a) Este SUBSTITUI o `look`

Nenhum look é montado para ninguém. O produto é **recomendação de compra**, não
composição de roupa. `CompleteTheLook` e todo o eixo de "o que se veste junto"
saem do caminho.

O `shelf` fica: ele responde algo genuinamente diferente — *"o que comprar no
lugar do que faltou"* — e continua ancorado no desejo esgotado, que é a âncora
certa para aquela pergunta.

### b) Sem persona confiável, sem section

O contrato duro do `look` continua, e agora com um motivo melhor: **esta não é a
section principal do site.** É uma recomendação extra na home. Um buraco onde
ela estaria não quebra nada; uma vitrine genérica, sim — ela ocuparia o lugar da
prova de personalização com algo que qualquer loja tem.

Isso torna a persona o **portão da feature inteira**, não uma etapa dela:

```
sem sinais  →  sem persona  →  sem vitrine  →  a section não aparece
```

E tem uma consequência boa que não é óbvia: quando não há persona, **nem a
segunda chamada acontece**. O piso de confiança deixa de ser só qualidade e vira
economia — o caso "não dá para personalizar" custa uma leitura indexada, não uma
composição.

### c) Lista única

Decidido acima, na §5.

---

## 7. Riscos, ditos antes de codar

**Sem âncora, o modelo tem menos restrição — e restrição era o que segurava a
alucinação.** Hoje ele escolhe 5 a 10 entre 18 candidatos relacionados. Passará
a escolher entre 127 sem nada que o obrigue a se relacionar com coisa alguma. A
validação da etapa 3 continua impedindo handle inventado, mas não impede escolha
arbitrária — e "arbitrário" é indistinguível de "personalizado" na tela.

Mitigação: a persona é a restrição, e pela decisão (b) ela é também o portão —
sem retrato não há vitrine. **O piso de confiança passa a proteger a feature
inteira**, não só o retrato. Se ele estiver frouxo, o defeito não aparece como
persona ruim: aparece como vitrine aleatória com texto bonito, que é muito mais
difícil de reconhecer.

E nao ha rede de composicao embaixo. No `look`, um resultado ruim ainda era um
conjunto vestivel, porque as regras de funcao (uma calca, no maximo duas camadas)
impunham forma mesmo com escolha fraca. **Aqui nao existe forma imposta**: uma
vitrine ruim e indistinguivel de uma boa em estrutura, so em conteudo. A persona
e a unica coisa entre o catalogo e a tela.

**O `look:eval` não serve como está.** Ele mede estabilidade de composição em
volta de uma âncora. Sem âncora, as condições mudam de forma e a comparação com
as medições antigas deixa de valer — inclusive a de `medicao-baseline-cor.md`.

**Nada disto foi medido com modelo.** O provedor está sem token desde ontem. O
desenho é derivado do que já roda, não de observação nova.

---

## 8. Ordem de construção

Determinístico primeiro, modelo depois, tela por último — a mesma ordem que a
persona seguiu, e pelo mesmo motivo: cada peça é verificável sozinha, e a que
depende de token fica por último para não bloquear o resto.

| # | Peça | Onde | Depende de |
|---|---|---|---|
| 0 | **Consertar `comOGuardaRoupa`**: separar posse de desejo | `look.candidates.ts` | — |
| 1 | `Vitrine`, `PecaRecomendada` | `vitrine.types.ts` | — |
| 2 | `catalogoDisponivel()` — o pool sem âncora, sem descrição | `vitrine.candidates.ts` | — |
| 3 | Prompt da recomendação | `vitrine.prompt.ts` | 1, 2 |
| 4 | `recomendar(persona, candidatos)` + validação | `vitrine.agent.ts` | 3 |
| 5 | Tabela `vitrines` + leitura/escrita/quarentena | migration + `vitrine.d1.ts` | 1 |
| 6 | `vitrineDaPessoa()` — o portão da persona | `vitrine.actions.ts` | 4, 5 |
| 7 | Section de lista única + loader | `sections/`, `loaders/` | 6 |
| 8 | Aposentar o `look` | remover section, loader, bloco | 7 |

O **passo 0 vem antes de tudo** e não é opcional: `combinaComOGuardaRoupa` passa
de segundo sinal a eixo da feature, e ele hoje conta "favoritou" e "viu" como
posse. Entrar com ele quebrado é construir a vitrine inteira sobre um fato falso.

O **passo 8 fica por último** de propósito. Enquanto os dois convivem, dá para
comparar as saídas lado a lado com os mesmos sinais — que é a única forma de
saber se a troca melhorou alguma coisa antes de não haver mais volta.

### Não há cron

A geração é disparada pela própria requisição, sem `await`, e o que a torna
barata é a chave — uma por pessoa por dia. É a solução da #30.

```
vitrineDaPessoa(email)   lê pela chave do dia. No miss, dispara e devolve `null`
                         — a section aparece no carregamento seguinte.
gerarVitrine(email)      compõe e grava. 60-150s.
```

O `Set` de dedupe em voo e a quarentena **voltaram**, e vale dizer que voltaram:
o desenho anterior os dispensava porque o cron era o único a gerar. Sem cron, a
home volta a ser a origem das chamadas, e a chave diária reduz o volume — não a
concorrência dentro do mesmo dia.

A válvula, para quando a demo não puder esperar o dia virar:

```bash
npm run vitrine:refresh -- ana.escura@demo.local
```

> **Correção.** Uma versão anterior desta seção dizia para varrer
> `SELECT sinais_hash FROM personas` e passar o hash. **Não funciona:** o hash é
> via única, e as sementes que o geraram não estão guardadas em lugar nenhum —
> sem elas não há como calcular `combinaComOGuardaRoupa`, que é o eixo da
> recomendação. Se alguém começou contra aquele contrato, é aqui que a mudança
> mora.
