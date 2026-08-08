/**
 * Barrel do domínio de composição.
 *
 * Exports nomeados um a um, nunca `export *` — a regra existe porque `export *`
 * quebra o `knip` e faz código morto passar despercebido.
 */

export type {
  Ancora,
  Candidato,
  Contexto,
  Local,
  Look,
  PecaDoLook,
  Semente,
  SeedKind,
} from "./look.types";

export { lookDaPeca } from "./look.actions";
export type { BlocoDoLook, LookPersonalizado, PecaRenderizavel } from "./look.actions";

export { comporLook, gerarLook, validar } from "./look.agent";
export { montarCandidatos } from "./look.candidates";
export { colherSementes } from "./look.seeds";
export { localDaRequisicao, localEmTexto, mesAtual } from "./look.local";
export { acharAncora } from "./look.d1";
export {
  LOCAL_COOKIE,
  RECENT_COOKIE,
  lerVistos,
  serializarLocal,
  serializarVistos,
} from "./look.cookies";
