import { forwardRef } from "react";
import {
  Image as DecoImage,
  getOptimizedMediaUrl,
  getSrcSet,
  registerImageCdnDomain,
  getImageCdnDomain,
  FACTORS,
  type ImageProps,
  type FitOptions,
} from "@decocms/blocks/hooks";

export {
  getOptimizedMediaUrl,
  getSrcSet,
  registerImageCdnDomain,
  getImageCdnDomain,
  FACTORS,
  type ImageProps,
  type FitOptions,
};

/**
 * Hosts cujas URLs devem ir direto ao `<img>`, sem passar pelo otimizador.
 *
 * O `getOptimizedMediaUrl` do framework manda toda URL que não seja
 * `cdn.shopify.com`, VTEX ou `data:` para o CDN de imagem da deco
 * (`decoims.com/image?...&src=...`). E esse CDN **só serve arquivos do próprio
 * armazenamento**: uma URL externa absoluta volta 403. Verificado:
 *
 *   src=decocms/<uuid>/deco-logo.png        -> 200
 *   src=https://images.unsplash.com/photo-… -> 403
 *
 * O catálogo nunca tinha exercitado esse caminho porque todas as 127 imagens
 * originais são do Shopify, que o framework reescreve com o resize nativo e
 * nunca toca no CDN. Ao trazer fotos do Unsplash, elas seriam as primeiras — e
 * apareceriam todas quebradas.
 *
 * A lista é explícita, e não uma heurística tipo "tudo que for externo": assim
 * nada muda para as imagens que já funcionam hoje. Para adicionar um host novo,
 * confirme antes que ele serve imagem redimensionada por query string — é o
 * que substitui a otimização que estamos abrindo mão aqui.
 */
const DIRECT_HOSTS = ["images.unsplash.com"];

const servesItself = (src: string): boolean => {
  if (typeof src !== "string") return false;
  return DIRECT_HOSTS.some((host) => src.startsWith(`https://${host}/`));
};

/**
 * `Image` do framework, com desvio para os hosts acima.
 *
 * O desvio troca `width`/`height` por `w`/`q` na própria URL do host — o
 * Unsplash redimensiona no CDN dele, então não se perde a otimização, só se
 * troca quem a faz. `srcSet` fica de fora no caminho direto: gerá-lo exigiria
 * reimplementar a lógica de FACTORS do framework, e uma imagem numa resolução
 * boa é melhor que várias numa quebrada.
 */
export const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(props, ref) {
  const { src, width, height, fit, quality, preload, media, loading, decoding, ...rest } = props;

  if (!servesItself(src)) return <DecoImage {...props} ref={ref} />;

  const url = new URL(src);
  url.searchParams.set("w", String(width));
  if (height) url.searchParams.set("h", String(height));
  url.searchParams.set("fit", fit === "contain" ? "clip" : "crop");
  url.searchParams.set("q", typeof quality === "number" ? String(quality) : "80");
  url.searchParams.set("auto", "format");

  return (
    <img
      {...rest}
      src={url.toString()}
      width={width}
      height={height}
      loading={loading ?? (preload ? "eager" : "lazy")}
      decoding={decoding ?? "async"}
      fetchPriority={preload ? "high" : props.fetchPriority}
      ref={ref}
    />
  );
});

export default Image;
