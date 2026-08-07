# Otimização do Personal Shopping Agent — Cache, Context e Performance

> Este documento é um complemento ao `personal-shopping-agent-mvp.md`.
>
> Objetivo: definir como otimizar a arquitetura do MVP antes da implementação no repositório, reduzindo latência, custo de LLM, chamadas a banco/tools e complexidade desnecessária no caminho crítico.

---

# 1. Objetivo da otimização

A primeira versão do Personal Shopping Agent pode facilmente cair em uma arquitetura como:

```text
Request
  ↓
LLM
  ↓
get_user_profile()
  ↓
get_behavior()
  ↓
search_products()
  ↓
ranking
  ↓
LLM
  ↓
Response
```

Essa arquitetura funciona conceitualmente, mas é ruim para produção porque cada requisição pode gerar:

- múltiplas consultas ao banco;
- múltiplas chamadas de tools;
- chamadas desnecessárias ao LLM;
- latência elevada;
- custo elevado;
- resultados potencialmente inconsistentes;
- dificuldade de escalar.

A proposta de otimização é separar os dados de acordo com a frequência com que mudam e retirar o processamento pesado do caminho crítico.

Princípio central:

> **LLM para entender. Redis para lembrar. Search para encontrar. Ranker para ordenar. MCP para conectar. Eventos para atualizar.**

---

# 2. Princípio arquitetural

Nem todo dado do usuário precisa ser recalculado a cada request.

Dividir o contexto em três níveis:

```text
                         USER CONTEXT
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         LONG-TERM         SESSION         REAL-TIME
          CONTEXT           CONTEXT          CONTEXT
              │               │               │
          horas/dias        minutos         segundos
```

## 2.1 Long-term Context

Dados relativamente estáveis:

```text
preferências
histórico de compras
marcas favoritas
categorias preferidas
faixa de preço
padrões de comportamento
```

Pode ser atualizado de forma assíncrona e armazenado em cache por períodos maiores.

Exemplo:

```text
TTL: ~1 hora
```

O TTL exato deve ser definido conforme o comportamento real do sistema.

---

## 2.2 Session Context

Dados que mudam durante a sessão:

```text
buscas recentes
produtos visualizados
categoria atual
carrinho
intenção atual
últimas interações
```

Pode ser armazenado em cache por alguns minutos e atualizado conforme eventos importantes.

Exemplo:

```text
TTL: ~5–30 minutos
```

---

## 2.3 Real-time Context

Informações que podem mudar imediatamente:

```text
produto atual
query atual
preço atual
estoque atual
estado atual do carrinho
```

Esses dados podem precisar de consulta em tempo real ou invalidação imediata.

---

# 3. Redis como Context Cache

Para o MVP, Redis pode funcionar como camada de dados quentes entre a aplicação e o banco principal.

Arquitetura:

```text
                PostgreSQL
                    │
             dados persistentes
                    │
                    ▼
                  Redis
                    │
             contexto quente
                    │
                    ▼
              Agent / Ranker
```

O banco continua sendo a fonte persistente.

Redis é uma camada de baixa latência.

---

# 4. Estrutura de chaves

Uma possível convenção:

```text
user:{userId}:profile
user:{userId}:session
user:{userId}:intent
user:{userId}:context
user:{userId}:recommendations
```

Exemplo:

```text
user:123:profile
```

Pode armazenar:

```json
{
  "user_id": "123",
  "preferences": {
    "brands": ["Apple", "Dell"],
    "price_range": {
      "min": 2000,
      "max": 5000
    }
  },
  "interests": [
    "technology",
    "desk setup"
  ]
}
```

---

# 5. User Context Snapshot

Uma das principais otimizações é não enviar todo o histórico para o LLM.

Em vez disso, criar um objeto compacto chamado:

```text
User Context Snapshot
```

Exemplo:

```json
{
  "user_id": "123",

  "current_intent": {
    "name": "comprar monitor para Mac",
    "confidence": 0.91
  },

  "preferences": [
    "4K",
    "USB-C",
    "Apple"
  ],

  "recent_categories": [
    "monitores",
    "acessórios"
  ],

  "price_range": {
    "min": 2000,
    "max": 4000
  },

  "recent_behavior": [
    "search: monitor 4k",
    "search: monitor usb-c",
    "view: LG UltraFine",
    "view: Dell UltraSharp"
  ]
}
```

Esse snapshot deve ser:

- pequeno;
- estruturado;
- versionado;
- fácil de recuperar;
- suficiente para o ranking;
- suficiente para o agente tomar decisões.

---

# 6. Profile vs Intent

Não misturar memória de longo prazo com intenção atual.

## User Profile

Representa:

```text
quem é o usuário
```

Exemplo:

```json
{
  "preferred_brands": ["Apple", "Dell"],
  "price_sensitivity": "medium",
  "favorite_categories": [
    "technology",
    "desk setup"
  ]
}
```

---

## Current Intent

Representa:

```text
o que o usuário parece querer agora
```

Exemplo:

```json
{
  "intent": "comprar monitor para Mac",
  "category": "monitor",
  "attributes": [
    "4K",
    "USB-C"
  ],
  "confidence": 0.91
}
```

Essa separação permite atualizar intenção com alta frequência sem reconstruir o perfil inteiro.

---

# 7. Event-driven Context Processing

O contexto não deve ser construído somente quando o usuário abre uma página.

A proposta é usar eventos.

```text
User Action
    ↓
Event
    ↓
Event Processor
    ↓
Update Profile / Intent
    ↓
Redis
```

Exemplo:

```text
Usuário pesquisa:

"monitor 4k para mac"

        ↓

search event

        ↓

Intent Processor

        ↓

Current Intent atualizado

        ↓

Redis
```

Quando o usuário abrir a homepage:

```text
Homepage
   ↓
Redis
   ↓
Context já pronto
   ↓
Ranking
   ↓
UI
```

Isso reduz drasticamente o trabalho realizado durante o request.

---

# 8. Quando usar o LLM

O LLM não deve ser chamado a cada interação.

Usar LLM principalmente para:

```text
inferência de intenção
resumo de contexto
interpretação de linguagem natural
decisões complexas
orquestração de tools
```

Não usar LLM para:

```text
cada product_view
cada mudança de página
cada request de recomendação
ranking simples
filtragem determinística
```

---

# 9. Gatilhos para chamar novamente o LLM

Criar regras de reprocessamento.

## Deve reprocessar

```text
Nova intenção detectada
        ↓
LLM

Nova categoria relevante
        ↓
LLM

Busca semanticamente muito diferente
        ↓
LLM

Mudança significativa no comportamento
        ↓
LLM

Compra relevante
        ↓
atualizar perfil/intenção
```

## Não deve reprocessar

```text
Usuário abriu outro produto
        ↓
não chamar LLM

Usuário scrollou
        ↓
não chamar LLM

Usuário abriu outro produto da mesma categoria
        ↓
não chamar LLM
```

---

# 10. Intent Cache

Depois de inferir a intenção:

```json
{
  "intent": "monitor para Mac",
  "category": "monitor",
  "attributes": [
    "4K",
    "USB-C"
  ],
  "confidence": 0.91
}
```

Salvar:

```text
user:123:intent
```

Enquanto a intenção continuar válida, o agente não precisa inferi-la novamente.

---

# 11. Invalidação de Intent

A intenção deve ser invalidada quando houver mudança relevante.

Exemplos:

```text
Usuário pesquisou:
"cadeira gamer"

↓

nova intenção

```

ou:

```text
Usuário comprou:
"monitor"

↓

intenção de monitor pode ser reduzida/inválida
```

Também pode haver expiração temporal:

```text
intent TTL
```

A duração deve ser ajustada experimentalmente.

---

# 12. Context Versioning

Adicionar uma versão ao contexto.

Exemplo:

```json
{
  "user_id": "123",
  "context_version": 17,
  "intent": "monitor 4k",
  "preferences": [
    "USB-C",
    "Apple"
  ]
}
```

Quando ocorre uma mudança significativa:

```text
Compra
   ↓
Context version 18
```

Isso permite invalidar caches antigos de forma simples.

---

# 13. Candidate Retrieval

Não executar ranking complexo sobre todo o catálogo.

Se existem:

```text
100.000 produtos
```

fazer:

```text
100.000 produtos
        ↓
Candidate Retrieval
        ↓
100 candidatos
        ↓
Personalized Ranking
        ↓
10 produtos
```

O Candidate Retrieval pode utilizar:

- busca textual;
- filtros;
- busca semântica;
- embeddings;
- PostgreSQL;
- pgvector;
- Elasticsearch/OpenSearch;
- combinação híbrida.

Para o MVP, começar simples.

---

# 14. Candidate Cache

Resultados de busca que são iguais ou muito semelhantes podem ser armazenados.

Exemplo:

```text
query: "monitor 4k"
filters:
  usb_c=true
  available=true
```

Resultado:

```text
Top 100 candidatos
```

Cache:

```text
candidate:{queryHash}:{filterHash}
```

TTL inicial sugerido:

```text
5–30 minutos
```

O TTL deve ser menor quando preço e estoque mudam com frequência.

---

# 15. Personalized Recommendation Cache

Depois do ranking:

```text
User
+
Intent
+
Context Version
+
Candidate Version
```

geram uma chave.

Exemplo:

```text
recommendation:{userId}:{intentHash}:{contextVersion}:{catalogVersion}
```

Resultado:

```json
{
  "products": [
    "product-a",
    "product-b",
    "product-c"
  ]
}
```

Isso permite reutilizar uma recomendação enquanto o contexto relevante não mudou.

---

# 16. Cuidado com cache de recomendações

Não usar simplesmente:

```text
recommendations:user123
```

Porque a recomendação pode ficar stale.

Usar:

```text
user
+
intent
+
context version
+
catalog version
```

Dessa maneira:

```text
mesmo usuário
+
mesma intenção
+
mesmo contexto
+
mesmo catálogo
```

pode gerar:

```text
Cache HIT
```

Se qualquer componente mudar:

```text
Cache MISS
```

e o ranking é recalculado.

---

# 17. Dois níveis de cache

A arquitetura recomendada:

```text
                  REQUEST
                     │
             ┌───────┴───────┐
             ▼               ▼
      Candidate Cache   Context Cache
             │               │
             └───────┬───────┘
                     ▼
                  Ranker
                     │
                     ▼
             Recommendation Cache
```

## Cache A — Candidate Cache

Armazena:

```text
resultado de busca
```

Exemplo:

```text
"monitor 4k" → 100 produtos
```

---

## Cache B — Recommendation Cache

Armazena:

```text
resultado personalizado
```

Exemplo:

```text
user123 + intentX → top 10
```

---

# 18. O Agent não deve estar no caminho crítico

Evitar:

```text
Homepage
   ↓
Agent
   ↓
MCP
   ↓
Database
   ↓
LLM
   ↓
Ranking
   ↓
Response
```

Preferir:

```text
                 Event Pipeline
                      │
             ┌────────┴────────┐
             ▼                 ▼
          Profile           Intent
             │                 │
             └────────┬────────┘
                      ▼
                    Redis
                      │
                      ▼
                   Ranker
                      │
                      ▼
                     UI
```

O agente aparece quando existe uma decisão que realmente exige raciocínio.

---

# 19. Quando o Agent deve atuar

Exemplo:

```text
Usuário:

"Quero um monitor para trabalhar e jogar,
mas não quero gastar mais de R$3000."

             ↓

           AGENT
             ↓
      Intent extraction
             ↓
      Structured intent
             ↓
      Search / Ranking
```

Depois:

```text
Usuário navega
      ↓
Ranker
      ↓
recomendação rápida
```

Não precisamos executar o agente novamente para cada clique.

---

# 20. MCP fora do caminho crítico

MCP é importante como arquitetura de integração, mas não precisa ser utilizado em cada interação.

Exemplo:

```text
Agent
  ↓
Customer MCP
  ↓
get_user_context()
  ↓
Redis
```

O resultado é armazenado.

Depois:

```text
Request
  ↓
Redis
  ↓
Ranker
```

Sem nova chamada MCP.

Isso reduz latência e quantidade de chamadas externas.

---

# 21. Arquitetura otimizada

```text
                           USER
                            │
                            ▼
                         Browser
                            │
                          Events
                            │
                            ▼
                   ┌─────────────────┐
                   │ Event Processor │
                   └────────┬────────┘
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
             Profile      Intent      Session
                │           │           │
                └───────────┼───────────┘
                            ▼
                       ┌────────┐
                       │ Redis  │
                       └───┬────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       Candidate Cache           Context Cache
              │                         │
              └────────────┬────────────┘
                           ▼
                         Ranker
                           │
                           ▼
                 Recommendation Cache
                           │
                           ▼
                          UI
```

Em paralelo:

```text
                     ┌──────────────┐
                     │    Agent     │
                     └──────┬───────┘
                            │
                     somente quando
                       necessário
                            │
                 ┌──────────┴──────────┐
                 ▼                     ▼
           Customer MCP           Catalog MCP
```

---

# 22. Fluxo completo de atualização

Exemplo:

```text
Usuário pesquisa:

"monitor 4k para mac"
```

## Etapa 1

Browser gera:

```text
search event
```

## Etapa 2

Event Processor recebe.

## Etapa 3

Sistema detecta mudança potencial de intenção.

## Etapa 4

Agent/LLM interpreta:

```json
{
  "intent": "monitor para Mac",
  "attributes": [
    "4K",
    "USB-C"
  ]
}
```

## Etapa 5

Salvar:

```text
user:123:intent
```

## Etapa 6

Incrementar:

```text
context_version
```

## Etapa 7

Invalidar:

```text
recommendation cache
```

## Etapa 8

Próxima requisição:

```text
Redis
 ↓
Candidate Retrieval
 ↓
Ranker
 ↓
Recommendation
```

O LLM não precisa ser chamado novamente até existir uma mudança relevante.

---

# 23. Fluxo de uma recomendação

Quando o usuário abre a homepage:

```text
GET /recommendations
```

## 1. Recuperar contexto

```text
Redis
 ↓
User Context Snapshot
```

## 2. Recuperar candidatos

```text
Candidate Cache
```

Se houver MISS:

```text
Search
 ↓
Candidate Cache
```

## 3. Verificar Recommendation Cache

Se HIT:

```text
retornar recomendações
```

Se MISS:

```text
Ranker
 ↓
Top 10
 ↓
Recommendation Cache
 ↓
retornar
```

Idealmente, o caminho crítico não envolve LLM.

---

# 24. Ranking

Uma função inicial pode ser:

```text
score =
    0.30 × intent_match
  + 0.20 × user_preference
  + 0.15 × purchase_similarity
  + 0.15 × behavior_similarity
  + 0.10 × popularity
  + 0.10 × business_score
```

Os pesos são apenas ponto de partida.

Devem ser ajustados usando dados do experimento.

O importante é manter o ranking:

- rápido;
- explicável;
- mensurável;
- independente do LLM.

---

# 25. Latência esperada

Arquitetura não otimizada:

```text
Request
 ↓
LLM
 ↓
Tools
 ↓
DB
 ↓
LLM
 ↓
Response

Potencialmente segundos
```

Arquitetura otimizada:

```text
Request
 ↓
Redis
 ↓
Candidate Cache
 ↓
Ranker
 ↓
Response
```

Objetivo do MVP:

```text
dezenas a poucas centenas de ms
```

O valor exato deve ser medido no ambiente real.

---

# 26. Processamento assíncrono

Tudo que não precisa bloquear a resposta deve ser assíncrono.

Exemplos:

```text
Atualizar perfil
Gerar resumo
Inferir intenção
Calcular embeddings
Atualizar métricas
Atualizar recomendações
Atualizar estatísticas
```

Fluxo:

```text
User Event
    │
    ├──────────────→ Response
    │
    └──────────────→ Async Processing
                           │
                    Profile / Intent
                           │
                         Redis
```

O usuário não precisa esperar o processamento completo.

---

# 27. Invalidação baseada em eventos

Eventos importantes devem invalidar caches específicos.

Exemplo:

```text
purchase
   ↓
invalidate profile cache
invalidate recommendation cache
```

Outro:

```text
new search
   ↓
invalidate intent
invalidate recommendation
```

Outro:

```text
product price changed
   ↓
invalidate affected candidate/recommendation cache
```

Não invalidar tudo globalmente.

---

# 28. Contexto externo do navegador

O browser context pode ser uma fonte adicional de sinais, mas deve ser tratado como um contexto opcional e consentido.

Fluxo:

```text
Browser
   ↓
Consent
   ↓
Allowed Signals
   ↓
Context Processor
   ↓
User Context Snapshot
```

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

Não assumir acesso irrestrito ao histórico do navegador.

A implementação concreta deve respeitar:

- permissões do browser;
- consentimento;
- LGPD;
- minimização de dados;
- escopo da aplicação/extensão;
- segurança.

---

# 29. Segurança

O sistema deve assumir que dados externos podem ser maliciosos ou não confiáveis.

Especialmente quando existe:

```text
Browser Context
+
Agent
+
Tools
```

Nunca permitir que conteúdo externo execute ações críticas diretamente.

Separar:

```text
Context
```

de:

```text
Instructions
```

e validar argumentos das Tools.

Exemplo:

```text
Browser signal
      ↓
Context
      ↓
Agent
      ↓
Tool validation
      ↓
Action
```

Nunca:

```text
Web content
 ↓
Tool execution
```

sem validação.

---

# 30. Observabilidade do cache

Adicionar métricas:

```text
context_cache_hit_rate
candidate_cache_hit_rate
recommendation_cache_hit_rate
llm_calls_per_session
average_recommendation_latency
p95_recommendation_latency
```

Exemplo:

```text
Context Cache Hit Rate: 96%
Candidate Cache Hit Rate: 82%
Recommendation Cache Hit Rate: 74%
LLM Calls / Session: 1.4
P95 Recommendation Latency: 180ms
```

Esses números são apenas exemplos.

---

# 31. Observabilidade do Agent

Registrar:

```json
{
  "user_id": "123",
  "context_version": 17,
  "intent": "monitor 4k para mac",
  "confidence": 0.91,
  "tools_used": [
    "get_user_profile",
    "get_recent_behavior"
  ],
  "llm_call": true
}
```

Isso permite responder:

- por que o agente foi chamado?
- quais dados ele recebeu?
- quais tools utilizou?
- qual intenção inferiu?
- qual versão do contexto estava ativa?

---

# 32. Estratégia de implementação

Não implementar toda a arquitetura de uma vez.

## Fase 1 — Cache de contexto

Implementar:

```text
PostgreSQL
+
Redis
+
User Context Snapshot
```

Objetivo:

```text
tirar consultas repetidas do banco
```

---

## Fase 2 — Event Processor

Implementar:

```text
Events
 ↓
Context updates
 ↓
Redis
```

Objetivo:

```text
manter contexto atualizado
```

---

## Fase 3 — Intent Cache

Implementar:

```text
LLM
 ↓
Intent
 ↓
Redis
```

Objetivo:

```text
reduzir chamadas ao LLM
```

---

## Fase 4 — Candidate Cache

Implementar:

```text
Query
 ↓
Candidate Retrieval
 ↓
Redis
```

Objetivo:

```text
reduzir buscas repetidas
```

---

## Fase 5 — Ranking

Implementar:

```text
Context
+
Candidates
 ↓
Ranker
```

Objetivo:

```text
personalização rápida
```

---

## Fase 6 — Recommendation Cache

Implementar:

```text
User
+
Intent
+
Context Version
+
Catalog Version
 ↓
Top Products
```

Objetivo:

```text
reutilizar recomendações
```

---

## Fase 7 — MCP

Somente depois:

```text
Customer MCP
Catalog MCP
Store Context MCP
```

Objetivo:

```text
padronizar integração do agente
```

Não deixar MCP atrasar o MVP funcional.

---

# 33. MVP otimizado

A menor arquitetura que ainda demonstra o conceito:

```text
Browser
   │
   ▼
Events
   │
   ▼
Context Processor
   │
   ▼
Redis
   │
   ├── Profile
   ├── Intent
   └── Session
   │
   ▼
Candidate Retrieval
   │
   ▼
Ranker
   │
   ▼
Recommendation Cache
   │
   ▼
UI
```

LLM:

```text
somente para inferir/revisar intenção
```

MCP:

```text
somente como camada de integração do Agent
```

---

# 34. Arquitetura otimizada final

```text
                           USER
                            │
                            ▼
                         Browser
                            │
                         Events
                            │
                            ▼
                  ┌───────────────────┐
                  │  Event Processor  │
                  └─────────┬─────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
      Long-term          Current            Session
       Profile           Intent             Context
          │                 │                 │
          └─────────────────┼─────────────────┘
                            ▼
                       ┌─────────┐
                       │  Redis  │
                       └────┬────┘
                            │
                 ┌──────────┴──────────┐
                 ▼                     ▼
          Candidate Cache       Context Snapshot
                 │                     │
                 └──────────┬──────────┘
                            ▼
                         Ranker
                            │
                            ▼
                 Recommendation Cache
                            │
                            ▼
                           UI
                            │
                            ▼
                        User Action
                            │
                            ▼
                          Event
                            │
                            └───────────────┐
                                            │
                                            ▼
                                    Context atualizado


                     AGENT / LLM
                          │
             ┌────────────┼────────────┐
             ▼                         ▼
       Customer MCP               Catalog MCP
             │                         │
             └────────────┬────────────┘
                          ▼
                     Tools / APIs
```

---

# 35. Regras práticas para o desenvolvimento

1. Não chamar LLM por request.
2. Não enviar histórico bruto para o LLM.
3. Não usar LLM como ranking principal.
4. Não consultar o banco repetidamente se o dado puder estar em Redis.
5. Não executar MCP para cada interação.
6. Não recalcular intenção quando nada mudou.
7. Não ranquear o catálogo inteiro.
8. Não cachear recomendações sem considerar versão do contexto.
9. Não invalidar todos os caches por qualquer evento.
10. Processar eventos e atualizações de contexto de forma assíncrona sempre que possível.
11. Medir cache hit rate e latência desde o começo.
12. Manter o caminho crítico pequeno.
13. Tratar dados externos do navegador como opcionais, consentidos e não confiáveis.
14. Priorizar impacto de negócio sobre complexidade arquitetural.
15. Implementar a solução mais simples que permita demonstrar personalização mensurável.

---

# 36. Frase de arquitetura

A arquitetura otimizada pode ser resumida como:

> **O sistema observa eventos, atualiza o contexto do usuário de forma assíncrona, usa LLM apenas quando precisa interpretar uma mudança de intenção, mantém o contexto quente em Redis, recupera candidatos rapidamente, utiliza um ranker especializado para ordenar produtos e cacheia a recomendação final. MCP conecta o agente aos sistemas, mas não precisa estar no caminho crítico de cada recomendação.**

---

# 37. Objetivo final

O objetivo não é simplesmente construir:

```text
AI → recommendations
```

Mas:

```text
User Signals
      ↓
Context
      ↓
Intent
      ↓
Candidate Retrieval
      ↓
Personalized Ranking
      ↓
Recommendation
      ↓
User Action
      ↓
New Signal
```

Criar esse ciclo com baixa latência, baixo custo e capacidade de aprender com novos eventos é o principal objetivo técnico da otimização.
