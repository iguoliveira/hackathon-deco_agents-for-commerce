import {
  vitrineDoComprador,
  type ListaDaVitrine,
  type VitrinePersonalizada,
} from "~/platform/shelf/shelf.actions";

export interface Props {
  /**
   * @title Lista
   * @description "alternativas" mostra o que substitui a peça esgotada (mesmo tipo). "combinam" mostra o que completa o look (outro tipo).
   */
  lista?: ListaDaVitrine;
}

/**
 * As vitrines pessoais montadas pelo agente a partir do sinal de "avise-me".
 *
 * A única prop é qual das duas listas renderizar — quantos itens entram e em
 * que ordem é decisão do agente, tomada na geração. Um `count` aqui seria
 * fachada.
 *
 * Devolve `null` quando não há comprador identificado, quando ele não tem
 * vitrine, ou quando o que o agente escolheu esgotou desde então. A section
 * some nos três casos, que é o comportamento certo: vitrine pessoal para quem
 * não tem uma é pior que nenhuma seção.
 */
export default async function personalShelfLoader({
  lista = "alternativas",
}: Props = {}): Promise<VitrinePersonalizada | null> {
  return vitrineDoComprador(lista);
}
