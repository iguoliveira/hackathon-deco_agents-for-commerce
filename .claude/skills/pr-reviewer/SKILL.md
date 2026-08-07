---
name: pr-reviewer
description: Lê um Pull Request do GitHub, revisa o código E a descrição, e posta o resultado como comentário que NÃO bloqueia o merge. Use quando alguém pedir para revisar, analisar, comentar ou dar parecer sobre uma PR — "revisa a PR 6", "olha esse PR pra mim", "comenta os pontos na PR", "/pr-reviewer <url ou número>" —, com URL, com número ou sem nada (aí é a PR do branch atual). Também cobre "como conecto o Claude ao GitHub?", "por que o gh não funciona?" e qualquer erro de autenticação do `gh`, porque a primeira seção é o tutorial de setup. Não use para revisar o working diff local sem PR — para isso existe `/code-review`.
---

# pr-reviewer

Revisa PR do GitHub e comenta sem bloquear.

**Duas regras que não se negociam.** A revisão sai como **comentário**, nunca
como `--request-changes` — quem decide se um achado bloqueia é o autor, não o
revisor automático. E **nada é postado sem o usuário ver antes**: publicar em
nome da conta de alguém é ação de mão única.

---

## Primeiro comando, sempre

```sh
gh auth status
```

Uma chamada, e ela decide o caminho inteiro:

| Resultado | O que fazer |
|---|---|
| Sai 0, mostra a conta | **Pule a §0 inteira.** Vá direto para a §1. Não recite setup para quem já configurou. |
| `command not found` | §0 → instalar |
| `not logged into any GitHub hosts` | §0 → autenticar (só o usuário consegue) |

Enquanto o setup não estiver pronto, **a revisão não fica bloqueada**: o diff
sai do git (§0, "Sem `gh`") e você entrega o texto no chat. Só o post precisa
esperar.

---

## 0. Setup — pule se `gh auth status` já passou

Sintomas: `gh: command not found`, `not logged into any GitHub hosts`, ou
`HTTP 404` ao ler um repo que existe (404 é como o GitHub responde repo privado
sem credencial — não confunda com repo inexistente).

### Instalar

```sh
winget install --id GitHub.cli   # Windows (ou: choco install gh)
brew install gh                  # macOS
sudo apt install gh              # Debian/Ubuntu
```

**Depois de instalar, reinicie o Claude Code.** O instalador escreve no PATH do
sistema, mas o processo do Claude Code já carregou o ambiente — os shells que
ele abre herdam o snapshot antigo e continuam sem enxergar o `gh`. Vale para o
Bash e para o PowerShell igualmente, e é o motivo nº 1 de `command not found`
logo depois de uma instalação bem-sucedida. Até reiniciar, use o caminho
completo:

```powershell
& "$env:ProgramFiles\GitHub CLI\gh.exe" --version   # Windows
```

### Autenticar — só o usuário faz isto

`gh auth login` é interativo. O shell da ferramenta roda com stdin fechado, então
o prompt morre na hora. Peça ao usuário que rode na própria sessão:

```
! gh auth login
```

GitHub.com → HTTPS → autenticar o git também. Escopos mínimos se for PAT:

| Tipo de token | Escopo |
|---|---|
| Classic | `repo` |
| Fine-grained | Contents `read`, Metadata `read`, **Pull requests `read+write`** |

`read` sozinho não posta comentário. Alternativa sem login interativo: exportar
`GH_TOKEN` com o PAT — o `gh` respeita a variável e pula o `auth login`.

Confirme com `gh auth status`.

### Permissões do Claude Code

`.claude/settings.json` já libera a leitura (`gh pr view/diff/list/checks`,
`gh api repos/…`). **`gh pr comment` e `gh pr review` ficaram de fora de
propósito** — publicam em nome do usuário e devem pedir confirmação toda vez.
Não adicione essas duas ao allow, mesmo que o prompt canse.

### Nunca faça isto

Não tente extrair token do Git Credential Manager (`git credential fill`,
`git credential-manager get`). É o padrão exato que o classificador de segurança
bloqueia, e com razão. Se o `gh` não está autenticado, a saída é o tutorial
acima — não contornar.

### Sem `gh`, o que ainda funciona

Se o Credential Manager do git está configurado, **o diff já é acessível sem
`gh`**, mesmo em repo privado:

```sh
git fetch origin refs/pull/<N>/head:pr-<N>
```

Só a **descrição** da PR e o **post** exigem `gh` (ou navegador). Vale saber
para não travar a revisão inteira por falta de setup: dá para revisar o código e
entregar o texto no chat.

---

## 1. Ler a PR

### Primeiro: não desmonte a URL

Se veio uma URL, **passe-a inteira para o `gh`**. Não extraia o número.

```sh
ALVO="https://github.com/owner/repo/pull/7"   # ou só: 7
gh pr view "$ALVO" --json number,title,body,author,state,baseRefName,headRefName,url,additions,deletions,changedFiles
gh pr diff "$ALVO" --name-only
```

O motivo é uma armadilha silenciosa: `gh pr view 7` resolve pelo repositório
**onde você está**, não pelo repositório da URL. Cole uma URL de outro repo,
extraia o `7`, e a revisão sai inteira sobre a PR errada — título errado, diff
errado, tudo coerente e tudo falso. O `gh` aceita a URL completa e vai no repo
certo; deixe ele resolver.

Prove que o alvo é o que você pensa antes de gastar contexto: o `url` que voltou
tem que bater com o que foi pedido. Se apontar para fora do repo atual, **pare** —
o `git fetch origin refs/pull/N/head` da §2 buscaria a PR de número igual deste
repo, e as duas metades da revisão falariam de PRs diferentes. Nesse caso, ou
troque de diretório, ou faça a revisão só pelo `gh` (sem as etapas §2 e §3) e
diga no comentário que foi só leitura.

### Estado e conversa que já existe

```sh
gh pr view "$ALVO" --json state,isDraft,comments,reviews,statusCheckRollup
```

Três coisas mudam o que vale escrever:

- **`state`/`isDraft`** — PR mergeada ou fechada se revisa em pretérito, e a §3
  precisa do tratamento de merge-base que o script já tem. Draft merece revisão
  mais leve: o autor ainda está escrevendo.
- **`comments`/`reviews`** — repetir um achado que alguém já levantou é ruído, e
  contradizer um combinado da thread sem saber que ele existe é pior. Se um ponto
  já foi feito, referencie em vez de reescrever.
- **`statusCheckRollup`** — se o CI já está vermelho, não reporte à mão o que ele
  já gritou. Aponte o que o CI **não** pega.

### O diff

**Nunca rode `gh pr diff <N>` sem filtro.** É o maior desperdício possível aqui:
a PR #6 tinha 4.277 linhas, das quais 3.648 eram uma migration SQL gerada e o
gerador que a produz. Despejar isso custa mais contexto que a revisão inteira e
não ensina nada — arquivo gerado se audita pelo gerador, não pelo produto.

O caminho barato, nesta ordem:

1. `--name-only` para ver a forma da PR.
2. `git diff --stat` (§2) para saber onde está o peso.
3. Diff **por caminho**, só das áreas que carregam decisão.
4. Em arquivo gerado, leia `head`/`tail` e o cabeçalho — não o corpo.

**Leia a descrição inteira antes do diff.** Ela é metade do objeto da revisão:
uma PR que explica o porquê, lista o que foi verificado e admite o que não foi
merece ser dita boa, e uma que só narra o diff merece ser dita insuficiente. Os
comentários sobre a descrição vão numa seção própria no fim.

## 2. Isolar o que a PR de fato mudou

Nunca use `main..pr-N`. O `main` local costuma estar velho, e o intervalo vem
poluído com merges de PRs antigas que não são desta. Sempre pelo merge-base:

```sh
# o ref local da PR: nada antes desta linha o cria, nem quando o `gh` está ok
git fetch origin refs/pull/<N>/head:pr-<N> --force

git fetch origin main
MB=$(git merge-base origin/main pr-<N>)
git log --oneline "$MB..pr-<N>"
git diff --stat "$MB..pr-<N>"
git diff "$MB..pr-<N>" -- <caminho>
```

Em PR grande, leia por área (plataforma, componentes, scripts, dados gerados) em
vez de tudo de uma vez.

**Se já revisou esta PR antes** e o autor empurrou commits novos, não releia tudo
nem poste um comentário completo de novo. Escope no que mudou desde a última
passada e diga no comentário que é a segunda:

```sh
git diff <head-da-revisao-anterior>..pr-<N>
```

## 3. Rodar as verificações — sempre contra a linha de base

**Pule esta seção se o `--name-only` da §1 não trouxe nenhum `.ts`/`.tsx`** — e
diga no comentário que pulou. Dois `tsc --noEmit` completos para confirmar um
empate garantido é o mesmo desperdício que o diff cru da §1, só que mais lento.
PR de documentação, de skill ou de configuração não move o número. (A #7 foi
exatamente isso: três arquivos, `.md` + `.mjs` + `.json`, e o delta deu 6/6.)

Esta é a etapa que separa achado de ruído. **Um erro no head não é um erro
introduzido pela PR até você provar que o merge-base não o tinha.** Rode nos
dois lados e compare as listas:

```sh
node .claude/skills/pr-reviewer/scripts/typecheck-delta.mjs --pr 6
node .claude/skills/pr-reviewer/scripts/typecheck-delta.mjs --head <branch>
```

O script recusa árvore com mudança rastreada, guarda o branch atual, roda
`tsc --noEmit` nos dois lados, imprime só a diferença e **restaura o branch mesmo
se falhar no meio**. Se a PR já foi mergeada, ele detecta (o merge-base viraria o
próprio head, dando um "nada introduzido" falso) e usa o 1º pai do merge commit.

Foi assim que `Image.tsx` virou achado real: o head tinha 6 erros, mas 4 já
existiam na base.

**O delta é sinal bruto, não veredito.** No mesmo caso ele apontou 2
"introduzidos", e só 1 era defeito: o outro era um arquivo novo importando
`postgres`, que não está instalado — mesma classe dos 4 pré-existentes, não um
problema da PR. Antes de reportar, pergunte de cada erro novo: *isto é o código
desta PR estando errado, ou é o ambiente estando incompleto?*

O script chama o `tsc` de `node_modules` com o próprio node, sem `npx` e sem
`shell: true` — no Windows o `npx` é um `.cmd`, que exige shell, e shell reabre
a injeção de argumento que o array de args fecha. Se reclamar que não achou o
TypeScript, falta `npm install`.

### Sem o script

**O script é atalho, não dependência.** Se ele não existir, quebrar, ou você
estiver em outro repo, o mesmo delta sai à mão — e o raciocínio da seção vale
igual:

```sh
MB=$(git merge-base origin/main pr-<N>)
git switch --detach "$MB" && npm run typecheck > /tmp/base.txt 2>&1
git switch --detach pr-<N> && npm run typecheck > /tmp/head.txt 2>&1
git switch -                                    # volte ANTES de analisar
comm -13 <(sort /tmp/base.txt) <(sort /tmp/head.txt)   # só o que o head tem a mais
```

O que se perde em relação ao script: se isso quebrar no meio (tsc travado,
Ctrl+C), você fica em HEAD destacado sem aviso. Então **volte primeiro, analise
depois** — a ordem acima não é estética.

### Não troque isto por `git worktree`

Parece a simplificação óbvia: montar o merge-base num diretório separado dispensa
trocar de branch, e com isso some a razão de existir do `finally`. **Não funciona
neste repo**, e falha em silêncio — medindo, no mesmo commit:

| | Erros |
|---|---|
| Trocando branch no lugar | **6** |
| Worktree novo | **14** |

O worktree só recebe arquivo rastreado. `src/routeTree.gen.ts` é gerado pelo
`tsr generate` e está no `.gitignore`, então lá ele não existe — e faltando, saem
seis `TS2307` em cascata que não têm nada a ver com a PR.

Trocar branch no lugar **preserva `node_modules` e os artefatos gerados não
commitados** entre as duas medições. É isso que torna a comparação justa, e é o
motivo real de o script fazer o que faz. Worktree só empata se você rodar os
geradores dos dois lados — aí a "simplificação" custa mais que o script inteiro.

Aqui `npm run build` **não** chama `tsc`. Então typecheck quebrado não impede o
deploy, e uma PR pode chegar verde ao merge com erro de tipo dentro. Diga isso
quando acontecer, e sugira `typecheck` no CI — mas como sugestão, não como
bloqueio.

## 4. O que este repo esconde

Checklist do que já mordeu aqui e não aparece no diff:

- **Prop de section removida deixa bloco órfão.** Se a PR tira um campo de uma
  `interface` de section, `grep` o nome em `.deco/blocks/*.json`. O
  `meta.gen.json` é regerado, os blocos não — ficam com dado que não valida mais
  contra o schema.
- **Wrapper que não cobre todos os caminhos.** Ao envolver um componente do
  framework, verifique quem mais importa o original direto
  (`grep "@decocms/blocks/hooks"`). Foi assim que `Picture.tsx` apareceu
  contornando o desvio novo do `Image.tsx`.
- **Migration precisa ser transacional e reaplicável.** `scripts/migrate.ts`
  envolve cada arquivo em `sql.begin` — confirme que continua assim, e que um
  `DELETE` de início é restrito por prefixo (`gid://catalog/` não pode encostar
  em `gid://shopify/`).
- **Off-by-one de paginação mora em três lugares.** Loader
  (`src/platform/catalog/catalog.actions.ts`), montagem
  (`src/platform/catalog/catalog.plp.ts`) e componente — e aqui existem **dois**
  `SearchResult.tsx`, `src/components/search/` e `src/sections/Product/`, que é
  o que recebe `startingPage` dos blocos. Uma correção que só toca um deles
  conserta metade.
- **Status 200 não é sinal de saúde.** As sections são lazy; loader que falha
  vira section vazia e a página segue 200. Nunca conclua "funciona" a partir de
  código HTTP.
- **Parte do que o `tsc` precisa é gerado e não está no git.**
  `src/routeTree.gen.ts` sai do `tsr generate` e está no `.gitignore:16`; os
  `.deco/*.gen.ts` saem do `generate:blocks`/`sections`/`loaders`. Qualquer
  medição feita numa cópia limpa do repositório — worktree, clone raso, checkout
  de CI sem `npm run build` — mede *a ausência dos geradores*, não o código: são
  seis `TS2307` a mais que somem depois de gerar. Se um número de typecheck vier
  diferente do esperado, confira isto **antes** de suspeitar da PR.

## 5. Escrever

Ordem que funciona:

1. **Uma linha dizendo que não bloqueia**, logo no topo. É a primeira coisa que
   o autor precisa saber.
2. **O que a PR acertou** — e isto vem *antes* dos achados, não como consolo
   depois deles. Veja a regra de tom abaixo.
3. **Achados numerados**, do mais grave ao menos. Cada um com `arquivo:linha`,
   a consequência concreta, e a correção sugerida. Sem consequência, é preferência.
4. **Menores**, agrupados.
5. **O que você verificou e está correto.** Não é enfeite: diz ao autor onde a
   revisão passou de fato, e onde ele ainda é o único que olhou.
6. **Sobre a descrição** — escopo, título, o que faltou registrar.

Separe sempre **"achei um bug"** de **"eu teria feito diferente"**. As duas coisas
cabem no comentário; misturá-las faz a segunda parecer a primeira.

### O tom: específico nos dois sentidos

O comentário aponta problema **e** reconhece força, e as duas coisas obedecem ao
mesmo padrão de prova. Elogio genérico não vale nada — "bom trabalho", "ficou
limpo" é ruído que o autor aprende a pular, e pular o elogio é como ele passa a
pular o resto. **Elogie com a mesma precisão com que acusa:** nomeie a decisão,
o arquivo, e por que aquilo foi a escolha certa.

| Não | Sim |
|---|---|
| "PR bem feita, parabéns!" | "A descrição registra o `.ps1` descartado e o bug de encoding que ele trouxe — decisão que não se recupera lendo o diff." |
| "O script está bom." | "O `finally` restaura o branch mesmo quando o `tsc` falha no meio; rodei e confirmei que a árvore volta limpa." |
| "Só uns pontinhos." | "Um achado com consequência real, três menores." |

Três regras que sustentam isso:

- **Verifique o elogio.** Se disse que algo funciona, foi porque rodou. O item 5
  da ordem existe para isso — é a seção que separa "eu li" de "eu testei".
- **Não invente força para equilibrar.** Se a PR é fraca, o comentário é curto na
  parte boa e honesto no resto. Simetria forçada é desonestidade educada.
- **Ataque o código, nunca quem escreveu.** "Esta função conta crash como zero
  erros" e não "você esqueceu de tratar o status". A primeira o autor conserta; a
  segunda ele defende.

O objetivo é o autor terminar a leitura sabendo **o que preservar** com a mesma
clareza com que sabe o que mudar. Revisão que só lista defeito ensina o time a
escrever PR pior — porque ninguém aprende qual parte valeu.

### Quando o autor é você

Auto-revisão é uso legítimo — foi assim que a #7 encontrou os próprios defeitos.
Mas a cerimônia de postar comentário na própria PR normalmente não faz sentido:
se você pode corrigir, corrija, e deixe o comentário para o que ficou como
decisão consciente. Pergunte ao usuário qual dos dois ele quer antes de assumir.

## 6. Postar

Mostre o texto ao usuário e pergunte antes. Depois, com o **mesmo `$ALVO`** da §1
— aqui o repo errado publica de verdade, não só lê errado:

```sh
gh pr comment "$ALVO" --body-file <arquivo.md>
```

Escreva o corpo num arquivo do scratchpad, nunca inline — o texto tem crase,
backtick e `$`, e passar por linha de comando corrompe.

**Nunca:**

```sh
gh pr review <N> --request-changes   # bloqueia o merge
gh pr close <N>                      # nem preciso explicar
```

`gh pr review "$ALVO" --comment --body-file …` também não bloqueia e ancora melhor
na timeline — use só se o usuário pedir "review" com essa palavra. O default é
`gh pr comment`.

### Sem `gh` autenticado

Dá para postar pelo navegador (`claude-in-chrome`), com a sessão do usuário:
navegar até a PR, preencher a textarea com `form_input`, e clicar o botão verde
**Comment**. Cuidado: **"Close with comment"** fica coladinho à esquerda dele.
Tire screenshot e confirme o alvo antes de clicar. O comentário sai como sendo
do usuário, não de um bot — avise isso a ele.
