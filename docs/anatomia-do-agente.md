# Anatomia de uma recomendação

> O que o agente usa para escolher cada peça, como ele decide, e quanto custa
> uma geração. Medido em 2026-08-09 contra o Supabase real, com
> `npm run look:anatomia`.
>
> Complementa `agente-de-combinacoes.md`, que descreve **o que** a feature é.
> Este descreve **como ela decide**, e é o documento para responder à pergunta
> "por que essa peça e não outra".

---

## 1. O artefato

Uma "section custom" aqui é um `Look`: um título, uma confiança, e de 5 a 10
peças, cada uma com **um motivo escrito** e um **rótulo de ocasião** que agrupa a
vitrine em blocos.

O que a distingue de um carrossel de relacionados são exatamente essas duas
coisas — o motivo e o agrupamento. Sem elas, o que sobra é o que qualquer loja
já tem, e é por isso que a regra do repositório é **ou o look é do agente, ou a
section não aparece**.

---

## 2. Os critérios, em três eixos

### Eixo 1 — a peça aberta (a âncora)

Define **quem pode ser candidato**. `findComplementsAvailable`
(`catalog.d1.ts:468`) admite um produto quando:

```
tipo diferente da âncora          (não sugerir calça para quem abriu calça)
tem variante disponível AGORA
E (compartilha ao menos uma TAG  OU  é da mesma COLEÇÃO)
```

E os ordena por uma fórmula explícita:

```sql
tagsEmComum × 3  +  (mesmaColecao ? 2 : 0)   DESC,  position ASC
```

Tag vale mais que coleção porque coleção é território da loja e tag é atributo
da peça. O desempate por `position` mantém a ordem estável entre execuções.

### Eixo 2 — o lugar e o mês

Vão ao prompt como **texto cru**:

```json
{ "lugar": "Porto Alegre, RS, BR", "mes": "agosto" }
```

Não existe tabela de clima, hemisfério ou estação em lugar nenhum do domínio. O
prompt diz, literalmente: *"você sabe como é o clima daquele lugar naquela época;
eu não te digo. Deduza."*

O mês vai **por extenso** porque "agosto" carrega a inferência de inverno no
hemisfério sul e `8` não carrega nada.

### Eixo 3 — as sementes (quem está olhando)

No máximo **6**, escolhidas por força e depois por recência:

| Semente | Peso | Origem | O que diz ao modelo |
|---|---|---|---|
| comprou | 4 | `orders` + `order_items` | *ela TEM essa peça* |
| pediu avise-me | 3 | `stock_alerts` | *ela QUER, e a loja não tinha* |
| favoritou | 2 | `wishlist_items` ∪ cookie `deco_wishlist` | *ela QUER. Levantou a mão* |
| viu | 1 | cookie `deco_recent` | *olhar não é querer* |

A mesma peça chegando por duas origens ocupa **uma** vaga, com a origem mais
forte (`consolidar`, `look.seeds.ts`). Favoritar e depois comprar é o percurso
normal — sem a deduplicação, uma peça só gastaria duas das seis vagas.

---

## 3. O pipeline

**Determinístico → modelo → determinístico.** É o que torna alucinação de
produto impossível por construção, e não apenas mitigada.

```
1. acharAncora            resolve o slug da URL no produto
2. colherSementes         4 fontes em paralelo, dedup, corte em 6
3. lerLook (cache)        HIT? devolve. MISS? segue.
4. falhaRecente           em quarentena? não gasta modelo.
5. montarCandidatos       pool → exclusões → sinais → equilíbrio → 18
6. montarMensagem         instrução + âncora + sementes + lugar + candidatos
7. ── perguntar() ──      A ÚNICA chamada ao modelo. 22-41s.
8. validar                descarta o que não veio do pool
9. gravarLook             persiste sob (peça, contexto)
10. montarBlocos          JOIN com variants — disponibilidade AGORA
```

### O que a etapa 5 faz, em ordem

1. **Busca 30** do banco (folgado: cortar por afinidade é melhor que nunca ter visto)
2. **Remove o que a pessoa já comprou** — uma peça comprada não é recomendação,
   é erro de loja: o card vem com preço e botão de comprar
3. **Calcula dois sinais** contra o guarda-roupa: `combinaComOGuardaRoupa` (tags
   em comum com o que ela tem) e `jaTemDesteTipo` (saturação)
4. **Equilibra por tipo** — no máximo 3 por `product_type`, em duas passadas: a
   primeira pega o melhor de cada tipo, a segunda preenche até o teto
5. **Corta em 18**

O equilíbrio existe porque a SQL ordena por afinidade, não por variedade. Sem
ele, o topo se enche do tipo que por acaso compartilha mais tags — e o resultado
deixa de parecer uma roupa.

---

## 4. O que o modelo **não** decide

Estas são garantias de código, não instruções de prompt:

| Garantia | Onde | Por quê |
|---|---|---|
| Não inventa produto | `validar` descarta handle fora do pool | Handle "quase certo" corrigido por proximidade seria adivinhação |
| Não decide disponibilidade | `JOIN variants` no render | O look fica gravado enquanto o estoque muda |
| Não recomenda o que a pessoa tem | `jaComprados` sai do pool | Medido: ele devolvia o blazer comprado com o motivo *"você já tem este blazer preto"* |
| Não escolhe peça sem motivo | `validar` descarta motivo vazio | Peça sem explicação é indistinguível de carrossel |
| Não entrega abaixo da confiança | piso de 0.5 | Declarar confiança baixa é a resposta certa quando ela é baixa |

---

## 5. O custo, medido

Uma geração, âncora `vintage-wash-tee`, 18 candidatos:

| Parte da mensagem | Caracteres | ~Tokens | % |
|---|---|---|---|
| **Instrução** (fixa) | 8.894 | 2.224 | **50%** |
| **Candidatos** (catálogo) | 8.186 | 2.047 | **46%** |
| A peça aberta | 377 | 94 | 2% |
| Sementes (vazias) | 98 | 25 | 1% |
| Lugar e mês | 73 | 18 | 0% |
| **Total** | **17.630** | **~4.408** | |

Estável entre âncoras: 4.269 a 4.436 tokens em quatro testadas.

**A personalização é barata.** Cada semente custa ~88 caracteres (~22 tokens);
as seis vagas cheias somam ~528 caracteres — **3% a mais** que o piso. O que
custa é a instrução e o catálogo, que são fixos.

### O que não está nessa conta

A sobrecarga do próprio agente no Decopilot — system prompt e schemas das
ferramentas ligadas a ele — foi medida por terceiros em **~15.900 tokens**.
Contra os ~4.400 daqui:

> **~78% do custo por chamada não é o nosso texto.**

E o `lerStream` só acumula `text-delta`: eventos de ferramenta são ignorados por
completo. **Desligar as ferramentas do agente é provavelmente o maior ganho de
custo disponível, e é configuração, não código.**

### Latência

22–41s por geração, medidos. Por isso nada disso roda no caminho de uma
requisição que alguém esteja esperando: a PDP dispara sem `await` e responde
`null`; o próximo carregamento lê do cache.

---

## 6. Divergências encontradas

### 6.1 — O cabeçalho de `look.candidates.ts` afirma o contrário do que o código faz

`look.candidates.ts:10-13` diz:

> *"As sementes **NÃO** entram aqui. Elas vão para o prompt, como contexto de
> quem está olhando, e é o modelo que decide o quanto elas puxam a escolha."*

Mas a assinatura (`:146-150`) recebe as sementes **duas vezes**, e as duas
mudam o pool:

```ts
montarCandidatos(variantId, jaComprados, guardaRoupa)
//                          ^^^^^^^^^^^  filtra o pool (exclusão)
//                                       ^^^^^^^^^^^  acrescenta dois sinais
```

Era verdade quando foi escrito. Deixou de ser em duas etapas — primeiro a
exclusão de comprados, depois os sinais de guarda-roupa da #16 — e ninguém
voltou ao comentário. **Quem ler o cabeçalho hoje conclui que o pool é
independente da pessoa, e ele não é.**

**Corrigido nesta branch.**

### 6.2 — O filtro de banalidade vale para um eixo e não para o outro

`combinaComOGuardaRoupa` descarta tag presente em mais da metade do pool, com um
argumento medido: cruzar as tags completas fazia o sinal disparar para **18 de
18** candidatos, e um sinal que vale para todos não ordena nada.

`tagsEmComum` — o eixo que o prompt chama de *"o mais forte de combina com"* —
**não passa por esse filtro** (`look.candidates.ts:69`, `similar.sharedTags` cru).

Medido agora, o mesmo argumento aplicado ao eixo da âncora:

| Âncora | Tags banais no pool | Candidatos cuja afinidade é **só** tag banal |
|---|---|---|
| Vintage Wash Tee | `unisex`(17), `everyday`(15), `cotton`(10) | **11 de 18** |
| Faux Leather Biker | `unisex`(17), `everyday`(16), `layering`(10) | **8 de 18** |
| Leather Belt Bag | `unisex`(17), `everyday`(16) | **4 de 18** |

Na âncora principal, **61% dos candidatos** chegam ao modelo declarando uma
afinidade que é a linha de base do catálogo. O modelo lê `tagsEmComum:
["unisex", "everyday"]` como sinal de composição, quando é só "isto é roupa".

**Não corrigido, de propósito.** Diferente do outro caso, `tagsEmComum` alimenta
a **ordenação** do pool (`× 3` na fórmula do SQL), não só a apresentação.
Filtrar ali muda quem entra, não apenas o que o modelo lê — e isso merece
medição própria, com antes e depois, não um palpite embutido num documento.

Fica registrado como o próximo experimento do `look:eval`.

### 6.3 — Observação: o caso "só coleção" não acontece

O sinal do guarda-roupa não pode disparar para candidato que entrou apenas pela
coleção (ele teria `tagsEmComum` vazio, e antes da #16 o cruzamento partia
dali). Medido nas quatro âncoras: **zero** candidatos nessa situação — os 18 têm
afinidade por tag em todas.

A razão é aritmética: busca-se 30, mantêm-se 18, e a fórmula põe tag-match
(`×3`) acima de coleção (`×2`). Os que entram só por coleção não sobrevivem ao
corte.

Ou seja: a preocupação era legítima no código e **é inalcançável neste
catálogo**. Vale saber, porque num catálogo com menos tags ela voltaria.

---

## 7. Como reproduzir

```bash
npm run look:anatomia                        # âncora padrão
npm run look:anatomia -- faux-leather-biker  # qualquer handle
```

Não chama o modelo — monta a mensagem que iria para ele e a disseca. A contagem
de tokens é estimada em 4 caracteres por token, e erra **para mais** em
português: trate como teto, não como medida.
