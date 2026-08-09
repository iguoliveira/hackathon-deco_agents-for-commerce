# Agente de combinações

> **Este é o documento em vigor para a feature do hackathon.** Onde ele
> discordar de qualquer outro em `docs/`, ele ganha. O estado de cada um dos
> outros está em [§9](#9-o-estado-dos-outros-documentos).

Você abre uma camisa preta básica. O agente monta **a roupa inteira em volta
dela** — a calça, o tênis, a peça de cima —, escolhendo com base no que você já
favoritou, esperou, viu e comprou, e no **lugar onde você mora**. Cada peça vem
com uma linha dizendo por que ela entrou.

Não é "quem viu isto também viu". É **composição**, e ela é assinada.

> ### Quem é o público: usuário logado
>
> **Esta feature pressupõe identidade, e visitante anônimo não é caso a
> considerar.** A composição parte do **armário da pessoa** — o que ela comprou,
> favoritou, pediu "avise-me" e viu. Sem identidade não há armário, e sem armário
> o agente não faz o que se propõe: vira um carrossel de relacionados com texto
> bonito, que é exatamente aquilo que esta feature existe para contradizer.
>
> Isso não é uma limitação a ser corrigida depois. É o **recorte**: um caminho
> anônimo não está previsto, não é medido e não decide desenho nenhum aqui. Onde
> este documento diz "a pessoa", leia "a pessoa logada".
>
> A premissa viveu implícita até a revisão da PR #14 apontar decisões que só
> fazem sentido sob ela — e uma premissa que só existe na cabeça de quem escreveu
> reaparece como achado a cada revisão. Está escrita agora.

---

## 1. Por que esta feature e não a do `personal-shopping-agent-proposta.md`

Aquele documento (§3) desenha o agente raciocinando **offline**, em duas
passadas sobre os 136 produtos, gravando `product_affinity` como migration
revisada à mão. O raciocínio era bom e a conclusão envelheceu por um motivo
simples: **enquanto ele era escrito, o agente de runtime foi construído e
verificado** (`docs/agente-vitrine.md`).

O que existe hoje em `src/platform/shelf/` já é o pipeline
determinístico → modelo → determinístico, com validação de handle, fallback por
SQL e persistência. Rodar duas passadas offline para produzir uma tabela que
responde a mesma pergunta seria construir o mesmo agente duas vezes, e a
segunda versão perderia o que a primeira tem de melhor: **o motivo escrito
sabendo quem é a pessoa**. Um `reason` gravado no sábado não pode dizer "para o
frio de Porto Alegre em agosto"; ele foi escrito antes de existir alguém.

O que se herda daquele documento e continua valendo integralmente:

- **as sementes** (`wishlist ∪ avise-me ∪ vistos ∪ comprou`) — §4 e §10 dele
- **genérico por construção** — nenhum literal de catálogo no código
- **disponibilidade nunca é afirmação do modelo** — é `JOIN` com `variants`
- **`ocasiao` é `string`**, não união de literais

O que cai: as passadas A e B, `product_affinity`, e as migrations 0012/0013/0014
como ele as numera — **0012 e 0013 já estão ocupadas** por `create_shelves` e
`shelf_complements`.

---

## 2. O que já existe e não vai ser reescrito

Levantado lendo o código, não os docs.

| Peça | Onde | Serve como |
|---|---|---|
| Pool de complementos ancorado numa peça | `catalog.d1.ts:468` `findComplementsAvailable` | **a etapa 1 inteira** — exclui mesmo tipo, exige afinidade real |
| Pool de alternativas | `catalog.d1.ts:549` `findSimilarAvailable` | o `similar` de graça |
| Equilíbrio por tipo | `shelf.candidates.ts:102` `equilibrarPorTipo` | é o que impede "seis calças" virarem um look |
| Transporte até o modelo | `shelf.decopilot.ts` `perguntar()` | thread nova por execução, SSE, verificado |
| Parsing tolerante | `shelf.agent.ts:44` `extrairJson` | o Decopilot não garante saída estruturada |
| Validação contra os candidatos | `shelf.agent.ts:90` `validar` | descarta, nunca conserta |
| Favoritos | cookie `deco_wishlist` — `_cookie.ts:6` | semente (desde 09/08, também de `wishlist_items`) |
| Avise-me | `stock_alerts` — `alerts.d1.ts` `findWaitedItems` | semente |
| Reconferir estoque no render | `catalog.d1.ts:390` | preserva a ordem pedida |

**Três dessas são reusadas por import direto.** O domínio novo não copia código
do `shelf`; ele importa `findComplementsAvailable`, `perguntar` e `extrairJson`.

## 3. O que não existe

Semente de favorito lida no servidor · cookie de vistos · tabela de pedidos ·
**qualquer noção de onde a pessoa está** · cache de look.

---

## 4. A arquitetura

```text
              PDP: a pessoa abre uma peça
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
        ▼                                   ▼
  ÂNCORA (a peça aberta)            CONTEXTO (quem está olhando)
  findComplementsAvailable          sementes: deco_wishlist ∪ stock_alerts
  findSimilarAvailable                       ∪ deco_recent ∪ orders
        │                           local:   x-vercel-ip-city / cookie
        │                           mês:     new Date()
        └─────────────────┬─────────────────┘
                          ▼
                  hash do contexto
                          │
              ┌───────────┴───────────┐
              │                       │
         CACHE HIT                CACHE MISS
              │                       │
              │            ┌──────────┴──────────┐
              │            ▼                     ▼
              │      a section NÃO         dispara o agente
              │      aparece nesta         SEM await
              │      visita                      │
              │                                  ▼
              │                        ┌──────────────────┐
              │                        │ passada 1        │  ~22-41s
              │                        │ TODOS os sinais  │  (cache por
              │                        │ → PERSONA        │   hash dos sinais)
              │                        └────────┬─────────┘
              │                                 ▼
              │                        valida a evidencia contra
              │                        os sinais (sem modelo)
              │                                 ▼
              │                        ┌──────────────────┐
              │                        │ passada 2        │  ~35-60s
              │                        │ persona + ancora │
              │                        │ + pool → LOOK    │
              │                        └────────┬─────────┘
              │                                 ▼
              │                        resolve handles contra
              │                        os pools (sem modelo)
              │                                 ▼
              │                     falhou? não grava nada
              │                     compôs? grava em `looks`
              └───────────┬─────────────────────┘
                          ▼
              JOIN com variants (disponibilidade AGORA)
                          ▼
        blocos por `ocasiao`, cada peça com o seu motivo
```

### Duas passadas, desde a #26

A primeira sintetiza o guarda-roupa; a segunda compõe. Elas rodam **em
sequência dentro de `gerarLook`**, que já era background — a PDP continua sem
esperar modelo nenhum.

O que a separação comprou: o teto de seis sementes existia porque muitos sinais
faziam o modelo compor *"para todo mundo"*. Esse é um problema **de composição**;
para sintetizar, descrever o armário inteiro é o objetivo. Separadas, cada tarefa
recebe o que precisa — e a tabela de pesos que escolhia as seis vagas saiu do
código.

O custo não dobra na prática: a persona é por **pessoa**, não por peça aberta, e
fica em cache pelo hash dos sinais. Quem abre cinco PDPs sintetiza uma vez. Ver
[`persona-do-guarda-roupa.md`](persona-do-guarda-roupa.md).

### A decisão que define esta feature

> **O código não sabe o que é inverno. O agente sabe.**

O local vai para o prompt como texto cru — `"Porto Alegre, RS, BR"` e
`"agosto"` — e **o modelo** conclui que é frio, que pede camada externa, que um
linho não serve. Não existe tabela de clima, não existe
`estacao: "inverno" | "verao"`, não existe `if (cidade === ...)`.

Isso não é elegância: é a regra de genericidade da §1 de
`personal-shopping-agent-mudancas.md` sobrevivendo ao recurso mais tentador de
todos para violá-la. Trocar o catálogo por um de vinho e a mesma linha de código
continua produzindo "para o calor de Recife, um branco gelado" sem nenhuma
edição.

### Por que cache + geração em background, e não chamada síncrona

O Decopilot leva 35-60s, e às vezes trava em `waiting-capacity` até o timeout
(`docs/agente-vitrine.md`). Uma PDP não segura isso, e um spinner de 40s no
telão do pitch é pior que não ter a feature.

O padrão já é o do repo: `subscribe.ts` dispara `gerarVitrine(email)` **sem
`await`** e responde na hora. Aqui é o mesmo: no miss, dispara e responde
`null`.

### É pelo agente ou não aparece

> **Não existe look sem motivos.** Se o agente não compôs, a section some.

A versão anterior desta feature degradava de **look explicado** para **look sem
texto**: no miss, ou quando o modelo falhava, a tela recebia os candidatos na
ordem que `findComplementsAvailable` já dava, sem motivo nenhum. Isso caiu.

O argumento é de produto. Sem os motivos e sem o agrupamento por ocasião, o que
sobra é indistinguível de um carrossel de "produtos relacionados" — que toda
loja já tem, e cuja existência é justamente o que esta feature veio contradizer.
Mostrá-lo **exatamente no momento em que o agente falhou** é pior que não
mostrar nada: ele ocupa, silenciosamente, o lugar onde a prova deveria estar, e
um jurado que role a página vê a feature funcionando quando ela não funcionou.

O que isso custa, dito sem enfeite:

- a **primeira visita** a um par (peça, contexto) novo não mostra a section;
- o `contexto_hash` inclui a cidade, então **trocar de cidade ao vivo cai nesse
  caso** — a roupa nova só aparece no carregamento seguinte, ~40s depois;
- uma falha do provedor vira ausência, não degradação.

**Consequência que precisa ir para o roteiro:** `npm run look:warm` deixou de
ser otimização e virou pré-requisito. Os produtos da demo — e as cidades que se
pretende demonstrar — são pré-aquecidos antes do pitch. Vale dizer no slide que
uma loja de verdade faria isso num job; o que não vale é descobrir ao vivo.

**Pré-aqueça no contexto da persona logada, não no do terminal.** `aquecerLook`
usa o contexto de quem chama, e do terminal isso é uma conta sem histórico —
que, pelo recorte do topo, não é o caso de uso. O par que precisa estar quente é
`(peça do roteiro, persona da demo)`, e hoje o caminho para produzi-lo é abrir a
PDP logado como ela. Um `--cidade` e um `--email` no `look:warm` fechariam isso
num comando; enquanto não existem, o pré-aquecimento é manual e vai no checklist
do dia.

Falha **grava um marcador, e não um look** — e a distinção é a correção da
issue #19.

A regra original era "falha não grava nada", com um argumento que parecia
completo: persistir um look de consolação ensinaria o cache a servir a falha, e
sem linha o próximo carregamento tenta de novo, que é o certo quando a causa
provável é saturação do provedor. O que faltava é o caso em que a geração
**nunca converge**. Aí "tenta de novo" deixa de ser resiliência e vira laço:
cada pageview abre uma chamada de até 120s que falha e não deixa rastro, e o
sistema responde a *"o provedor está saturado"* **gerando mais carga**. Com a
section na home (`956b252`), isso passou a ser toda visita — bot, preview da
Vercel e health check inclusive.

O marcador preserva a intenção e corta o laço:

- `origem = 'falha'`, `titulo` e `pecas` vazios, motivo em `motivo_do_fallback`
  — as colunas que a `0014` já tinha e que ficaram ociosas quando o fallback por
  SQL caiu. **Nenhuma migration.**
- **A quarentena é por PEÇA, não pelo par `(peça, contexto)`.** Uma linha por
  âncora, sob o `contexto_hash` reservado `__falha__` (que não colide com nada:
  `hashDoContexto` só produz base36). A primeira versão usava o par e tinha um
  furo que anulava quase todo o conserto: `marcarVisita` grava `deco_recent` em
  toda PDP, `colherSementes` lê esse cookie e o hash inclui as sementes — então
  quem navega gera um contexto novo a cada página, e um par novo nunca teve
  marcador. A quarentena não errava; nunca era consultada. Para visitante
  anônimo, que não tem sinal mais forte que `recent`, era o caso comum.
  Por peça fecha, e pelo motivo certo: **"modelo indisponível" é propriedade do
  provedor, não do contexto** — a peça é a chave mais fina que ainda faz sentido.
  `lerLook` continua com a chave completa, então **nada disto muda o que alguém
  vê**.
- `lerLook` já ignora `origem <> 'agente'`, então o marcador **não pode virar
  look na tela**. A regra do título desta seção continua intacta.
- O retry continua existindo, só que **espaçado**: `TTL_FALHA_MINUTOS = 10` em
  `look.actions.ts`. Dez minutos é o maior valor que ainda deixa a demo se
  recuperar sozinha sem alguém rodar nada.
- O `UPSERT` do marcador tem `WHERE looks.origem <> 'agente'`. Sem isso, um
  `look:warm` rodado com o provedor fora **apagaria** os looks bons já gravados —
  destruindo exatamente o cache que se queria proteger.

Uma segunda camada cobre o que o marcador não alcança: o `Set` `emVoo`, em
`look.actions.ts`, impede que a rajada de pageviews **durante** os 120s da
primeira tentativa dispare N gerações da mesma coisa. Ele é por instância e o
comentário no código diz isso — o marcador é quem cobre entre instâncias e entre
visitas. Um lock de verdade seria um `INSERT` de reserva antes de chamar o
modelo; vale se isto sair da demo.

O sucesso limpa a quarentena sozinho: `gravarLook` sobrescreve a linha inteira,
zerando `motivo_do_fallback` e devolvendo `origem = 'agente'`.

### A chave do cache

`(anchor_id, contexto_hash)`, onde o hash cobre sementes + local + mês. Duas
pessoas diferentes na mesma peça recebem looks diferentes, e é **isso** que
prova personalização — não o número de produtos mudando.

---

## 5. Modelo de dados — duas migrations

`db/migrations/0014_looks_and_orders.sql`. **0012 e 0013 estão ocupadas.**

A `0019_personas.sql` entrou com a #26 e é descrita em
[`persona-do-guarda-roupa.md`](persona-do-guarda-roupa.md) §6. Ela segue as
mesmas decisões desta: JSON em `TEXT` porque é blob opaco, sem `FOREIGN KEY` para
`products`, e marcador de falha com quarentena na própria tabela — `lerPersona`
ignora tudo que não seja `origem = 'agente'`, exatamente como `lerLook`.

```sql
CREATE TABLE IF NOT EXISTS looks (
  anchor_id     TEXT NOT NULL,   -- product_group_id da peça aberta
  contexto_hash TEXT NOT NULL,   -- sementes + local + mês
  titulo        TEXT NOT NULL,
  confianca     REAL NOT NULL,
  pecas         TEXT NOT NULL,   -- JSON [{handle, motivo, ocasiao, position}]
  origem        TEXT NOT NULL,   -- sempre 'agente'; ver nota abaixo
  generated_at  TEXT NOT NULL,
  PRIMARY KEY (anchor_id, contexto_hash)
);

CREATE TABLE IF NOT EXISTS orders (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

**`pecas` é JSON num TEXT de propósito.** É blob opaco: só é lido inteiro, nunca
filtrado em SQL. Normalizar custaria uma tabela e um JOIN para não comprar nada
— mesmo argumento que a spec aprovada usa para `Proposal.evidence`.

**`origem` e `motivo_do_fallback` sobrevivem à remoção do fallback**, e não por
inércia: a `0014` já foi aplicada, e uma migration para apagar duas colunas que
não incomodam ninguém não se paga. `gravarLook` escreve `'agente'` literal e
`NULL`; `lerLook` **ignora qualquer linha que não seja `'agente'`**, e é isso que
aposenta sozinhas as linhas antigas — servir uma delas hoje poria na tela
exatamente o look sem motivos que se decidiu não mostrar. Elas são regeneradas
na primeira visita.

**Nenhuma das duas tem `FOREIGN KEY` para `products`.** É a regra da `0005`: as
migrations de seed apagam e reinserem o catálogo, e um `ON DELETE CASCADE`
destruiria histórico a cada `db:reset`. `looks` é cache — perder é barato — e
`orders` é comportamento, que não pode sumir. Quem descarta linha morta é a
leitura, pelo `JOIN`.

> Isto é o **oposto** do que `personal-shopping-agent-proposta.md` §4 decide para
> `product_affinity`, e os dois estão certos: aquela tabela é **derivada do
> catálogo** e deve cair junto; estas duas não são.

### As sementes não precisam de tabela

| Semente | Onde já está | Falta |
|---|---|---|
| Favoritos | `wishlist_items` (logado) ∪ cookie `deco_wishlist` (todos) | **nada** — ver a nota abaixo |
| Avise-me | `stock_alerts` | nada |
| Vistos | — | cookie `deco_recent`, ~30 min |
| Comprou | `orders` + `order_items` | **nada** — ver [`pedidos-e-compra-simulada.md`](pedidos-e-compra-simulada.md) |

> **09/08 — a wishlist tem duas casas, e as duas contam.** O cookie sempre
> existiu e é o que dá look pessoal a quem não entrou. Quando a PR #15 levou o
> favorito para `wishlist_items`, o agente passaria a **não enxergar justamente
> quem se identificou** — que é o público desta feature pelo recorte do topo.
> `favoritosDe()` fecha isso, e `colherSementes` une as duas fontes.
>
> **Nenhuma das duas casas vale mais que a outra**, e isso deixou de ser uma
> escolha desta feature quando a pesagem de sementes caiu: `consolidar` agrupa
> por produto e **une** os `kinds`, sem eleger vencedora. As duas emitem
> `wishlist`, e uma peça que esteja nas duas sai com uma entrada só.
>
> **A do banco é preferida num ponto, e só nele: a data.** O cookie guarda uma
> lista de ids, sem quando — `sementesPorVariante` carimba o instante da
> requisição em todos. Como a ordem final agora é cronológica, esse carimbo é
> sempre mais novo que o `created_at` verdadeiro e venceria a comparação de
> `consolidar`, empurrando a peça ao topo com uma data inventada. Por isso
> `herdarDataReal` troca esse carimbo pela data verdadeira quando **qualquer**
> fonte datada conhece a peça — compra, avise-me ou o favorito do banco.
>
> **Herda, não descarta**, e a diferença é o `kinds`: filtrar a entrada do cookie
> resolveria a ordem, mas a peça perderia a origem `wishlist` e *"comprou e
> favoritou"* viraria só *"comprou"* — a informação que a #26 ganhou ao parar de
> eleger vencedora. Não é hierarquia entre fontes: o cookie cede no ponto da
> data, e só por ser o único que não a tem. Favorito que existe apenas no cookie
> segue com o instante da requisição, que é a melhor aproximação disponível.
>
> **A migration `0015_wishlist.sql` está em `main` desde a #29** — esta branch a
> trouxe da #15 antes disso, byte a byte idêntica, e o merge resolve sozinho.
>
> **Não existe mais UI de favoritar.** Sem ela, `wishlist_items` só tem o que for
> semeado — e é assim que a wishlist entra na demo. Vale o mesmo aviso que
> `orders` já carrega: **isso vai dito no slide**. Um jurado de e-commerce
> reconhece dado semeado apresentado como comportamento.

> **08/08:** a linha "Comprou" deixou de ser pendência. Existe carrinho, botão de
> finalizar e tela de pedidos, e a compra é gravada de verdade — o que a torna
> semente sem precisar de seed. `comprasDe` lê de `order_items` desde a `0017`.
>
> A semente também deixou de ser rótulo: ela carrega `tags`, e
> `combinaComOGuardaRoupa` cruza o guarda-roupa com cada candidato **em código**.
> Antes o modelo recebia só título e tipo, e dizia "o tênis branco que você
> comprou" lendo a cor da string do título.

> **Continua verdade, com uma emenda (#26).** As quatro sementes seguem sem
> tabela própria. O que ganhou tabela foi a **síntese** delas — `personas` guarda
> o retrato para não reprocessá-lo a cada PDP.
>
> E a semente mudou de forma: `kind: SeedKind` virou `kinds: SeedKind[]`. A mesma
> peça chega por dois caminhos o tempo todo (favoritar e depois comprar é o
> percurso normal), e a versão anterior escolhia a origem "mais forte" e
> descartava a outra. Guardar as duas fechou um bug real: uma compra **sombreada
> por um `recent` mais novo** sumia de `jaComprados`, e a peça voltava a ser
> recomendada — desfazendo o que a §7b listou como o primeiro defeito corrigido.

**Não há pagamento**, e isso continua indo dito no slide. Fingir pipeline de
compra é o tipo de coisa que um jurado de e-commerce reconhece na hora.

---

## 6. O domínio novo

```
src/platform/look/
  look.types.ts        Semente, SeedKind, Local, Contexto, PecaDoLook, Look,
                       Persona, EixoDaPersona
  look.cookies.ts      deco_recent (vistos) e deco_local (seletor)
  look.local.ts        headers da Vercel + cookie → Local
  look.hash.ts         fnv1a + hashDosSinais — sem node:crypto (agente-vitrine.md)
  look.seeds.ts        wishlist ∪ alerts ∪ recent ∪ orders → Semente[]
  look.candidates.ts   etapa 1: pools ancorados na peça aberta
  persona.prompt.ts    a instrução da SÍNTESE (passada 1)
  persona.agent.ts     derivarPersona · validarPersona · obterPersona
  look.prompt.ts       a instrução da COMPOSIÇÃO (passada 2)
  look.agent.ts        etapas 2 e 3, validação (falhou = `null`, sem fallback)
  look.d1.ts           único arquivo com SQL de `looks`, `personas` e `orders`
  look.actions.ts      o que o loader consome
  index.ts
```

Espelha `src/platform/shelf/`, que é o padrão que o validador de
`.claude/skills/agent-creator/` cobra. O nome é `look` e não `agent` porque
`src/platform/agent/` está construído na branch
`feature/agente-vendas-ia-phase1` e criar o diretório aqui garantiria conflito
— mesma razão que fez `shelf` se chamar `shelf`.

### Arquivos existentes a modificar

| Arquivo | Mudança | Risco |
|---|---|---|
| `src/loaders/` | `completeTheLook.ts` novo | baixo |
| `src/setup.ts` | registrar o loader | baixo — copiar de `personalShelf` |
| `src/sections/Product/` | `CompleteTheLook.tsx` | baixo |
| `src/components/header/` | seletor de local | baixo |
| `src/loaders/catalogProductDetailsPage.ts` | grava `deco_recent` | baixo — é o loader que roda em toda PDP |
| `.deco/blocks/` | posicionar a section na **home** | conteúdo |

> **A escrita de `deco_recent` nunca ficou em `src/server.ts`.** O plano previa
> um middleware ali; a implementação a pôs no loader do look, com o argumento de
> que ele rodava em toda PDP. Quando a section saiu da PDP e passou a existir só
> na home, esse argumento caiu junto — e como aquela era a **única** escrita do
> cookie no repositório, um dos quatro sinais do agente virou constante zero sem
> erro nenhum. Hoje quem grava é o loader da PDP, que é o único que de fato roda
> em toda visita a produto.

---

## 7. As regras que não podem cair

Herdadas da spec aprovada e do agente da vitrine. Cada uma já custou caro uma
vez.

1. **O modelo escolhe de uma lista, nunca inventa.** Handle fora dos candidatos
   é descartado, jamais corrigido por proximidade.
2. **Disponibilidade é do banco, não do modelo.** `JOIN variants` no render.
3. **`ocasiao` é `string`.** Uma união de literais trava o sistema em moda para
   sempre, e de forma silenciosa.
4. **Nenhum literal de catálogo em `src/platform/look/`.** Sem `"T-Shirt"`, sem
   `"inverno"`, sem `Size`.
5. **Nada de carrinho ou checkout.** O agente é read-only — exclusão da spec.
6. **Nenhuma UI de chat.** O motivo é texto no card.
7. **A section busca dados client-side.** O HTML da PDP tem TTL longo; renderizar
   no servidor congela a personalização dentro da janela do pitch e parece
   quebrado. É o bug mais provável de aparecer no dia.
8. **Nada lança.** Todo caminho de falha termina em `null`, e `null` é a section
   sumindo — nunca um erro na tela, nunca um look de consolação.
9. **Ou é do agente, ou não aparece.** Nenhuma peça chega à tela sem motivo. A
   ordenação por SQL não é fallback; ela não existe mais.
10. **O público é o usuário logado.** Comportamento com visitante anônimo não é
    requisito, não é medido e não decide desenho — ver o recorte no topo. Um
    achado cujo único cenário seja "visitante sem histórico" está fora de
    escopo por definição, e não vira tarefa.
11. **Nenhuma tabela de pesos.** Critério não se pondera em código com número
    escolhido a olho. Os sinais vão inteiros ao modelo com o que cada um
    significa dito em português, e é ele que decide quanto pesam. A `FORCA`
    caiu na #26 e não volta por conveniência.
12. **A persona descreve, nunca supõe.** *"cor dominante: escuros"* com as peças
    que provam, jamais *"prefere neutros"*. É a mesma regra de
    `look.prompt.ts:183`, e ela vale ainda mais na síntese: um retrato é
    exatamente o formato em que a suposição se disfarça de conhecimento.
13. **Eixo sem evidência não existe.** `validarPersona` descarta o eixo inteiro
    quando um título citado não está entre os sinais — descarta, nunca conserta,
    e nunca casa por proximidade. Evidência inventada é alucinação com aparência
    de fundamento, e ela fica **a montante** de todos os looks daquela pessoa.

---

## 7b. O que foi verificado (2026-08-08)

Contra o Supabase e o Decopilot reais, não em teste sintético. Âncora:
`vintage-wash-tee` (*Vintage Wash Tee - Black*), 18 candidatos, 15 tipos.

> **09/08 — a wishlist do banco chegando como semente.** Onze asserções contra o
> banco real (`npm run look:wishlist`), num eixo que discrimina: sem cookie na
> requisição, a metade do banco fica isolada e é exatamente o que se quer medir.
>
> `favoritosDe` devolveu 3 sementes com **tags** (5, 6 e 4 — logo alimentam
> `combinaComOGuardaRoupa`) e com a data de **quando** cada uma foi favoritada,
> não o instante da consulta. E-mail sem favoritos devolve vazio; sem sessão, não
> há wishlist do banco.
>
> O trecho mais informativo da saída, com dados de verdade:
>
> ```
> purchased+wishlist Ctrl+Shift+Tote Bag   ← favoritou E comprou: as duas origens
> wishlist           Essential Cotton Tee
> wishlist           Code Wizard Hat
> ```
>
> É o `consolidar` fazendo o que deve **depois que a pesagem caiu**: a mesma peça
> chegando por duas origens ocupa uma entrada só, e leva as duas. A versão
> anterior desta nota dizia *"com a origem mais forte"* — não há mais forte, e
> `purchased+wishlist` diz mais que qualquer um dos dois sozinho.
>
> **`npm run look:wishlist:e2e`** fecha o outro lado: semeia `wishlist_items`,
> confere que o dado chega ao prompt e apaga o e-mail de teste no fim. O eixo ali
> **não** é o conjunto de candidatos — a semente não filtra o pool, os dois lados
> veem os mesmos 18. Ela entra por `comOGuardaRoupa`: 14 candidatos marcados por
> afinidade e 2 por saturação com a wishlist, **zero** sem ela.

**O clima é inferido, e isso muda a escolha — não só o texto.** Mesma peça,
mesmo pool, mesmo código, só a string da cidade mudando:

| | Porto Alegre, agosto | Recife, agosto |
|---|---|---|
| Jaqueta jeans | ✅ *"noites frias de agosto"* | ❌ |
| Jaqueta de couro | ✅ *"camada preta extra para o frio"* | ❌ |
| Moletom | ✅ *"por cima em dia mais frio"* | ❌ |
| Gorro | ✅ *"fecha a camada de frio"* | ❌ |
| Chambray | *"sobrecamisa nas horas amenas"* | *"leve para o **calor de Recife**"* |
| Boné | *"fecha o visual sem pesar"* | *"leve, sem pesar **no calor**"* |
| Bloco dominante | *para o frio* | *para o calor* |

As quatro peças de agasalho estavam disponíveis nos **dois** pools. O modelo as
descartou em Recife. Nenhuma linha de código sabe que agosto é inverno no sul.

**As sementes mudam a composição.** Com `tailored-blazer` e `wide-leg-trousers`
como compras, o agente puxou a paleta inteira para preto e escreveu *"o tênis
vintage que acompanha a calça que você já comprou"*.

**Zero handles inventados** em quatro execuções. Confiança 0.75 nas quatro,
origem `agente`, 22–41s.

### Dois defeitos achados e corrigidos na verificação

1. **O agente recomendava uma peça já comprada.** Com o blazer como semente
   `purchased`, ele voltava dentro do look — com o motivo *"você já tem este
   blazer preto"*, que é texto bom e resultado errado: o card tem preço e botão
   de comprar. Correção: sementes `purchased` saem do pool.
   **Só `purchased`** — favoritar e ver não tiram a peça de circulação, porque a
   fronteira é *ter ou não ter*. A exclusão vive em `jaComprados()`, exportada,
   porque `look.actions.ts` também conta candidatos antes de disparar o agente e
   as duas contagens têm de bater; divergirem faria a PDP gastar um minuto de
   modelo a cada visita para um pool que o agente recusaria por pequeno.

2. **O dry run mentia sobre o agrupamento.** Ele imprimia um cabeçalho toda vez
   que o rótulo mudava em relação à peça anterior, e o modelo intercala
   ocasiões — então *"para o frio"* aparecia três vezes e o agrupamento parecia
   quebrado quando não estava (a section usa um `Map` e funde). Num script que é
   a única janela para a saída do agente, um print que não bate com a tela manda
   ajustar um prompt que está certo.

---

## 7c. O que a passada 1 NÃO tem (2026-08-09)

A §7b acima mediu o agente contra o Decopilot real. **A persona não tem nada
disso**, e a distinção importa porque as duas seções ficam lado a lado: o
provedor está sem token, então nenhuma síntese real rodou.

O que foi provado sem modelo — e é o contrato, não a qualidade:

| | |
|---|---|
| `look:check` | 45/45, com 9 asserções novas sobre `validarPersona` e o hash |
| Round-trip da `0019` | contra o Postgres: evidência sobrevive ao JSON, UPSERT idempotente, falha nunca vira persona na tela, falha não apaga persona boa |
| Caminho de falha | ponta a ponta: sem retrato → compõe pelas sementes; e a **2ª execução nem tenta**, entra na quarentena |

O último foi presente do provedor caído, e não seria fácil montar de propósito:
o modo de falha mais caro desta feature é *"o provedor está fora e o sistema
responde gerando mais carga"*.

**Segue sem resposta:** o retrato é melhor que a pesagem? Só
`npm run look:eval -- --rotulo persona --n 3 --persona` responde, e o número que
decide é a **estabilidade**, não "mudou". E há um que só o olho dá: os motivos
continuam citando peças reais, ou a persona os transformou em generalidade?

---

## 8. Plano de execução

| # | Passo | Prova de que funcionou | ~h |
|---|---|---|---|
| 1 | `0014` + `look.d1.ts` | `db:migrate` roda duas vezes sem erro | 30min |
| 2 | `look.local.ts` + seletor | trocar a cidade muda o `Local` no JSON | 1h |
| 3 | `look.seeds.ts` | uma persona devolve os 4 `SeedKind` numa lista só | 1h30 |
| 4 | `look.candidates.ts` | abrir qualquer peça dá ≥ 8 complementos de ≥ 4 tipos | 1h |
| 5 | `look.prompt.ts` + `look.agent.ts` | dry run: JSON puro, zero handle inventado | 2h |
| 6 | loader + section na PDP | **abrir a camisa preta e o look aparecer com os motivos** | 2h |
| 7 | pré-aquecer o roteiro | os produtos da demo respondem do cache | 30min |
| 8 | trocar cidade ao vivo | **mesma peça, cidade diferente, look diferente** | — |

**O corte é o passo 5.** Com o agente respondendo e gravando, existe demo. O
passo 8 não custa hora nenhuma porque cai de graça do passo 2 — e é o momento
mais forte do pitch.

**Ordem de corte se o tempo apertar:** 8 → 7 → 3 (as sementes viram só
`deco_wishlist`, e o look ainda é pessoal). Do 1 ao 6 não há o que cortar.

### O dry run vem antes da section

`npm run look:dryrun -- <handle>` imprime o look sem gravar. É a única forma
prática de olhar a saída do agente: as sections são diferidas, e **status 200
não é sinal de saúde neste site** — um loader que falha vira section vazia e a
página continua 200. A lição está em `docs/agente-vitrine.md` e não precisa ser
aprendida de novo.

---

## 9. O estado dos outros documentos

| Documento | Estado |
|---|---|
| `agente-vitrine.md` | **em vigor** — descreve o agente construído, que esta feature reusa |
| `persona-do-guarda-roupa.md` | **em vigor** — a passada 1, que substituiu a tabela de pesos. Implementada e verificada estruturalmente; **sem medida de qualidade** até o `look:eval -- --persona` rodar |
| `pedidos-e-compra-simulada.md` | **em vigor** — a quarta semente (`comprou`), que a §5 daqui listava como falta |
| `feature-back-in-stock-shelf.md` | **em vigor** — o sinal de "avise-me", que aqui vira uma das quatro sementes |
| `catalog-population.md` | **em vigor** — o catálogo de 136, que é o que torna a composição possível |
| `deploy-vercel-supabase.md` | **em vigor** — infra |
| `tese-agente-vendas-ia.md` r6 | **normativa e parcialmente ociosa**: o agente de busca que ela especifica está fora do fim de semana. As `explicit_exclusions` continuam valendo |
| `personal-shopping-agent-proposta.md` | **parcialmente superado** — §§1-2 e 12 valem; §3, §4, §5, §7 e §11 foram substituídos por este arquivo |
| `personal-shopping-agent-mudancas.md` | **parcialmente superado** — §1 (genérico) e §10 (o que não muda) valem; §§3-4 e 8 substituídos. **§2 não vale aqui**: ela argumenta pela continuidade do histórico do visitante anônimo, e esta feature não atende anônimo — ver o recorte no topo |
| `tese-admin-agentes.md` | **fora do escopo do fim de semana** — nenhuma tela de admin é construída |
| `agente-especificidade-de-cor.md` | **parcialmente superado** — o núcleo (fazer o agente usar a cor do armário) foi para `main` pela #16, por um caminho melhor; vale a §4: a `0018` e as três regras de prompt que a #16 não cobre |
| `medicao-baseline-cor.md` | **histórico, não comparável** — medido antes da `0018`, com outros títulos e outro prompt. Valem só os achados metodológicos (estabilidade por condição, o orçamento do motivo); os números absolutos **não** servem de critério de aceite |
| `personal-shopping-agent-mvp.md` | revogado |
| `personal-shopping-agent-optimization.md` | revogado |
| `personal-shopping-agent-pre-changes.md` | histórico |
