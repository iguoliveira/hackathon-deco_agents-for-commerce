/**
 * Etapa 1: montar o espaço de escolha. **Sem modelo.**
 *
 * Aqui está a inversão que define o domínio: o `look` monta o pool a partir da
 * peça aberta, e chama isso de "a decisão que define esta feature". Esta monta a
 * partir do **catálogo inteiro**, e a decisão que define a feature é justamente
 * não haver recorte — ver `catalogoDisponivel`.
 *
 * O que este arquivo faz, então, não é escolher: é **anotar**. Cada produto sai
 * daqui com os sinais que o relacionam à pessoa já calculados, para o modelo ler
 * em vez de deduzir. Cruzar 127 produtos contra N peças de alguém é exatamente o
 * tipo de trabalho em que um modelo erra em silêncio.
 */

import { catalogoDisponivel } from "./vitrine.d1";
import type { Candidato } from "./vitrine.types";
import type { SeedKind } from "../look/look.types";

/**
 * O recorte de uma semente que este arquivo precisa. **`kinds` e obrigatorio**,
 * e essa e a correcao inteira em uma linha.
 *
 * O tipo anterior era `{ titulo, tipo, tags }` — sem `kinds`. A informacao de
 * ORIGEM era apagada na fronteira da funcao, entao "comprou" e "viu numa PDP"
 * chegavam indistinguiveis e a unica leitura possivel era tratar as duas como
 * posse. O bug nao estava na logica: estava na assinatura, que tornava a logica
 * correta impossivel de escrever.
 *
 * Nasceu em `look.candidates.ts` e veio para ca quando o look foi aposentado —
 * era a unica parte daquele arquivo que nao dependia de ancora.
 */
export interface PecaDaPessoa {
  titulo: string;
  tipo: string;
  tags: string[];
  kinds: readonly SeedKind[];
}

export const comOGuardaRoupa = (
  candidato: Candidato,
  tagsDoCandidato: string[],
  guardaRoupa: readonly PecaDaPessoa[],
): Candidato => {
  if (guardaRoupa.length === 0) return candidato;

  // **Posse e desejo sao coisas diferentes, e so uma das quatro origens e
  // posse.** Comprar significa ter; favoritar, pedir avise-me e ver numa PDP
  // significam querer, esperar e olhar.
  //
  // `recent` fica de fora dos DOIS: um cookie de trinta minutos com oito peças
  // vistas marcaria meio pool como afinidade, e o proprio prompt proibe
  // nominalmente ("nao e parece com o que ela olha"). Nada se perde — as quatro
  // origens continuam chegando ao modelo pelas sementes e pela persona. O que
  // muda e quais delas podem AFIRMAR afinidade candidato a candidato.
  const possui = guardaRoupa.filter((p) => p.kinds.includes("purchased"));
  const quer = guardaRoupa.filter(
    (p) => p.kinds.includes("wishlist") || p.kinds.includes("waited"),
  );

  // Uma peca comprada E favoritada conta nos dois, e isso e verdade, nao dupla
  // contagem: ela e posse e e desejo declarado.
  const cruzar = (pecas: readonly PecaDaPessoa[]): string[] => {
    const tags = new Set(pecas.flatMap((peca) => peca.tags));
    return tagsDoCandidato.filter((tag) => tags.has(tag));
  };

  const combinaComTem = cruzar(possui);
  const combinaComQuer = cruzar(quer);

  // As pecas que a pessoa REALMENTE tem, do mesmo tipo do candidato. Deixa o
  // modelo ver saturacao sem que o codigo decida o que e demais — e agora sem
  // contar como posse o gorro que ela so olhou.
  const jaTemDoTipo = possui
    .filter((peca) => peca.tipo === candidato.tipo)
    .map((peca) => peca.titulo);

  return {
    ...candidato,
    ...(combinaComTem.length > 0 ? { combinaComOGuardaRoupa: combinaComTem } : {}),
    ...(combinaComQuer.length > 0 ? { combinaComOQueQuer: combinaComQuer } : {}),
    ...(jaTemDoTipo.length > 0 ? { jaTemDesteTipo: jaTemDoTipo } : {}),
  };
};

/**
 * Uma tag que quase todo produto tem não distingue nada — só ocupa prompt.
 *
 * O `look` mede isso dentro do pool dele, que é pequeno e ancorado. Aqui o pool
 * é o catálogo, então a frequência é global por construção, e o corte precisa
 * ser mais alto: `everyday` está em 65% dos produtos e `unisex` em 61%, mas uma
 * tag em 30% ainda separa 70 produtos dos outros 57.
 *
 * **Metade do catálogo**, mesmo critério do `look` e pelo mesmo motivo de não
 * virar lista: um `["everyday", "unisex"]` no código seria literal de catálogo,
 * travaria o domínio nesta loja, e num catálogo de vinho as banais seriam
 * outras. A função as acha sozinha.
 *
 * ## O alarme falso que valeu a medição
 *
 * A primeira leitura foi que o corte estava frouxo: com ele, 116 dos 127
 * produtos saem com `combinaComOGuardaRoupa` preenchido, e um sinal que vale
 * para 91% do pool não ordena nada.
 *
 * **Estava errado, e o erro foi ler o campo como booleano.** Ele carrega uma
 * LISTA, e é o tamanho dela que ordena. Medido, com dois armários semeados:
 *
 *   tags em comum   0    1    2    3    4    5
 *   ana.escura     11   37   40   30    7    2
 *   carla.tecnica  17   39   39   24    6    2
 *
 * Nove produtos com 4-5 tags se destacam de verdade, e o topo bate com o
 * armário: para a `carla.tecnica` (técnico, outdoor, inverno) sobem
 * `Cargo Pants → streetwear, carry, dark green` e `Cargo Jogger Pants`.
 *
 * Baixar o corte para 20% deixaria 48 marcados, mas cortaria `women` (25%) e
 * `classic` (23%) — que para estes armários são sinal legítimo, não ruído
 * (`Open Knit Cardigan → women, classic, layering`). Um corte mais agressivo
 * jogaria fora informação para consertar um problema que não existe.
 */
const tagsBanais = (catalogo: readonly Candidato[]): Set<string> => {
  if (catalogo.length < 4) return new Set();

  const contagem = new Map<string, number>();
  for (const produto of catalogo) {
    for (const tag of new Set(produto.tags)) {
      contagem.set(tag, (contagem.get(tag) ?? 0) + 1);
    }
  }

  const corte = catalogo.length / 2;
  return new Set([...contagem].filter(([, n]) => n > corte).map(([tag]) => tag));
};

/**
 * O catálogo, anotado com o que ele tem a ver com esta pessoa.
 *
 * `comOGuardaRoupa` é reusado do `look` **de propósito, e não por preguiça**: é
 * exatamente a mesma pergunta — "o que este produto tem a ver com o que ela tem
 * e com o que ela quer?" — e foi consertado no passo 0 justamente porque aqui
 * ele deixa de ser um sinal entre vários e passa a ser o único. Duas cópias
 * dessa lógica seriam duas chances de o defeito voltar em uma delas.
 *
 * **`jaComprados` sai do pool**, mesma regra do `look` e pelo mesmo motivo: uma
 * peça já comprada não é recomendação, é erro de loja — o card viria com preço e
 * botão de comprar. Favoritar e ver não tiram nada: quem favoritou e não comprou
 * continua sendo alguém a quem oferecer aquilo.
 *
 * Não há teto e não há equilíbrio por tipo. O `look` corta em 18 e limita 3 por
 * tipo porque uma roupa com seis calças não é uma roupa; uma vitrine com seis
 * camisetas é uma vitrine. Ver docs/vitrine-sem-ancora.md §5.
 */
export const montarCandidatos = async (
  guardaRoupa: readonly PecaDaPessoa[] = [],
  /** `product_group_id` do que ela já comprou. Excluído no SQL — ver `catalogoDisponivel`. */
  jaComprados: readonly string[] = [],
): Promise<Candidato[]> => {
  const disponiveis = await catalogoDisponivel(jaComprados);

  const banais = tagsBanais(disponiveis);

  // Direto, sem adaptação. Enquanto o `look` existia, esta linha passava por um
  // `anotavel()` que preenchia `mesmaColecao` e `tagsEmComum` com vazio, porque
  // `comOGuardaRoupa` tipava o candidato daquele domínio. Com o look aposentado
  // a função mudou de casa e os campos de âncora sumiram do tipo — a camada de
  // tradução deixou de ter o que traduzir.
  return disponiveis.map((produto) =>
    comOGuardaRoupa(produto, produto.tags.filter((tag) => !banais.has(tag)), guardaRoupa),
  );
};
