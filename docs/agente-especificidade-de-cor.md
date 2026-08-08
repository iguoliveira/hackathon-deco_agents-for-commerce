# A paleta da pessoa — plano

> **Status: plano em análise. Nenhum código escrito.**
> Parte de `main`, onde o domínio `src/platform/look/` já está desde a #12.

O agente já compõe a roupa em volta da peça aberta lendo o lugar e o mês. Este
plano acrescenta o eixo que falta: **a cor que a pessoa demonstra preferir**, e
com que grau de especificidade citá-la.

---

## 1. O achado que define a feature

Medido no banco, 135 produtos:

| Fonte da cor | Cobertura | Vocabulário |
|---|---|---|
| `variant_options` com `name='Color'` | **21 produtos (15%)** | 7 valores: `White`, `Black`, `DarkGreen`, `DarkYellow`, `DarkBlue`, `LightBlue`, `Gray` |
| Sufixo do título, depois de ` - ` | **104 produtos (77%)** | ~30 valores: `Cream`, `Olive`, `Tan`, `Navy`, `Sage`, `Charcoal`, `Wine`, `Ivory`, `Pastel`, `Floral`, `Multicolor`… |

**As duas fontes discordam, e a estruturada é a pior.** Ela cobre um sexto do
catálogo e usa nomes de sistema em camelCase que ninguém escreveria — e as cores
que de fato aparecem nos títulos (`Olive`, `Indigo`, `Cream`, `Tan`, `Navy`)
**não existem** como valor de `Color`.

Consequência direta: qualquer desenho que trate `variant_options` como a fonte
da verdade da cor funciona em 15% do catálogo e falha calado nos outros 85%.
A cor real deste catálogo mora no título.

Repare também que três dos valores mais frequentes — `Pastel`, `Floral`,
`Multicolor` — **não são cores**. São famílias e padrões. Um classificador em
código teria de decidir o que fazer com eles; um modelo já sabe.

## 2. A decisão de arquitetura

> **O código não sabe o que é "tom neutro". O agente sabe.**

É a mesma jogada do clima, e pela mesma razão. Assim como não existe tabela de
estação, **não deve existir lista de cores, mapa de famílias cromáticas, nem
`type Cor = "preto" | "branco" | ...`** em lugar nenhum.

Um `const NEUTROS = ["preto", "cinza", "bege"]` seria a forma mais silenciosa de
travar o sistema em moda para sempre — exatamente o que a §1 de
`personal-shopping-agent-mudancas.md` proíbe, e exatamente a regra que a #12
preservou no recurso mais tentador para violá-la. Trocar o catálogo por um de
vinho e a mesma linha precisa continuar produzindo *"você vem preferindo tintos
encorpados"* sem editar nada.

O plano, então, é: **mandar os títulos crus e deixar o modelo concluir a
paleta** — inclusive o quanto ela é específica.

## 3. O que já funciona hoje (e reduz muito o custo)

Antes de projetar campo novo, vale olhar o que já chega ao prompt:

- `montarMensagem` já envia o **título** de cada semente e de cada candidato.
- O título já carrega a cor em 77% dos casos (`"Heavyweight Boxy Tee - Black"`).
- Logo, **a informação de cor já está nos dois lados do prompt hoje.**

E o agente já a usa por conta própria. Dos dry runs rodados na revisão da #12:

> *"Mesma cor da camiseta e contraste de couro por cima do algodão."*
> *"Camada externa em preto para o frio de Porto Alegre."*

Isto muda a natureza do trabalho: **não é uma feature de dados, é uma feature de
instrução.** O que falta não é fazer a cor chegar — é pedir que ela seja lida
como preferência da pessoa, e não só como propriedade da peça.

Consequência prática boa: `hashDoContexto` **não precisa mudar**. As sementes já
entram na chave, então a paleta muda junto com elas e o cache continua correto
sem migration.

## 4. A dependência de dados — e por que ela NÃO é desta branch

Esta é a seção que faltava na primeira versão do plano, e ela quase inverteu a
conclusão. O estado real das quatro sementes, medido:

| Semente | Peso | Estado hoje |
|---|---|---|
| `purchased` (`orders`) | 4 | **0 registros.** A `0014` cria a tabela e não semeia nada |
| `waited` (`stock_alerts`) | 3 | 2 alertas / 2 e-mails = **1 semente por pessoa** |
| `wishlist` (cookie) | 2 | só existe se a pessoa favoritar |
| `recent` (cookie) | 1 | até **8** handles (`RECENT_MAX`), enche sozinho só de navegar |

### Densidade não é o mesmo que qualidade

A feature **não depende tecnicamente de `orders`** — três das quatro fontes
funcionam sem ela, sendo duas cookies de primeira parte que nem exigem login.
O problema é outro, e é pior.

**Paleta exige concordância entre várias peças.** Uma semente não revela
preferência de cor; duas peças pretas podem ser coincidência. São necessárias
**3 ou mais concordantes** para afirmar "prefere neutros escuros" sem inventar.

E aí a conta não fecha: a única fonte que hoje gera massa sozinha é `recent` —
que é justamente **a de pior qualidade para este fim**. Olhar não é preferir.
Quem abriu seis produtos de uma listagem viu o que a listagem ordenou, não o que
gosta. Inferir paleta daí produz uma afirmação confiante sobre um sinal que não
a sustenta.

### A diferença estrutural com o clima

O eixo do clima precisa de **zero** sementes: cidade e mês bastam, e é por isso
que ele funciona para visitante anônimo desde o primeiro acesso.

**Cor é o primeiro eixo que depende de densidade de histórico.** Os dois não têm
a mesma natureza, e tratá-los como se tivessem foi o erro da primeira versão
deste documento.

### A fronteira

**O seed do banco é de outra frente e não entra nesta branch.** Aqui não se
escreve migration de `orders`, não se semeia cor e não se mexe em dado de
catálogo. O que esta branch faz é deixar o agente **pronto para usar** esse
sinal quando ele existir, e **degradar com honestidade** enquanto não existe.

O que precisamos combinar com quem fizer o seed está na §8.

## 5. O silêncio é o caso comum, não a exceção

Consequência direta da §4, e a regra mais importante do desenho:

> Quando as sementes não concordam em cor, **o agente não cita paleta.**

O precedente existe e é do próprio prompt, na seção do clima:

> *"Se você não reconhecer a cidade, não invente clima: componha pela peça e
> pelas sementes, e não cite lugar nenhum."*

Com os dados de hoje — e provavelmente com os de amanhã, para visitante novo —
**o silêncio será o caminho mais percorrido**. A feature precisa ser escrita a
partir dele: o texto sobre paleta é o caso especial que exige prova, não o
padrão que às vezes falha.

Isso também protege a única coisa que esta feature tem a perder: um agente que
afirma preferência de cor errada soa pior do que um que não afirma nada.

## 6. O obstáculo real: a regra 3 do prompt

`look.prompt.ts` hoje diz:

> A cor de cada peça está no fim do título, depois do hífen. Só afirme que duas
> peças têm a mesma cor se as duas trouxerem a MESMA palavra ali. Não deduza cor
> da descrição.

Essa regra é **restritiva de propósito** — existe para impedir o modelo de
afirmar "moletom cinza" sobre uma peça azul. Ela foi paga com um erro real.

Mas ela colide de frente com o que esta feature quer: raciocinar sobre
*famílias* de cor exige justamente relacionar `Charcoal` com `Grey`, ou `Cream`
com `Ivory` — coisas que a regra 3 hoje proíbe.

**Esta é a decisão mais delicada do plano.** A saída provável é separar dois
atos que a regra hoje trata como um só:

- **Afirmar** a cor de uma peça específica → continua estrito, palavra por palavra.
- **Agrupar** cores para descrever uma preferência → passa a ser permitido, mas
  só sobre as sementes, nunca como afirmação sobre um candidato.

Escrever isso sem reabrir a porta da alucinação é o trabalho fino desta branch.

## 7. Precedência: a âncora manda

O look é composto em volta de uma peça que **já tem cor**. Se a pessoa prefere
tons terrosos e abriu uma peça vermelha, quem vence?

O precedente do clima já responde, e vale copiar a forma:

> *"Se a peça aberta desmentir o clima, componha para a peça mesmo assim: a
> pessoa a escolheu, e não cabe a você corrigir."*

A âncora é uma escolha deliberada de agora; a preferência é um histórico. **A
âncora vence, e a preferência entra como o critério de desempate entre
candidatos** — não como filtro.

Risco a vigiar: um agente que leve preferência longe demais devolve um look
monocromático, que é feio e é pior que o de hoje.

## 8. O que precisamos fazer

### Nesta branch

| # | Tarefa | Onde | Bloqueado? |
|---|---|---|---|
| 1 | **Baseline** — contar quantos motivos citam cor hoje, com sementes concordantes e dispersas | medição via `look:dryrun --semente` | não |
| 2 | Seção nova: **A PALETA DA PESSOA** | `look.prompt.ts` | não |
| 3 | Reescrever a regra 3 separando *afirmar* de *agrupar* (§6) | `look.prompt.ts` | não |
| 4 | Regra do silêncio como padrão (§5) | `look.prompt.ts` | não |
| 5 | Precedência âncora × preferência (§7) | `look.prompt.ts` | não |
| 6 | **Avaliação comparativa** — mesmo produto, mesma cidade, paletas opostas | `look:dryrun` | parcial (ver abaixo) |
| 7 | *(condicional)* cor derivada do título no `Candidato` | `look.candidates.ts` | não |

**Nada de 1 a 5 está bloqueado.** O `--semente <handle>` do dry run marca a peça
como `purchased`, então dá para exercitar o comportamento inteiro hoje, sem
tabela nenhuma. Iterar no prompt é trabalho disponível agora.

O que está bloqueado é **provar que funciona para uma pessoa real**: a tarefa 6
roda com sementes forjadas e valida a *instrução*, não o *fluxo*. A validação de
ponta a ponta espera o seed.

A tarefa 7 fica condicional de propósito. Derivar cor do título em código é
fácil (`split(" - ")`), mas cria um campo que **mente em 23% do catálogo** — os
produtos sem hífen — e reintroduz em código uma decisão que a §2 quer no modelo.
Só entra se a avaliação mostrar que o modelo erra sem ela.

### Da outra frente (o seed) — o que pedimos

Não é trabalho desta branch, mas é o que ela precisa receber para ser validada.
Especificação mínima, derivada da §4:

- **`orders` semeada por persona, com pelo menos 4 compras.** Menos que isso e as
  sementes fracas (`recent`, peso 1) tomam as vagas restantes de `MAX_SEMENTES`
  (6) e diluem a paleta.
- **Ao menos 3 dessas 4 concordando em família de cor.** É o mínimo para o agente
  poder afirmar preferência sem inventar.
- **Duas personas de paletas opostas**, para a comparação da tarefa 6 ter
  contraste. O catálogo comporta:
  - *neutros escuros* — `Black` (11), `Grey` (7), `Navy` (3), `Charcoal` (2) = **23 produtos**
  - *claros e terrosos* — `Cream` (8), `Off White` (4), `Tan` (4), `Ivory` (2), `Sage` (2) = **20 produtos**
- **Uma terceira persona de cores dispersas**, que é o caso de controle: com ela
  o agente tem de **se calar** sobre paleta (§5). Sem esse caso, a regra mais
  importante do desenho fica sem teste.

## 9. O que este plano NÃO propõe

- Nenhuma tabela nova, nenhuma migration, nenhum campo em `looks`.
- **Nenhum seed** — nem de `orders`, nem de cor, nem de catálogo (§4).
- Nenhuma mudança em `hashDoContexto` (§3).
- Nenhuma lista de cores, família cromática ou união de literais em TypeScript.
- Nenhum filtro de candidatos por cor — preferência desempata, não elimina.
- Nada de seletor de paleta na UI. A preferência se lê do histórico, não se
  pergunta.

## 10. Perguntas em aberto

1. **"Especificidade" é granularidade do vocabulário ou peso na escolha?**
   - *(a)* o agente decide entre dizer *"preto"*, *"neutro escuro"* ou *"a paleta
     sóbria que você vem montando"*, conforme o quanto as sementes concordam;
   - *(b)* quanto o eixo cor pesa contra tags, tipo e clima na hora de escolher.

   São ortogonais e dá para fazer as duas, mas **(a) é quase só prompt e (b) é
   onde mora o risco do look monocromático.** Muda o tamanho da branch.

2. **A cor da âncora entra na paleta ou é tratada à parte?** Ela não é semente —
   é a peça aberta agora, e a §7 já diz que ela vence a preferência.

3. **Enquanto o seed não chega, a branch para na tarefa 5 ou seguimos para a 7?**
   Seguir sem avaliação real significa afinar o prompt contra sementes forjadas,
   o que tende a superajustar ao caso que inventamos.
