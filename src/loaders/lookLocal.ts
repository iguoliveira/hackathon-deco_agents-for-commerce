import { localDaRequisicao } from "~/platform/look/look.local";
import type { Local } from "~/platform/look/look.types";

/**
 * O local em vigor para quem está pedindo: seletor > geo da Vercel > padrão.
 *
 * Existe como loader invocável, e não como prop de section, por uma razão que
 * já mordeu este repo: o `Header` é `layout` e tem cache de 5 minutos
 * **compartilhado entre visitantes**. Injetar o `Local` ali pelo servidor
 * serviria a cidade da primeira pessoa a todas as seguintes dentro da janela —
 * e o sintoma seria o pior possível, um seletor que mostra a cidade de outra
 * pessoa e ainda assim compõe o look certo.
 *
 * Lido no cliente, cada visitante recebe o seu.
 */
export default async function lookLocalLoader(): Promise<Local> {
  return localDaRequisicao();
}
