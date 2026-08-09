/**
 * O trabalho que as duas rotas do experimento executam — idêntico nas duas.
 *
 * É deliberadamente uma consulta **real** de catálogo, não um `{ ok: true }`:
 * se a resposta fosse trivial, o teste mediria só a rede e não responderia a
 * pergunta que interessa, que é se vale a pena cachear o que uma section de
 * verdade devolve. Doze produtos com imagens, props e variantes é a ordem de
 * grandeza do que a PLP e as vitrines carregam.
 *
 * **Isto é código de experimento e sai quando o experimento acabar.** Está
 * versionado porque a medição precisa rodar num deploy de preview — não há como
 * medir o CDN da Vercel a partir do `localhost`.
 */

import { findCatalogRecords } from "../../platform/catalog/catalog.d1";

export const dadosDoTeste = async () => {
  const inicio = Date.now();
  const registros = await findCatalogRecords({ limit: 12 });

  return {
    // O tempo gasto DENTRO da função, sem a rede. É o que permite dizer, ao ver
    // 180ms na ponta, quanto foi banco e quanto foi a viagem até a Virgínia.
    msNoServidor: Date.now() - inicio,
    // Marca qual invocação produziu esta resposta. Num HIT ele fica congelado —
    // é como se prova que a borda respondeu sem chamar a função de novo.
    geradoEm: new Date().toISOString(),
    produtos: registros.length,
    amostra: registros.slice(0, 3).map((r) => ({
      handle: r.product.handle,
      titulo: r.product.title,
      variantes: r.variants.length,
    })),
  };
};

export const respostaJson = (dados: unknown, headers: Record<string, string>): Response =>
  new Response(JSON.stringify(dados), {
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
