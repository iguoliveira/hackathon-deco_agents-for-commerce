/**
 * Linhas do SQLite -> `Product` (schema.org) de @decocms/apps-commerce/types.
 *
 * Este arquivo é uma reimplementação deliberada de `toProduct` do app Shopify
 * (node_modules/@decocms/apps-shopify/src/utils/transform.ts:162-337). O objetivo
 * não é ser mais bonito que ele: é produzir a MESMA forma, campo a campo, para
 * que ProductShelf / ProductCard / useOffer / useVariantPossibilities continuem
 * funcionando sem saber que a fonte mudou.
 *
 * Se o transform do Shopify mudar, este arquivo é o que precisa acompanhar.
 */

import type {
  BreadcrumbList,
  ImageObject,
  ListItem,
  Product,
  ProductDetailsPage,
  PropertyValue,
} from "@decocms/apps-commerce/types";
import { DEFAULT_IMAGE } from "@decocms/apps-commerce/utils/constants";
import type { CatalogRecord, VariantRow } from "./catalog.types";

/**
 * `gid://shopify/ProductVariant/9100000000001` -> `9100000000001`.
 * A PDP roteia por `/products/:slug` (.deco/blocks/pages-productpage-*.json),
 * e o slug carrega o id numérico da variante — mesma convenção do Shopify.
 */
const numericVariantId = (variantId: string) => variantId.split("/").pop() ?? variantId;

const productPath = (handle: string, variant?: VariantRow) =>
  variant ? `/products/${handle}-${numericVariantId(variant.variant_id)}` : `/products/${handle}`;

const toImage = (url: string, alt: string): ImageObject => ({
  "@type": "ImageObject",
  encodingFormat: "image",
  alternateName: alt,
  url,
});

const toPropertyValue = (option: Omit<PropertyValue, "@type">): PropertyValue => ({
  "@type": "PropertyValue",
  ...option,
});

/**
 * Converte uma variante em `Product`.
 *
 * `includeVariants` espelha o parâmetro `level` do transform do Shopify: no nível
 * de topo o produto carrega todos os irmãos em `isVariantOf.hasVariant`; dentro
 * de `hasVariant` cada um vem com a lista vazia, senão a estrutura se
 * auto-referencia infinitamente.
 */
const toProduct = (
  record: CatalogRecord,
  variant: VariantRow,
  origin: string,
  includeVariants: boolean,
): Product => {
  const { product, images, props, variants, optionsByVariant } = record;

  const selectedOptions = (optionsByVariant.get(variant.variant_id) ?? []).map((option) =>
    toPropertyValue({ name: option.name, value: option.value }),
  );

  const additionalProperty: PropertyValue[] = [
    ...selectedOptions,
    toPropertyValue({ name: "descriptionHtml", value: product.description_html ?? undefined }),
    toPropertyValue({ name: "productType", value: product.product_type }),
  ];

  const priceSpecification: NonNullable<Product["offers"]>["offers"][number]["priceSpecification"] =
    [
      {
        "@type": "UnitPriceSpecification",
        priceType: "https://schema.org/SalePrice",
        price: variant.price,
      },
    ];

  if (variant.compare_at_price != null) {
    priceSpecification.push({
      "@type": "UnitPriceSpecification",
      priceType: "https://schema.org/ListPrice",
      price: variant.compare_at_price,
    });
  }

  const variantImage = variant.image_url
    ? [toImage(variant.image_url, variant.image_alt)]
    : [DEFAULT_IMAGE];

  return {
    "@type": "Product",
    productID: variant.variant_id,
    url: `${origin}${productPath(product.handle, variant)}`,
    name: variant.title,
    description: product.description,
    sku: variant.variant_id,
    gtin: variant.barcode ?? undefined,
    brand: { "@type": "Brand", name: product.vendor },
    releaseDate: product.created_at ?? undefined,
    additionalProperty,
    isVariantOf: {
      "@type": "ProductGroup",
      productGroupID: product.product_group_id,
      hasVariant: includeVariants
        ? variants.map((sibling) => toProduct(record, sibling, origin, false))
        : [],
      url: `${origin}${productPath(product.handle)}`,
      name: product.title,
      additionalProperty: props.map((prop) =>
        toPropertyValue({
          name: prop.name,
          value: prop.value,
          valueReference: prop.value_reference ?? undefined,
        }),
      ),
      image: images.map((image) => toImage(image.url, image.alt)),
    },
    image: variantImage,
    video: [],
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: product.currency_code,
      highPrice: variant.compare_at_price ?? variant.price,
      lowPrice: variant.price,
      offerCount: 1,
      offers: [
        {
          "@type": "Offer",
          price: variant.price,
          availability: variant.available
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          inventoryLevel: { value: variant.quantity },
          priceSpecification,
        },
      ],
    },
  };
};

/**
 * Converte um registro do catálogo no `Product` que representa o produto na
 * vitrine. Sem `variantId`, usa a primeira variante — a mesma escolha que
 * `productByHandle` faz hoje com o Shopify
 * (src/loaders/productByHandle.ts:29: `variants.nodes[0]`). Com `variantId`,
 * preserva a variante selecionada, como na wishlist.
 */
export const recordToProduct = (
  record: CatalogRecord,
  origin: string,
  variantId?: string,
): Product | null => {
  const variant =
    record.variants.find((candidate) => candidate.variant_id === variantId) ?? record.variants[0];
  if (!variant) return null;
  return toProduct(record, variant, origin, true);
};

/**
 * Breadcrumb da PDP.
 *
 * Espelha `toBreadcrumbList` do Shopify (transform.ts:128-160), inclusive a
 * peculiaridade de usar `position: 2` no item do produto mesmo quando ele é o
 * único da lista (produto sem coleção). Parece engano deles, mas isto alimenta
 * o JSON-LD de SEO — divergir aqui mudaria a saída estruturada da página em
 * relação ao que o Shopify serve hoje, que é justamente o que não queremos.
 */
const toBreadcrumbList = (record: CatalogRecord, origin: string, path: string): BreadcrumbList => {
  const collection = record.props.find((prop) => prop.name === "COLLECTION");

  const items: ListItem[] = collection
    ? [
        {
          "@type": "ListItem",
          name: decodeURI(collection.value),
          position: 1,
          item: `/${collection.value_reference ?? ""}`,
        },
        { "@type": "ListItem", name: decodeURI(record.product.title), position: 2, item: path },
      ]
    : [{ "@type": "ListItem", name: decodeURI(record.product.title), position: 2, item: path }];

  return {
    "@type": "BreadcrumbList",
    numberOfItems: items.length,
    itemListElement: items,
  };
};

/**
 * Monta a `ProductDetailsPage` — o que a PDP e o SEO PDP consomem.
 *
 * `variantId` escolhe a variante exibida; ausente ou inexistente cai na
 * primeira, mesma tolerância do loader do Shopify.
 */
export const recordToProductPage = (
  record: CatalogRecord,
  origin: string,
  variantId?: string,
): ProductDetailsPage | null => {
  const variant =
    record.variants.find((candidate) => candidate.variant_id === variantId) ?? record.variants[0];

  if (!variant) return null;

  const path = productPath(record.product.handle, variant);

  return {
    "@type": "ProductDetailsPage",
    breadcrumbList: toBreadcrumbList(record, origin, path),
    product: toProduct(record, variant, origin, true),
    seo: {
      title: record.product.title,
      description: record.product.description,
      canonical: `${origin}${path}`,
    },
  };
};
