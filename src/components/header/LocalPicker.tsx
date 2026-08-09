import { useLocalAtual, useTrocarLocal } from "~/platform/look/look.hooks";
import type { Local } from "~/platform/look/look.types";
import Icon from "../ui/Icon";

export interface Props {
  /**
   * Cidades oferecidas no seletor, como "Cidade,UF,País".
   *
   * É uma lista de **atalhos**, não de valores válidos: a action aceita
   * qualquer texto e o prompt manda o modelo não inventar clima para lugar que
   * ele não reconheça. Uma validação contra esta lista no servidor seria o
   * mesmo erro que uma tabela de estações — ver `src/actions/look/setLocal.ts`.
   */
  cidades?: string[];
  /** Só para encolher no header mobile. */
  compacto?: boolean;
}

/**
 * De onde o agente parte para compor o look.
 *
 * Existe por dois motivos, e o segundo é o que o torna indispensável no palco:
 *
 * 1. Quem viaja continua comprando para casa — o IP diz onde o corpo está, não
 *    para onde a roupa vai.
 * 2. **Em `vite dev` os headers de geo da Vercel não existem.** Sem isto, a
 *    diferença entre um look para Porto Alegre e um para Recife só seria
 *    observável depois de um deploy.
 *
 * O valor corrente vem do servidor (`useLocalAtual`), nunca de prop: o `Header`
 * é `layout` e o cache dele é compartilhado entre visitantes.
 */
const PADRAO = ["Porto Alegre,RS,BR", "Recife,PE,BR", "São Paulo,SP,BR", "Lisboa,,PT"];

const paraTexto = (local: Pick<Local, "cidade" | "regiao" | "pais">): string =>
  [local.cidade, local.regiao, local.pais].join(",");

const paraLocal = (valor: string): Pick<Local, "cidade" | "regiao" | "pais"> => {
  const [cidade = "", regiao = "", pais = ""] = valor.split(",").map((parte) => parte.trim());
  return { cidade, regiao, pais };
};

/** "Porto Alegre,RS,BR" -> "Porto Alegre, RS". O país sobra na etiqueta. */
const rotulo = (valor: string): string => {
  const { cidade, regiao } = paraLocal(valor);
  return regiao ? `${cidade}, ${regiao}` : cidade;
};

export default function LocalPicker({ cidades = PADRAO, compacto }: Props) {
  const { local, isLoading } = useLocalAtual();
  const trocar = useTrocarLocal();

  // Enquanto o servidor não respondeu, não renderiza nada em vez de renderizar
  // a primeira opção da lista: um seletor que mostra "Porto Alegre" para quem
  // está em Recife e depois corrige sozinho é pior que meio segundo de vazio —
  // no palco, alguém lê o valor errado em voz alta.
  if (isLoading || !local) return null;

  const atual = paraTexto(local);

  // A cidade em vigor pode não estar na lista de atalhos: o geo da Vercel
  // devolve o que devolve. Ela entra como opção própria para o `<select>` ter
  // o que selecionar — sem isto o browser mostraria a primeira da lista e
  // mentiria sobre de onde o look partiu.
  const opcoes = cidades.includes(atual) ? cidades : [atual, ...cidades];

  return (
    <label
      className="frost tap-scale flex h-10 items-center gap-1.5 rounded-sm px-2.5 text-ink transition-colors duration-(--duration-fast) hover:bg-glass-strong"
      title={
        local.origem === "seletor"
          ? "Você escolheu esta cidade"
          : local.origem === "geo"
            ? "Detectado pelo seu IP"
            : "Não deu para detectar — usando o padrão"
      }
    >
      <Icon id="home_pin" size={16} />
      <span className="sr-only">Cidade para o agente compor o look</span>
      <select
        className="max-w-[9rem] cursor-pointer appearance-none bg-transparent text-sm focus:outline-none disabled:opacity-50"
        value={atual}
        disabled={trocar.isPending}
        onChange={(event) => trocar.mutate(paraLocal(event.currentTarget.value))}
      >
        {opcoes.map((cidade) => (
          <option key={cidade} value={cidade}>
            {compacto ? rotulo(cidade).split(",")[0] : rotulo(cidade)}
          </option>
        ))}
      </select>
      {trocar.isPending && <span className="loading loading-spinner loading-xs" />}
    </label>
  );
}
