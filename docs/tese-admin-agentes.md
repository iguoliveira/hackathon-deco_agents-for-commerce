# Tese: Admin de Agentes — a superfície de controle e demonstração

> Documento de design. Serve como contexto para desenvolvimento — define o **quê** e o **porquê**, e fixa as decisões arquiteturais já tomadas. Não é plano de implementação (schemas finais, rotas e tarefas vêm depois).

> **⚠️ Enquadramento — leia antes de tudo.** O produto principal são **os agentes** (§12). Este admin **não é o entregável**: é o arnês onde a gente organiza, opera, inspeciona e demonstra a frota. Toda decisão neste documento existe pra servir os agentes, não pra competir com eles por tempo de desenvolvimento.

---

## ⚠️ Status neste repositório — leia antes de implementar qualquer coisa daqui

Este documento foi escrito **antes** da spec de vocês e descreve um desenho **mais amplo** que o aprovado. Ele está aqui como material de visão e de pitch, **não como plano de execução**.

**A spec aprovada é [`tese-agente-vendas-ia.md`](tese-agente-vendas-ia.md).** Onde os dois divergirem, a spec ganha. Em particular, ela exclui explicitamente (`explicit_exclusions`) a escrita programática de bloco CMS — que é a fundação de boa parte deste documento.

| Deste documento | Situação na v1 |
|---|---|
| Proposta com `before`/`after` de bloco (§6) | **Fora do escopo** — sem escrita de bloco CMS |
| Aprovar / publicar como A/B / reverter (§8) | **Fora do escopo** |
| Níveis de autonomia (§4) | **Fora do escopo** — o agente é síncrono e read-only |
| Preview via `/deco/render` (§5) | **Fora do escopo** como fluxo de aprovação |
| Frota de 3 agentes (§12) | **Um** agente na v1: recomendação conversacional |
| Admin como superfície da frota (§2) | Vira `/admin/agent-dashboard`: ranking de tópicos, zero-result, conversão |
| Honestidade sobre métricas (§11) | **Vale integralmente** — aplica-se ao dashboard aprovado |
| Guardrails e zonas proibidas (§10) | **Vale integralmente** — virou `explicit_exclusions` na spec |
| Teto de esforço do admin (§8) | **Vale integralmente** |

As primitivas técnicas citadas aqui foram reverificadas neste repo e **existem** (`src/routes/deco/render.ts`, `.deco/blocks/Teste AB.json` com o matcher `random.ts`, `PLP Loader.json`, `DECO_KV` bindado, sem `triggers.crons` ainda). Ou seja: o caminho descrito é viável — foi descartado na v1 por **risco de cronograma**, não por impossibilidade. É exatamente assim que ele deve ser apresentado no pitch: próximo passo assumido, não limitação escondida.

O padrão de execução do que **está** aprovado vive em [`.claude/skills/store-agent/SKILL.md`](../.claude/skills/store-agent/SKILL.md).

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
3. **Decisão** — Aprovar / Rejeitar / Publicar como A/B. "Aprovar" vira commit ou PR no `.deco/blocks/*.json`; "A/B" cria o matcher com 50% de tráfego.
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
| Persistência | `DECO_KV` (já bindado). Chaves `proposal:<agent>:<ts>:<id>`, `run:<agent>:<ts>`. `list` por prefixo cobre fila e timeline | Binding pronto |
| Aplicar mudança | Escrever `.deco/blocks/*.json` → commit direto ou PR | Fonte da verdade documentada em `AGENTS.md` |
| A/B | Criar bloco matcher `website/matchers/random.ts` com `traffic: 0.5` | Padrão já existe (`Teste AB.json`) |
| Preview | `iframe` → `/deco/render` | ⚠️ contrato a verificar (§5) |
| Rollback | Reescrever o `before` guardado na Proposta | Sai de graça do §3 |

**Nota sobre D1:** KV dá conta na escala de demo. Só migrar para D1 se for preciso cruzar métrica com proposta em query — não é necessário para a primeira versão.

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

- [ ] Verificar o contrato de `decoRenderRouteConfig` (aceita props inline?) — define o caminho da preview
- [ ] Fechar o schema final de Proposta e de Workflow
- [ ] Definir mapa de rotas do admin
- [ ] Definir formato do log de evidência (de onde cada métrica é lida)
- [ ] Decidir: commit direto vs. PR como comportamento padrão de "Aprovar"
