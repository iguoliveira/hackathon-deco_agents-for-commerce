# Personal Shopping Agent — Plano de Desenvolvimento do MVP

## 0. Visão do projeto

### Objetivo

Construir um agente de recomendação para e-commerce capaz de personalizar a experiência de compra com base em:

- comportamento dentro da loja;
- histórico de compras;
- buscas e intenções recentes;
- preferências inferidas;
- contexto atual da navegação;
- catálogo e disponibilidade dos produtos.

A ideia central é não usar o LLM como um simples "recomendador de produtos".

O sistema será dividido em:

```text
Eventos do usuário
       ↓
Context Engineering
       ↓
Perfil contextual do usuário
       ↓
Agente
       ↓
Busca de candidatos
       ↓
Ranking
       ↓
Recomendação personalizada
       ↓
Interface da loja
```

O agente funciona como uma camada de decisão e orquestração. O ranking de produtos deve continuar sendo rápido, mensurável e determinístico sempre que possível.

---

# 1. O problema que estamos resolvendo

Um recomendador tradicional pode funcionar assim:

```text
Usuário
  ↓
Histórico
  ↓
Modelo de recomendação
  ↓
Produtos
```

O problema é que o histórico não explica necessariamente a intenção atual.

Exemplo:

```text
Usuário comprou:
- teclado
- mouse
- webcam
```

Isso não significa necessariamente que ele quer outro periférico.

Agora imagine que ele acabou de pesquisar:

```text
"monitor 4k para macbook"
```

e dentro da loja pesquisou:

```text
"monitor usb-c"
```

O sistema tem sinais muito melhores de que existe uma intenção de compra atual.

Portanto, queremos modelar:

```text
Quem é o usuário?
+
O que ele costuma comprar?
+
O que ele está fazendo agora?
+
O que ele provavelmente quer fazer a seguir?
```

---

# 2. Arquitetura geral

A arquitetura recomendada para o MVP:

```text
                         ┌──────────────┐
                         │    Browser   │
                         └──────┬───────┘
                                │
                         eventos/contexto
                                │
                                ▼
                    ┌─────────────────────┐
                    │ Event / Context API │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  User Context Store │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Personal Agent     │
                    │                     │
                    │ LLM + reasoning     │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┼─────────────┐
                 ▼             ▼             ▼
              Catalog        Orders       Behavior
                MCP            MCP           MCP
                 │             │             │
                 └─────────────┼─────────────┘
                               ▼
                     Candidate Retrieval
                               │
                               ▼
                         Product Ranking
                               │
                               ▼
                    Personalized Experience
```

---

# 3. Regra principal da arquitetura

## Não faça isso

```text
Todo request
   ↓
LLM
   ↓
"Quais produtos recomendar?"
```

Isso gera:

- latência;
- custo;
- resultados inconsistentes;
- dificuldade de avaliação;
- dificuldade de escalar.

## Faça isso

```text
Eventos
   ↓
Contexto estruturado
   ↓
Agente entende intenção
   ↓
Sistema recupera candidatos
   ↓
Ranking rápido
   ↓
Top produtos
```

O LLM deve responder principalmente:

> "O que este usuário parece estar tentando fazer?"

E o sistema de ranking responde:

> "Entre os produtos disponíveis, quais são os melhores para essa intenção?"

---

# 4. Passo 1 — Criar o catálogo

Antes de criar o agente, precisamos ter produtos estruturados.

Exemplo:

```json
{
  "id": "monitor-lg-27-4k",
  "name": "LG UltraFine 27 4K",
  "category": "monitor",
  "price": 3299,
  "brand": "LG",
  "attributes": {
    "resolution": "4K",
    "refresh_rate": 60,
    "size": 27,
    "usb_c": true,
    "hdr": true
  },
  "tags": [
    "produtividade",
    "mac",
    "usb-c",
    "4k"
  ]
}
```

O catálogo precisa permitir busca por:

- categoria;
- marca;
- preço;
- atributos;
- tags;
- disponibilidade;
- compatibilidade;
- texto semântico.

---

# 5. Passo 2 — Criar o sistema de eventos

Toda interação relevante deve gerar um evento.

Eventos iniciais:

```text
page_view
product_view
search
filter
sort
add_to_cart
remove_from_cart
wishlist
checkout_start
purchase
```

Exemplo:

```json
{
  "user_id": "user_123",
  "event": "search",
  "timestamp": "2026-08-07T20:00:00Z",
  "properties": {
    "query": "monitor 4k usb c"
  }
}
```

Outro exemplo:

```json
{
  "user_id": "user_123",
  "event": "product_view",
  "timestamp": "2026-08-07T20:02:00Z",
  "properties": {
    "product_id": "monitor-lg-27-4k"
  }
}
```

---

# 6. Passo 3 — Criar um Event Store

Para o MVP, não precisamos de uma arquitetura gigantesca.

Podemos usar:

```text
PostgreSQL
```

ou outro banco já disponível no projeto.

Tabela conceitual:

```text
user_events
-------------------------
id
user_id
event_type
timestamp
properties
session_id
```

Exemplo:

```text
user_123
search
"monitor 4k"
20:00

user_123
product_view
"LG UltraFine"
20:02

user_123
product_view
"Dell UltraSharp"
20:04
```

---

# 7. Passo 4 — Criar o User Context

Não devemos mandar milhares de eventos para o LLM.

Precisamos transformar eventos em contexto.

Exemplo:

```json
{
  "user_id": "user_123",

  "current_intent": {
    "name": "comprar monitor",
    "confidence": 0.91
  },

  "interests": [
    "produtividade",
    "Apple",
    "desk setup"
  ],

  "preferences": {
    "brands": ["LG", "Dell"],
    "price_range": {
      "min": 2000,
      "max": 4000
    },
    "resolution": ["4K"]
  },

  "recent_behavior": [
    "search: monitor 4k",
    "search: monitor usb-c",
    "view: LG UltraFine",
    "view: Dell UltraSharp"
  ],

  "purchase_history": [
    "MacBook Pro",
    "Magic Keyboard"
  ]
}
```

Esse objeto é o principal contexto do agente.

---

# 8. Passo 5 — Separar memória de intenção

Uma distinção importante:

## Memória

Coisas relativamente estáveis:

```text
Usuário gosta de Apple.
Usuário costuma comprar produtos premium.
Usuário já comprou MacBook.
```

## Intenção

O que está acontecendo agora:

```text
Usuário está procurando um monitor.
```

A arquitetura deve representar as duas coisas separadamente.

```text
User Profile
├── Preferences
├── Long-term interests
├── Purchase history
└── Behavioral patterns

Current Intent
├── Query
├── Category
├── Constraints
├── Recent signals
└── Confidence
```

---

# 9. Passo 6 — Criar as Tools

O agente precisa de ferramentas.

## Tool 1 — get_user_profile

```text
get_user_profile(user_id)
```

Retorna preferências e histórico relevante.

---

## Tool 2 — get_recent_behavior

```text
get_recent_behavior(user_id, window)
```

Exemplo:

```text
window = 7 days
```

Retorna:

```text
buscas
produtos vistos
categorias
carrinho
interações
```

---

## Tool 3 — get_current_context

```text
get_current_context(user_id)
```

Retorna:

```text
página atual
produto atual
query atual
categoria atual
itens no carrinho
```

---

## Tool 4 — search_products

```text
search_products({
  query,
  filters,
  limit
})
```

Exemplo:

```json
{
  "query": "monitor 4k usb-c",
  "filters": {
    "price_max": 4000,
    "available": true
  },
  "limit": 50
}
```

---

## Tool 5 — get_product

```text
get_product(product_id)
```

Busca detalhes do produto.

---

## Tool 6 — get_inventory

```text
get_inventory(product_ids)
```

Evita recomendar produtos indisponíveis.

---

# 10. Passo 7 — MCP

Depois de definir as Tools, podemos expô-las por MCP.

Uma possível divisão:

```text
Customer MCP
├── get_user_profile
├── get_recent_behavior
└── get_purchase_history

Catalog MCP
├── search_products
├── get_product
└── get_inventory

Store Context MCP
├── get_current_page
├── get_current_cart
└── get_current_search
```

O MCP não é o agente.

Ele apenas padroniza a comunicação entre o agente e os sistemas.

```text
Agent
  ↓
MCP
  ↓
Tool
  ↓
API / Database
```

Para o hackathon, também é perfeitamente válido implementar primeiro as Tools diretamente e colocar MCP como uma camada de integração depois. Não deixem MCP virar o objetivo do projeto.

---

# 11. Passo 8 — Browser Context

Essa é uma das partes mais interessantes do projeto.

Precisamos diferenciar:

```text
dados da loja
```

de:

```text
dados externos do navegador
```

O segundo grupo só deve existir quando houver uma forma legítima de obter esses dados, com consentimento e permissões adequadas.

Uma opção para o MVP é criar uma extensão/browser layer que exponha apenas dados selecionados.

Exemplo:

```json
{
  "recent_searches": [
    "monitor 4k para macbook",
    "melhor monitor usb c"
  ],

  "recent_topics": [
    "MacBook",
    "desk setup"
  ]
}
```

Não é necessário — e não é desejável — enviar o histórico completo do navegador.

A regra deve ser:

```text
Browser
  ↓
Consentimento
  ↓
Dados mínimos necessários
  ↓
Context Pipeline
```

---

# 12. Passo 9 — Inferir intenção

Agora podemos usar o LLM.

Input:

```json
{
  "recent_searches": [
    "monitor 4k para macbook",
    "monitor usb c"
  ],
  "store_behavior": [
    "viewed LG UltraFine",
    "viewed Dell UltraSharp"
  ],
  "purchase_history": [
    "MacBook Pro",
    "Magic Keyboard"
  ]
}
```

Prompt conceitual:

```text
Você é um classificador de intenção de compra.

Analise o contexto do usuário.

Determine:
1. intenção atual;
2. categoria;
3. atributos desejados;
4. restrições;
5. nível de confiança.

Não invente informações.
Use apenas evidências disponíveis.
```

Saída:

```json
{
  "intent": "comprar monitor para produtividade",
  "category": "monitor",
  "attributes": [
    "4K",
    "USB-C",
    "compatível com Mac"
  ],
  "confidence": 0.91
}
```

---

# 13. Passo 10 — Candidate Retrieval

Agora que sabemos a intenção:

```text
comprar monitor para produtividade
4K
USB-C
Mac
```

buscamos candidatos.

```text
Catalog
   ↓
Search
   ↓
50 produtos
```

Podemos usar:

- busca textual;
- filtros;
- embeddings;
- busca híbrida;
- SQL;
- Elasticsearch/OpenSearch;
- banco vetorial.

Para um MVP, uma busca híbrida simples já é suficiente.

---

# 14. Passo 11 — Ranking

Agora temos:

```text
50 candidatos
```

Precisamos ordenar.

Uma função simples pode ser:

```text
score =
    0.30 × intent_match
  + 0.20 × user_preference
  + 0.15 × purchase_similarity
  + 0.15 × behavior_similarity
  + 0.10 × popularity
  + 0.10 × business_score
```

Exemplo:

```text
Produto A → 0.94
Produto B → 0.87
Produto C → 0.79
Produto D → 0.62
```

Top 5:

```text
A
B
C
D
E
```

Mais tarde podemos substituir essa função por:

- learning-to-rank;
- collaborative filtering;
- neural ranking;
- embeddings;
- modelos treinados com eventos reais.

Mas para o hackathon, uma função explicável é ótima.

---

# 15. Passo 12 — Personalização contextual

O ranking não deve olhar apenas para o produto.

Deve olhar:

```text
Produto
+
Usuário
+
Intenção
+
Contexto
```

Exemplo:

```text
Produto:
LG UltraFine 27

Usuário:
comprou MacBook

Intenção:
monitor 4K

Contexto:
pesquisou USB-C

Resultado:

Score muito alto
```

Outro usuário:

```text
Produto:
LG UltraFine 27

Usuário:
comprou PC gamer

Intenção:
monitor gamer

Contexto:
pesquisou 240Hz

Resultado:

Score baixo
```

O mesmo produto pode ter scores diferentes para usuários diferentes.

---

# 16. Passo 13 — O agente decide a experiência

Depois do ranking:

```text
Top Products
     ↓
Agent
```

O agente pode decidir:

```text
"mostrar 3 recomendações"
```

ou:

```text
"mostrar um bundle"
```

ou:

```text
"não recomendar nada"
```

Isso é importante.

Um bom agente também precisa saber quando **não recomendar**.

Exemplo:

```text
confidence < 0.4
```

Nesse caso:

```text
Não personalizar agressivamente.
Mostrar recomendação genérica.
```

---

# 17. Passo 14 — Criar uma UI visível

Para a demo, a personalização precisa ser muito evidente.

Exemplo:

```text
┌──────────────────────────────────────────────┐
│                                              │
│  Olá, Vinicius                               │
│                                              │
│  Baseado no que você está procurando...      │
│                                              │
│  ┌────────┐ ┌────────┐ ┌────────┐           │
│  │Monitor │ │Monitor │ │  Dock  │           │
│  │  4K    │ │ USB-C  │ │ USB-C  │           │
│  └────────┘ └────────┘ └────────┘           │
│                                              │
│  Por que recomendamos?                       │
│  "Você demonstrou interesse em monitores     │
│   4K e acessórios para Mac."                 │
│                                              │
└──────────────────────────────────────────────┘
```

A justificativa deve ser baseada em sinais reais e permitidos.

---

# 18. Passo 15 — Criar dois perfis para a demo

Essa provavelmente será uma das melhores partes da apresentação.

## Perfil A — Gamer

```text
Buscas:
monitor 240hz
mouse gamer
headset

Compras:
teclado mecânico
mouse

Preferências:
performance
gaming
```

Resultado:

```text
Monitor 240Hz
Mouse
Headset
```

---

## Perfil B — Produtividade / Mac

```text
Buscas:
monitor 4k
monitor para macbook
usb-c monitor

Compras:
MacBook
Magic Keyboard

Preferências:
Apple
produtividade
```

Resultado:

```text
Monitor 4K USB-C
Dock
Suporte
```

A loja é a mesma.

O catálogo é o mesmo.

O que muda é o contexto.

---

# 19. Passo 16 — A/B Test

Para provar que o projeto funciona:

```text
Grupo A
↓
Recomendação tradicional

Grupo B
↓
Personal Shopping Agent
```

Medir:

```text
CTR
Add-to-cart rate
Conversion rate
Revenue/session
Average order value
```

A métrica principal para o hackathon pode ser:

```text
Revenue per Session
```

porque conecta diretamente a solução ao objetivo do desafio:

> fazer a loja vender mais.

---

# 20. Passo 17 — Observabilidade

Criem logs para cada recomendação.

Exemplo:

```json
{
  "user_id": "123",
  "intent": "monitor 4k para mac",
  "candidates": 50,
  "recommended": [
    "monitor-1",
    "monitor-2",
    "dock-1"
  ],
  "ranking_scores": [
    0.94,
    0.88,
    0.82
  ],
  "context_sources": [
    "store_behavior",
    "purchase_history",
    "browser_context"
  ]
}
```

Isso ajuda muito a debugar a demo.

---

# 21. Passo 18 — Segurança e privacidade

Essa parte precisa fazer parte do produto desde o começo.

Nunca trate dados externos do navegador como se fossem automaticamente disponíveis.

O sistema deve:

```text
1. Pedir consentimento
2. Explicar quais dados serão usados
3. Coletar apenas o necessário
4. Limitar acesso por ferramenta
5. Evitar armazenar dados desnecessários
6. Permitir revogação
```

Também precisamos considerar:

- LGPD;
- autenticação;
- autorização;
- isolamento por usuário;
- prompt injection;
- tool permissions;
- dados maliciosos vindos de páginas externas.

Uma ferramenta de browser não deve ter acesso irrestrito ao sistema.

---

# 22. Stack sugerida para o MVP

Como o objetivo é hackathon, priorizar velocidade.

## Frontend

```text
Next.js
React
Tailwind
```

ou o stack que o time já domina.

## Backend

```text
TypeScript
Node.js / Bun
```

## Banco

```text
PostgreSQL
```

## Busca

Inicialmente:

```text
PostgreSQL + full text
```

Se houver tempo:

```text
pgvector
```

## LLM

Um modelo rápido para:

```text
intent classification
context summarization
agent reasoning
```

## Agent

Pode ser implementado com:

```text
tool calling
```

e posteriormente adaptado para MCP.

## MCP

Criar inicialmente:

```text
Customer MCP
Catalog MCP
Store Context MCP
```

---

# 23. Ordem de implementação

Não tentem construir tudo simultaneamente.

## Fase 1 — Demo básica

```text
Catálogo
+
Eventos
+
Perfil de usuário
+
Recomendação
```

Objetivo:

> provar que usuários diferentes recebem produtos diferentes.

---

## Fase 2 — Agente

Adicionar:

```text
LLM
+
Intent detection
+
Tool calling
```

Objetivo:

> provar que o sistema entende o contexto.

---

## Fase 3 — MCP

Transformar as principais ferramentas em:

```text
Customer MCP
Catalog MCP
```

Objetivo:

> provar a arquitetura agentic.

---

## Fase 4 — Browser Context

Adicionar:

```text
Browser / extension layer
```

com consentimento.

Objetivo:

> trazer sinais externos relevantes para a intenção.

---

## Fase 5 — Ranking

Melhorar:

```text
candidate retrieval
+
ranking
+
business constraints
```

Objetivo:

> melhorar conversão.

---

## Fase 6 — Métricas

Adicionar:

```text
baseline
vs
personal agent
```

Objetivo:

> provar impacto.

---

# 24. MVP mínimo

Se vocês tiverem pouco tempo, construam somente isto:

```text
                    ┌───────────────┐
                    │   E-commerce  │
                    └───────┬───────┘
                            │
                         eventos
                            │
                            ▼
                    ┌───────────────┐
                    │ User Context  │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │     Agent     │
                    └───────┬───────┘
                            │
                     search_products
                            │
                            ▼
                    ┌───────────────┐
                    │    Ranking    │
                    └───────┬───────┘
                            │
                            ▼
                    Personalized UI
```

E criar:

```text
2 usuários
10–30 produtos
5–10 tipos de evento
3–5 tools
1 agente
1 ranking
1 dashboard de métricas
```

Isso já é suficiente para uma demonstração muito boa.

---

# 25. MVP avançado

Se sobrar tempo:

```text
Browser Context
       +
Long-term memory
       +
Short-term intent
       +
MCP
       +
Vector Search
       +
Learning-to-Rank
       +
A/B testing
       +
Explanation
```

---

# 26. O diferencial da solução

Não vendam a ideia como:

> "Uma IA que recomenda produtos."

Isso é genérico.

A apresentação deve ser:

> **"Um agente de compras que constrói uma representação contextual do usuário e adapta a experiência da loja em tempo real."**

A diferença é:

```text
Recomendador tradicional

Quem é você?
↓
Histórico
↓
Produtos
```

versus:

```text
Personal Shopping Agent

Quem é você?
+
O que você costuma comprar?
+
O que está procurando agora?
+
O que acabou de pesquisar?
+
O que está fazendo na loja?
+
Quais produtos estão disponíveis?
↓
Qual é sua intenção?
↓
Qual é a melhor próxima ação?
```

---

# 27. Arquitetura final

```text
                           USER
                            │
                            ▼
                     ┌─────────────┐
                     │   Browser   │
                     └──────┬──────┘
                            │
                   consent + signals
                            │
                            ▼
                 ┌────────────────────┐
                 │ Context Engineering│
                 └─────────┬──────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
       Long-term Memory          Current Intent
              │                         │
              └────────────┬────────────┘
                           ▼
                   ┌───────────────┐
                   │     Agent     │
                   │               │
                   │ LLM + Tools   │
                   └───────┬───────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
        Customer MCP   Catalog MCP   Context MCP
             │             │             │
             ▼             ▼             ▼
         User Data      Products      Browser
                           │
                           ▼
                  Candidate Retrieval
                           │
                           ▼
                       Ranking
                           │
                           ▼
                 Personalized Experience
                           │
                           ▼
                       PURCHASE
                           │
                           ▼
                      New Event
                           │
                           └───────────────┐
                                           │
                                           ▼
                                  Context atualizado
```

Esse último ciclo é importante:

```text
Observe
  ↓
Understand
  ↓
Act
  ↓
Observe novamente
```

O sistema aprende continuamente com o comportamento do usuário.

---

# 28. Checklist do hackathon

## Semana / preparação

- [ ] Definir problema de negócio
- [ ] Definir usuário/personas
- [ ] Criar catálogo fake ou real
- [ ] Criar eventos
- [ ] Criar banco
- [ ] Criar User Context
- [ ] Criar tools
- [ ] Criar agente
- [ ] Criar ranking
- [ ] Criar UI
- [ ] Criar baseline
- [ ] Criar métricas

## Antes da apresentação

- [ ] Demo com usuário gamer
- [ ] Demo com usuário produtividade
- [ ] Mostrar mudança de recomendação
- [ ] Mostrar contexto usado
- [ ] Mostrar arquitetura
- [ ] Mostrar métricas
- [ ] Explicar consentimento
- [ ] Explicar por que LLM não faz o ranking sozinho

---

# 29. Prioridade absoluta

Se o tempo apertar, priorizem nesta ordem:

```text
1. Personalização visível
2. Dados/contexto bons
3. Ranking
4. Métrica de impacto
5. Agente
6. MCP
7. Browser Context avançado
```

Não sacrifiquem uma boa experiência de personalização apenas para dizer que o projeto usa MCP.

O MCP é infraestrutura.

O produto é:

> **entender melhor a intenção do consumidor e aumentar a chance de compra.**
