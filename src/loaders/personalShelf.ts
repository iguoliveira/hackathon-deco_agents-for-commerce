import { vitrineDoComprador, type VitrinePersonalizada } from "~/platform/shelf/shelf.actions";

/**
 * A vitrine pessoal montada pelo agente a partir do sinal de "avise-me".
 *
 * Não tem props: o que ela mostra depende de quem está pedindo, não de
 * configuração. Um `count` aqui seria fachada — quantos itens entram é decisão
 * do agente, tomada na geração.
 *
 * Devolve `null` quando não há comprador logado, quando ele não tem vitrine, ou
 * quando o que o agente escolheu esgotou desde então. A section some nos três
 * casos, que é o comportamento certo: vitrine pessoal para quem não tem uma é
 * pior que nenhuma seção.
 */
export default async function personalShelfLoader(): Promise<VitrinePersonalizada | null> {
  return vitrineDoComprador();
}
