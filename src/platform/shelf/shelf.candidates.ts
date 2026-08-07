/**
 * Etapa 1 do pipeline: montar o espaço de escolha. **Sem modelo.**
 *
 * Aqui está a decisão que define o produto: os candidatos vêm sempre ancorados
 * no que a pessoa quis e não pôde levar — nunca de uma consulta geral ao
 * catálogo. Um agente que recebesse a loja inteira produziria uma vitrine
 * plausível e genérica, que é exatamente o que qualquer loja já tem e não usa o
 * sinal que esta feature captura.
 *
 * São **dois** espaços, porque são duas vitrines com perguntas diferentes:
 *
 *   alternativas → "no lugar do que você queria"  (mesmo tipo)
 *   complementos → "para usar junto"              (outro tipo, mesmo estilo)
 */

import { findWaitedItems, type WaitedItem } from "../alerts";
import { findComplementsAvailable, findSimilarAvailable } from "../catalog/catalog.d1";
import type { SimilarCandidate } from "../catalog/catalog.d1";
import type { Candidato, DesejoNoPrompt } from "./shelf.types";

/**
 * Quantos buscar por desejo. O da âncora recebe mais porque é dele que devem
 * sair as alternativas do topo.
 */
const POR_DESEJO_ANCORA = 14;
const POR_DESEJO_SECUNDARIO = 6;
const COMPLEMENTOS_POR_DESEJO = 10;

/**
 * Tetos por lista.
 *
 * Não é economia de token à toa: o custo é linear no tamanho, e a partir de
 * certo ponto o modelo ignora a cauda de qualquer jeito. Melhor cortar em
 * código, por nota, do que deixar o modelo cortar por posição.
 */
const TETO_ALTERNATIVAS = 24;
const TETO_COMPLEMENTOS = 14;

/** Quantos desejos entram. Além disso o prompt vira ruído. */
const MAX_DESEJOS = 3;

/**
 * Teto por `product_type` na lista de complementos.
 *
 * É o que impede a vitrine "combina com" de virar seis calças. A SQL ordena por
 * afinidade e não por variedade, então sem isto o topo se enche do tipo que por
 * acaso compartilha mais tags — e o resultado deixa de parecer um look.
 */
const MAX_POR_TIPO = 2;

export interface EspacoDeEscolha {
  desejos: DesejoNoPrompt[];
  /** Mesmo tipo do desejado: substituem o que faltou. */
  alternativas: Candidato[];
  /** Outro tipo, mesmo estilo: completam o look. */
  complementos: Candidato[];
  /** Os desejos crus — quem grava a vitrine precisa do `variantId` da âncora. */
  brutos: WaitedItem[];
}

/** O tamanho pedido, quando existe. Acessório não tem, e isso não é erro. */
const tamanhoDe = (item: WaitedItem): string => item.options.Size ?? item.options.size ?? "único";

const paraCandidato = (similar: SimilarCandidate, desejo: WaitedItem): Candidato => {
  const produto = similar.record.product;

  const tamanhos = similar.record.variants
    .filter((variante) => variante.available === 1)
    .map(
      (variante) =>
        similar.record.optionsByVariant
          .get(variante.variant_id)
          ?.find((opcao) => opcao.name === "Size")?.value,
    )
    .filter((valor): valor is string => !!valor);

  return {
    handle: produto.handle,
    titulo: produto.title,
    tipo: produto.product_type,
    preco: similar.record.variants[0]?.price ?? 0,
    mesmoTipo: similar.sameType,
    mesmaColecao: similar.sameCollection,
    tagsEmComum: similar.sharedTags,
    tamanhosDisponiveis: [...new Set(tamanhos)],
    // 160 caracteres: o bastante para o modelo julgar a peça, longe do bastante
    // para as descrições (média de 866) dominarem o prompt.
    descricao: (produto.description ?? "").slice(0, 160),
    paraODesejo: desejo.title,
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
 */
const equilibrarPorTipo = (candidatos: Candidato[], teto: number): Candidato[] => {
  const porTipo = new Map<string, Candidato[]>();
  for (const candidato of candidatos) {
    const chave = candidato.tipo || "(sem tipo)";
    porTipo.set(chave, [...(porTipo.get(chave) ?? []), candidato]);
  }

  const escolhidos: Candidato[] = [];
  const usados = new Set<string>();

  for (const [, doTipo] of porTipo) {
    const primeiro = doTipo[0];
    if (primeiro) {
      escolhidos.push(primeiro);
      usados.add(primeiro.handle);
    }
  }

  const contagem = new Map<string, number>();
  for (const escolhido of escolhidos) {
    contagem.set(escolhido.tipo, 1);
  }

  for (const candidato of candidatos) {
    if (escolhidos.length >= teto) break;
    if (usados.has(candidato.handle)) continue;
    const quantos = contagem.get(candidato.tipo) ?? 0;
    if (quantos >= MAX_POR_TIPO) continue;

    escolhidos.push(candidato);
    usados.add(candidato.handle);
    contagem.set(candidato.tipo, quantos + 1);
  }

  // A ordem final volta a ser a de afinidade: o equilíbrio decide QUEM entra,
  // não em que ordem o modelo os lê.
  const posicao = new Map(candidatos.map((c, i) => [c.handle, i]));
  return escolhidos
    .sort((a, b) => (posicao.get(a.handle) ?? 0) - (posicao.get(b.handle) ?? 0))
    .slice(0, teto);
};

/**
 * Espaço de escolha de um comprador.
 *
 * **Uma vitrine por comprador, ancorada no desejo mais recente.** Os demais
 * contribuem candidatos, e cada candidato carrega em `paraODesejo` de onde veio.
 * Sem essa procedência o motivo degenera para um "combina com você" genérico —
 * com ela o agente escreve "para a calça que você queria".
 *
 * Não lança: quem consome é uma vitrine, e vitrine vazia é resultado aceitável.
 */
export const montarEspacoDeEscolha = async (email: string): Promise<EspacoDeEscolha> => {
  const vazio: EspacoDeEscolha = { desejos: [], alternativas: [], complementos: [], brutos: [] };

  const todos = await findWaitedItems(email, MAX_DESEJOS);
  // Um desejo que já voltou ao estoque não precisa de substituto: o melhor
  // "produto que combina" é o próprio item esperado, e a loja deveria estar
  // avisando que ele voltou, não recomendando outro.
  const pendentes = todos.filter((item) => !item.available);
  if (pendentes.length === 0) return vazio;

  // `findWaitedItems` já devolve do mais recente para o mais antigo.
  const alternativas = new Map<string, Candidato>();
  const complementos = new Map<string, Candidato>();

  for (const [indice, desejo] of pendentes.entries()) {
    const limite = indice === 0 ? POR_DESEJO_ANCORA : POR_DESEJO_SECUNDARIO;

    const [similares, combinam] = await Promise.all([
      findSimilarAvailable(desejo.variantId, limite),
      findComplementsAvailable(desejo.variantId, COMPLEMENTOS_POR_DESEJO),
    ]);

    for (const similar of similares) {
      const handle = similar.record.product.handle;
      // O primeiro a reivindicar um handle fica com ele — e a iteração começa
      // pela âncora, então em empate a procedência é a do desejo mais recente,
      // que é a que o motivo deve citar.
      if (!alternativas.has(handle)) alternativas.set(handle, paraCandidato(similar, desejo));
    }

    for (const combina of combinam) {
      const handle = combina.record.product.handle;
      // Deduplica só DENTRO desta lista, nunca contra as alternativas.
      //
      // Excluir o que já está em `alternativas` parece certo — nada deveria
      // aparecer nas duas vitrines — e mata a segunda. `findSimilarAvailable`
      // não filtra por tipo: para um moletom ela devolve boné e camiseta junto,
      // porque compartilham tags. Esses chegam primeiro, viram "alternativa", e
      // sobra quase nada para o look. Medido: 14 alternativas e **2**
      // complementos, o bastante para a vitrine de composição desistir.
      //
      // A repetição é evitada onde ela de fato importa, na saída: `combinam` é
      // validado excluindo o que o modelo já usou em `itens`. Assim os dois
      // pools ficam ricos e nenhum produto aparece duas vezes na tela.
      if (complementos.has(handle)) continue;
      complementos.set(handle, paraCandidato(combina, desejo));
    }
  }

  return {
    desejos: pendentes.map((item) => ({
      titulo: item.title,
      tipo: item.productType,
      tamanho: tamanhoDe(item),
    })),
    alternativas: [...alternativas.values()].slice(0, TETO_ALTERNATIVAS),
    complementos: equilibrarPorTipo([...complementos.values()], TETO_COMPLEMENTOS),
    brutos: pendentes,
  };
};
