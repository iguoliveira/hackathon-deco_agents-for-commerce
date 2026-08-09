/**
 * Etapa 1: montar o espaço de escolha. **Sem modelo.**
 *
 * A decisão que define esta feature: os candidatos saem sempre de
 * `findComplementsAvailable(variantId)` — peças de **outro tipo** que
 * compartilham tags ou coleção com a peça aberta —, nunca de uma consulta geral
 * ao catálogo. Um agente que recebesse a loja inteira produziria um look
 * plausível e genérico, que é o que qualquer loja já tem.
 *
 * As sementes NÃO entram aqui. Elas vão para o prompt, como contexto de quem
 * está olhando, e é o modelo que decide o quanto elas puxam a escolha. Filtrar
 * o pool por elas em código seria decidir no lugar do agente com um critério
 * mais burro — e é justamente o pedaço em que ele é insubstituível.
 */

import { findComplementsAvailable } from "../catalog/catalog.d1";
import type { SimilarCandidate } from "../catalog/catalog.d1";
import type { Candidato } from "./look.types";

/**
 * Quantos pedir ao SQL. Folgado de propósito: o teto e o equilíbrio por tipo
 * cortam depois, e cortar por afinidade é melhor do que nunca ter visto.
 */
const DO_BANCO = 30;

/**
 * Teto do que chega ao prompt.
 *
 * O custo é linear no tamanho, e a partir de certo ponto o modelo ignora a
 * cauda de qualquer jeito. Melhor cortar em código, por nota, do que deixar o
 * modelo cortar por posição.
 */
export const TETO = 18;

/**
 * Teto por `product_type`.
 *
 * É o que impede o look de virar seis calças. A SQL ordena por afinidade e não
 * por variedade, então sem isto o topo se enche do tipo que por acaso
 * compartilha mais tags — e o resultado deixa de parecer uma roupa.
 *
 * 3 e não 2 (como no `shelf`) porque aqui o modelo compõe blocos por ocasião:
 * ter duas calças para escolher **dentro** de "para o frio" e outra em "para
 * trabalhar" é o caso normal, não repetição.
 */
const MAX_POR_TIPO = 3;

const paraCandidato = (similar: SimilarCandidate): Candidato => {
  const produto = similar.record.product;

  // Todas as opções de variante disponível, sem saber que existem "tamanhos".
  // `findOptionNames()` descobre os nomes em runtime — hard-codar `Size` aqui
  // travaria o domínio em moda, que é a regra da §1 do doc de mudanças.
  const opcoes = similar.record.variants
    .filter((variante) => variante.available === 1)
    .flatMap(
      (variante) =>
        similar.record.optionsByVariant
          .get(variante.variant_id)
          ?.map((opcao) => `${opcao.name}: ${opcao.value}`) ?? [],
    );

  return {
    handle: produto.handle,
    titulo: produto.title,
    tipo: produto.product_type,
    preco: similar.record.variants[0]?.price ?? 0,
    mesmaColecao: similar.sameCollection,
    tagsEmComum: similar.sharedTags,
    opcoesDisponiveis: [...new Set(opcoes)],
    // 160 caracteres: o bastante para o modelo julgar a peça, longe do bastante
    // para as descrições (média de 866) dominarem o prompt.
    descricao: (produto.description ?? "").slice(0, 160),
  };
};

/**
 * Espalha por `product_type`, preservando a ordem de afinidade.
 *
 * Duas passadas em vez de uma: a primeira garante variedade pegando o melhor de
 * cada tipo, a segunda preenche o resto com os melhores que sobraram até o
 * teto. Uma passada só com contador por tipo daria variedade **ou** qualidade,
 * nunca as duas — cortaria o segundo melhor tênis mesmo quando não houvesse
 * mais tipos para oferecer no lugar dele.
 *
 * (Mesma lógica de `shelf.candidates.ts:102`. Está duplicada de propósito: os
 * dois domínios têm tetos diferentes e vidas independentes, e extrair isto para
 * um utilitário compartilhado acoplaria dois agentes por causa de vinte linhas.)
 */
const equilibrarPorTipo = (candidatos: Candidato[], teto: number): Candidato[] => {
  const porTipo = new Map<string, Candidato[]>();
  for (const candidato of candidatos) {
    const chave = candidato.tipo || "(sem tipo)";
    porTipo.set(chave, [...(porTipo.get(chave) ?? []), candidato]);
  }

  const escolhidos: Candidato[] = [];
  const usados = new Set<string>();
  const contagem = new Map<string, number>();

  for (const [chave, doTipo] of porTipo) {
    const primeiro = doTipo[0];
    if (!primeiro) continue;
    escolhidos.push(primeiro);
    usados.add(primeiro.handle);
    contagem.set(chave, 1);
  }

  for (const candidato of candidatos) {
    if (escolhidos.length >= teto) break;
    if (usados.has(candidato.handle)) continue;
    const chave = candidato.tipo || "(sem tipo)";
    if ((contagem.get(chave) ?? 0) >= MAX_POR_TIPO) continue;

    escolhidos.push(candidato);
    usados.add(candidato.handle);
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }

  // A ordem final volta a ser a de afinidade: o equilíbrio decide QUEM entra,
  // não em que ordem o modelo os lê.
  const posicao = new Map(candidatos.map((c, i) => [c.handle, i]));
  return escolhidos
    .sort((a, b) => (posicao.get(a.handle) ?? 0) - (posicao.get(b.handle) ?? 0))
    .slice(0, teto);
};

/**
 * O espaço de escolha de uma peça.
 *
 * `jaComprados` sai do pool, e essa é a única coisa que as sementes decidem
 * aqui. Não é ranqueamento disfarçado: é que uma peça já comprada não é uma
 * recomendação, é um erro de loja. O card viria com preço e botão de comprar.
 *
 * **Só `purchased` é excluído.** Favoritar e ver não tiram a peça do pool —
 * quem favoritou e não comprou continua sendo alguém a quem faz sentido
 * oferecer aquilo, e o agente sabe usar isso ("fecha com a peça que você vem
 * namorando"). A fronteira é ter ou não ter.
 *
 * Medido: com o Tailored Blazer como semente comprada, o agente o devolvia
 * dentro do look com o motivo "Você já tem este blazer preto" — texto bom,
 * resultado errado.
 *
 * Não lança: quem consome é um look, e look vazio é resultado aceitável.
 */
export const montarCandidatos = async (
  variantId: string,
  jaComprados: ReadonlySet<string> = new Set(),
  guardaRoupa: ReadonlyArray<{ titulo: string; tipo: string; tags: string[] }> = [],
): Promise<Candidato[]> => {
  const complementos = await findComplementsAvailable(variantId, DO_BANCO);

  const disponiveis = complementos.filter(
    (candidato) => !jaComprados.has(candidato.record.product.product_group_id),
  );

  const banais = tagsBanais(disponiveis);

  return equilibrarPorTipo(
    disponiveis.map((similar) =>
      comOGuardaRoupa(
        paraCandidato(similar),
        tagsDoProduto(similar).filter((tag) => !banais.has(tag)),
        guardaRoupa,
      ),
    ),
    TETO,
  );
};

/**
 * As tags comuns demais para distinguir qualquer coisa NESTE pool.
 *
 * Cruzar as tags completas com o armário fez o sinal disparar para **18 de 18**
 * candidatos — e um sinal que vale para todo mundo não ordena nada, só ocupa
 * lugar no prompt. A causa está nos dados: `everyday` está em 65% do catálogo e
 * `unisex` em 61%. Compartilhar `everyday` com o armário não é afinidade, é
 * coincidência estatística.
 *
 * O corte é a **metade do pool**, e é medido aqui e agora em vez de vir de uma
 * lista: um `["everyday", "unisex"]` no código seria literal de catálogo, que a
 * regra 4 de docs/agente-de-combinacoes.md proíbe — e travaria o domínio neste
 * catálogo. Num de vinho as tags banais seriam outras, e esta função as acha
 * sozinha.
 *
 * Frequência local, e não global, de propósito: o que importa é distinguir
 * DENTRO do espaço de escolha. Uma tag rara na loja inteira mas presente em
 * todos os complementos desta peça também não separa nada aqui.
 */
const tagsBanais = (pool: SimilarCandidate[]): Set<string> => {
  if (pool.length < 4) return new Set(); // pool pequeno: tudo é informativo

  const frequencia = new Map<string, number>();
  for (const similar of pool) {
    for (const tag of new Set(tagsDoProduto(similar))) {
      frequencia.set(tag, (frequencia.get(tag) ?? 0) + 1);
    }
  }

  const metade = pool.length / 2;
  return new Set([...frequencia].filter(([, n]) => n > metade).map(([tag]) => tag));
};

/**
 * TODAS as tags do candidato, e não só as que ele divide com a âncora.
 *
 * `tagsEmComum` é a interseção com a peça aberta, e usá-la para cruzar com o
 * guarda-roupa produzia **(candidato ∩ âncora) ∩ armário** — um subconjunto,
 * não o cruzamento que o nome promete. Uma tag que o candidato divide com o
 * armário mas não com a peça aberta nunca aparecia.
 *
 * O caso em que isso era certeza, não hipótese: `findComplementsAvailable`
 * admite candidato por tag **ou** coleção. Quem entra só por coleção tem
 * `sharedTags = []`, logo `tagsEmComum = []` — e o sinal não podia disparar
 * para ele por construção, por mais que o armário combinasse.
 *
 * Não vira campo do `Candidato`: as tags completas iriam para o prompt e
 * inflariam o token count de 18 candidatos sem mudar escolha nenhuma. O que o
 * modelo precisa ver é a interseção, que é o que ele recebe.
 */
const tagsDoProduto = (similar: SimilarCandidate): string[] =>
  similar.record.props.filter((prop) => prop.name === "TAG").map((prop) => prop.value);

/**
 * Acrescenta ao candidato a afinidade com o que a pessoa **já tem**.
 *
 * Simétrico ao `tagsEmComum`, que mede afinidade com a peça aberta. Aquele
 * responde "isto combina com o que ela está olhando?"; este responde "isto
 * combina com o guarda-roupa dela?" — e sem ele a compra chegava ao modelo como
 * rótulo, não como dado: só título e tipo, sem nada calculado em cima.
 *
 * Calculado em CÓDIGO, e não deixado para o modelo cruzar de cabeça, pela mesma
 * razão que `tagsEmComum` é: o prompt manda usar os sinais prontos em vez de
 * recalculá-los, e cruzar N candidatos contra M peças possuídas é exatamente o
 * tipo de trabalho em que um modelo erra em silêncio.
 */
const comOGuardaRoupa = (
  candidato: Candidato,
  tagsDoCandidato: string[],
  guardaRoupa: ReadonlyArray<{ titulo: string; tipo: string; tags: string[] }>,
): Candidato => {
  if (guardaRoupa.length === 0) return candidato;

  // Cruza as tags COMPLETAS do candidato com as do armário — ver `tagsDoProduto`
  // para por que não pode partir de `tagsEmComum`.
  const minhasTags = new Set(guardaRoupa.flatMap((peca) => peca.tags));
  const combina = tagsDoCandidato.filter((tag) => minhasTags.has(tag));

  // As peças que a pessoa já tem DO MESMO TIPO do candidato. É o que permite ao
  // modelo ver saturação — três casacos no armário desqualificam o quarto — sem
  // que o código decida por ele o que é demais.
  const jaTemDoTipo = guardaRoupa
    .filter((peca) => peca.tipo === candidato.tipo)
    .map((peca) => peca.titulo);

  return {
    ...candidato,
    ...(combina.length > 0 ? { combinaComOGuardaRoupa: combina } : {}),
    ...(jaTemDoTipo.length > 0 ? { jaTemDesteTipo: jaTemDoTipo } : {}),
  };
};
