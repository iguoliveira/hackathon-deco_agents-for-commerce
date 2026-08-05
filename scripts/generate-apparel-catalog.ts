/**
 * Gera o catálogo de vestuário — a fonte de verdade dos 103 produtos da 0011.
 *
 *   npm run catalog:apparel             # só regera o SQL
 *   npm run catalog:apparel -- --apply  # regera E aplica no banco do .env
 *
 * A migration 0011 tem 252 KB. Editá-la à mão é inviável: mudar o preço de uma
 * peça significaria caçar a linha certa entre milhares. Este arquivo é onde se
 * mexe — a tabela `P` abaixo tem uma linha legível por produto.
 *
 * Por que `--apply` existe: uma migration roda UMA vez (o runner registra em
 * `schema_migrations`), então regerar a 0011 não muda um banco que já a
 * aplicou. O `--apply` executa o SQL direto, e como o arquivo começa apagando
 * os próprios produtos (`gid://catalog/Product/%`), rodar de novo substitui em
 * vez de duplicar. Isso torna o ciclo de polimento rápido: editar, aplicar,
 * olhar o site.
 *
 * O DELETE é restrito ao prefixo `gid://catalog/` — os produtos importados do
 * Shopify usam `gid://shopify/` e não são tocados.
 *
 * FOTOS: só entram URLs de images.unsplash.com verificadas duas vezes — que
 * respondem 200 e que MOSTRAM a peça descrita. O endpoint aleatório
 * source.unsplash.com está morto (503), então não dá para gerar foto por
 * palavra-chave: cada id foi conferido a olho. Ao trocar uma foto, confira as
 * duas coisas antes de commitar.
 */

import { writeFileSync } from "node:fs";
import postgres from "postgres";
import { resolveDatabaseUrl } from "./db-url";

// ---------------------------------------------------------------------------
// Fotos — todas verificadas: carregam (200) E foram inspecionadas visualmente.
// ---------------------------------------------------------------------------
const IMG = {
  teeWhite: "1521572163474-6864f9cf17ab",
  teeBlackRack: "1576871337622-98d48d1cf531",
  teeBlackHanger: "1618354691373-d851c5c3a990",
  teeBlackGraphic: "1503341504253-dff4815485f1",
  teeGreen: "1523381210434-271e8be1f52b",
  teeBlackText: "1583743814966-8936f5b7be1a",
  teeWhiteGraphic: "1554568218-0f1715e72254",
  teeOutfit: "1582418702059-97ebafb35d09",
  hoodieGrey: "1556821840-3a63f95609a7",
  sweatWhite: "1620799140408-edc6dcb6d633",
  hoodieDenim: "1517841905240-472988babdf9",
  shirtChambray: "1596755094514-f87e34085b2c",
  rackColor: "1489987707025-afc232f7ea0f",
  rackBlouse: "1512436991641-6745cdb1723f",
  bomberBrown: "1591047139829-d91aecb6caea",
  leatherBlack: "1551028719-00167b16eac5",
  blazerBlack: "1610652492500-ded49ceeb378",
  ponchoCream: "1434389677669-e08b4cac3105",
  knitPastel: "1509319117193-57bab727e09d",
  joggerPink: "1594633312681-425c7b97ccd1",
  jeansFolded: "1542272604-787c3835535d",
  jeansPatch: "1541099649105-f69ad21f3246",
  jeansSkinny: "1475178626620-a4d074967452",
  shortsDenim: "1591195853828-11db59a44f6b",
  dressRed: "1595777457583-95e059d581b8",
  dressPurple: "1566174053879-31528523f8ae",
  romperOlive: "1618932260643-eee4a2f652a6",
  backpackGrey: "1547949003-9792a18a2601",
  backpackNavy: "1553062407-98eeb64c6a62",
  bagTan: "1590874103328-eac38a683ce7",
  bagRed: "1584917865442-de89df76afd3",
  capWhite: "1588850561407-ed78c282e89b",
  shoeRed: "1542291026-7eec264c27ff",
  shoeWhite: "1608231387042-66d1773070a5",
  shoeTan: "1549298916-b41d501d3772",
  shoeGrey: "1460353581641-37baddab0fa2",
  shoePastel: "1595950653106-6c9ebd614d3a",
  shoeOrange: "1600185365483-26d7a4cc7519",
  capCharcoal: "1521369909029-2afed882baee",
  jacketOlive: "1544022613-e87ca75a784a",
  sneakerMulti: "1560769629-975ec94e6a86",
  teeBlackModel: "1571455786673-9d9d6c194f90",
  teeCreamGraphic: "1576566588028-4147f3842f27",
  kidsOutfit: "1519238263530-99bdd11df2ea",
  bucketTan: "1578681994506-b8f463449011",
  teeBlackWoman: "1583744946564-b52ac1c389c8",
  bagFloral: "1591561954557-26941169b49e",
  shirtWhiteRack: "1603252109303-2751441dd157",
  teeWhiteHeart: "1613852348851-df1739db8201",
  pantsCargoOlive: "1552902865-b72c031ac5ea",
  jeansRipped: "1582552938357-32b906df40cb",
  trousersBlack: "1584865288642-42078afe6942",
  suitGreen: "1593032465175-481ac7f401a0",
  shortsGrey: "1598522325074-042db73aa4e6",
  denimJacketDark: "1611312449408-fcece27cdbb7",
  suitNavy: "1617137968427-85924c800a22",
  shortsRed: "1617952236317-0bd127407984",
  teeWhiteFlat: "1620799139834-6b8f844fbe61",
  jeansDark: "1624378439575-d8705ad7ae80",
  skirtTulle: "1509551388413-e18d0ac5d495",
};

/**
 * A cor que cada foto REALMENTE mostra.
 *
 * A cor do produto é derivada daqui, nunca escolhida à parte. Antes cada
 * produto declarava 2 ou 3 cores e todas usavam a mesma foto — então a variante
 * "Black" de uma bolsa exibia a foto de uma bolsa bege. Bolsas e calçados eram
 * o pior caso: cor inexistente, foto igual.
 *
 * Derivar a cor da foto torna a inconsistência impossível por construção: para
 * ter uma cor nova é preciso ter uma foto nova.
 */
const COR: Record<keyof typeof IMG, string> = {
  teeWhite: "White",
  teeBlackRack: "Black",
  teeBlackHanger: "Black",
  teeBlackGraphic: "Black",
  teeGreen: "Sage",
  teeBlackText: "Black",
  teeWhiteGraphic: "White",
  teeOutfit: "Black",
  hoodieGrey: "Grey",
  sweatWhite: "White",
  hoodieDenim: "Blue",
  shirtChambray: "Blue",
  rackColor: "Multicolor",
  rackBlouse: "Off White",
  bomberBrown: "Brown",
  leatherBlack: "Black",
  blazerBlack: "Black",
  ponchoCream: "Cream",
  knitPastel: "Pastel",
  joggerPink: "Pink",
  jeansFolded: "Indigo",
  jeansPatch: "Blue",
  jeansSkinny: "Light Blue",
  shortsDenim: "Light Blue",
  dressRed: "Red",
  dressPurple: "Wine",
  romperOlive: "Olive",
  backpackGrey: "Grey",
  backpackNavy: "Navy",
  bagTan: "Tan",
  bagRed: "Red",
  capWhite: "White",
  shoeRed: "Red",
  shoeWhite: "White",
  shoeTan: "Tan",
  shoeGrey: "Grey",
  shoePastel: "Pastel",
  shoeOrange: "Orange",
  capCharcoal: "Charcoal",
  jacketOlive: "Olive",
  sneakerMulti: "Multicolor",
  teeBlackModel: "Black",
  teeCreamGraphic: "Cream",
  kidsOutfit: "Navy",
  bucketTan: "Tan",
  teeBlackWoman: "Black",
  bagFloral: "Floral",
  shirtWhiteRack: "White",
  teeWhiteHeart: "White",
  pantsCargoOlive: "Olive",
  jeansRipped: "Light Blue",
  trousersBlack: "Black",
  suitGreen: "Forest",
  shortsGrey: "Grey",
  denimJacketDark: "Dark Indigo",
  suitNavy: "Navy",
  shortsRed: "Red",
  teeWhiteFlat: "White",
  jeansDark: "Dark Indigo",
  skirtTulle: "Ivory",
};
const url = (k: keyof typeof IMG, w = 900) =>
  `https://images.unsplash.com/photo-${IMG[k]}?w=${w}&q=80&auto=format&fit=crop`;

const APP = ["XS", "S", "M", "L", "XL"];
const DEN = ["36", "38", "40", "42", "44"];
const SHO = ["37", "38", "39", "40", "41", "42"];
const ONE = null; // sem tamanho: só cor

const COLECOES = {
  shirts: "Shirts",
  "hoodies-sweatshirts": "Hoodies & Sweatshirts",
  "jackets-outerwear": "Jackets & Outerwear",
  bottoms: "Bottoms",
  accessories: "Accessories",
  shoes: "Shoes",
  kids: "Kids",
  dresses: "Dresses",
} as const;

/**
 * Uma linha por produto:
 * handle, título, product_type, coleção, cores, tamanhos, preço, fotos, tags, descrição.
 *
 * As tags são o eixo de similaridade do agente — mantenha o vocabulário
 * pequeno e REPETIDO. Tag que aparece num produto só não serve de eixo:
 * 'cotton' em 30 peças vale mais que 30 tags distintas e únicas.
 */
type Produto = [
  handle: string,
  title: string,
  tipo: string,
  colecao: keyof typeof COLECOES,
  cores: string[],
  tamanhos: string[] | null,
  preco: number,
  imgs: (keyof typeof IMG)[],
  tags: string[],
  desc: string,
];

const P: Produto[] = [
  // ---------------------------------------------------------------- camisetas
  [
    "essential-cotton-tee",
    "Essential Cotton Tee",
    "T-Shirt",
    "shirts",
    ["White", "Black", "Sand"],
    APP,
    89,
    ["teeWhite", "teeBlackHanger"],
    ["unisex", "basic", "cotton", "everyday", "layering"],
    "A camiseta que resolve qualquer dia. Malha 100% algodão penteado de 180g, com caimento reto que não marca o corpo e gola canelada que não cede na lavagem. Serve sozinha no calor ou por baixo de moletom e jaqueta quando esfria.",
  ],
  [
    "heavyweight-boxy-tee",
    "Heavyweight Boxy Tee",
    "T-Shirt",
    "shirts",
    ["Black", "Off White"],
    APP,
    119,
    ["teeBlackHanger", "teeBlackRack"],
    ["unisex", "oversized", "cotton", "streetwear", "everyday"],
    "Algodão pesado de 240g com modelagem boxy: ombro caído, corpo largo e barra na altura do quadril. O tecido encorpado faz a peça cair estruturada em vez de grudar, o que sustenta o visual oversized sem parecer um tamanho maior por acidente.",
  ],
  [
    "studio-pocket-tee",
    "Studio Pocket Tee",
    "T-Shirt",
    "shirts",
    ["Sage", "White"],
    APP,
    99,
    ["teeGreen", "teeWhite"],
    ["unisex", "minimalist", "cotton", "everyday"],
    "Camiseta de bolso em algodão macio, com costura reforçada no ombro. O bolso é chapado e discreto, do tamanho certo para não deformar o caimento. Uma peça neutra para quem prefere que a roupa não grite.",
  ],
  [
    "night-shift-graphic-tee",
    "Night Shift Graphic Tee",
    "T-Shirt",
    "shirts",
    ["Black"],
    APP,
    129,
    ["teeBlackGraphic", "teeBlackText"],
    ["unisex", "graphic", "cotton", "streetwear", "code-culture"],
    "Estampa serigrafada em tinta à base d'água, que penetra na malha em vez de formar película — não craquela nem esquenta. Base de algodão preto com lavagem enzimática, então já chega com aquele toque macio de camiseta velha favorita.",
  ],
  [
    "capybara-club-tee",
    "Capybara Club Tee",
    "T-Shirt",
    "shirts",
    ["White", "Sage"],
    APP,
    109,
    ["teeWhiteGraphic", "teeGreen"],
    ["unisex", "graphic", "cotton", "capybara", "everyday"],
    "Ilustração de capivara no peito, desenhada à mão e impressa em tom sobre tom. Algodão leve de 160g, ideal para dias quentes. É a peça que gera conversa sem precisar de logo grande.",
  ],
  [
    "long-sleeve-daily-tee",
    "Long Sleeve Daily Tee",
    "T-Shirt",
    "shirts",
    ["Black", "White"],
    APP,
    129,
    ["teeBlackRack", "teeWhite"],
    ["unisex", "basic", "cotton", "long-sleeve", "layering"],
    "Manga longa em algodão de gramatura média, com punho canelado que segura no lugar. Funciona como camiseta em meia-estação e como segunda pele por baixo de casaco no frio.",
  ],
  [
    "vintage-wash-tee",
    "Vintage Wash Tee",
    "T-Shirt",
    "shirts",
    ["Faded Black", "Dusty Blue"],
    APP,
    119,
    ["teeBlackText", "teeOutfit"],
    ["unisex", "vintage", "cotton", "everyday"],
    "Lavagem estonada feita peça a peça, então nenhuma sai idêntica à outra. O algodão perde rigidez no processo e ganha um caimento fluido que normalmente só aparece depois de um ano de uso.",
  ],
  [
    "relaxed-crop-tee",
    "Relaxed Crop Tee",
    "T-Shirt",
    "shirts",
    ["White", "Sage"],
    APP,
    99,
    ["teeWhite", "teeGreen"],
    ["women", "cropped", "cotton", "summer", "everyday"],
    "Comprimento cropped que para na cintura alta, com corpo folgado para não marcar. Algodão leve com leve elastano na gola, que evita o alargamento típico de camiseta cortada.",
  ],
  [
    "kids-capybara-tee",
    "Kids Capybara Tee",
    "T-Shirt",
    "kids",
    ["White", "Sage"],
    ["2", "4", "6", "8", "10"],
    79,
    ["teeWhiteGraphic", "teeGreen"],
    ["kids", "graphic", "cotton", "capybara", "everyday"],
    "Camiseta infantil com duas capivaras amigas estampadas na frente. Algodão macio sem etiqueta interna — costurada com etiqueta impressa, porque criança não perdoa raspagem no pescoço.",
  ],
  [
    "kids-everyday-tee",
    "Kids Everyday Tee",
    "T-Shirt",
    "kids",
    ["White", "Black"],
    ["2", "4", "6", "8", "10"],
    69,
    ["teeWhite", "teeBlackHanger"],
    ["kids", "basic", "cotton", "everyday"],
    "A camiseta de todo dia para criança: algodão resistente que aguenta lavagem frequente, com costura dupla na gola e nas cavas, onde a roupa infantil costuma ceder primeiro.",
  ],

  // ------------------------------------------------------------ moletons
  [
    "classic-pullover-hoodie",
    "Classic Pullover Hoodie",
    "Hoodie",
    "hoodies-sweatshirts",
    ["Grey", "Black", "Sand"],
    APP,
    249,
    ["hoodieGrey", "sweatWhite"],
    ["unisex", "basic", "cotton", "layering", "winter"],
    "Moletom fechado com capuz forrado e cordão em algodão encerado. Felpa interna escovada que segura o calor sem peso, e bolso canguru fundo o bastante para as duas mãos e o celular.",
  ],
  [
    "oversized-hoodie",
    "Oversized Hoodie",
    "Hoodie",
    "hoodies-sweatshirts",
    ["Black", "Sand"],
    APP,
    279,
    ["hoodieGrey", "hoodieDenim"],
    ["unisex", "oversized", "cotton", "streetwear", "winter"],
    "Modelagem propositalmente ampla: ombro caído e manga longa que sobra na mão. O capuz é duplo, então fica em pé mesmo abaixado — detalhe que muda completamente a silhueta.",
  ],
  [
    "zip-through-hoodie",
    "Zip-Through Hoodie",
    "Hoodie",
    "hoodies-sweatshirts",
    ["Grey", "Navy"],
    APP,
    269,
    ["hoodieGrey", "hoodieDenim"],
    ["unisex", "basic", "cotton", "layering", "winter"],
    "Moletom com zíper inteiro e puxador metálico. Mais versátil que o fechado: abre quando o dia esquenta e vira camada intermediária por baixo de jaqueta no frio de verdade.",
  ],
  [
    "crewneck-sweatshirt",
    "Crewneck Sweatshirt",
    "Sweatshirt",
    "hoodies-sweatshirts",
    ["White", "Grey", "Black"],
    APP,
    219,
    ["sweatWhite", "hoodieGrey"],
    ["unisex", "classic", "cotton", "layering", "winter"],
    "Moletom careca de gola canelada, sem capuz e sem bolso. Corte limpo que funciona por cima de camisa social tanto quanto por cima de camiseta — é a peça mais versátil do armário de inverno.",
  ],
  [
    "boxy-cropped-sweatshirt",
    "Boxy Cropped Sweatshirt",
    "Sweatshirt",
    "hoodies-sweatshirts",
    ["Sand", "Sage"],
    APP,
    229,
    ["sweatWhite", "knitPastel"],
    ["women", "cropped", "cotton", "streetwear", "winter"],
    "Moletom curto de corpo largo, com barra canelada que assenta acima da cintura. Pensado para usar com calça de cintura alta, deixando aparecer um vão proposital.",
  ],
  [
    "heavy-fleece-hoodie",
    "Heavy Fleece Hoodie",
    "Hoodie",
    "hoodies-sweatshirts",
    ["Black", "Grey"],
    APP,
    319,
    ["hoodieGrey", "sweatWhite"],
    ["unisex", "technical", "cotton", "winter", "outdoor"],
    "Felpa pesada de 420g com interior escovado duas vezes. É o moletom para frio de verdade — grosso o bastante para dispensar casaco em dia seco, mas ainda flexível no ombro.",
  ],
  [
    "kids-hoodie",
    "Kids Hoodie",
    "Hoodie",
    "kids",
    ["Grey", "Sage"],
    ["2", "4", "6", "8", "10"],
    149,
    ["hoodieGrey", "sweatWhite"],
    ["kids", "basic", "cotton", "layering", "winter"],
    "Moletom infantil com capuz sem cordão, por segurança. Punhos e barra canelados que seguram no lugar durante a brincadeira, e felpa macia que não coça.",
  ],

  // ------------------------------------------------------------ camisas
  [
    "chambray-work-shirt",
    "Chambray Work Shirt",
    "Shirt",
    "shirts",
    ["Blue", "White"],
    APP,
    199,
    ["shirtChambray", "rackColor"],
    ["unisex", "classic", "cotton", "everyday", "layering"],
    "Camisa de chambray, o primo leve do jeans: mesma aparência, metade do peso. Botões de madrepérola e bolso no peito. Abre por cima de camiseta como sobrecamisa ou fecha sozinha.",
  ],
  [
    "linen-blend-shirt",
    "Linen Blend Shirt",
    "Shirt",
    "shirts",
    ["White", "Sand"],
    APP,
    229,
    ["rackColor", "rackBlouse"],
    ["unisex", "minimalist", "linen", "summer", "everyday"],
    "Mistura de linho e algodão que respira como linho puro mas amassa bem menos. Caimento solto e manga que dobra no antebraço — a camisa de calor sem parecer desleixada.",
  ],
  [
    "oxford-button-down",
    "Oxford Button-Down",
    "Shirt",
    "shirts",
    ["White", "Blue"],
    APP,
    239,
    ["rackColor", "shirtChambray"],
    ["men", "classic", "cotton", "everyday", "layering"],
    "Oxford de algodão com colarinho abotoado, tecido encorpado que dá estrutura ao colarinho sem engomar. A camisa que vai de reunião a bar sem trocar de peça.",
  ],
  [
    "silk-touch-blouse",
    "Silk Touch Blouse",
    "Blouse",
    "shirts",
    ["Off White", "Dusty Blue"],
    APP,
    259,
    ["rackBlouse", "rackColor"],
    ["women", "minimalist", "everyday", "layering"],
    "Blusa de viscose com toque de seda e caimento fluido. Sem transparência sob luz direta — testada, porque é onde a maioria das blusas claras falha.",
  ],
  [
    "flannel-overshirt",
    "Flannel Overshirt",
    "Shirt",
    "jackets-outerwear",
    ["Sage", "Faded Black"],
    APP,
    269,
    ["shirtChambray", "rackColor"],
    ["unisex", "classic", "cotton", "layering", "winter"],
    "Sobrecamisa de flanela escovada, mais pesada que camisa e mais leve que jaqueta. Ocupa aquela faixa de temperatura em que casaco é demais e camiseta é pouco.",
  ],

  // ------------------------------------------------------------ jaquetas
  [
    "classic-bomber-jacket",
    "Classic Bomber Jacket",
    "Bomber Jacket",
    "jackets-outerwear",
    ["Brown", "Black"],
    APP,
    449,
    ["bomberBrown", "leatherBlack"],
    ["unisex", "classic", "layering", "everyday"],
    "Bomber de gola, punho e barra canelados, com forro leve e bolso interno com zíper. O corte para na cintura, então funciona bem sobre moletom sem criar volume embaixo.",
  ],
  [
    "faux-leather-biker",
    "Faux Leather Biker",
    "Leather Jacket",
    "jackets-outerwear",
    ["Black"],
    APP,
    599,
    ["leatherBlack", "bomberBrown"],
    ["unisex", "streetwear", "layering", "everyday"],
    "Jaqueta biker em couro sintético de superfície fosca, com zíper diagonal e lapela assimétrica. O forro é acetinado, o que faz vestir e tirar sem prender na manga da blusa.",
  ],
  [
    "denim-trucker-jacket",
    "Denim Trucker Jacket",
    "Denim Jacket",
    "jackets-outerwear",
    ["Blue", "Faded Black"],
    APP,
    389,
    ["hoodieDenim", "jeansFolded"],
    ["unisex", "classic", "denim", "layering", "everyday"],
    "Jaqueta jeans de corte trucker, com bolsos no peito e ajuste lateral por botão. Denim de 12oz sem elastano, que amolda ao corpo com o uso em vez de já vir amaciado.",
  ],
  [
    "hooded-rain-shell",
    "Hooded Rain Shell",
    "Rain Jacket",
    "jackets-outerwear",
    ["Navy", "Black"],
    APP,
    529,
    ["bomberBrown", "leatherBlack"],
    ["unisex", "technical", "waterproof", "outdoor", "layering"],
    "Corta-vento impermeável com costuras seladas e capuz ajustável. Leve o bastante para dobrar dentro da mochila, o que é a diferença entre levar sempre e nunca levar.",
  ],
  [
    "tailored-blazer",
    "Tailored Blazer",
    "Blazer",
    "jackets-outerwear",
    ["Black", "Navy"],
    APP,
    689,
    ["blazerBlack", "suitGreen"],
    ["unisex", "classic", "layering", "everyday"],
    "Blazer de dois botões com ombro leve e forro parcial. Estruturado o suficiente para ocasião formal, macio o suficiente para usar por cima de camiseta num sábado.",
  ],
  [
    "quilted-liner-jacket",
    "Quilted Liner Jacket",
    "Jacket",
    "jackets-outerwear",
    ["Sage", "Black"],
    APP,
    469,
    ["bomberBrown", "hoodieDenim"],
    ["unisex", "minimalist", "layering", "winter"],
    "Jaqueta matelassê fina, feita para ser a camada do meio. Cabe por baixo de casaco maior sem apertar e sai sozinha em dia ameno.",
  ],

  // ------------------------------------------------------------ calças
  [
    "straight-leg-jeans",
    "Straight Leg Jeans",
    "Jeans",
    "bottoms",
    ["Blue", "Faded Black"],
    DEN,
    329,
    ["jeansSkinny", "jeansFolded"],
    ["unisex", "classic", "denim", "everyday"],
    "Jeans de perna reta em denim rígido de 13oz, cintura média. Sem elastano: veste firme no primeiro dia e vai cedendo ao corpo em vez de ceder no joelho.",
  ],
  [
    "relaxed-mom-jeans",
    "Relaxed Mom Jeans",
    "Jeans",
    "bottoms",
    ["Blue"],
    DEN,
    349,
    ["jeansPatch", "jeansSkinny"],
    ["women", "vintage", "denim", "everyday"],
    "Cintura alta, quadril folgado e barra virada. A modelagem mom clássica, com denim de toque seco que sustenta a forma em vez de amassar atrás do joelho.",
  ],
  [
    "slim-stretch-jeans",
    "Slim Stretch Jeans",
    "Jeans",
    "bottoms",
    ["Blue", "Black"],
    DEN,
    299,
    ["jeansSkinny", "jeansFolded"],
    ["unisex", "basic", "denim", "everyday"],
    "Jeans slim com 2% de elastano, o mínimo para dar mobilidade sem virar legging. Bolso traseiro fundo, que é onde jeans slim costuma decepcionar.",
  ],
  [
    "cargo-jogger-pants",
    "Cargo Jogger Pants",
    "Joggers",
    "bottoms",
    ["Sage", "Black"],
    APP,
    289,
    ["pantsCargoOlive", "joggerPink"],
    ["unisex", "streetwear", "everyday", "carry"],
    "Jogger com bolsos cargo laterais de fole e punho elástico na barra. Tecido de sarja leve com toque seco — não é moletom, então serve fora de casa sem parecer pijama.",
  ],
  [
    "fleece-sweatpants",
    "Fleece Sweatpants",
    "Sweatpants",
    "bottoms",
    ["Grey", "Black"],
    APP,
    239,
    ["joggerPink", "trousersBlack"],
    ["unisex", "basic", "cotton", "winter", "everyday"],
    "Calça de moletom com felpa interna e cós com cordão duplo. Conjunto natural do Classic Pullover Hoodie, na mesma malha e no mesmo tom.",
  ],
  [
    "wide-leg-trousers",
    "Wide Leg Trousers",
    "Trousers",
    "bottoms",
    ["Sand", "Black"],
    APP,
    359,
    ["trousersBlack", "joggerPink"],
    ["women", "minimalist", "everyday", "layering"],
    "Alfaiataria de perna ampla e cintura alta, com pregas frontais que criam volume estruturado. Cai bem com tênis e com salto, que é o teste real desse modelo.",
  ],
  [
    "denim-mom-shorts",
    "Denim Mom Shorts",
    "Shorts",
    "bottoms",
    ["Blue"],
    DEN,
    199,
    ["shortsDenim", "shortsGrey"],
    ["women", "vintage", "denim", "summer"],
    "Short jeans de cintura alta com barra dobrada e leve destroyed. Comprimento pensado para não subir ao sentar — o defeito mais comum do short jeans.",
  ],
  [
    "everyday-chino-shorts",
    "Everyday Chino Shorts",
    "Shorts",
    "bottoms",
    ["Sand", "Navy"],
    DEN,
    189,
    ["shortsRed", "shortsGrey"],
    ["men", "basic", "cotton", "summer", "everyday"],
    "Bermuda de sarja com cós de elástico parcial nas costas. Comprimento no meio da coxa, que é o ponto em que a peça deixa de ser esportiva sem virar social.",
  ],
  [
    "kids-jogger-pants",
    "Kids Jogger Pants",
    "Joggers",
    "kids",
    ["Grey", "Sage"],
    ["2", "4", "6", "8", "10"],
    139,
    ["joggerPink", "pantsCargoOlive"],
    ["kids", "basic", "cotton", "everyday"],
    "Jogger infantil com joelho reforçado por dentro, onde a calça de criança fura primeiro. Cós de elástico com cordão falso — ajusta sem risco de desamarrar.",
  ],

  // ------------------------------------------------------------ vestidos
  [
    "satin-slip-dress",
    "Satin Slip Dress",
    "Dress",
    "dresses",
    ["Wine", "Black"],
    APP,
    449,
    ["dressPurple", "dressRed"],
    ["women", "minimalist", "everyday", "layering"],
    "Vestido slip de cetim com viés no decote e alça regulável. O corte enviesado faz o tecido deslizar sobre o corpo em vez de agarrar, que é o que separa um slip bom de um ruim.",
  ],
  [
    "flowing-maxi-dress",
    "Flowing Maxi Dress",
    "Dress",
    "dresses",
    ["Red", "Sand"],
    APP,
    529,
    ["dressRed", "dressPurple"],
    ["women", "classic", "summer", "everyday"],
    "Vestido longo de tecido leve com muito rodado. Ele se move — foi cortado com folga generosa na saia justamente para isso.",
  ],
  [
    "off-shoulder-midi",
    "Off-Shoulder Midi Dress",
    "Dress",
    "dresses",
    ["Wine"],
    APP,
    489,
    ["dressPurple", "dressRed"],
    ["women", "classic", "everyday"],
    "Midi ombro a ombro com malha canelada de bom peso, que segura a estrutura do decote sem barbatana. Comprimento na canela.",
  ],
  [
    "utility-romper",
    "Utility Romper",
    "Romper",
    "dresses",
    ["Olive", "Sand"],
    APP,
    349,
    ["romperOlive", "joggerPink"],
    ["women", "minimalist", "summer", "everyday"],
    "Macaquinho de tecido leve com cinto de amarração e bolsos funcionais. Peça única que resolve o look inteiro num dia quente.",
  ],
  [
    "knit-midi-dress",
    "Knit Midi Dress",
    "Dress",
    "dresses",
    ["Sand", "Sage"],
    APP,
    459,
    ["knitPastel", "ponchoCream"],
    ["women", "classic", "winter", "layering"],
    "Vestido de tricô canelado com manga longa. Aceita bota e meia-calça no frio e sandália em meia-estação, o que estica muito a temporada de uso.",
  ],

  // ------------------------------------------------------------ tricô
  [
    "chunky-knit-sweater",
    "Chunky Knit Sweater",
    "Sweater",
    "hoodies-sweatshirts",
    ["Cream", "Sage"],
    APP,
    399,
    ["knitPastel", "ponchoCream"],
    ["unisex", "classic", "winter", "layering"],
    "Tricô de ponto grosso em fio macio, com gola careca larga. O ponto aberto aprisiona ar, então aquece mais do que a espessura sugere.",
  ],
  [
    "fringe-knit-poncho",
    "Fringe Knit Poncho",
    "Poncho",
    "hoodies-sweatshirts",
    ["Cream"],
    ONE,
    429,
    ["ponchoCream", "knitPastel"],
    ["women", "classic", "winter", "layering"],
    "Poncho de tricô com franjas na barra e decote em V. Tamanho único que cai bem em corpos diferentes — vantagem real de peça sem manga estruturada.",
  ],
  [
    "fine-merino-crewneck",
    "Fine Merino Crewneck",
    "Sweater",
    "hoodies-sweatshirts",
    ["Navy", "Cream"],
    APP,
    489,
    ["knitPastel", "ponchoCream"],
    ["unisex", "minimalist", "winter", "layering"],
    "Suéter de merino fino, quente sem volume. Cabe por baixo de blazer sem estufar o ombro, que é onde tricô grosso estraga a silhueta.",
  ],
  [
    "cardigan-open-knit",
    "Open Knit Cardigan",
    "Cardigan",
    "hoodies-sweatshirts",
    ["Cream", "Sage"],
    APP,
    449,
    ["ponchoCream", "knitPastel"],
    ["women", "classic", "layering", "everyday"],
    "Cardigã aberto de tricô leve, sem botão. Funciona como terceira peça o ano inteiro — é o casaco de ar-condicionado.",
  ],

  // ------------------------------------------------------------ bolsas
  [
    "everyday-canvas-tote",
    "Everyday Canvas Tote",
    "Tote Bag",
    "accessories",
    ["Natural", "Black"],
    ONE,
    159,
    ["bagTan", "backpackGrey"],
    ["unisex", "minimalist", "cotton", "carry", "everyday"],
    "Tote de lona de algodão pesado com alça reforçada e bolso interno. Fundo estruturado, então fica em pé sozinha na mesa em vez de tombar.",
  ],
  [
    "laptop-commuter-backpack",
    "Laptop Commuter Backpack",
    "Backpack",
    "accessories",
    ["Grey", "Navy"],
    ONE,
    449,
    ["backpackGrey", "backpackNavy"],
    ["unisex", "minimalist", "carry", "travel", "everyday"],
    'Mochila com compartimento acolchoado para notebook de 15", costas ventiladas e bolso rápido no topo. Abertura em clamshell, que evita despejar tudo para achar o carregador.',
  ],
  [
    "rolltop-daypack",
    "Rolltop Daypack",
    "Backpack",
    "accessories",
    ["Navy", "Black"],
    ONE,
    389,
    ["backpackNavy", "backpackGrey"],
    ["unisex", "streetwear", "carry", "travel"],
    "Mochila rolltop de lona encerada, com volume ajustável conforme você enrola a boca. Fecho por fivela metálica, resistente a chuva leve.",
  ],
  [
    "structured-top-handle-bag",
    "Structured Top Handle Bag",
    "Handbag",
    "accessories",
    ["Tan", "Red"],
    ONE,
    569,
    ["bagTan", "bagRed"],
    ["women", "classic", "carry", "everyday"],
    "Bolsa estruturada de alça curta com fecho metálico e alça tiracolo removível. Mantém o formato mesmo vazia, que é o que diferencia bolsa estruturada de bolsa mole.",
  ],
  [
    "mini-crossbody-bag",
    "Mini Crossbody Bag",
    "Handbag",
    "accessories",
    ["Red", "Tan"],
    ONE,
    349,
    ["bagRed", "bagTan"],
    ["women", "minimalist", "carry", "everyday"],
    "Bolsa pequena de tiracolo, do tamanho de celular, cartão e chave. Alça regulável com fivela — ajusta de ombro para transversal sem ferramenta.",
  ],
  [
    "weekend-duffle",
    "Weekend Duffle",
    "Duffle Bag",
    "accessories",
    ["Navy", "Grey"],
    ONE,
    499,
    ["backpackNavy", "backpackGrey"],
    ["unisex", "classic", "carry", "travel"],
    "Mala de mão para dois dias, com bolso lateral para calçado e alça de ombro acolchoada. Cabe no compartimento superior do avião.",
  ],

  // ------------------------------------------------------------ chapéus
  [
    "classic-trucker-cap",
    "Classic Trucker Cap",
    "Cap",
    "accessories",
    ["White", "Black"],
    ONE,
    129,
    ["capWhite"],
    ["unisex", "basic", "everyday", "summer"],
    "Boné trucker de frente estruturada e traseira em tela, com ajuste de encaixe. A tela ventila de verdade, o que faz diferença em dia de sol.",
  ],
  [
    "washed-dad-cap",
    "Washed Dad Cap",
    "Cap",
    "accessories",
    ["Sand", "Navy"],
    ONE,
    119,
    ["capWhite"],
    ["unisex", "vintage", "cotton", "everyday"],
    "Boné de algodão lavado com aba curva e copa baixa, que assenta na cabeça em vez de flutuar. Fecho de fivela metálica.",
  ],
  [
    "ribbed-beanie",
    "Ribbed Beanie",
    "Beanie",
    "accessories",
    ["Black", "Cream"],
    ONE,
    109,
    ["capCharcoal"],
    ["unisex", "basic", "winter"],
    "Gorro canelado com barra dupla, que dá para usar dobrado ou esticado sobre a orelha. Fio macio sem lã, então não coça.",
  ],
  [
    "bucket-hat",
    "Bucket Hat",
    "Bucket Hat",
    "accessories",
    ["Sand", "Sage"],
    ONE,
    139,
    ["bucketTan"],
    ["unisex", "summer", "outdoor", "everyday"],
    "Chapéu bucket de sarja com aba média e ilhoses de ventilação. Amassa na mochila e volta ao formato.",
  ],

  // ------------------------------------------------------------ calçados
  [
    "canvas-low-sneakers",
    "Canvas Low Sneakers",
    "Sneakers",
    "shoes",
    ["White", "Black"],
    SHO,
    329,
    ["shoeWhite", "shoeGrey"],
    ["unisex", "basic", "canvas", "everyday"],
    "Tênis baixo de lona com solado de borracha vulcanizada. Leve, dobra no pé desde o primeiro dia e combina com praticamente tudo.",
  ],
  [
    "retro-runner-sneakers",
    "Retro Runner Sneakers",
    "Sneakers",
    "shoes",
    ["Grey", "Orange"],
    SHO,
    449,
    ["shoeGrey", "shoeOrange"],
    ["unisex", "vintage", "everyday", "outdoor"],
    "Tênis de corrida com estética anos 90: entressola alta, painéis em camurça e malha. Confortável para caminhada longa, sem pretensão de performance.",
  ],
  [
    "minimal-leather-sneakers",
    "Minimal Leather Sneakers",
    "Sneakers",
    "shoes",
    ["White", "Tan"],
    SHO,
    529,
    ["shoeWhite", "shoeTan"],
    ["unisex", "minimalist", "everyday", "classic"],
    "Tênis de couro liso sem logo aparente, solado fino. É o tênis que passa em ambiente com dress code sem parecer sapato.",
  ],
  [
    "pastel-court-sneakers",
    "Pastel Court Sneakers",
    "Sneakers",
    "shoes",
    ["Pastel"],
    SHO,
    479,
    ["shoePastel", "shoeWhite"],
    ["women", "everyday", "summer"],
    "Tênis estilo court em cartela pastel, com painéis em tons alternados. Cabedal macio que não precisa de amaciamento.",
  ],
  [
    "trail-sneakers",
    "Trail Sneakers",
    "Sneakers",
    "shoes",
    ["Red", "Grey"],
    SHO,
    559,
    ["shoeRed", "shoeGrey"],
    ["unisex", "technical", "outdoor"],
    "Tênis com solado de tração agressiva e cabedal em malha reforçada. Feito para trilha leve, mas usável na cidade em dia de chuva.",
  ],
  [
    "everyday-slides",
    "Everyday Slides",
    "Slides",
    "shoes",
    ["Black", "Sand"],
    SHO,
    159,
    ["shoeTan", "shoePastel"],
    ["unisex", "summer", "everyday"],
    "Chinelo slide com palmilha anatômica e tira única acolchoada. O calçado de sair rápido — praia, academia, padaria.",
  ],

  // ---------------------------------------------------------- segunda leva
  [
    "ringer-contrast-tee",
    "Ringer Contrast Tee",
    "T-Shirt",
    "shirts",
    ["White", "Sage"],
    APP,
    109,
    ["teeWhite", "teeGreen"],
    ["unisex", "vintage", "cotton", "everyday"],
    "Camiseta ringer com gola e punho em cor contrastante. Detalhe retrô que resolve o visual sem precisar de estampa.",
  ],
  [
    "striped-breton-tee",
    "Striped Breton Tee",
    "T-Shirt",
    "shirts",
    ["Navy", "Off White"],
    APP,
    139,
    ["teeWhite", "teeOutfit"],
    ["unisex", "classic", "cotton", "everyday", "layering"],
    "Listras bretãs em malha de algodão firme, com gola barco levemente aberta. Um clássico que atravessa temporada sem datar.",
  ],
  [
    "muscle-fit-tee",
    "Muscle Fit Tee",
    "T-Shirt",
    "shirts",
    ["Black", "White"],
    APP,
    99,
    ["teeBlackHanger", "teeWhite"],
    ["men", "basic", "cotton", "everyday"],
    "Camiseta de corte justo no tronco e cava mais alta. Feita para marcar ombro sem apertar a barriga.",
  ],
  [
    "tie-dye-tee",
    "Tie Dye Tee",
    "T-Shirt",
    "shirts",
    ["Pastel", "Sage"],
    APP,
    129,
    ["teeGreen", "teeWhiteGraphic"],
    ["unisex", "graphic", "cotton", "summer", "streetwear"],
    "Tingimento manual em espiral, feito peça a peça — cada camiseta sai com um padrão único. Algodão pré-encolhido.",
  ],
  [
    "kids-striped-tee",
    "Kids Striped Tee",
    "T-Shirt",
    "kids",
    ["Navy", "Sage"],
    ["2", "4", "6", "8", "10"],
    75,
    ["teeGreen", "teeWhite"],
    ["kids", "classic", "cotton", "everyday"],
    "Camiseta infantil listrada em algodão macio, com gola envelopada que passa fácil pela cabeça — detalhe que só quem veste criança valoriza.",
  ],
  [
    "half-zip-sweatshirt",
    "Half-Zip Sweatshirt",
    "Sweatshirt",
    "hoodies-sweatshirts",
    ["Navy", "Grey"],
    APP,
    259,
    ["sweatWhite", "hoodieGrey"],
    ["unisex", "classic", "cotton", "layering", "winter"],
    "Moletom meio-zíper com gola alta. Fecha para bloquear vento no pescoço e abre quando o ambiente aquece.",
  ],
  [
    "raglan-sweatshirt",
    "Raglan Sweatshirt",
    "Sweatshirt",
    "hoodies-sweatshirts",
    ["Grey", "Cream"],
    APP,
    239,
    ["hoodieGrey", "sweatWhite"],
    ["unisex", "vintage", "cotton", "layering", "winter"],
    "Manga raglan em tom contrastante, com costura diagonal do colarinho à axila — o corte dá mais liberdade de ombro que a manga montada.",
  ],
  [
    "sherpa-lined-hoodie",
    "Sherpa Lined Hoodie",
    "Hoodie",
    "hoodies-sweatshirts",
    ["Sand", "Black"],
    APP,
    389,
    ["hoodieGrey", "knitPastel"],
    ["unisex", "technical", "winter", "outdoor", "layering"],
    "Moletom forrado em sherpa, quente o bastante para dispensar casaco. O forro é só no corpo, não na manga, para não travar o movimento.",
  ],
  [
    "cropped-zip-hoodie",
    "Cropped Zip Hoodie",
    "Hoodie",
    "hoodies-sweatshirts",
    ["Pastel", "Black"],
    APP,
    269,
    ["sweatWhite", "knitPastel"],
    ["women", "cropped", "cotton", "streetwear", "winter"],
    "Moletom curto com zíper e punho canelado largo. Termina na cintura, então funciona com calça e saia de cintura alta.",
  ],
  [
    "kids-crewneck",
    "Kids Crewneck Sweatshirt",
    "Sweatshirt",
    "kids",
    ["Sage", "Grey"],
    ["2", "4", "6", "8", "10"],
    139,
    ["sweatWhite", "hoodieGrey"],
    ["kids", "basic", "cotton", "layering", "winter"],
    "Moletom careca infantil, sem capuz nem cordão. Felpa interna macia e costura plana, que não marca a pele.",
  ],
  [
    "cuban-collar-shirt",
    "Cuban Collar Shirt",
    "Shirt",
    "shirts",
    ["Sand", "Sage"],
    APP,
    219,
    ["rackColor", "rackBlouse"],
    ["men", "vintage", "linen", "summer", "everyday"],
    "Camisa de colarinho cubano, aberta e sem botão no topo. Modelagem reta pensada para usar por fora.",
  ],
  [
    "denim-western-shirt",
    "Denim Western Shirt",
    "Shirt",
    "shirts",
    ["Blue"],
    APP,
    249,
    ["shirtChambray", "hoodieDenim"],
    ["unisex", "vintage", "denim", "layering", "everyday"],
    "Camisa jeans com botão de pressão e recorte em V no peito. Denim leve, então serve de camisa e não só de sobrecamisa.",
  ],
  [
    "poplin-shirt-dress",
    "Poplin Shirt Dress",
    "Dress",
    "dresses",
    ["White", "Blue"],
    APP,
    389,
    ["rackBlouse", "shirtChambray"],
    ["women", "minimalist", "cotton", "everyday"],
    "Chemise de popeline com cinto de amarração na cintura. Ajusta a silhueta sem precisar de pence.",
  ],
  [
    "satin-camisole",
    "Satin Camisole",
    "Blouse",
    "shirts",
    ["Wine", "Off White"],
    APP,
    189,
    ["rackBlouse", "dressPurple"],
    ["women", "minimalist", "layering", "everyday"],
    "Regata de cetim com alça fina regulável e viés no decote. Usa sozinha no calor ou por baixo de blazer.",
  ],
  [
    "puffer-jacket",
    "Puffer Jacket",
    "Jacket",
    "jackets-outerwear",
    ["Black", "Sage"],
    APP,
    649,
    ["bomberBrown", "leatherBlack"],
    ["unisex", "technical", "winter", "outdoor", "layering"],
    "Jaqueta puffer de canais horizontais com enchimento sintético. Comprime na mochila e volta ao volume.",
  ],
  [
    "wool-overcoat",
    "Wool Overcoat",
    "Coat",
    "jackets-outerwear",
    ["Navy", "Black"],
    APP,
    899,
    ["suitNavy", "blazerBlack"],
    ["unisex", "classic", "winter", "layering"],
    "Sobretudo de lã batida com comprimento no joelho e forro inteiro. A peça de frio que combina com social e com jeans.",
  ],
  [
    "coach-jacket",
    "Coach Jacket",
    "Jacket",
    "jackets-outerwear",
    ["Black", "Navy"],
    APP,
    359,
    ["bomberBrown", "hoodieDenim"],
    ["unisex", "streetwear", "layering", "everyday"],
    "Coach jacket de nylon com botão de pressão e forro de flanela. Corta vento, leve, e cabe por cima de moletom.",
  ],
  [
    "denim-jacket-sherpa",
    "Sherpa Denim Jacket",
    "Denim Jacket",
    "jackets-outerwear",
    ["Blue"],
    APP,
    489,
    ["denimJacketDark", "hoodieDenim"],
    ["unisex", "vintage", "denim", "winter", "layering"],
    "Jaqueta jeans com gola e forro em sherpa. Denim rígido por fora, felpa por dentro — o contraste é o ponto da peça.",
  ],
  [
    "baggy-carpenter-jeans",
    "Baggy Carpenter Jeans",
    "Jeans",
    "bottoms",
    ["Blue", "Faded Black"],
    DEN,
    359,
    ["jeansPatch", "jeansFolded"],
    ["unisex", "streetwear", "denim", "everyday"],
    "Jeans carpinteiro de perna larga, com passador de martelo na lateral e bolso utilitário. Cai reto do quadril ao tornozelo.",
  ],
  [
    "bootcut-jeans",
    "Bootcut Jeans",
    "Jeans",
    "bottoms",
    ["Blue"],
    DEN,
    339,
    ["jeansSkinny", "jeansPatch"],
    ["women", "vintage", "denim", "everyday"],
    "Jeans de boca levemente aberta a partir do joelho, cintura média. Alonga a perna e acomoda bota por baixo.",
  ],
  [
    "cargo-pants",
    "Cargo Pants",
    "Trousers",
    "bottoms",
    ["Sage", "Sand"],
    APP,
    319,
    ["pantsCargoOlive", "trousersBlack"],
    ["unisex", "streetwear", "everyday", "carry"],
    "Calça cargo de sarja com seis bolsos e barra ajustável por cordão. Bolsos de fole que comportam volume sem deformar a perna.",
  ],
  [
    "pleated-chino",
    "Pleated Chino",
    "Trousers",
    "bottoms",
    ["Sand", "Navy"],
    APP,
    299,
    ["trousersBlack", "pantsCargoOlive"],
    ["men", "classic", "cotton", "everyday", "layering"],
    "Chino de duas pregas e caimento solto na coxa, afinando na barra. Mais confortável que chino slim, mais arrumada que jogger.",
  ],
  [
    "knit-lounge-shorts",
    "Knit Lounge Shorts",
    "Shorts",
    "bottoms",
    ["Grey", "Sage"],
    APP,
    169,
    ["shortsGrey", "shortsDenim"],
    ["unisex", "basic", "cotton", "summer", "everyday"],
    "Short de moletom leve com cós de elástico e bolso lateral. O par natural do Crewneck Sweatshirt no calor.",
  ],
  [
    "a-line-denim-skirt",
    "A-Line Denim Skirt",
    "Skirt",
    "bottoms",
    ["Blue"],
    DEN,
    229,
    ["skirtTulle", "shortsDenim"],
    ["women", "vintage", "denim", "summer", "everyday"],
    "Saia jeans evasê com botões frontais e barra desfiada. Comprimento acima do joelho.",
  ],
  [
    "pleated-midi-skirt",
    "Pleated Midi Skirt",
    "Skirt",
    "bottoms",
    ["Sand", "Wine"],
    APP,
    289,
    ["skirtTulle", "rackBlouse"],
    ["women", "classic", "everyday", "layering"],
    "Saia midi plissada em tecido leve, com movimento a cada passo. Cós elástico coberto, sem zíper.",
  ],
  [
    "wrap-midi-dress",
    "Wrap Midi Dress",
    "Dress",
    "dresses",
    ["Wine", "Sage"],
    APP,
    469,
    ["dressPurple", "dressRed"],
    ["women", "classic", "everyday"],
    "Vestido midi transpassado com amarração lateral. Ajusta em vários corpos porque o transpasse define a cintura.",
  ],
  [
    "sundress-cotton",
    "Cotton Sundress",
    "Dress",
    "dresses",
    ["Sand", "White"],
    APP,
    359,
    ["dressRed", "romperOlive"],
    ["women", "minimalist", "cotton", "summer"],
    "Vestido de algodão leve com alça larga e corte solto. Não gruda no corpo em dia quente — a única exigência real de um vestido de verão.",
  ],
  [
    "knit-tank-dress",
    "Knit Tank Dress",
    "Dress",
    "dresses",
    ["Black", "Cream"],
    APP,
    399,
    ["knitPastel", "ponchoCream"],
    ["women", "minimalist", "layering", "everyday"],
    "Vestido regata de malha canelada, justo ao corpo. Feito para camada: usa sozinho no calor e com tricô por cima no frio.",
  ],
  [
    "turtleneck-sweater",
    "Turtleneck Sweater",
    "Sweater",
    "hoodies-sweatshirts",
    ["Black", "Cream"],
    APP,
    429,
    ["knitPastel", "ponchoCream"],
    ["unisex", "classic", "winter", "layering"],
    "Suéter de gola alta em malha fina, que dobra duas vezes no pescoço. Cabe por baixo de blazer e sobretudo.",
  ],
  [
    "v-neck-knit-vest",
    "V-Neck Knit Vest",
    "Sweater",
    "hoodies-sweatshirts",
    ["Sand", "Navy"],
    APP,
    309,
    ["knitPastel", "ponchoCream"],
    ["unisex", "classic", "layering", "everyday"],
    "Colete de tricô com decote V, para usar sobre camisa. Aquece o tronco deixando o braço livre.",
  ],
  [
    "mohair-cardigan",
    "Mohair Cardigan",
    "Cardigan",
    "hoodies-sweatshirts",
    ["Cream", "Pastel"],
    APP,
    529,
    ["ponchoCream", "knitPastel"],
    ["women", "classic", "winter", "layering"],
    "Cardigã de mohair com pelo longo e botões de madrepérola. Leve para o volume que tem.",
  ],
  [
    "leather-belt-bag",
    "Leather Belt Bag",
    "Belt Bag",
    "accessories",
    ["Tan", "Black"],
    ONE,
    289,
    ["bagTan", "bagRed"],
    ["unisex", "minimalist", "carry", "everyday"],
    "Pochete de couro com alça regulável, para usar na cintura ou cruzada no peito. Um compartimento principal e um bolso plano atrás.",
  ],
  [
    "woven-market-tote",
    "Woven Market Tote",
    "Tote Bag",
    "accessories",
    ["Natural"],
    ONE,
    229,
    ["bagTan", "bagFloral"],
    ["unisex", "summer", "carry", "everyday"],
    "Bolsa de palha trançada com alça de couro. Estrutura firme que aguenta feira e praia.",
  ],
  [
    "nylon-shoulder-bag",
    "Nylon Shoulder Bag",
    "Handbag",
    "accessories",
    ["Black", "Navy"],
    ONE,
    259,
    ["bagRed", "bagFloral"],
    ["unisex", "minimalist", "carry", "everyday"],
    "Bolsa de ombro em nylon leve com zíper superior. Resistente a chuva e limpa com pano úmido.",
  ],
  [
    "canvas-messenger",
    "Canvas Messenger",
    "Messenger Bag",
    "accessories",
    ["Grey", "Natural"],
    ONE,
    339,
    ["backpackGrey", "backpackNavy"],
    ["unisex", "classic", "cotton", "carry", "everyday"],
    'Carteiro de lona com aba e fivelas, compartimento para notebook de 13". Alça larga que não corta o ombro.',
  ],
  [
    "wide-brim-hat",
    "Wide Brim Hat",
    "Hat",
    "accessories",
    ["Sand", "Black"],
    ONE,
    199,
    ["bucketTan"],
    ["women", "classic", "summer", "outdoor"],
    "Chapéu de aba larga com fita interna ajustável. Sombra de verdade no rosto e no pescoço.",
  ],
  [
    "knit-headband",
    "Knit Headband",
    "Headband",
    "accessories",
    ["Cream", "Black"],
    ONE,
    89,
    ["knitPastel"],
    ["women", "basic", "winter", "outdoor"],
    "Faixa de tricô canelado que cobre a orelha sem achatar o cabelo — a alternativa ao gorro.",
  ],
  [
    "five-panel-cap",
    "Five Panel Cap",
    "Cap",
    "accessories",
    ["Sage", "Black"],
    ONE,
    139,
    ["capWhite"],
    ["unisex", "streetwear", "everyday", "outdoor"],
    "Boné de cinco gomos com aba plana e copa baixa. Silhueta mais discreta que o snapback tradicional.",
  ],
  [
    "chunky-sole-sneakers",
    "Chunky Sole Sneakers",
    "Sneakers",
    "shoes",
    ["White", "Pastel"],
    SHO,
    589,
    ["shoePastel", "shoeWhite"],
    ["women", "streetwear", "everyday"],
    "Tênis de solado alto e volumoso, com camadas em tons diferentes. Ganha altura sem salto.",
  ],
  [
    "suede-desert-boots",
    "Suede Desert Boots",
    "Boots",
    "shoes",
    ["Tan", "Sand"],
    SHO,
    649,
    ["shoeTan", "shoeGrey"],
    ["men", "classic", "outdoor", "everyday"],
    "Bota deserto em camurça, dois pares de ilhoses e solado de crepe. O calçado de meia-estação que serve com jeans e com chino.",
  ],
  [
    "canvas-high-tops",
    "Canvas High Tops",
    "Sneakers",
    "shoes",
    ["Black", "White"],
    SHO,
    349,
    ["shoeWhite", "shoeGrey"],
    ["unisex", "basic", "canvas", "everyday", "streetwear"],
    "Tênis cano alto de lona com reforço na biqueira. Sustenta o tornozelo e é o mais durável da linha de lona.",
  ],
];

// ---------------------------------------------------------------------------
// Geração
// ---------------------------------------------------------------------------
const q = (s: string | null) => (s === null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
const PG = (i: number) => `gid://catalog/Product/${9000 + i}`;
const VG = (i: number, j: number) => `gid://catalog/Variant/${900000 + i * 100 + j}`;

/**
 * Tamanhos esgotados, por handle. Cada entrada é um ponto de entrada para o
 * agente da vitrine — só dispara para quem tentou comprar e não pôde.
 *
 * Espalhados por tipo de propósito: se todos fossem moletom, o agente só teria
 * um cenário para demonstrar. Aqui há camiseta, moletom, jaqueta, calça,
 * vestido, tricô, calçado e acessório.
 */
const TAMANHOS_ESGOTADOS: Record<string, string[]> = {
  "essential-cotton-tee": ["M"],
  "heavyweight-boxy-tee": ["L", "XL"],
  "capybara-club-tee": ["S"],
  "striped-breton-tee": ["M"],
  "classic-pullover-hoodie": ["M", "L"],
  "oversized-hoodie": ["XL"],
  "crewneck-sweatshirt": ["S"],
  "sherpa-lined-hoodie": ["M"],
  "classic-bomber-jacket": ["L"],
  "denim-trucker-jacket": ["M"],
  "straight-leg-jeans": ["40"],
  "relaxed-mom-jeans": ["38", "40"],
  "cargo-jogger-pants": ["L"],
  "satin-slip-dress": ["S"],
  "flowing-maxi-dress": ["M"],
  "chunky-knit-sweater": ["L"],
  "canvas-low-sneakers": ["40"],
  "minimal-leather-sneakers": ["39", "41"],
  "kids-capybara-tee": ["6"],
};

/**
 * Produtos esgotados por inteiro — nenhuma variante disponível.
 *
 * Diferente do tamanho esgotado: aqui o agente não tem "outro tamanho do mesmo
 * item" para oferecer, então precisa recomendar outra peça. É o caso que
 * exercita de verdade a recomendação cruzada.
 */
const PRODUTOS_ESGOTADOS = new Set([
  "structured-top-handle-bag",
  "washed-dad-cap",
  "knit-lounge-shorts",
  "v-neck-knit-vest",
]);

const linhas: Record<string, string[]> = {
  products: [],
  product_images: [],
  product_props: [],
  variants: [],
  variant_options: [],
};
let nVar = 0,
  nEsg = 0,
  nEsgTotal = 0;

/**
 * Escolhe entre as fotos declaradas a MENOS usada até agora.
 *
 * Há 49 fotos verificadas para 103 produtos, então alguma repetição é
 * inevitável. Sem isto ela se concentrava: sete produtos exibiam a mesma foto
 * do boné branco enquanto outras fotos ficavam sem uso. Espalhar não elimina a
 * repetição, mas troca "sete iguais lado a lado" por "duas aqui, duas ali".
 */
const usoFoto = new Map<string, number>();

/**
 * Fotos intercambiáveis: mesmo assunto, cor diferente.
 *
 * Serve para espalhar sem trocar o assunto. Uma alternativa de `capWhite` tem
 * que ser outro boné — pegar qualquer foto pouco usada da mesma coleção
 * colocaria a foto de um boné numa bolsa, já que `accessories` mistura os dois.
 *
 * Como a cor sai da foto (ver COR), escolher a alternativa também troca a cor
 * do produto. É o comportamento desejado: a peça passa a existir na cor que a
 * foto mostra.
 */
const ALTERNATIVAS: Partial<Record<keyof typeof IMG, (keyof typeof IMG)[]>> = {
  // Camisetas
  teeWhite: ["teeWhiteHeart", "teeWhiteGraphic", "teeWhiteFlat"],
  teeWhiteGraphic: ["teeCreamGraphic", "teeWhiteHeart", "teeWhiteFlat"],
  teeBlackHanger: ["teeBlackModel", "teeBlackWoman", "teeBlackRack"],
  teeBlackRack: ["teeBlackWoman", "teeBlackModel", "teeBlackHanger"],
  teeBlackGraphic: ["teeBlackModel", "teeBlackText", "teeBlackWoman"],
  teeGreen: ["teeCreamGraphic"],
  // Moletons e tricô — só entre si.
  hoodieGrey: ["sweatWhite"],
  sweatWhite: ["hoodieGrey"],
  knitPastel: ["ponchoCream"],
  ponchoCream: ["knitPastel"],
  // Jaquetas: bomber com bomber, jeans com jeans, alfaiataria com alfaiataria.
  bomberBrown: ["jacketOlive"],
  jacketOlive: ["bomberBrown"],
  hoodieDenim: ["denimJacketDark"],
  blazerBlack: ["suitNavy", "suitGreen"],
  // Calças longas: NUNCA cair em short nem em jeans, que são peças diferentes.
  joggerPink: ["pantsCargoOlive", "trousersBlack"],
  pantsCargoOlive: ["joggerPink", "trousersBlack"],
  trousersBlack: ["joggerPink", "pantsCargoOlive"],
  // Jeans entre jeans.
  jeansFolded: ["jeansDark", "jeansPatch"],
  jeansSkinny: ["jeansRipped", "jeansPatch"],
  jeansPatch: ["jeansRipped", "jeansSkinny"],
  // Shorts entre shorts.
  shortsDenim: ["shortsGrey", "shortsRed"],
  shortsGrey: ["shortsDenim", "shortsRed"],
  // Camisas e blusas.
  rackColor: ["shirtWhiteRack", "rackBlouse"],
  rackBlouse: ["shirtWhiteRack", "rackColor"],
  shirtChambray: ["shirtWhiteRack"],
  // Bonés entre bonés — bucket é outra peça.
  capWhite: ["capCharcoal"],
  capCharcoal: ["capWhite"],
  // Bolsas de mão entre si; mochila com mochila.
  bagTan: ["bagFloral", "bagRed"],
  bagRed: ["bagFloral", "bagTan"],
  backpackGrey: ["backpackNavy"],
  backpackNavy: ["backpackGrey"],
  // Tênis entre tênis.
  shoeWhite: ["sneakerMulti", "shoeGrey"],
  shoeGrey: ["sneakerMulti", "shoeWhite"],
  shoeTan: ["shoeOrange"],
  shoePastel: ["sneakerMulti"],
};

const escolherFoto = (imgs: (keyof typeof IMG)[]): keyof typeof IMG => {
  const candidatas = [...new Set(imgs.flatMap((k) => [k, ...(ALTERNATIVAS[k] ?? [])]))];
  let melhor = candidatas[0];
  for (const k of candidatas) {
    if ((usoFoto.get(k) ?? 0) < (usoFoto.get(melhor) ?? 0)) melhor = k;
  }
  usoFoto.set(melhor, (usoFoto.get(melhor) ?? 0) + 1);
  return melhor;
};

P.forEach(([handle, title, tipo, colecao, _cores, tamanhos, preco, imgs, tags, desc], i) => {
  const pg = PG(i);
  const label = COLECOES[colecao];

  // UMA foto e UMA cor, e a cor vem da foto (ver COR). O título carrega a cor
  // porque é onde ela fica visível na vitrine e na busca; a tag carrega para o
  // agente.
  const foto = escolherFoto(imgs);
  const cor = COR[foto];
  const tituloFinal = `${title} - ${cor}`;

  linhas.products.push(
    `(${q(pg)}, ${q(handle)}, ${q(tituloFinal)}, ${q(desc)}, ${q(`<p>${desc}</p>`)}, 'Deco Store', ${q(tipo)}, '2026-08-05T00:00:00Z', 'BRL', ${100 + i})`,
  );

  linhas.product_images.push(`(${q(pg)}, ${q(url(foto))}, ${q(tituloFinal)}, 0)`);

  linhas.product_props.push(`(${q(pg)}, 'COLLECTION', ${q(label)}, ${q(colecao)}, 0)`);
  tags.forEach((t, j) => linhas.product_props.push(`(${q(pg)}, 'TAG', ${q(t)}, NULL, ${j})`));
  linhas.product_props.push(`(${q(pg)}, 'TAG', ${q(cor.toLowerCase())}, NULL, 100)`);

  const produtoEsgotado = PRODUTOS_ESGOTADOS.has(handle);
  if (produtoEsgotado) nEsgTotal++;
  const tamanhosFora = new Set(TAMANHOS_ESGOTADOS[handle] ?? []);

  // Sem opção de Color: com uma cor só, o seletor renderizaria uma linha de um
  // item, que não é escolha nenhuma.
  let j = 0;
  for (const tam of tamanhos ?? [null]) {
    const vid = VG(i, j);
    const esgotado = produtoEsgotado || (tam !== null && tamanhosFora.has(tam));
    if (esgotado) nEsg++;
    linhas.variants.push(
      `(${q(vid)}, ${q(pg)}, ${q(tam ?? cor)}, NULL, ${preco}, ${i % 7 === 3 ? Math.round(preco * 1.3) : "NULL"}, ${esgotado ? 0 : 1}, ${esgotado ? 0 : 12}, ${q(url(foto, 600))}, ${q(tituloFinal)}, ${j})`,
    );
    if (tam) linhas.variant_options.push(`(${q(vid)}, 'Size', ${q(tam)}, 0)`);
    j++;
    nVar++;
  }
});

const COLS: Record<string, string> = {
  products:
    "product_group_id, handle, title, description, description_html, vendor, product_type, created_at, currency_code, position",
  product_images: "product_group_id, url, alt, position",
  product_props: "product_group_id, name, value, value_reference, position",
  variants:
    "variant_id, product_group_id, title, barcode, price, compare_at_price, available, quantity, image_url, image_alt, position",
  variant_options: "variant_id, name, value, position",
};

let sql = `-- Migration 0011 — catálogo ampliado: ${P.length} produtos de vestuário e acessórios.
--
-- Gerado para dar ao agente da vitrine massa e variedade suficientes. O
-- catálogo tinha 32 produtos com categorias de 1 e 2 itens — \`bottoms\` tinha
-- um único produto, e nenhum agente monta "combina com" convincente assim.
--
-- FOTOS: todas de images.unsplash.com, e todas verificadas duas vezes — que a
-- URL responde 200 e que a imagem MOSTRA a peça descrita (inspecionadas uma a
-- uma). Fotos com marca de terceiro visível ou com estampa inadequada foram
-- descartadas.
--
-- Elas NÃO passam pelo otimizador do framework: o CDN da deco só serve
-- arquivos do próprio armazenamento e devolve 403 para URL externa
-- (verificado). \`src/components/ui/Image.tsx\` desvia esses hosts direto para
-- o \`<img>\`, com o resize feito pela query string do próprio Unsplash. O CSP
-- em \`src/server.ts\` libera o host.
--
-- ESGOTADOS: ${nEsg} variantes entram indisponíveis de propósito, espalhadas por
-- tipos diferentes (moletom, camiseta, jeans, tênis, bolsa, vestido). Cada uma
-- é um ponto de entrada para o agente — antes existiam só dois.
--
-- Cores e tamanhos viram \`variant_options\`, e as cores também viram TAG, para
-- que a similaridade enxergue paleta sem precisar ler variante.
--
-- NÃO EDITE ESTE ARQUIVO À MÃO. Ele é gerado por
-- \`scripts/generate-apparel-catalog.ts\`, onde cada produto é uma linha
-- legível. Mudanças feitas aqui somem na próxima geração.
--
--   npm run catalog:apparel -- --apply
--
-- O DELETE abaixo torna o arquivo reaplicável: rodar de novo substitui em vez
-- de duplicar. Ele é restrito ao prefixo \`gid://catalog/\`, então os produtos
-- importados do Shopify (\`gid://shopify/\`) não são tocados. As tabelas filhas
-- caem por ON DELETE CASCADE.

DELETE FROM products WHERE product_group_id LIKE 'gid://catalog/Product/%';

`;

for (const [tabela, vals] of Object.entries(linhas)) {
  const conflito =
    tabela === "products" ? "(product_group_id)" : tabela === "variants" ? "(variant_id)" : null;
  // Em blocos: um INSERT com milhares de tuplas fica ilegível e difícil de diffar.
  for (let k = 0; k < vals.length; k += 60) {
    sql += `INSERT INTO ${tabela} (${COLS[tabela]}) VALUES\n${vals.slice(k, k + 60).join(",\n")}`;
    sql += conflito ? `\nON CONFLICT ${conflito} DO NOTHING;\n\n` : ";\n\n";
  }
}

const ARQUIVO = "db/migrations/0011_expand_apparel_catalog.sql";
writeFileSync(ARQUIVO, sql);

const comEsgotado = new Set([...Object.keys(TAMANHOS_ESGOTADOS), ...PRODUTOS_ESGOTADOS]);

console.log(`gerado ${ARQUIVO}`);
console.log(
  `  ${P.length} produtos, ${nVar} variantes, ${linhas.product_images.length} imagens, ` +
    `${linhas.product_props.length} props`,
);
console.log(
  `  ${comEsgotado.size} itens com esgotado (${nEsgTotal} inteiros, ${nEsg} variantes no total)`,
);
const maisUsada = [...usoFoto.entries()].sort((a, b) => b[1] - a[1])[0];
console.log(`  ${usoFoto.size} fotos distintas; a mais repetida aparece ${maisUsada[1]}x`);
const tipos = new Set(P.map((p) => p[2]));
console.log(`  ${tipos.size} product_types, ${new Set(P.map((p) => p[3])).size} coleções`);

// Handles duplicados quebrariam o índice UNIQUE só na hora de aplicar, com uma
// mensagem que não diz qual produto duplicou. Melhor falhar aqui, nomeando.
const dup = P.map((p) => p[0]).filter((h, i, a) => a.indexOf(h) !== i);
if (dup.length) {
  console.error(`\nhandles duplicados: ${[...new Set(dup)].join(", ")}`);
  process.exit(1);
}

if (process.argv.includes("--apply")) {
  // Direto pelo driver, sem subprocesso: chamar `npx` exigiria `shell: true` no
  // Windows, o que o Node avisa ser risco de injeção de argumento.
  //
  // Numa transação só — se um INSERT falhar no meio, o DELETE do começo não
  // fica aplicado sozinho, o que deixaria o catálogo vazio.
  const sqlClient = postgres(resolveDatabaseUrl(), { prepare: false, max: 1, onnotice: () => {} });
  try {
    console.log("\naplicando no banco do .env ...");
    await sqlClient.begin((tx) => tx.unsafe(sql));
    const [{ count }] = await sqlClient<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM products WHERE product_group_id LIKE 'gid://catalog/%'
    `;
    console.log(`aplicado — ${count} produtos gerados no banco.`);
  } finally {
    await sqlClient.end();
  }
}
