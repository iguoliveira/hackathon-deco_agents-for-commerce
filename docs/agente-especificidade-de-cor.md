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
`personal-shopping-agent-mudancas.md` proíbe, e exatamente a regra que a PR #12
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

## 4. O obstáculo real: a regra 3 do prompt

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

## 5. Precedência: a âncora manda

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

## 6. O "nível de especificidade"

O termo comporta duas leituras, e elas levam a features diferentes:

- **(a) Granularidade do vocabulário** — o agente decide se diz *"preto"*,
  *"neutro escuro"* ou *"a paleta sóbria que você vem montando"*, conforme o
  quanto as sementes concordam entre si. Três peças pretas autorizam ser
  específico; três peças de cores dispersas só autorizam falar em família.
- **(b) Força com que a preferência puxa a escolha** — quanto o eixo cor pesa
  contra tags, tipo e clima na hora de escolher.

São ortogonais e dá para fazer as duas, mas a ordem importa e o esforço é
diferente. **(a) é quase só prompt; (b) mexe em como o agente pondera e é onde
mora o risco do look monocromático.**

Esta é a pergunta que precisa de resposta antes da implementação.

## 7. Fases

| # | O quê | Entrega |
|---|---|---|
| 0 | **Baseline** — rodar o dry run atual com sementes de cores concordantes e dispersas, e contar quantos motivos citam cor hoje | Números, antes de mudar nada |
| 1 | Seção nova no prompt: **A PALETA DA PESSOA** | `look.prompt.ts` |
| 2 | Reescrever a regra 3 separando *afirmar* de *agrupar* | `look.prompt.ts` |
| 3 | Precedência âncora × preferência | `look.prompt.ts` |
| 4 | **Avaliação comparativa** — mesmo produto, mesma cidade, sementes de paletas opostas | Evidência de que mudou |
| 5 | *(condicional)* Expor a cor derivada do título no `Candidato` | `look.candidates.ts` |

A fase 0 não é burocracia: **o agente já cita cor**, então sem medir o antes não
há como afirmar que a feature fez diferença. Foi exatamente o teste
Porto Alegre × Recife que provou o eixo do clima na #12; aqui o análogo é
sementes-pretas × sementes-coloridas, mesmo produto, mesma cidade.

A fase 5 fica condicional de propósito. Derivar cor do título em código é fácil
(`split(" - ")`), mas cria um campo que **mente em 23% do catálogo** — os
produtos sem hífen — e reintroduz em código uma decisão que a §2 quer no modelo.
Só entra se a avaliação da fase 4 mostrar que o modelo erra sem ela.

## 8. O que este plano NÃO propõe

- Nenhuma tabela nova, nenhuma migration, nenhum campo em `looks`.
- Nenhuma mudança em `hashDoContexto` (ver §3).
- Nenhuma lista de cores, família cromática ou união de literais em TypeScript.
- Nenhum filtro de candidatos por cor — preferência desempata, não elimina.
- Nada de seletor de paleta na UI. A preferência se lê do histórico, não se
  pergunta.

## 9. Perguntas em aberto

1. **Especificidade é (a) ou (b) da §6?** — muda o tamanho da branch.
2. **Quando as sementes não concordam em cor nenhuma, o agente cita paleta
   assim mesmo ou se cala?** O precedente do clima manda calar
   (*"Se você não reconhecer a cidade, não invente clima"*), e provavelmente é a
   resposta certa aqui também.
3. **A cor da âncora entra na paleta ou é tratada à parte?** Ela não é semente —
   é a peça aberta agora.
