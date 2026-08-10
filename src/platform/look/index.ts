/**
 * Barrel do domínio de **sinais e persona**.
 *
 * O nome `look` sobreviveu ao agente que o batizou. Quando a vitrine sem âncora
 * substituiu o "complete o look", o que ficou aqui não é composição: é o que
 * alimenta qualquer agente — as quatro sementes, o retrato do guarda-roupa, os
 * cookies e o hash. Renomear o diretório seria um diff de centenas de linhas em
 * imports, sem mudar comportamento nenhum; fica registrado como dívida.
 *
 * Exports nomeados um a um, nunca `export *` — a regra existe porque `export *`
 * quebra o `knip` e faz código morto passar despercebido.
 */

export type { Local, Semente, SeedKind, Persona, EixoDaPersona } from "./look.types";

export { colherSementes } from "./look.seeds";
export { localDaRequisicao, localEmTexto, mesAtual } from "./look.local";
export { LOCAL_QUERY_KEY, useLocalAtual, useTrocarLocal } from "./look.hooks";
export { acharAncora } from "./look.d1";
export {
  LOCAL_COOKIE,
  RECENT_COOKIE,
  lerVistos,
  marcarVisita,
  serializarLocal,
  serializarVistos,
} from "./look.cookies";
export { fnv1a, hashDosSinais } from "./look.hash";
export { obterPersona } from "./persona.agent";
