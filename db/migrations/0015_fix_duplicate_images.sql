-- Migration 0015 — acaba com as fotos repetidas, e corrige as cores que elas revelaram.
--
-- 33 fotos eram usadas por mais de um produto, cobrindo 80 dos 136. O pior
-- grupo tinha SEIS produtos na mesma imagem: Boxy Cropped Sweatshirt, Chunky
-- Knit Sweater, Fine Merino Crewneck, Cropped Zip Hoodie, Turtleneck Sweater e
-- Knit Headband — todos "Pastel", todos com a mesma foto.
--
-- Não era descuido: `escolherFoto` em scripts/generate-apparel-catalog.ts
-- distribui a menos usada entre ~62 fotos para 104 produtos. Com esse saldo a
-- repetição é aritmética, não bug. A correção real é ter mais fotos — 47 novas,
-- uma por produto que repetia, e agora são 104 fotos para 104 produtos.
--
-- Por que importa além do estético: `findComplementsAvailable` monta a vitrine
-- de "combina com" cruzando produtos de TIPOS diferentes que compartilham tag
-- ou coleção. Um Knit Headband e um Turtleneck Sweater satisfazem isso e caíam
-- lado a lado na mesma prateleira com a foto idêntica — com o agente escrevendo
-- motivos distintos para o que a tela mostrava igual.
--
-- AS CORES: nove produtos mudam de cor, e isso é consequência, não escopo
-- extra. Neste catálogo a cor é DERIVADA da foto (ver COR no gerador) — foto
-- nova, cor nova. As nove foram conferidas a olho numa folha de contato:
--
--   Half-Zip Sweatshirt   White      -> Yellow
--   Chunky Knit Sweater   Pastel     -> Magenta
--   Cropped Zip Hoodie    Pastel     -> Orange
--   Knit Headband         Pastel     -> Blue
--   Cuban Collar Shirt    Multicolor -> Pastel
--   Cargo Pants           Olive      -> Dark Green
--   Leather Belt Bag      Tan        -> Black
--   Canvas Messenger      Grey       -> Brown
--   Woven Market Tote     Floral     -> Off White
--
-- Trocar a cor move cinco campos, não um: título do produto, `alt` da imagem,
-- `image_alt` e título da variante, e a tag de cor em product_props. Atualizar
-- só o título deixaria a busca por "tan" achando uma bolsa preta.
--
-- O handle NÃO muda — ele nunca carregou a cor (`leather-belt-bag`, não
-- `leather-belt-bag-tan`). Nenhuma URL quebra, e os handles guardados em
-- `shelves` e `looks` seguem válidos.
--
-- AS FOTOS: todas de images.unsplash.com, id distinto entre si e sem colisão
-- com as que já estavam em uso, todas verificadas por requisição HTTP (200).
-- Três candidatas caíram no caminho por serem Unsplash+, servidas por
-- plus.unsplash.com e portanto 404 na URL que o catálogo monta.
--
-- POR QUE ESTA MIGRATION EXISTE SE A 0011 JÁ FOI CORRIGIDA:
-- a 0011 é saída de `npm run catalog:apparel`, e foi regerada para que o
-- gerador e o arquivo não divirjam. Mas ela já está aplicada em produção, e
-- `scripts/migrate.ts` controla por nome — não roda de novo. Então:
--
--   banco existente -> 0011 é pulada, esta aqui aplica a correção
--   banco do zero   -> 0011 já traz tudo certo, esta vira no-op
--
-- Os dois caminhos chegam ao mesmo estado. Este arquivo é GERADO da diferença
-- entre a 0011 regerada e a anterior, e não escrito à mão — é o que garante
-- que os dois não discordem.
--
-- Idempotente: atribui valor fixo por chave, reaplica sem efeito.

UPDATE products AS p
   SET title = novo.title
  FROM (VALUES
  ('gid://catalog/Product/9042', 'Chunky Knit Sweater - Magenta'),
  ('gid://catalog/Product/9067', 'Half-Zip Sweatshirt - Yellow'),
  ('gid://catalog/Product/9070', 'Cropped Zip Hoodie - Orange'),
  ('gid://catalog/Product/9072', 'Cuban Collar Shirt - Pastel'),
  ('gid://catalog/Product/9082', 'Cargo Pants - Dark Green'),
  ('gid://catalog/Product/9093', 'Leather Belt Bag - Black'),
  ('gid://catalog/Product/9094', 'Woven Market Tote - Off White'),
  ('gid://catalog/Product/9096', 'Canvas Messenger - Brown'),
  ('gid://catalog/Product/9098', 'Knit Headband - Blue')
  ) AS novo(product_group_id, title)
 WHERE p.product_group_id = novo.product_group_id;

UPDATE product_images AS pi
   SET url = novo.url, alt = novo.alt
  FROM (VALUES
  ('gid://catalog/Product/9013', 'https://images.unsplash.com/photo-1578681994827-a9776963799c?w=900&q=80&auto=format&fit=crop', 'Crewneck Sweatshirt - White'),
  ('gid://catalog/Product/9015', 'https://images.unsplash.com/photo-1564557287817-3785e38ec1f5?w=900&q=80&auto=format&fit=crop', 'Heavy Fleece Hoodie - Grey'),
  ('gid://catalog/Product/9016', 'https://images.unsplash.com/photo-1611817757591-c3f345024273?w=900&q=80&auto=format&fit=crop', 'Kids Hoodie - Grey'),
  ('gid://catalog/Product/9021', 'https://images.unsplash.com/photo-1589310243389-96a5483213a8?w=900&q=80&auto=format&fit=crop', 'Flannel Overshirt - Blue'),
  ('gid://catalog/Product/9027', 'https://images.unsplash.com/photo-1630300236870-c9480cfa7856?w=900&q=80&auto=format&fit=crop', 'Quilted Liner Jacket - Brown'),
  ('gid://catalog/Product/9036', 'https://images.unsplash.com/photo-1779675787172-fcac54b36bab?w=900&q=80&auto=format&fit=crop', 'Kids Jogger Pants - Pink'),
  ('gid://catalog/Product/9039', 'https://images.unsplash.com/photo-1568252542512-9fe8fe9c87bb?w=900&q=80&auto=format&fit=crop', 'Off-Shoulder Midi Dress - Wine'),
  ('gid://catalog/Product/9042', 'https://images.unsplash.com/photo-1771170223514-0c7030d41308?w=900&q=80&auto=format&fit=crop', 'Chunky Knit Sweater - Magenta'),
  ('gid://catalog/Product/9043', 'https://images.unsplash.com/photo-1761552349582-89197f465089?w=900&q=80&auto=format&fit=crop', 'Fringe Knit Poncho - Cream'),
  ('gid://catalog/Product/9044', 'https://images.unsplash.com/photo-1622925492162-98c3760a7080?w=900&q=80&auto=format&fit=crop', 'Fine Merino Crewneck - Pastel'),
  ('gid://catalog/Product/9045', 'https://images.unsplash.com/photo-1616522431599-568dfc895b6b?w=900&q=80&auto=format&fit=crop', 'Open Knit Cardigan - Cream'),
  ('gid://catalog/Product/9051', 'https://images.unsplash.com/photo-1525103504173-8dc1582c7430?w=900&q=80&auto=format&fit=crop', 'Weekend Duffle - Navy'),
  ('gid://catalog/Product/9054', 'https://images.unsplash.com/photo-1618354691792-d1d42acfd860?w=900&q=80&auto=format&fit=crop', 'Ribbed Beanie - Charcoal'),
  ('gid://catalog/Product/9062', 'https://images.unsplash.com/photo-1622445275463-afa2ab738c34?w=900&q=80&auto=format&fit=crop', 'Ringer Contrast Tee - White'),
  ('gid://catalog/Product/9065', 'https://images.unsplash.com/photo-1759572095329-1dcf9522762b?w=900&q=80&auto=format&fit=crop', 'Tie Dye Tee - Sage'),
  ('gid://catalog/Product/9066', 'https://images.unsplash.com/photo-1618677603544-51162346e165?w=900&q=80&auto=format&fit=crop', 'Kids Striped Tee - Cream'),
  ('gid://catalog/Product/9067', 'https://images.unsplash.com/photo-1621198059871-0d5f9b449233?w=900&q=80&auto=format&fit=crop', 'Half-Zip Sweatshirt - Yellow'),
  ('gid://catalog/Product/9068', 'https://images.unsplash.com/photo-1778787826955-f846a9776c6f?w=900&q=80&auto=format&fit=crop', 'Raglan Sweatshirt - Grey'),
  ('gid://catalog/Product/9069', 'https://images.unsplash.com/photo-1615397587950-3cbb55f95b77?w=900&q=80&auto=format&fit=crop', 'Sherpa Lined Hoodie - White'),
  ('gid://catalog/Product/9070', 'https://images.unsplash.com/photo-1578768079052-aa76e52ff62e?w=900&q=80&auto=format&fit=crop', 'Cropped Zip Hoodie - Orange'),
  ('gid://catalog/Product/9071', 'https://images.unsplash.com/photo-1630254688956-40da9f30216a?w=900&q=80&auto=format&fit=crop', 'Kids Crewneck Sweatshirt - White'),
  ('gid://catalog/Product/9072', 'https://images.unsplash.com/photo-1678872844677-d650b788709b?w=900&q=80&auto=format&fit=crop', 'Cuban Collar Shirt - Pastel'),
  ('gid://catalog/Product/9073', 'https://images.unsplash.com/photo-1574180566232-aaad1b5b8450?w=900&q=80&auto=format&fit=crop', 'Denim Western Shirt - White'),
  ('gid://catalog/Product/9074', 'https://images.unsplash.com/photo-1768632066820-a88f086fffba?w=900&q=80&auto=format&fit=crop', 'Poplin Shirt Dress - Off White'),
  ('gid://catalog/Product/9075', 'https://images.unsplash.com/photo-1614245756970-791579ec966b?w=900&q=80&auto=format&fit=crop', 'Satin Camisole - Off White'),
  ('gid://catalog/Product/9076', 'https://images.unsplash.com/photo-1548883354-a3fb8460973f?w=900&q=80&auto=format&fit=crop', 'Puffer Jacket - Olive'),
  ('gid://catalog/Product/9078', 'https://images.unsplash.com/photo-1768983953826-231e8ef0b6dc?w=900&q=80&auto=format&fit=crop', 'Coach Jacket - Blue'),
  ('gid://catalog/Product/9079', 'https://images.unsplash.com/photo-1611912901957-80caca8de69a?w=900&q=80&auto=format&fit=crop', 'Sherpa Denim Jacket - Dark Indigo'),
  ('gid://catalog/Product/9081', 'https://images.unsplash.com/photo-1784639072018-dd85c44f992e?w=900&q=80&auto=format&fit=crop', 'Bootcut Jeans - Light Blue'),
  ('gid://catalog/Product/9082', 'https://images.unsplash.com/photo-1687825515654-23620796760c?w=900&q=80&auto=format&fit=crop', 'Cargo Pants - Dark Green'),
  ('gid://catalog/Product/9083', 'https://images.unsplash.com/photo-1780291366347-f0191b9405f2?w=900&q=80&auto=format&fit=crop', 'Pleated Chino - Black'),
  ('gid://catalog/Product/9086', 'https://images.unsplash.com/photo-1754639544919-ea4d1cff7dce?w=900&q=80&auto=format&fit=crop', 'Pleated Midi Skirt - Ivory'),
  ('gid://catalog/Product/9087', 'https://images.unsplash.com/photo-1622460432096-f6b772409e1f?w=900&q=80&auto=format&fit=crop', 'Wrap Midi Dress - Red'),
  ('gid://catalog/Product/9088', 'https://images.unsplash.com/photo-1784460470008-49f363e19275?w=900&q=80&auto=format&fit=crop', 'Cotton Sundress - Olive'),
  ('gid://catalog/Product/9089', 'https://images.unsplash.com/photo-1529636273736-fc88b31ea9d9?w=900&q=80&auto=format&fit=crop', 'Knit Tank Dress - Cream'),
  ('gid://catalog/Product/9090', 'https://images.unsplash.com/photo-1776162241177-8ed7caa11a37?w=900&q=80&auto=format&fit=crop', 'Turtleneck Sweater - Pastel'),
  ('gid://catalog/Product/9091', 'https://images.unsplash.com/photo-1773747310674-b42a55d72003?w=900&q=80&auto=format&fit=crop', 'V-Neck Knit Vest - Cream'),
  ('gid://catalog/Product/9092', 'https://images.unsplash.com/photo-1606598646035-05f923f42982?w=900&q=80&auto=format&fit=crop', 'Mohair Cardigan - Cream'),
  ('gid://catalog/Product/9093', 'https://images.unsplash.com/photo-1602532360508-595f449c7c55?w=900&q=80&auto=format&fit=crop', 'Leather Belt Bag - Black'),
  ('gid://catalog/Product/9094', 'https://images.unsplash.com/photo-1758815915419-d427160da2e6?w=900&q=80&auto=format&fit=crop', 'Woven Market Tote - Off White'),
  ('gid://catalog/Product/9095', 'https://images.unsplash.com/photo-1751522925876-79bfeae6fbfb?w=900&q=80&auto=format&fit=crop', 'Nylon Shoulder Bag - Red'),
  ('gid://catalog/Product/9096', 'https://images.unsplash.com/photo-1485894944436-a890c1048494?w=900&q=80&auto=format&fit=crop', 'Canvas Messenger - Brown'),
  ('gid://catalog/Product/9097', 'https://images.unsplash.com/photo-1694436986130-c4c949d3f431?w=900&q=80&auto=format&fit=crop', 'Wide Brim Hat - Tan'),
  ('gid://catalog/Product/9098', 'https://images.unsplash.com/photo-1614455002811-b2fb45781815?w=900&q=80&auto=format&fit=crop', 'Knit Headband - Blue'),
  ('gid://catalog/Product/9099', 'https://images.unsplash.com/photo-1556793521-ec4b34e6545e?w=900&q=80&auto=format&fit=crop', 'Five Panel Cap - White'),
  ('gid://catalog/Product/9100', 'https://images.unsplash.com/photo-1581977012607-4091712d36f9?w=900&q=80&auto=format&fit=crop', 'Chunky Sole Sneakers - Pastel'),
  ('gid://catalog/Product/9102', 'https://images.unsplash.com/photo-1695073621086-aa692bc32a3d?w=900&q=80&auto=format&fit=crop', 'Canvas High Tops - White')
  ) AS novo(product_group_id, url, alt)
 WHERE pi.product_group_id = novo.product_group_id;

-- As variantes guardam a própria cópia da URL, em 600 de largura (a galeria usa
-- 900). Atualizar só `product_images` deixaria a PDP certa e o card da PLP
-- errado — que é a metade mais visível, porque a prateleira é onde a repetição
-- aparecia lado a lado.
UPDATE variants AS v
   SET title = novo.title, image_url = novo.image_url, image_alt = novo.image_alt
  FROM (VALUES
  ('gid://catalog/Variant/901300', 'XS', 'https://images.unsplash.com/photo-1578681994827-a9776963799c?w=600&q=80&auto=format&fit=crop', 'Crewneck Sweatshirt - White'),
  ('gid://catalog/Variant/901301', 'S', 'https://images.unsplash.com/photo-1578681994827-a9776963799c?w=600&q=80&auto=format&fit=crop', 'Crewneck Sweatshirt - White'),
  ('gid://catalog/Variant/901302', 'M', 'https://images.unsplash.com/photo-1578681994827-a9776963799c?w=600&q=80&auto=format&fit=crop', 'Crewneck Sweatshirt - White'),
  ('gid://catalog/Variant/901303', 'L', 'https://images.unsplash.com/photo-1578681994827-a9776963799c?w=600&q=80&auto=format&fit=crop', 'Crewneck Sweatshirt - White'),
  ('gid://catalog/Variant/901304', 'XL', 'https://images.unsplash.com/photo-1578681994827-a9776963799c?w=600&q=80&auto=format&fit=crop', 'Crewneck Sweatshirt - White'),
  ('gid://catalog/Variant/901500', 'XS', 'https://images.unsplash.com/photo-1564557287817-3785e38ec1f5?w=600&q=80&auto=format&fit=crop', 'Heavy Fleece Hoodie - Grey'),
  ('gid://catalog/Variant/901501', 'S', 'https://images.unsplash.com/photo-1564557287817-3785e38ec1f5?w=600&q=80&auto=format&fit=crop', 'Heavy Fleece Hoodie - Grey'),
  ('gid://catalog/Variant/901502', 'M', 'https://images.unsplash.com/photo-1564557287817-3785e38ec1f5?w=600&q=80&auto=format&fit=crop', 'Heavy Fleece Hoodie - Grey'),
  ('gid://catalog/Variant/901503', 'L', 'https://images.unsplash.com/photo-1564557287817-3785e38ec1f5?w=600&q=80&auto=format&fit=crop', 'Heavy Fleece Hoodie - Grey'),
  ('gid://catalog/Variant/901504', 'XL', 'https://images.unsplash.com/photo-1564557287817-3785e38ec1f5?w=600&q=80&auto=format&fit=crop', 'Heavy Fleece Hoodie - Grey'),
  ('gid://catalog/Variant/901600', '2', 'https://images.unsplash.com/photo-1611817757591-c3f345024273?w=600&q=80&auto=format&fit=crop', 'Kids Hoodie - Grey'),
  ('gid://catalog/Variant/901601', '4', 'https://images.unsplash.com/photo-1611817757591-c3f345024273?w=600&q=80&auto=format&fit=crop', 'Kids Hoodie - Grey'),
  ('gid://catalog/Variant/901602', '6', 'https://images.unsplash.com/photo-1611817757591-c3f345024273?w=600&q=80&auto=format&fit=crop', 'Kids Hoodie - Grey'),
  ('gid://catalog/Variant/901603', '8', 'https://images.unsplash.com/photo-1611817757591-c3f345024273?w=600&q=80&auto=format&fit=crop', 'Kids Hoodie - Grey'),
  ('gid://catalog/Variant/901604', '10', 'https://images.unsplash.com/photo-1611817757591-c3f345024273?w=600&q=80&auto=format&fit=crop', 'Kids Hoodie - Grey'),
  ('gid://catalog/Variant/902100', 'XS', 'https://images.unsplash.com/photo-1589310243389-96a5483213a8?w=600&q=80&auto=format&fit=crop', 'Flannel Overshirt - Blue'),
  ('gid://catalog/Variant/902101', 'S', 'https://images.unsplash.com/photo-1589310243389-96a5483213a8?w=600&q=80&auto=format&fit=crop', 'Flannel Overshirt - Blue'),
  ('gid://catalog/Variant/902102', 'M', 'https://images.unsplash.com/photo-1589310243389-96a5483213a8?w=600&q=80&auto=format&fit=crop', 'Flannel Overshirt - Blue'),
  ('gid://catalog/Variant/902103', 'L', 'https://images.unsplash.com/photo-1589310243389-96a5483213a8?w=600&q=80&auto=format&fit=crop', 'Flannel Overshirt - Blue'),
  ('gid://catalog/Variant/902104', 'XL', 'https://images.unsplash.com/photo-1589310243389-96a5483213a8?w=600&q=80&auto=format&fit=crop', 'Flannel Overshirt - Blue'),
  ('gid://catalog/Variant/902700', 'XS', 'https://images.unsplash.com/photo-1630300236870-c9480cfa7856?w=600&q=80&auto=format&fit=crop', 'Quilted Liner Jacket - Brown'),
  ('gid://catalog/Variant/902701', 'S', 'https://images.unsplash.com/photo-1630300236870-c9480cfa7856?w=600&q=80&auto=format&fit=crop', 'Quilted Liner Jacket - Brown'),
  ('gid://catalog/Variant/902702', 'M', 'https://images.unsplash.com/photo-1630300236870-c9480cfa7856?w=600&q=80&auto=format&fit=crop', 'Quilted Liner Jacket - Brown'),
  ('gid://catalog/Variant/902703', 'L', 'https://images.unsplash.com/photo-1630300236870-c9480cfa7856?w=600&q=80&auto=format&fit=crop', 'Quilted Liner Jacket - Brown'),
  ('gid://catalog/Variant/902704', 'XL', 'https://images.unsplash.com/photo-1630300236870-c9480cfa7856?w=600&q=80&auto=format&fit=crop', 'Quilted Liner Jacket - Brown'),
  ('gid://catalog/Variant/903601', '4', 'https://images.unsplash.com/photo-1779675787172-fcac54b36bab?w=600&q=80&auto=format&fit=crop', 'Kids Jogger Pants - Pink'),
  ('gid://catalog/Variant/903602', '6', 'https://images.unsplash.com/photo-1779675787172-fcac54b36bab?w=600&q=80&auto=format&fit=crop', 'Kids Jogger Pants - Pink'),
  ('gid://catalog/Variant/903603', '8', 'https://images.unsplash.com/photo-1779675787172-fcac54b36bab?w=600&q=80&auto=format&fit=crop', 'Kids Jogger Pants - Pink'),
  ('gid://catalog/Variant/903604', '10', 'https://images.unsplash.com/photo-1779675787172-fcac54b36bab?w=600&q=80&auto=format&fit=crop', 'Kids Jogger Pants - Pink'),
  ('gid://catalog/Variant/903900', 'XS', 'https://images.unsplash.com/photo-1568252542512-9fe8fe9c87bb?w=600&q=80&auto=format&fit=crop', 'Off-Shoulder Midi Dress - Wine'),
  ('gid://catalog/Variant/903901', 'S', 'https://images.unsplash.com/photo-1568252542512-9fe8fe9c87bb?w=600&q=80&auto=format&fit=crop', 'Off-Shoulder Midi Dress - Wine'),
  ('gid://catalog/Variant/903902', 'M', 'https://images.unsplash.com/photo-1568252542512-9fe8fe9c87bb?w=600&q=80&auto=format&fit=crop', 'Off-Shoulder Midi Dress - Wine'),
  ('gid://catalog/Variant/903903', 'L', 'https://images.unsplash.com/photo-1568252542512-9fe8fe9c87bb?w=600&q=80&auto=format&fit=crop', 'Off-Shoulder Midi Dress - Wine'),
  ('gid://catalog/Variant/903904', 'XL', 'https://images.unsplash.com/photo-1568252542512-9fe8fe9c87bb?w=600&q=80&auto=format&fit=crop', 'Off-Shoulder Midi Dress - Wine'),
  ('gid://catalog/Variant/904200', 'XS', 'https://images.unsplash.com/photo-1771170223514-0c7030d41308?w=600&q=80&auto=format&fit=crop', 'Chunky Knit Sweater - Magenta'),
  ('gid://catalog/Variant/904201', 'S', 'https://images.unsplash.com/photo-1771170223514-0c7030d41308?w=600&q=80&auto=format&fit=crop', 'Chunky Knit Sweater - Magenta'),
  ('gid://catalog/Variant/904202', 'M', 'https://images.unsplash.com/photo-1771170223514-0c7030d41308?w=600&q=80&auto=format&fit=crop', 'Chunky Knit Sweater - Magenta'),
  ('gid://catalog/Variant/904203', 'L', 'https://images.unsplash.com/photo-1771170223514-0c7030d41308?w=600&q=80&auto=format&fit=crop', 'Chunky Knit Sweater - Magenta'),
  ('gid://catalog/Variant/904204', 'XL', 'https://images.unsplash.com/photo-1771170223514-0c7030d41308?w=600&q=80&auto=format&fit=crop', 'Chunky Knit Sweater - Magenta'),
  ('gid://catalog/Variant/904300', 'Cream', 'https://images.unsplash.com/photo-1761552349582-89197f465089?w=600&q=80&auto=format&fit=crop', 'Fringe Knit Poncho - Cream'),
  ('gid://catalog/Variant/904400', 'XS', 'https://images.unsplash.com/photo-1622925492162-98c3760a7080?w=600&q=80&auto=format&fit=crop', 'Fine Merino Crewneck - Pastel'),
  ('gid://catalog/Variant/904401', 'S', 'https://images.unsplash.com/photo-1622925492162-98c3760a7080?w=600&q=80&auto=format&fit=crop', 'Fine Merino Crewneck - Pastel'),
  ('gid://catalog/Variant/904402', 'M', 'https://images.unsplash.com/photo-1622925492162-98c3760a7080?w=600&q=80&auto=format&fit=crop', 'Fine Merino Crewneck - Pastel'),
  ('gid://catalog/Variant/904403', 'L', 'https://images.unsplash.com/photo-1622925492162-98c3760a7080?w=600&q=80&auto=format&fit=crop', 'Fine Merino Crewneck - Pastel'),
  ('gid://catalog/Variant/904404', 'XL', 'https://images.unsplash.com/photo-1622925492162-98c3760a7080?w=600&q=80&auto=format&fit=crop', 'Fine Merino Crewneck - Pastel'),
  ('gid://catalog/Variant/904500', 'XS', 'https://images.unsplash.com/photo-1616522431599-568dfc895b6b?w=600&q=80&auto=format&fit=crop', 'Open Knit Cardigan - Cream'),
  ('gid://catalog/Variant/904501', 'S', 'https://images.unsplash.com/photo-1616522431599-568dfc895b6b?w=600&q=80&auto=format&fit=crop', 'Open Knit Cardigan - Cream'),
  ('gid://catalog/Variant/904502', 'M', 'https://images.unsplash.com/photo-1616522431599-568dfc895b6b?w=600&q=80&auto=format&fit=crop', 'Open Knit Cardigan - Cream'),
  ('gid://catalog/Variant/904503', 'L', 'https://images.unsplash.com/photo-1616522431599-568dfc895b6b?w=600&q=80&auto=format&fit=crop', 'Open Knit Cardigan - Cream'),
  ('gid://catalog/Variant/904504', 'XL', 'https://images.unsplash.com/photo-1616522431599-568dfc895b6b?w=600&q=80&auto=format&fit=crop', 'Open Knit Cardigan - Cream'),
  ('gid://catalog/Variant/905100', 'Navy', 'https://images.unsplash.com/photo-1525103504173-8dc1582c7430?w=600&q=80&auto=format&fit=crop', 'Weekend Duffle - Navy'),
  ('gid://catalog/Variant/905400', 'Charcoal', 'https://images.unsplash.com/photo-1618354691792-d1d42acfd860?w=600&q=80&auto=format&fit=crop', 'Ribbed Beanie - Charcoal'),
  ('gid://catalog/Variant/906200', 'XS', 'https://images.unsplash.com/photo-1622445275463-afa2ab738c34?w=600&q=80&auto=format&fit=crop', 'Ringer Contrast Tee - White'),
  ('gid://catalog/Variant/906201', 'S', 'https://images.unsplash.com/photo-1622445275463-afa2ab738c34?w=600&q=80&auto=format&fit=crop', 'Ringer Contrast Tee - White'),
  ('gid://catalog/Variant/906202', 'M', 'https://images.unsplash.com/photo-1622445275463-afa2ab738c34?w=600&q=80&auto=format&fit=crop', 'Ringer Contrast Tee - White'),
  ('gid://catalog/Variant/906203', 'L', 'https://images.unsplash.com/photo-1622445275463-afa2ab738c34?w=600&q=80&auto=format&fit=crop', 'Ringer Contrast Tee - White'),
  ('gid://catalog/Variant/906204', 'XL', 'https://images.unsplash.com/photo-1622445275463-afa2ab738c34?w=600&q=80&auto=format&fit=crop', 'Ringer Contrast Tee - White'),
  ('gid://catalog/Variant/906500', 'XS', 'https://images.unsplash.com/photo-1759572095329-1dcf9522762b?w=600&q=80&auto=format&fit=crop', 'Tie Dye Tee - Sage'),
  ('gid://catalog/Variant/906501', 'S', 'https://images.unsplash.com/photo-1759572095329-1dcf9522762b?w=600&q=80&auto=format&fit=crop', 'Tie Dye Tee - Sage'),
  ('gid://catalog/Variant/906502', 'M', 'https://images.unsplash.com/photo-1759572095329-1dcf9522762b?w=600&q=80&auto=format&fit=crop', 'Tie Dye Tee - Sage'),
  ('gid://catalog/Variant/906503', 'L', 'https://images.unsplash.com/photo-1759572095329-1dcf9522762b?w=600&q=80&auto=format&fit=crop', 'Tie Dye Tee - Sage'),
  ('gid://catalog/Variant/906504', 'XL', 'https://images.unsplash.com/photo-1759572095329-1dcf9522762b?w=600&q=80&auto=format&fit=crop', 'Tie Dye Tee - Sage'),
  ('gid://catalog/Variant/906600', '2', 'https://images.unsplash.com/photo-1618677603544-51162346e165?w=600&q=80&auto=format&fit=crop', 'Kids Striped Tee - Cream'),
  ('gid://catalog/Variant/906601', '4', 'https://images.unsplash.com/photo-1618677603544-51162346e165?w=600&q=80&auto=format&fit=crop', 'Kids Striped Tee - Cream'),
  ('gid://catalog/Variant/906602', '6', 'https://images.unsplash.com/photo-1618677603544-51162346e165?w=600&q=80&auto=format&fit=crop', 'Kids Striped Tee - Cream'),
  ('gid://catalog/Variant/906603', '8', 'https://images.unsplash.com/photo-1618677603544-51162346e165?w=600&q=80&auto=format&fit=crop', 'Kids Striped Tee - Cream'),
  ('gid://catalog/Variant/906604', '10', 'https://images.unsplash.com/photo-1618677603544-51162346e165?w=600&q=80&auto=format&fit=crop', 'Kids Striped Tee - Cream'),
  ('gid://catalog/Variant/906700', 'XS', 'https://images.unsplash.com/photo-1621198059871-0d5f9b449233?w=600&q=80&auto=format&fit=crop', 'Half-Zip Sweatshirt - Yellow'),
  ('gid://catalog/Variant/906701', 'S', 'https://images.unsplash.com/photo-1621198059871-0d5f9b449233?w=600&q=80&auto=format&fit=crop', 'Half-Zip Sweatshirt - Yellow'),
  ('gid://catalog/Variant/906704', 'XL', 'https://images.unsplash.com/photo-1621198059871-0d5f9b449233?w=600&q=80&auto=format&fit=crop', 'Half-Zip Sweatshirt - Yellow'),
  ('gid://catalog/Variant/906800', 'XS', 'https://images.unsplash.com/photo-1778787826955-f846a9776c6f?w=600&q=80&auto=format&fit=crop', 'Raglan Sweatshirt - Grey'),
  ('gid://catalog/Variant/906801', 'S', 'https://images.unsplash.com/photo-1778787826955-f846a9776c6f?w=600&q=80&auto=format&fit=crop', 'Raglan Sweatshirt - Grey'),
  ('gid://catalog/Variant/906802', 'M', 'https://images.unsplash.com/photo-1778787826955-f846a9776c6f?w=600&q=80&auto=format&fit=crop', 'Raglan Sweatshirt - Grey'),
  ('gid://catalog/Variant/906803', 'L', 'https://images.unsplash.com/photo-1778787826955-f846a9776c6f?w=600&q=80&auto=format&fit=crop', 'Raglan Sweatshirt - Grey'),
  ('gid://catalog/Variant/906804', 'XL', 'https://images.unsplash.com/photo-1778787826955-f846a9776c6f?w=600&q=80&auto=format&fit=crop', 'Raglan Sweatshirt - Grey'),
  ('gid://catalog/Variant/906900', 'XS', 'https://images.unsplash.com/photo-1615397587950-3cbb55f95b77?w=600&q=80&auto=format&fit=crop', 'Sherpa Lined Hoodie - White'),
  ('gid://catalog/Variant/906901', 'S', 'https://images.unsplash.com/photo-1615397587950-3cbb55f95b77?w=600&q=80&auto=format&fit=crop', 'Sherpa Lined Hoodie - White'),
  ('gid://catalog/Variant/906902', 'M', 'https://images.unsplash.com/photo-1615397587950-3cbb55f95b77?w=600&q=80&auto=format&fit=crop', 'Sherpa Lined Hoodie - White'),
  ('gid://catalog/Variant/906903', 'L', 'https://images.unsplash.com/photo-1615397587950-3cbb55f95b77?w=600&q=80&auto=format&fit=crop', 'Sherpa Lined Hoodie - White'),
  ('gid://catalog/Variant/906904', 'XL', 'https://images.unsplash.com/photo-1615397587950-3cbb55f95b77?w=600&q=80&auto=format&fit=crop', 'Sherpa Lined Hoodie - White'),
  ('gid://catalog/Variant/907000', 'XS', 'https://images.unsplash.com/photo-1578768079052-aa76e52ff62e?w=600&q=80&auto=format&fit=crop', 'Cropped Zip Hoodie - Orange'),
  ('gid://catalog/Variant/907001', 'S', 'https://images.unsplash.com/photo-1578768079052-aa76e52ff62e?w=600&q=80&auto=format&fit=crop', 'Cropped Zip Hoodie - Orange'),
  ('gid://catalog/Variant/907002', 'M', 'https://images.unsplash.com/photo-1578768079052-aa76e52ff62e?w=600&q=80&auto=format&fit=crop', 'Cropped Zip Hoodie - Orange'),
  ('gid://catalog/Variant/907003', 'L', 'https://images.unsplash.com/photo-1578768079052-aa76e52ff62e?w=600&q=80&auto=format&fit=crop', 'Cropped Zip Hoodie - Orange'),
  ('gid://catalog/Variant/907004', 'XL', 'https://images.unsplash.com/photo-1578768079052-aa76e52ff62e?w=600&q=80&auto=format&fit=crop', 'Cropped Zip Hoodie - Orange'),
  ('gid://catalog/Variant/907100', '2', 'https://images.unsplash.com/photo-1630254688956-40da9f30216a?w=600&q=80&auto=format&fit=crop', 'Kids Crewneck Sweatshirt - White'),
  ('gid://catalog/Variant/907101', '4', 'https://images.unsplash.com/photo-1630254688956-40da9f30216a?w=600&q=80&auto=format&fit=crop', 'Kids Crewneck Sweatshirt - White'),
  ('gid://catalog/Variant/907102', '6', 'https://images.unsplash.com/photo-1630254688956-40da9f30216a?w=600&q=80&auto=format&fit=crop', 'Kids Crewneck Sweatshirt - White'),
  ('gid://catalog/Variant/907103', '8', 'https://images.unsplash.com/photo-1630254688956-40da9f30216a?w=600&q=80&auto=format&fit=crop', 'Kids Crewneck Sweatshirt - White'),
  ('gid://catalog/Variant/907104', '10', 'https://images.unsplash.com/photo-1630254688956-40da9f30216a?w=600&q=80&auto=format&fit=crop', 'Kids Crewneck Sweatshirt - White'),
  ('gid://catalog/Variant/907200', 'XS', 'https://images.unsplash.com/photo-1678872844677-d650b788709b?w=600&q=80&auto=format&fit=crop', 'Cuban Collar Shirt - Pastel'),
  ('gid://catalog/Variant/907201', 'S', 'https://images.unsplash.com/photo-1678872844677-d650b788709b?w=600&q=80&auto=format&fit=crop', 'Cuban Collar Shirt - Pastel'),
  ('gid://catalog/Variant/907202', 'M', 'https://images.unsplash.com/photo-1678872844677-d650b788709b?w=600&q=80&auto=format&fit=crop', 'Cuban Collar Shirt - Pastel'),
  ('gid://catalog/Variant/907203', 'L', 'https://images.unsplash.com/photo-1678872844677-d650b788709b?w=600&q=80&auto=format&fit=crop', 'Cuban Collar Shirt - Pastel'),
  ('gid://catalog/Variant/907204', 'XL', 'https://images.unsplash.com/photo-1678872844677-d650b788709b?w=600&q=80&auto=format&fit=crop', 'Cuban Collar Shirt - Pastel'),
  ('gid://catalog/Variant/907300', 'XS', 'https://images.unsplash.com/photo-1574180566232-aaad1b5b8450?w=600&q=80&auto=format&fit=crop', 'Denim Western Shirt - White'),
  ('gid://catalog/Variant/907301', 'S', 'https://images.unsplash.com/photo-1574180566232-aaad1b5b8450?w=600&q=80&auto=format&fit=crop', 'Denim Western Shirt - White'),
  ('gid://catalog/Variant/907302', 'M', 'https://images.unsplash.com/photo-1574180566232-aaad1b5b8450?w=600&q=80&auto=format&fit=crop', 'Denim Western Shirt - White'),
  ('gid://catalog/Variant/907303', 'L', 'https://images.unsplash.com/photo-1574180566232-aaad1b5b8450?w=600&q=80&auto=format&fit=crop', 'Denim Western Shirt - White'),
  ('gid://catalog/Variant/907304', 'XL', 'https://images.unsplash.com/photo-1574180566232-aaad1b5b8450?w=600&q=80&auto=format&fit=crop', 'Denim Western Shirt - White'),
  ('gid://catalog/Variant/907400', 'XS', 'https://images.unsplash.com/photo-1768632066820-a88f086fffba?w=600&q=80&auto=format&fit=crop', 'Poplin Shirt Dress - Off White'),
  ('gid://catalog/Variant/907401', 'S', 'https://images.unsplash.com/photo-1768632066820-a88f086fffba?w=600&q=80&auto=format&fit=crop', 'Poplin Shirt Dress - Off White'),
  ('gid://catalog/Variant/907402', 'M', 'https://images.unsplash.com/photo-1768632066820-a88f086fffba?w=600&q=80&auto=format&fit=crop', 'Poplin Shirt Dress - Off White'),
  ('gid://catalog/Variant/907403', 'L', 'https://images.unsplash.com/photo-1768632066820-a88f086fffba?w=600&q=80&auto=format&fit=crop', 'Poplin Shirt Dress - Off White'),
  ('gid://catalog/Variant/907404', 'XL', 'https://images.unsplash.com/photo-1768632066820-a88f086fffba?w=600&q=80&auto=format&fit=crop', 'Poplin Shirt Dress - Off White'),
  ('gid://catalog/Variant/907500', 'XS', 'https://images.unsplash.com/photo-1614245756970-791579ec966b?w=600&q=80&auto=format&fit=crop', 'Satin Camisole - Off White'),
  ('gid://catalog/Variant/907501', 'S', 'https://images.unsplash.com/photo-1614245756970-791579ec966b?w=600&q=80&auto=format&fit=crop', 'Satin Camisole - Off White'),
  ('gid://catalog/Variant/907502', 'M', 'https://images.unsplash.com/photo-1614245756970-791579ec966b?w=600&q=80&auto=format&fit=crop', 'Satin Camisole - Off White'),
  ('gid://catalog/Variant/907503', 'L', 'https://images.unsplash.com/photo-1614245756970-791579ec966b?w=600&q=80&auto=format&fit=crop', 'Satin Camisole - Off White'),
  ('gid://catalog/Variant/907504', 'XL', 'https://images.unsplash.com/photo-1614245756970-791579ec966b?w=600&q=80&auto=format&fit=crop', 'Satin Camisole - Off White'),
  ('gid://catalog/Variant/907600', 'XS', 'https://images.unsplash.com/photo-1548883354-a3fb8460973f?w=600&q=80&auto=format&fit=crop', 'Puffer Jacket - Olive'),
  ('gid://catalog/Variant/907601', 'S', 'https://images.unsplash.com/photo-1548883354-a3fb8460973f?w=600&q=80&auto=format&fit=crop', 'Puffer Jacket - Olive'),
  ('gid://catalog/Variant/907602', 'M', 'https://images.unsplash.com/photo-1548883354-a3fb8460973f?w=600&q=80&auto=format&fit=crop', 'Puffer Jacket - Olive'),
  ('gid://catalog/Variant/907603', 'L', 'https://images.unsplash.com/photo-1548883354-a3fb8460973f?w=600&q=80&auto=format&fit=crop', 'Puffer Jacket - Olive'),
  ('gid://catalog/Variant/907604', 'XL', 'https://images.unsplash.com/photo-1548883354-a3fb8460973f?w=600&q=80&auto=format&fit=crop', 'Puffer Jacket - Olive'),
  ('gid://catalog/Variant/907800', 'XS', 'https://images.unsplash.com/photo-1768983953826-231e8ef0b6dc?w=600&q=80&auto=format&fit=crop', 'Coach Jacket - Blue'),
  ('gid://catalog/Variant/907801', 'S', 'https://images.unsplash.com/photo-1768983953826-231e8ef0b6dc?w=600&q=80&auto=format&fit=crop', 'Coach Jacket - Blue'),
  ('gid://catalog/Variant/907802', 'M', 'https://images.unsplash.com/photo-1768983953826-231e8ef0b6dc?w=600&q=80&auto=format&fit=crop', 'Coach Jacket - Blue'),
  ('gid://catalog/Variant/907803', 'L', 'https://images.unsplash.com/photo-1768983953826-231e8ef0b6dc?w=600&q=80&auto=format&fit=crop', 'Coach Jacket - Blue'),
  ('gid://catalog/Variant/907804', 'XL', 'https://images.unsplash.com/photo-1768983953826-231e8ef0b6dc?w=600&q=80&auto=format&fit=crop', 'Coach Jacket - Blue'),
  ('gid://catalog/Variant/907900', 'XS', 'https://images.unsplash.com/photo-1611912901957-80caca8de69a?w=600&q=80&auto=format&fit=crop', 'Sherpa Denim Jacket - Dark Indigo'),
  ('gid://catalog/Variant/907901', 'S', 'https://images.unsplash.com/photo-1611912901957-80caca8de69a?w=600&q=80&auto=format&fit=crop', 'Sherpa Denim Jacket - Dark Indigo'),
  ('gid://catalog/Variant/907904', 'XL', 'https://images.unsplash.com/photo-1611912901957-80caca8de69a?w=600&q=80&auto=format&fit=crop', 'Sherpa Denim Jacket - Dark Indigo'),
  ('gid://catalog/Variant/908100', '36', 'https://images.unsplash.com/photo-1784639072018-dd85c44f992e?w=600&q=80&auto=format&fit=crop', 'Bootcut Jeans - Light Blue'),
  ('gid://catalog/Variant/908101', '38', 'https://images.unsplash.com/photo-1784639072018-dd85c44f992e?w=600&q=80&auto=format&fit=crop', 'Bootcut Jeans - Light Blue'),
  ('gid://catalog/Variant/908102', '40', 'https://images.unsplash.com/photo-1784639072018-dd85c44f992e?w=600&q=80&auto=format&fit=crop', 'Bootcut Jeans - Light Blue'),
  ('gid://catalog/Variant/908103', '42', 'https://images.unsplash.com/photo-1784639072018-dd85c44f992e?w=600&q=80&auto=format&fit=crop', 'Bootcut Jeans - Light Blue'),
  ('gid://catalog/Variant/908104', '44', 'https://images.unsplash.com/photo-1784639072018-dd85c44f992e?w=600&q=80&auto=format&fit=crop', 'Bootcut Jeans - Light Blue'),
  ('gid://catalog/Variant/908200', 'XS', 'https://images.unsplash.com/photo-1687825515654-23620796760c?w=600&q=80&auto=format&fit=crop', 'Cargo Pants - Dark Green'),
  ('gid://catalog/Variant/908201', 'S', 'https://images.unsplash.com/photo-1687825515654-23620796760c?w=600&q=80&auto=format&fit=crop', 'Cargo Pants - Dark Green'),
  ('gid://catalog/Variant/908202', 'M', 'https://images.unsplash.com/photo-1687825515654-23620796760c?w=600&q=80&auto=format&fit=crop', 'Cargo Pants - Dark Green'),
  ('gid://catalog/Variant/908203', 'L', 'https://images.unsplash.com/photo-1687825515654-23620796760c?w=600&q=80&auto=format&fit=crop', 'Cargo Pants - Dark Green'),
  ('gid://catalog/Variant/908204', 'XL', 'https://images.unsplash.com/photo-1687825515654-23620796760c?w=600&q=80&auto=format&fit=crop', 'Cargo Pants - Dark Green'),
  ('gid://catalog/Variant/908300', 'XS', 'https://images.unsplash.com/photo-1780291366347-f0191b9405f2?w=600&q=80&auto=format&fit=crop', 'Pleated Chino - Black'),
  ('gid://catalog/Variant/908301', 'S', 'https://images.unsplash.com/photo-1780291366347-f0191b9405f2?w=600&q=80&auto=format&fit=crop', 'Pleated Chino - Black'),
  ('gid://catalog/Variant/908302', 'M', 'https://images.unsplash.com/photo-1780291366347-f0191b9405f2?w=600&q=80&auto=format&fit=crop', 'Pleated Chino - Black'),
  ('gid://catalog/Variant/908303', 'L', 'https://images.unsplash.com/photo-1780291366347-f0191b9405f2?w=600&q=80&auto=format&fit=crop', 'Pleated Chino - Black'),
  ('gid://catalog/Variant/908304', 'XL', 'https://images.unsplash.com/photo-1780291366347-f0191b9405f2?w=600&q=80&auto=format&fit=crop', 'Pleated Chino - Black'),
  ('gid://catalog/Variant/908600', 'XS', 'https://images.unsplash.com/photo-1754639544919-ea4d1cff7dce?w=600&q=80&auto=format&fit=crop', 'Pleated Midi Skirt - Ivory'),
  ('gid://catalog/Variant/908601', 'S', 'https://images.unsplash.com/photo-1754639544919-ea4d1cff7dce?w=600&q=80&auto=format&fit=crop', 'Pleated Midi Skirt - Ivory'),
  ('gid://catalog/Variant/908602', 'M', 'https://images.unsplash.com/photo-1754639544919-ea4d1cff7dce?w=600&q=80&auto=format&fit=crop', 'Pleated Midi Skirt - Ivory'),
  ('gid://catalog/Variant/908603', 'L', 'https://images.unsplash.com/photo-1754639544919-ea4d1cff7dce?w=600&q=80&auto=format&fit=crop', 'Pleated Midi Skirt - Ivory'),
  ('gid://catalog/Variant/908604', 'XL', 'https://images.unsplash.com/photo-1754639544919-ea4d1cff7dce?w=600&q=80&auto=format&fit=crop', 'Pleated Midi Skirt - Ivory'),
  ('gid://catalog/Variant/908700', 'XS', 'https://images.unsplash.com/photo-1622460432096-f6b772409e1f?w=600&q=80&auto=format&fit=crop', 'Wrap Midi Dress - Red'),
  ('gid://catalog/Variant/908701', 'S', 'https://images.unsplash.com/photo-1622460432096-f6b772409e1f?w=600&q=80&auto=format&fit=crop', 'Wrap Midi Dress - Red'),
  ('gid://catalog/Variant/908702', 'M', 'https://images.unsplash.com/photo-1622460432096-f6b772409e1f?w=600&q=80&auto=format&fit=crop', 'Wrap Midi Dress - Red'),
  ('gid://catalog/Variant/908703', 'L', 'https://images.unsplash.com/photo-1622460432096-f6b772409e1f?w=600&q=80&auto=format&fit=crop', 'Wrap Midi Dress - Red'),
  ('gid://catalog/Variant/908704', 'XL', 'https://images.unsplash.com/photo-1622460432096-f6b772409e1f?w=600&q=80&auto=format&fit=crop', 'Wrap Midi Dress - Red'),
  ('gid://catalog/Variant/908800', 'XS', 'https://images.unsplash.com/photo-1784460470008-49f363e19275?w=600&q=80&auto=format&fit=crop', 'Cotton Sundress - Olive'),
  ('gid://catalog/Variant/908801', 'S', 'https://images.unsplash.com/photo-1784460470008-49f363e19275?w=600&q=80&auto=format&fit=crop', 'Cotton Sundress - Olive'),
  ('gid://catalog/Variant/908802', 'M', 'https://images.unsplash.com/photo-1784460470008-49f363e19275?w=600&q=80&auto=format&fit=crop', 'Cotton Sundress - Olive'),
  ('gid://catalog/Variant/908803', 'L', 'https://images.unsplash.com/photo-1784460470008-49f363e19275?w=600&q=80&auto=format&fit=crop', 'Cotton Sundress - Olive'),
  ('gid://catalog/Variant/908804', 'XL', 'https://images.unsplash.com/photo-1784460470008-49f363e19275?w=600&q=80&auto=format&fit=crop', 'Cotton Sundress - Olive'),
  ('gid://catalog/Variant/908900', 'XS', 'https://images.unsplash.com/photo-1529636273736-fc88b31ea9d9?w=600&q=80&auto=format&fit=crop', 'Knit Tank Dress - Cream'),
  ('gid://catalog/Variant/908901', 'S', 'https://images.unsplash.com/photo-1529636273736-fc88b31ea9d9?w=600&q=80&auto=format&fit=crop', 'Knit Tank Dress - Cream'),
  ('gid://catalog/Variant/908902', 'M', 'https://images.unsplash.com/photo-1529636273736-fc88b31ea9d9?w=600&q=80&auto=format&fit=crop', 'Knit Tank Dress - Cream'),
  ('gid://catalog/Variant/908903', 'L', 'https://images.unsplash.com/photo-1529636273736-fc88b31ea9d9?w=600&q=80&auto=format&fit=crop', 'Knit Tank Dress - Cream'),
  ('gid://catalog/Variant/908904', 'XL', 'https://images.unsplash.com/photo-1529636273736-fc88b31ea9d9?w=600&q=80&auto=format&fit=crop', 'Knit Tank Dress - Cream'),
  ('gid://catalog/Variant/909000', 'XS', 'https://images.unsplash.com/photo-1776162241177-8ed7caa11a37?w=600&q=80&auto=format&fit=crop', 'Turtleneck Sweater - Pastel'),
  ('gid://catalog/Variant/909001', 'S', 'https://images.unsplash.com/photo-1776162241177-8ed7caa11a37?w=600&q=80&auto=format&fit=crop', 'Turtleneck Sweater - Pastel'),
  ('gid://catalog/Variant/909002', 'M', 'https://images.unsplash.com/photo-1776162241177-8ed7caa11a37?w=600&q=80&auto=format&fit=crop', 'Turtleneck Sweater - Pastel'),
  ('gid://catalog/Variant/909003', 'L', 'https://images.unsplash.com/photo-1776162241177-8ed7caa11a37?w=600&q=80&auto=format&fit=crop', 'Turtleneck Sweater - Pastel'),
  ('gid://catalog/Variant/909004', 'XL', 'https://images.unsplash.com/photo-1776162241177-8ed7caa11a37?w=600&q=80&auto=format&fit=crop', 'Turtleneck Sweater - Pastel'),
  ('gid://catalog/Variant/909100', 'XS', 'https://images.unsplash.com/photo-1773747310674-b42a55d72003?w=600&q=80&auto=format&fit=crop', 'V-Neck Knit Vest - Cream'),
  ('gid://catalog/Variant/909101', 'S', 'https://images.unsplash.com/photo-1773747310674-b42a55d72003?w=600&q=80&auto=format&fit=crop', 'V-Neck Knit Vest - Cream'),
  ('gid://catalog/Variant/909104', 'XL', 'https://images.unsplash.com/photo-1773747310674-b42a55d72003?w=600&q=80&auto=format&fit=crop', 'V-Neck Knit Vest - Cream'),
  ('gid://catalog/Variant/909200', 'XS', 'https://images.unsplash.com/photo-1606598646035-05f923f42982?w=600&q=80&auto=format&fit=crop', 'Mohair Cardigan - Cream'),
  ('gid://catalog/Variant/909201', 'S', 'https://images.unsplash.com/photo-1606598646035-05f923f42982?w=600&q=80&auto=format&fit=crop', 'Mohair Cardigan - Cream'),
  ('gid://catalog/Variant/909202', 'M', 'https://images.unsplash.com/photo-1606598646035-05f923f42982?w=600&q=80&auto=format&fit=crop', 'Mohair Cardigan - Cream'),
  ('gid://catalog/Variant/909203', 'L', 'https://images.unsplash.com/photo-1606598646035-05f923f42982?w=600&q=80&auto=format&fit=crop', 'Mohair Cardigan - Cream'),
  ('gid://catalog/Variant/909204', 'XL', 'https://images.unsplash.com/photo-1606598646035-05f923f42982?w=600&q=80&auto=format&fit=crop', 'Mohair Cardigan - Cream'),
  ('gid://catalog/Variant/909300', 'Black', 'https://images.unsplash.com/photo-1602532360508-595f449c7c55?w=600&q=80&auto=format&fit=crop', 'Leather Belt Bag - Black'),
  ('gid://catalog/Variant/909400', 'Off White', 'https://images.unsplash.com/photo-1758815915419-d427160da2e6?w=600&q=80&auto=format&fit=crop', 'Woven Market Tote - Off White'),
  ('gid://catalog/Variant/909500', 'Red', 'https://images.unsplash.com/photo-1751522925876-79bfeae6fbfb?w=600&q=80&auto=format&fit=crop', 'Nylon Shoulder Bag - Red'),
  ('gid://catalog/Variant/909600', 'Brown', 'https://images.unsplash.com/photo-1485894944436-a890c1048494?w=600&q=80&auto=format&fit=crop', 'Canvas Messenger - Brown'),
  ('gid://catalog/Variant/909700', 'Tan', 'https://images.unsplash.com/photo-1694436986130-c4c949d3f431?w=600&q=80&auto=format&fit=crop', 'Wide Brim Hat - Tan'),
  ('gid://catalog/Variant/909800', 'Blue', 'https://images.unsplash.com/photo-1614455002811-b2fb45781815?w=600&q=80&auto=format&fit=crop', 'Knit Headband - Blue'),
  ('gid://catalog/Variant/909900', 'White', 'https://images.unsplash.com/photo-1556793521-ec4b34e6545e?w=600&q=80&auto=format&fit=crop', 'Five Panel Cap - White'),
  ('gid://catalog/Variant/910000', '37', 'https://images.unsplash.com/photo-1581977012607-4091712d36f9?w=600&q=80&auto=format&fit=crop', 'Chunky Sole Sneakers - Pastel'),
  ('gid://catalog/Variant/910001', '38', 'https://images.unsplash.com/photo-1581977012607-4091712d36f9?w=600&q=80&auto=format&fit=crop', 'Chunky Sole Sneakers - Pastel'),
  ('gid://catalog/Variant/910002', '39', 'https://images.unsplash.com/photo-1581977012607-4091712d36f9?w=600&q=80&auto=format&fit=crop', 'Chunky Sole Sneakers - Pastel'),
  ('gid://catalog/Variant/910003', '40', 'https://images.unsplash.com/photo-1581977012607-4091712d36f9?w=600&q=80&auto=format&fit=crop', 'Chunky Sole Sneakers - Pastel'),
  ('gid://catalog/Variant/910004', '41', 'https://images.unsplash.com/photo-1581977012607-4091712d36f9?w=600&q=80&auto=format&fit=crop', 'Chunky Sole Sneakers - Pastel'),
  ('gid://catalog/Variant/910005', '42', 'https://images.unsplash.com/photo-1581977012607-4091712d36f9?w=600&q=80&auto=format&fit=crop', 'Chunky Sole Sneakers - Pastel'),
  ('gid://catalog/Variant/910200', '37', 'https://images.unsplash.com/photo-1695073621086-aa692bc32a3d?w=600&q=80&auto=format&fit=crop', 'Canvas High Tops - White'),
  ('gid://catalog/Variant/910201', '38', 'https://images.unsplash.com/photo-1695073621086-aa692bc32a3d?w=600&q=80&auto=format&fit=crop', 'Canvas High Tops - White'),
  ('gid://catalog/Variant/910202', '39', 'https://images.unsplash.com/photo-1695073621086-aa692bc32a3d?w=600&q=80&auto=format&fit=crop', 'Canvas High Tops - White'),
  ('gid://catalog/Variant/910203', '40', 'https://images.unsplash.com/photo-1695073621086-aa692bc32a3d?w=600&q=80&auto=format&fit=crop', 'Canvas High Tops - White'),
  ('gid://catalog/Variant/910204', '41', 'https://images.unsplash.com/photo-1695073621086-aa692bc32a3d?w=600&q=80&auto=format&fit=crop', 'Canvas High Tops - White'),
  ('gid://catalog/Variant/910205', '42', 'https://images.unsplash.com/photo-1695073621086-aa692bc32a3d?w=600&q=80&auto=format&fit=crop', 'Canvas High Tops - White')
  ) AS novo(variant_id, title, image_url, image_alt)
 WHERE v.variant_id = novo.variant_id;

-- A tag de cor: é por ela que o agente e a busca enxergam a cor, então deixá-la
-- para trás faria o texto do agente contradizer a foto.
UPDATE product_props AS pp
   SET value = novo.value
  FROM (VALUES
  ('gid://catalog/Product/9042', 'TAG', 100, 'magenta'),
  ('gid://catalog/Product/9067', 'TAG', 100, 'yellow'),
  ('gid://catalog/Product/9070', 'TAG', 100, 'orange'),
  ('gid://catalog/Product/9072', 'TAG', 100, 'pastel'),
  ('gid://catalog/Product/9082', 'TAG', 100, 'dark green'),
  ('gid://catalog/Product/9093', 'TAG', 100, 'black'),
  ('gid://catalog/Product/9094', 'TAG', 100, 'off white'),
  ('gid://catalog/Product/9096', 'TAG', 100, 'brown'),
  ('gid://catalog/Product/9098', 'TAG', 100, 'blue')
  ) AS novo(product_group_id, name, position, value)
 WHERE pp.product_group_id = novo.product_group_id
   AND pp.name = novo.name
   AND pp.position = novo.position;
