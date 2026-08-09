import { type ImageWidget } from "~/types/widgets";
import Image from "~/components/ui/Image";
import PoweredByDeco from "~/components/ui/PoweredByDeco";
import Section from "../../components/ui/Section";

/** @titleBy title */
interface Item {
  title: string;
  href: string;
}

/** @titleBy title */
interface Link extends Item {
  children: Item[];
}

/** @titleBy alt */
interface Social {
  alt?: string;
  href?: string;
  image: ImageWidget;
}

interface Props {
  links?: Link[];
  social?: Social[];
  paymentMethods?: Social[];
  policies?: Item[];
  logo?: ImageWidget;
  trademark?: string;
}

function Footer({
  links = [],
  social = [],
  policies = [],
  paymentMethods = [],
  logo,
  trademark,
}: Props) {
  return (
    <footer className="mt-10 bg-gray-50 px-8">
      <div className="flex flex-col gap-8 py-10 sm:gap-10 sm:py-14">
        {/* As chaves levam o índice porque `href` NÃO é único aqui: o
            `Footer.json` tem 31 links com `href: "#"` — placeholders que nunca
            ganharam destino. Com `key={href}`, dezenas de irmãos dividiam a
            chave `#`, e o React avisava que "may cause children to be
            duplicated and/or omitted".

            Índice é seguro nestas listas por serem configuração do CMS: elas
            não reordenam nem filtram em runtime, que é o caso em que índice
            como chave quebra. */}
        <ul className="grid grid-flow-row gap-6 sm:grid-flow-col">
          {links.map(({ title, href, children }, i) => (
            <li key={`${href}-${i}`} className="flex flex-col gap-4">
              <a className="text-sm font-medium text-ink-soft" href={href}>
                {title}
              </a>
              <ul className="flex flex-col gap-2">
                {children.map(({ title, href }, j) => (
                  <li key={`${href}-${j}`}>
                    <a className="text-sm text-muted" href={href}>
                      {title}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center sm:gap-12">
          <ul className="flex gap-4">
            {social.map(({ image, href, alt }, i) => (
              <li key={`${href}-${i}`}>
                <a href={href}>
                  <Image src={image} alt={alt} loading="lazy" width={20} height={20} />
                </a>
              </li>
            ))}
          </ul>
          <ul className="flex flex-wrap gap-2">
            {paymentMethods.map(({ image, alt }) => (
              <li key={alt} className="frost flex h-8 w-10 items-center justify-center rounded-xs">
                <Image src={image} alt={alt} width={20} height={20} loading="lazy" />
              </li>
            ))}
          </ul>
        </div>

        <hr className="w-full border-gray-200" />

        <div className="grid grid-flow-row gap-8 sm:grid-flow-col">
          <ul className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            {policies.map(({ title, href }, i) => (
              <li key={`${href}-${i}`}>
                <a className="text-xs text-muted" href={href}>
                  {title}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex flex-nowrap items-center justify-between gap-4 sm:justify-center">
            {logo && <img loading="lazy" src={logo} className="h-5 w-auto" />}
            <span className="text-xs text-muted">{trademark}</span>
          </div>

          <div className="flex flex-nowrap items-center justify-center gap-4">
            <span className="text-sm text-muted">Powered by</span>
            <PoweredByDeco />
          </div>
        </div>
      </div>
    </footer>
  );
}

export const LoadingFallback = () => <Section.Placeholder height="380px" />;

export default Footer;

export const eager = true;
export const sync = true;
export const layout = true;
