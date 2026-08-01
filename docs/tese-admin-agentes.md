# Tese: Admin de Agentes — a superfície de controle e demonstração

> Documento de design. Serve como contexto para desenvolvimento — define o **quê** e o **porquê**, e fixa as decisões arquiteturais já tomadas. Não é plano de implementação (schemas finais, rotas e tarefas vêm depois).

> **⚠️ Enquadramento — leia antes de tudo.** O produto principal são **os agentes** (§12). Este admin **não é o entregável**: é o arnês onde a gente organiza, opera, inspeciona e demonstra a frota. Toda decisão neste documento existe pra servir os agentes, não pra competir com eles por tempo de desenvolvimento.

---

## ⚠️ Status neste repositório — leia antes de implementar qualquer coisa daqui

Este documento foi escrito **antes** da spec de vocês e descreve um desenho **mais amplo** que o aprovado. Ele está aqui como material de visão e de pitch, **não como plano de execução**.

**A spec aprovada é [`tese-agente-vendas-ia.md`](tese-agente-vendas-ia.md).** Onde os dois divergirem, a spec ganha. Em particular, ela exclui explicitamente (`explicit_exclusions`) a escrita programática de bloco CMS — que é a fundação de boa parte deste documento.

> **Atualizado na revisão 3 da spec.** A tabela abaixo foi revista: parte do que estava
> marcado como "fora do escopo" foi **adotado** na spec aprovada, e a exclusão de escrita
> de bloco CMS deixou de ser um bloqueio para virar uma **configuração de autonomia**.

| Deste documento | Situação na v1 |
|---|---|
| Artefato único + gate de autonomia (§3) | **Adotado integralmente** na spec (`admin_surface.decision`) |
| Proposta com `before`/`after` e `evidence` (§6) | **Adotado** — `before` é o que torna o undo gratuito |
| Níveis de autonomia (§4) | **Adotado, reduzido a dois**: `sugerir` (default) e `autonomo` (opt-in do lojista) |
| Aprovar / reverter (§8) | **Dentro do escopo** — ver caminhos de aplicação na spec |
| Publicar como A/B (§8) | **Fora do escopo na v1** — ver nota sobre `auto-ab` abaixo |
| Preview via `/deco/render` (§5) | Opcional; cortável. O plano B (bloco `Preview`) é o caminho seguro |
| Frota de 3 agentes (§12) | **Dois** na v1: busca conversacional + coleções sugeridas |
| Admin como superfície da frota (§2) | Vira **section CMS** em página não indexada, não rota `/admin/*` |
| Honestidade sobre métricas (§11) | **Vale integralmente** — conversão saiu do dashboard |
| Guardrails e zonas proibidas (§10) | **Vale integralmente** |
| Teto de esforço do admin (§8) | **Vale integralmente** |
| Sequência de construção — Merchandiser primeiro (§12) | **Substituída** — ver nota 5 abaixo |

O padrão de execução do que **está** aprovado vive na spec
[`tese-agente-vendas-ia.md`](tese-agente-vendas-ia.md).

---

## Reconciliação técnica (revisão 3)

**Escopo desta seção:** corrigir afirmações do *corpo deste documento* que não se
sustentam contra o repo. Onde uma decisão técnica foi tomada, ela vive na spec e aqui
fica só o ponteiro — para não existirem duas versões da mesma decisão divergindo com o
tempo. Este documento é **não-normativo**: ele responde *por que* a frota importa; a spec
responde *o que* construir.

### 1. Verificação das primitivas (§2, §9)

| Afirmação | Status |
|---|---|
| `src/routes/deco/render.ts` | ✅ existe |
| `.deco/blocks/Teste AB.json` com matcher `random.ts` | ✅ existe, exatamente como citado |
| `PLP Loader.json` | ✅ existe |
| `DECO_KV` bindado | ✅ `wrangler.jsonc:36-43` |
| sem `triggers.crons` | ✅ correto — nem trigger, nem handler `scheduled` |
| `.claude/skills/store-agent/SKILL.md` | ❌ **não existe** — diretório ausente e não está no `.gitignore` |

O último era um link do cabeçalho e foi removido. `render.ts` existe mas é uma linha
delegando para `decoRenderRouteConfig()` sem argumentos — a pendência do §5 (aceita props
inline?) **não é respondível a partir deste repo**, a resposta está dentro de
`@decocms/tanstack`. O plano B do §5 é o caminho seguro e a convenção já existe
(`.deco/blocks/Preview %2Fsections%2F....json`).

### 2. Correções que viraram decisão na spec

Três afirmações do corpo deste documento estavam erradas ou incompletas. As três foram
corrigidas **e decididas** na spec — não repito o conteúdo aqui:

| Afirmação neste doc | Correção | Onde a decisão vive |
|---|---|---|
| §9: "KV dá conta; só migrar para D1 se precisar cruzar métrica em query" | Certo para Propostas, errado para o log de buscas — que é exatamente a exceção prevista. Os dois convivem, com namespace próprio. | spec → `build_sequence.phase_0_unblock` |
| §8/Pendências: "Aprovar vira commit direto ou PR" | O Worker não escreve arquivo, mas **cria commit e PR pela API do GitHub**. Deixa de ser decisão de implementação e vira o seletor de autonomia do §4. | spec → `admin_surface.apply_paths` e `worker_capability_note` |
| §2: "um agente que escreve `.deco/blocks/*.json` edita a loja de verdade" | Verdade, mas escrever conteúdo direto no `DECO_KV` cria drift: o próximo deploy sobrescreve em silêncio, porque o git continua sendo a fonte da verdade. | spec → `admin_surface.drift_warning` |

### 3. Sequência de construção (§12) — substituída

O §12 afirma que o Merchandiser é construído primeiro por exercitar o pipeline inteiro. A
spec aprovada tem o **agente de busca** como o primeiro, e é ele que gera o
`AgentQueryLog` do qual o agente de coleções depende. A ordem do §12 está vencida —
quem ler aquela seção isolada começa pelo agente errado.

### 4. `auto-ab` (§4) — a capacidade existe, a demonstração não

O nível é conceitualmente o mais forte do documento, e o matcher realmente é uma linha.
Mas "promove ou descarta sozinho conforme resultado" exige **conversão medida**, e o §11
deste mesmo documento reconhece que a loja demo não tem tráfego real. O que falta não é
infra de experimentação — é o sinal que fecha o loop.

Duas saídas honestas: apresentar como capacidade arquitetural com o critério de promoção
declarado mas não exercido, ou rodar com evento sintético e o selo de "dados simulados"
que o §11 já prevê. O que não dá é deixar ambíguo — é exatamente onde um avaliador cutuca.
Por isso `auto-ab` ficou fora da v1 e a spec reduziu os níveis a `sugerir` e `autonomo`.

### 5. Autonomia — a tese do §3/§4 foi adotada

`agent.autonomy` é configuração persistida por agente, alterável em runtime, exatamente
como este documento propõe. A v1 reduz os quatro níveis a dois (`sugerir`, `autonomo`) e
sai de fábrica em `sugerir`.

O motivo de `autonomo` não ser o default é de conteúdo, não técnico, e a decisão de
assumir esse risco é do dono da loja — por isso é seletor, não valor fixo no código.
Níveis, caminhos de aplicação e o risco em si: spec → `admin_surface.autonomy_level` e
`risks.autonomous_content_from_user_text`.

---

## 1. O problema

Duas camadas de problema, e o admin ataca a segunda.

**Para a loja:** agentes de IA aplicados a e-commerce esbarram sempre no mesmo muro — **ninguém entrega a loja de produção pra uma IA sem ver o que ela vai fazer.** O dono da loja não quer um chat que "sugere"; quer trabalho feito. Mas também não aceita uma caixa-preta reordenando vitrine e reescrevendo PDP sem prestar contas.

**Para nós:** vamos construir vários agentes que agem sobre a mesma loja, de forma assíncrona e às vezes autônoma. Sem uma superfície comum, isso vira um punhado de scripts soltos — impossível de inspecionar durante o desenvolvimento e impossível de demonstrar em sequência. Cada agente acabaria com sua própria demo improvisada, e o conjunto não se leria como um sistema.

O que falta, nos dois casos, não é capacidade do modelo. É **visibilidade**: ver o que o agente fez, o que vai fazer, e desfazer.

## 2. A tese

> **Os agentes são o produto. O admin é o arnês comum que os torna operáveis, inspecionáveis e demonstráveis — e, de quebra, é a resposta pronta para "e se a IA fizer besteira na minha loja?".**

Construímos uma superfície única onde toda a frota **aparece, se explica e é controlada**: o que cada agente propôs, com preview real da mudança, com nível de autonomia ajustável agente por agente, e reversível em um clique.

Ele rende em três frentes ao mesmo tempo, e é por isso que vale construir:

- **Desenvolvimento** — enquanto a gente constrói cada agente, o admin é onde se vê a saída dele sem esperar cron, sem ler log, sem publicar nada. O botão *dry run* (§5) é ferramenta de dev antes de ser feature.
- **Demonstração** — a frota inteira se apresenta num lugar só, com narrativa contínua em vez de três demos desconexas.
- **Narrativa de produto** — a governança (autonomia por agente, guardrails, undo) é o que torna crível que esses agentes rodem em produção. É argumento de apoio, não a tese central.

**O que isso implica na prática:** o admin é deliberadamente pequeno e sem graça por dentro. Toda vez que surgir a escolha entre polir o admin e aprofundar um agente, **aprofundar o agente ganha**. A §8 lista o escopo fechado justamente pra essa decisão já vir tomada.

### Por que isso é executável neste stack

O scaffolding deco dá três primitivas que tornam o desenho executável em vez de aspiracional:

1. **`.deco/blocks/*.json` é a fonte da verdade** de conteúdo, layout e config de loader. Um agente que escreve esses arquivos **edita a loja de verdade** — sem backend novo, sem painel paralelo, sem integração.
2. **`/deco/render`** renderiza seção/página no servidor. A preview da proposta é a loja renderizada, não um mockup.
3. **A/B é um bloco de uma linha**: `{"__resolveType":"website/matchers/random.ts","traffic":0.5}` (ver `.deco/blocks/Teste AB.json`). O agente cria variante sem infra de experimentação.

Diff, preview e rollback saem quase de graça porque a mudança **é um arquivo JSON versionado em git**.

---

## 3. A decisão arquitetural central

> **Modo automático não é um caminho de código diferente.**

Toda execução de agente — manual, agendada ou totalmente autônoma — produz o **mesmo artefato**: uma **Proposta**. O nível de autonomia decide apenas o que acontece com ela depois de criada.

```
run(agent, { commit })
        │
        ▼
   ┌─────────┐
   │Proposta │  { before, after, hipótese, evidência, impacto, confiança }
   └────┬────┘
        │
        ▼
 ┌──────────────┐
 │ gate de      │  observar · sugerir · auto-ab · autônomo
 │ autonomia    │
 └──────┬───────┘
        │
   ┌────┴────┬──────────┬───────────┐
   ▼         ▼          ▼           ▼
descartada  fila     variante    aplicada
            humana    A/B 50%    + undo
```

**Consequências dessa decisão** (é por isso que ela vale):

- **Preview existe sempre**, em qualquer modo, porque sempre existe uma Proposta pra renderizar. Automático não é "sem proposta" — é "proposta auto-aprovada".
- **Dry run é trivial**: é o mesmo `run()` com `commit: false`. Nada de simulador separado.
- **Rollback é trivial**: o `before` está guardado na Proposta. Reverter é reescrever o `before`.
- **Mudar o nível de autonomia não muda o agente.** É configuração, não código. Um agente sobe de `sugerir` pra `autônomo` sem reescrita.

---

## 4. Níveis de autonomia

Configurável **por agente**, não global.

| Nível | Comportamento | O que o dono vê |
|---|---|---|
| `observar` | Só analisa e reporta. Nunca propõe mudança. | Achados e alertas, sem diff |
| `sugerir` | Cria Proposta e espera decisão humana | **O que vai acontecer** |
| `auto-ab` | Publica como variante A/B (50%), promove ou descarta sozinho conforme resultado | As duas variantes ao vivo + placar |
| `autônomo` | Publica direto na loja | **O que acabou de acontecer** + janela de undo |

Esse seletor é o coração do produto. Ele responde antecipadamente à pergunta que todo avaliador e todo cliente faz — *"e se a IA fizer besteira na minha loja?"* — e permite o caminho natural de adoção: o dono começa tudo em `sugerir`, ganha confiança em um agente específico, e promove só aquele.

`auto-ab` é o nível mais interessante conceitualmente: **autonomia com rede de segurança estatística**. O agente age sozinho, mas metade do tráfego fica protegido e a promoção depende de resultado medido, não de opinião do modelo.

---

## 5. Preview: a diferença é o tempo verbal

Preview não é uma tela — são três perguntas, e o modo do agente decide qual está sendo respondida.

### "O que **vai** acontecer" — modo `sugerir`
Renderiza o `after` da Proposta pendente ao lado do estado atual. Decisão informada antes do fato.

### "O que **acabou** de acontecer" — modo `autônomo`
Como o `before` foi guardado na Proposta, os dois lados continuam renderizáveis mesmo depois da publicação. **Sem isso, agente autônomo vira caixa-preta** — e a tese inteira cai.

### "O que aconteceria **se rodasse agora**" — qualquer modo, sob demanda
Botão **Dry run**. Executa o agente de verdade, gera a Proposta, renderiza o resultado, **não persiste nada**.

Essa terceira é a que faz o modo automático parecer seguro em vez de assustador. O dono da loja pode, a qualquer momento, perguntar a um agente autônomo "me mostra o que você faria agora" sem consequência. **Um agente autônomo sem dry run é um agente que ninguém liga.**

### Mecânica da preview

Caminho principal: `iframe` apontando para `/deco/render` com os props do `after`.

> ⚠️ **A verificar antes de implementar:** se `decoRenderRouteConfig` (`src/routes/deco/render.ts`) aceita props inline no request. Se aceitar, preview é direta. Se só resolver blocos já existentes, o plano B é o agente escrever um bloco descartável `Preview <agente> <id>` e renderizar esse — convenção que **já existe no repo** (`.deco/blocks/Preview %2Fsections%2FProduct%2FProductDetails.tsx.json` e similares). Ambos funcionam; muda pouca coisa de implementação.

---

## 6. O artefato: Proposta

Tudo no admin é uma view sobre este objeto. Definir ele bem é o que faz o resto do sistema ser barato.

```jsonc
{
  "id": "prp_01H...",
  "agent": "merchandiser",
  "run_id": "run_01H...",
  "created_at": "2026-08-01T14:00:00Z",

  // A mudança
  "target": ".deco/blocks/PLP%20Loader.json",
  "before": { /* JSON do bloco antes */ },
  "after":  { /* JSON do bloco proposto */ },

  // O porquê — em linguagem natural, é o que o humano lê primeiro
  "hypothesis": "Subir 'Camiseta X' de #12 para #3 na vitrine de destaque",
  "reasoning": "CTR de 4.2% (2.1x a média da vitrine) com 80 unidades paradas há 21 dias.",

  // Procedência — todo número tem que ser clicável
  "evidence": [
    { "metric": "ctr", "value": 0.042, "window": "7d", "source": "analytics.plp" },
    { "metric": "stock_age_days", "value": 21, "source": "shopify.inventory" }
  ],

  "estimated_impact": { "metric": "plp_conversion", "delta": "+0.8%", "confidence": 0.74 },

  "status": "pending",        // pending | approved | rejected | applied | ab_running | reverted
  "applied_as": null,         // null | "commit" | "pr" | "ab_variant"
  "decided_by": null,         // "human:email" | "auto:autonomy_level"
  "result": null              // preenchido depois da medição
}
```

**Regra inegociável: nenhum número no admin sem procedência clicável.** Todo card abre "de onde veio isso". Isso transforma a fraqueza óbvia (métrica de loja demo) em ponto forte de credibilidade.

---

## 7. Workflows (estilo Tines)

Agentes não são só "roda a cada hora" — são sequências de passos com condições. Mas **editor visual drag-and-drop é armadilha**: dois dias de UI que não aparece no pitch e não é o diferencial.

### A escolha: workflow declarativo, visualização read-only

```jsonc
{
  "agent": "merchandiser",
  "trigger": { "cron": "0 * * * *" },
  "steps": [
    { "id": "coletar", "run": "analytics.plp_performance", "window": "24h" },
    { "id": "decidir", "run": "llm.rank_proposal", "input": "$coletar" },
    { "id": "guardar", "if": "$decidir.confidence > 0.7", "run": "proposal.create" }
  ],
  "autonomy": "auto-ab"
}
```

Renderizar isso como grafo de caixinhas com status por passo (✓ rodou / ⏳ rodando / ✗ falhou) e duração entrega ~90% do valor visual do Tines por uma fração do custo. Editar é editar o JSON. Drag-and-drop só se sobrar tempo.

### Triggers por evento, no mesmo formato

Além de `cron`, o mesmo dispatcher aceita:

```jsonc
{ "trigger": { "event": "search.zero_results" } }
{ "trigger": { "event": "product.out_of_stock" } }
```

Isso muda a natureza da demo: em vez de esperar o relógio, você provoca o evento na loja ao vivo (faz uma busca sem resultado) e o agente acorda na hora.

---

## 8. As quatro telas do admin

Escopo deliberadamente pequeno. Cada tela existe porque aparece no pitch.

1. **Fila de propostas** — o que cada agente quer mudar, agrupado por agente, com o "porquê" em linguagem natural em destaque. É a home.
2. **Diff + preview lado a lado** — o JSON antes/depois e a loja renderizada da variante. **É a tela onde o trabalho do agente fica visível** — a única que merece capricho visual.
3. **Decisão** — Aprovar / Rejeitar / Publicar como A/B. "Aprovar" vira commit ou PR no `.deco/blocks/*.json` **via GitHub API** (o Worker não escreve arquivo — reconciliação §2), ou grava em D1 para a section ler direto, sem tocar em bloco; "A/B" cria o matcher com 50% de tráfego (fora da v1 — reconciliação §4).
4. **Timeline de decisões** — o que foi publicado, por quem (humano ou agente), quando, qual resultado, e **reverter em um clique**.

Mais o **seletor de autonomia** e o **dry run** presentes no card de cada agente.

### Fora de escopo (explicitamente)

Login e multiusuário, permissões e papéis, gráficos genéricos de BI, configuração de agente por formulário, editor visual de workflow, notificações por e-mail/Slack. Nada disso aparece na apresentação e tudo isso consome o tempo que deveria ir para os agentes.

### Teto de esforço

O admin é infraestrutura de apoio, e infraestrutura de apoio tem orçamento fixo. Regra prática: **se o admin passar de ~25% do esforço total, algo saiu do lugar** — ou o escopo vazou, ou estamos polindo pixel em vez de aprofundar agente.

Sinais de que vazou: aparecer estado de UI que não vem direto de uma Proposta; aparecer tela que nenhum agente alimenta; alguém abrir discussão de design system. O teste é sempre o mesmo — **essa tela mostra trabalho de agente?** Se não, corta.

O corolário positivo: quanto mais o admin for genérico sobre a Proposta (§6), mais barato fica adicionar o quarto e o quinto agente. Um agente novo deveria aparecer no admin **sem escrever tela nova**. Se precisar de tela nova, o schema da Proposta está errado — conserta o schema, não a tela.

---

## 9. Encaixe no repositório

| Necessidade | Como resolve aqui | Status |
|---|---|---|
| Agendamento | `"triggers": { "crons": [...] }` em `wrangler.jsonc` + handler `scheduled` que despacha por agente | Config trivial, ainda não existe |
| Persistência | KV com chaves `proposal:<agent>:<ts>:<id>` e `run:<agent>:<ts>`; `list` por prefixo cobre fila e timeline. Em **namespace próprio**, não no `DECO_KV` do framework — reconciliação §2 | Binding a criar |
| Aplicar mudança | GitHub REST API → commit ou PR em `.deco/blocks/*.json`. **Não** por filesystem — ver reconciliação §2 | Fonte da verdade documentada em `AGENTS.md` |
| A/B | Criar bloco matcher `website/matchers/random.ts` com `traffic: 0.5` | Padrão já existe (`Teste AB.json`) |
| Preview | `iframe` → `/deco/render` | ⚠️ contrato a verificar (§5) |
| Rollback | Reescrever o `before` guardado na Proposta | Sai de graça do §3 |

**Nota sobre D1 (revista):** KV dá conta das Propostas; o log de buscas precisa de D1. Os dois convivem, com namespace próprio. Detalhe e decisão: reconciliação §2.

---

## 10. Guardrails

Baratos de implementar, e demonstrá-los é parte do pitch.

- **Raio de alcance por agente** — máximo de N blocos por execução; allowlist de quais blocos o agente pode tocar.
- **Zonas proibidas** — preço e checkout nunca são tocados por agente, em nenhum nível de autonomia.
- **Kill switch global** — botão no topo do admin que congela toda a frota. Mostrar que ele existe conta pontos.
- **Janela de undo** — toda mudança de agente `autônomo` fica revertível em um clique por um período definido.
- **Auto-revert** — queda de métrica além de um limite reverte sozinho, sem esperar humano.

---

## 11. Honestidade sobre métricas

Loja demo não tem tráfego real. Taxa de conversão nela é zero ou é inventada, e avaliador de e-commerce reconhece métrica fabricada imediatamente.

**Decisão:** nunca apresentar número simulado como se fosse real. Dois caminhos aceitáveis, podendo coexistir:

- **Simulação rotulada** — replay de eventos sintéticos, com selo visível de "dados simulados" no admin.
- **Métricas honestas de processo** — o que é genuinamente mensurável durante o desenvolvimento: produtos enriquecidos, gaps de busca fechados, LCP antes/depois, propostas aprovadas vs. rejeitadas, tempo humano economizado por decisão.

A segunda é mais forte do que parece: ela mede exatamente o que estamos afirmando — trabalho autônomo com supervisão barata.

---

## 12. Os agentes — **este é o produto**

Tudo acima é andaime. O que é avaliado, e o que precisa ser profundo, é a frota. Prioridade:

1. **Merchandiser** — reordena vitrine (`PLP Loader`, `Product List Loader`) cruzando performance e estoque parado. É o agente que exercita o pipeline inteiro: proposta → diff → preview → A/B → medição → promoção. **Por ser o mais completo, é o primeiro a ser construído** — ele valida o arnês para todos os outros.
2. **Search** — busca por intenção sobre `SearchResult.tsx`; registra buscas sem resultado, que viram sinal para o Merchandiser e para o Catalog. É o mais visual e o mais fácil de entender em três minutos.
3. **Catalog Enrichment** — descrição, bullets, alt-text, JSON-LD; prioriza por tráfego alto × conversão baixa × descrição pobre.

Os três se alimentam — buscas sem resultado viram sinal de reordenação e gap de catálogo —, o que transforma três demos soltas em **um sistema**. Essa interligação é o diferencial real; o admin é o que a torna visível.

### Sequência de construção

O Merchandiser primeiro, ponta a ponta, com o mínimo de admin que ele exigir. Isso força o schema da Proposta (§6) a nascer de um caso real em vez de ser projetado no vácuo. Só depois generalizar o admin e plugar Search e Catalog — que, se o §8 estiver certo, entram **sem tela nova**.

---

## 13. O pitch em uma frase

> Uma frota de agentes trabalha sozinha na loja — reordenando vitrine, entendendo busca, enriquecendo catálogo — e uma superfície única mostra o que cada um vai fazer antes de acontecer, com quanta autonomia, e desfaz qualquer coisa em um clique.

---

## Pendências para a fase de implementação

Tarefas de implementação da v1 **não** vivem aqui — estão no `build_sequence` da spec.
O que segue é o que continua em aberto no desenho mais amplo deste documento.

- [x] Schema de Proposta — fechado na spec. **Workflow (§7) segue em aberto.**
- [x] Mapa de rotas do admin — não há rotas; virou section CMS (spec → `admin_surface.decision`).
- [x] Commit direto vs. PR — ambos possíveis; virou o seletor de autonomia (reconciliação §2).
- [ ] Contrato de `decoRenderRouteConfig` (aceita props inline?) — define o caminho da preview do §5. Não é respondível a partir deste repo: a resposta está em `@decocms/tanstack`. O plano B (bloco `Preview` descartável) destrava sem essa verificação.
- [ ] Formato do log de evidência (§6) — de onde cada métrica é lida, para a regra de procedência clicável valer na frota inteira.
- [ ] Schema de Workflow (§7) e o dispatcher de triggers por evento.
- [ ] Critério de promoção do `auto-ab` (§4) — ver reconciliação §4.
