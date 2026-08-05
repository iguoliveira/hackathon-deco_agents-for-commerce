-- Migration 0007 — devolve ao catálogo 10 itens de lifestyle.
--
-- A 0004 removeu 27 produtos para deixar só vestuário. Destes, 17 eram adesivos
-- e 10 eram itens de lifestyle (caneca, garrafa, caderno, caneta, capa de
-- celular, almofada, pelúcia). Esta migration traz de volta só os 10.
--
-- Por quê: o agente da vitrine precisa de "combina com", e o catálogo de
-- vestuário é raso demais para isso — bottoms tem 1 produto, jackets tem 2.
-- Cruzar categorias ("esse moletom + essa caneca") é a única recomendação com
-- variedade suficiente para não parecer aleatória. Os 10 têm dado real:
-- descrições de 395 a 1345 caracteres e imagens de verdade.
--
-- Os 17 adesivos ficaram de fora de propósito. São itens quase idênticos entre
-- si — mesmo formato, mesma faixa de preço, descrições intercambiáveis — e
-- dominariam qualquer busca por similaridade, empurrando a vitrine para um
-- monte de adesivo sempre que o texto casasse. Também foram removidos do menu
-- em 20f912a, então voltariam sem lugar na navegação.
--
-- As linhas abaixo foram extraídas da 0003 (a fonte original), não digitadas:
-- mesmos ids, preços, imagens e variantes que o Shopify serviu.
--
-- Idempotente via ON CONFLICT DO NOTHING: as chaves primárias são os gids do
-- Shopify, então reaplicar não duplica.

INSERT INTO products (product_group_id, handle, title, description, description_html, vendor, product_type, created_at, currency_code, position) VALUES
('gid://shopify/Product/7948043649201', 'the-syntax-scribbler-notebook', 'The Syntax Scribbler Notebook', 'Unlock your creative potential with The Syntax Scribbler Notebook! Perfect for capturing code snippets, sketching algorithms, or jotting down those lightbulb moments that strike between sprints. This notebook is designed with developers in mind, featuring a sleek design inspired by JSX, TailwindCSS, and Typescript. Whether you''re debugging or brainstorming, it''s the ultimate companion for turning your ideas into reality. Get ready to script your success!', '<p><meta charset="utf-8"><span>Unlock your creative potential with The Syntax Scribbler Notebook! Perfect for capturing code snippets, sketching algorithms, or jotting down those lightbulb moments that strike between sprints. This notebook is designed with developers in mind, featuring a sleek design inspired by JSX, TailwindCSS, and Typescript. Whether you''re debugging or brainstorming, it''s the ultimate companion for turning your ideas into reality. Get ready to script your success!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T00:50:41Z', 'BRL', 17),
('gid://shopify/Product/7948061180081', 'pixel-perfection-pen', 'Pixel Perfection Pen', 'Unlock your creativity with the Pixel Perfection Pen! Crafted for developers who believe every line of code is a work of art, this sleek pen is more than just a writing instrument—it''s a tool for bringing your digital dreams to life. Whether you''re sketching wireframes, jotting down algorithms, or signing off on your latest masterpiece, the Pixel Perfection Pen ensures your ideas flow smoothly onto the canvas of the digital world. So grab hold of your creativity and let your code be as precise as your strokes!', '<p><meta charset="utf-8"><span>Unlock your creativity with the Pixel Perfection Pen! Crafted for developers who believe every line of code is a work of art, this sleek pen is more than just a writing instrument—it''s a tool for bringing your digital dreams to life. Whether you''re sketching wireframes, jotting down algorithms, or signing off on your latest masterpiece, the Pixel Perfection Pen ensures your ideas flow smoothly onto the canvas of the digital world. So grab hold of your creativity and let your code be as precise as your strokes!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T01:15:06Z', 'BRL', 23),
('gid://shopify/Product/7948063244465', 'capy-coding-companion', 'Capy Coding Companion', 'Introducing your ultimate coding companion, the Capy Coding Companion! This stuffed capybara isn''t just cute—it''s also your partner in programming crime. Whether you''re tackling tough algorithms or debugging like a pro, this plush pal is here to keep you company and provide endless cuddles. So snuggle up, grab your keyboard, and let''s code away with our favorite fluffy friend by our side!', '<p><meta charset="utf-8"><span>Introducing your ultimate coding companion, the Capy Coding Companion! This stuffed capybara isn''t just cute—it''s also your partner in programming crime. Whether you''re tackling tough algorithms or debugging like a pro, this plush pal is here to keep you company and provide endless cuddles. So snuggle up, grab your keyboard, and let''s code away with our favorite fluffy friend by our side!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T01:17:27Z', 'BRL', 24),
('gid://shopify/Product/8028449734833', 'snap-case-for-iphone®', 'Snap Case for iPhone®', 'Searching for a premium phone case to keep your device protected? Look no further! Our Snap Case for iPhone® combines a slim and lightweight design with a classy, minimalist aesthetic. This case is available with all-over print sublimation, ensuring your custom design looks top-notch. - Constructed from durable polycarbonate (PC) material- Compatible with wireless charging- Precisely aligned port openings for ease of use- Available in both matte and gloss finishes- Sourced from the Republic of Korea Important Notes: - Avoid exposing the case to liquids with high alcohol content, as this may cause the design to wear off. - Keep the case out of direct sunlight to prevent yellowing.- This product is available for shipping in the US, Canada, Europe, the UK, Australia, and New Zealand only. Please select an alternative product if shipping outside these regions. Ensure your customers are aware of this limitation if selling on your online store. Note: iPhone® is a trademark of Apple Inc., registered in the US and other countries and regions. This accessory is made on demand with no minimum order requirements.', '<p>Searching for a premium phone case to keep your device protected? Look no further! Our Snap Case for iPhone® combines a slim and lightweight design with a classy, minimalist aesthetic. This case is available with all-over print sublimation, ensuring your custom design looks top-notch.</p>
<p>- Constructed from durable polycarbonate (PC) material<br>- Compatible with wireless charging<br>- Precisely aligned port openings for ease of use<br>- Available in both matte and gloss finishes<br>- Sourced from the Republic of Korea</p>
<p><strong>Important Notes:</strong></p>
<p>- Avoid exposing the case to liquids with high alcohol content, as this may cause the design to wear off. <br>- Keep the case out of direct sunlight to prevent yellowing.<br>- This product is available for shipping in the US, Canada, Europe, the UK, Australia, and New Zealand only. Please select an alternative product if shipping outside these regions. Ensure your customers are aware of this limitation if selling on your online store.</p>
<p><strong>Note:</strong></p>
<p> iPhone® is a trademark of Apple Inc., registered in the US and other countries and regions.</p>
<p>This accessory is made on demand with no minimum order requirements.</p>
<!---->', 'gimenesdevstore', '', '2024-06-21T08:50:01Z', 'BRL', 30),
('gid://shopify/Product/8028469428401', 'insulated-tumbler-with-a-straw', 'Insulated Tumbler with a Straw', 'Tired of ordinary drinkware? Introduce a splash of color and style with our Insulated Tumbler, available in a variety of trendy hues. Whether you''re on the move or relaxing at home, make a statement while enjoying your favorite drink. Perfect for home & living. - Made from high-grade stainless steel- 20 oz. (600 ml) capacity- Dimensions: 4″ × 7.2″ (10.1 cm × 18.2 cm)- Comes with a straw and lid- Blank product sourced from China, printed in the US Disclaimers: - Not safe for dishwasher or microwave use. Hand-wash only.- Not leak-proof. To avoid potential leaks, keep the tumbler upright at all times. This product is made on demand with no minimum order requirements.', '<p>Tired of ordinary drinkware? Introduce a splash of color and style with our Insulated Tumbler, available in a variety of trendy hues. Whether you''re on the move or relaxing at home, make a statement while enjoying your favorite drink. Perfect for home &amp; living.</p>
<p>- Made from high-grade stainless steel<br>- 20 oz. (600 ml) capacity<br>- Dimensions: 4″ × 7.2″ (10.1 cm × 18.2 cm)<br>- Comes with a straw and lid<br>- Blank product sourced from China, printed in the US</p>
<p><strong>Disclaimers:</strong></p>
<p>- Not safe for dishwasher or microwave use. Hand-wash only.<br>- Not leak-proof. To avoid potential leaks, keep the tumbler upright at all times.</p>
<p>This product is made on demand with no minimum order requirements. </p>
<!---->', 'gimenesdevstore', '', '2024-06-21T09:14:55Z', 'BRL', 34),
('gid://shopify/Product/8028471361713', 'stainless-steel-water-bottle', 'Stainless Steel Water Bottle', 'Introducing our Stainless Steel Water Bottle, crafted from high-grade stainless steel. Its double-wall construction makes it ideal for maintaining the temperature of both hot and cold beverages. Whether you''re savoring a hot coffee in the morning or refreshing yourself with ice-cold water post-workout, this beautifully designed, reusable bottle ensures an enjoyable drinking experience. Perfect for home & living. - High-grade stainless steel- 17 oz (500 ml) capacity- Dimensions: 10.5″ × 2.85″ (27 × 7 cm)- Vacuum flask with double-wall construction- Sleek bowling pin shape- Glossy finish- Odorless and leak-proof cap- Insulated for hot and cold liquids, maintaining temperature for up to 6 hours- Hand-wash only- Blank product sourced from China **Disclaimer:** Storing water in the bottle for over 24 hours is not recommended, as it can lead to unpleasant odors. This product is made on demand with no minimum order requirements.', '<p>Introducing our Stainless Steel Water Bottle, crafted from high-grade stainless steel. Its double-wall construction makes it ideal for maintaining the temperature of both hot and cold beverages. Whether you''re savoring a hot coffee in the morning or refreshing yourself with ice-cold water post-workout, this beautifully designed, reusable bottle ensures an enjoyable drinking experience. Perfect for home &amp; living.</p>
<p>- High-grade stainless steel<br>- 17 oz (500 ml) capacity<br>- Dimensions: 10.5″ × 2.85″ (27 × 7 cm)<br>- Vacuum flask with double-wall construction<br>- Sleek bowling pin shape<br>- Glossy finish<br>- Odorless and leak-proof cap<br>- Insulated for hot and cold liquids, maintaining temperature for up to 6 hours<br>- Hand-wash only<br>- Blank product sourced from China</p>
<p>**Disclaimer:** Storing water in the bottle for over 24 hours is not recommended, as it can lead to unpleasant odors.</p>
<p>This product is made on demand with no minimum order requirements.</p>
<!---->', 'gimenesdevstore', '', '2024-06-21T09:17:33Z', 'BRL', 35),
('gid://shopify/Product/8058167787697', 'mug', 'Mug', 'This metal mug is the ideal choice for coffee lovers. Its sturdy design and cozy feel make it the perfect addition to your morning routine. Enjoy your favorite beverage with this durable and practical mug. Perfect for home & living. Key Features: Sturdy Design: Made from high-quality metal for durability and long-lasting use. Cozy Feel: Designed for comfort, providing a pleasant drinking experience. Durable and Practical: Perfect for everyday use, whether at home, work, or on the go. Heat Retention: Keeps your beverage warm for longer, so you can savor every sip. Versatile Use: Ideal for coffee, tea, hot chocolate, and other beverages. Additional Details: Material: Premium-grade metal Capacity: Available in multiple sizes to suit your needs Care: Hand wash recommended to maintain quality and longevity Perfect for Coffee LoversEnhance your morning routine with this metal mug. Its sturdy and practical design ensures that you can enjoy your favorite beverages in style and comfort. Whether you''re a coffee enthusiast or simply love a good cup of tea, this mug is a must-have addition to your kitchenware collection.', '<p>This metal mug is the ideal choice for coffee lovers. Its sturdy design and cozy feel make it the perfect addition to your morning routine. Enjoy your favorite beverage with this durable and practical mug. <meta charset="utf-8">Perfect for home &amp; living.</p>
<p><strong>Key Features:</strong></p>
<ul>
<li>
<strong>Sturdy Design:</strong> Made from high-quality metal for durability and long-lasting use.</li>
<li>
<strong>Cozy Feel:</strong> Designed for comfort, providing a pleasant drinking experience.</li>
<li>
<strong>Durable and Practical:</strong> Perfect for everyday use, whether at home, work, or on the go.</li>
<li>
<strong>Heat Retention:</strong> Keeps your beverage warm for longer, so you can savor every sip.</li>
<li>
<strong>Versatile Use:</strong> Ideal for coffee, tea, hot chocolate, and other beverages.</li>
</ul>
<p><strong>Additional Details:</strong></p>
<ul>
<li>
<strong>Material:</strong> Premium-grade metal</li>
<li>
<strong>Capacity:</strong> Available in multiple sizes to suit your needs</li>
<li>
<strong>Care:</strong> Hand wash recommended to maintain quality and longevity</li>
</ul>
<p><strong>Perfect for Coffee Lovers</strong><br>Enhance your morning routine with this metal mug. Its sturdy and practical design ensures that you can enjoy your favorite beverages in style and comfort. Whether you''re a coffee enthusiast or simply love a good cup of tea, this mug is a must-have addition to your kitchenware collection.</p>
<!---->', 'gimenesdevstore', '', '2024-07-05T18:29:58Z', 'BRL', 40),
('gid://shopify/Product/8062721458353', 'bottle', 'Bottle', 'This bottle is crafted from durable metal, providing lasting use. With its thermic design, it can keep beverages hot or cold for extended periods of time. Stay hydrated and satisfied on-the-go with this efficient and versatile bottle. Perfect for home & living. Key Features: Durable Construction: Made from high-quality metal, ensuring long-lasting performance and resistance to wear and tear. Thermic Design: Keeps beverages hot or cold for hours, maintaining the perfect temperature for your drinks. Versatile Use: Ideal for a variety of beverages, from coffee and tea to water and juice. Leak-Proof: Secure lid ensures no spills or leaks, making it perfect for travel and daily use. Eco-Friendly: A reusable alternative to single-use plastic bottles, helping reduce environmental impact. Additional Details: Material: Premium-grade metal Capacity: Available in different sizes to suit your needs Care: Hand wash recommended for best results Stay Hydrated and SatisfiedThis efficient and versatile bottle is designed to keep up with your busy lifestyle. Whether you''re heading to the office, the gym, or on an outdoor adventure, this thermic bottle ensures you stay hydrated and enjoy your favorite beverages at the perfect temperature all day long.', '<p>This bottle is crafted from durable metal, providing lasting use. With its thermic design, it can keep beverages hot or cold for extended periods of time. Stay hydrated and satisfied on-the-go with this efficient and versatile bottle. Perfect for home &amp; living.</p>
<p><strong>Key Features:</strong></p>
<ul>
<li>
<strong>Durable Construction:</strong> Made from high-quality metal, ensuring long-lasting performance and resistance to wear and tear.</li>
<li>
<strong>Thermic Design:</strong> Keeps beverages hot or cold for hours, maintaining the perfect temperature for your drinks.</li>
<li>
<strong>Versatile Use:</strong> Ideal for a variety of beverages, from coffee and tea to water and juice.</li>
<li>
<strong>Leak-Proof:</strong> Secure lid ensures no spills or leaks, making it perfect for travel and daily use.</li>
<li>
<strong>Eco-Friendly:</strong> A reusable alternative to single-use plastic bottles, helping reduce environmental impact.</li>
</ul>
<p><strong>Additional Details:</strong></p>
<ul>
<li>
<strong>Material:</strong> Premium-grade metal</li>
<li>
<strong>Capacity:</strong> Available in different sizes to suit your needs</li>
<li>
<strong>Care:</strong> Hand wash recommended for best results</li>
</ul>
<p><strong>Stay Hydrated and Satisfied</strong><br>This efficient and versatile bottle is designed to keep up with your busy lifestyle. Whether you''re heading to the office, the gym, or on an outdoor adventure, this thermic bottle ensures you stay hydrated and enjoy your favorite beverages at the perfect temperature all day long.</p>
<!---->', 'gimenesdevstore', '', '2024-07-08T14:09:31Z', 'BRL', 42),
('gid://shopify/Product/8062743281841', 'notebook', 'Notebook', 'This A3 notebook is perfect for all your writing and note-taking needs. With its larger size, you''ll have more space to jot down important information and ideas. The high-quality paper ensures a smooth writing experience, making this notebook a must-have for students and professionals alike. Perfect for home & living. Key Features: Spacious Size: A3 dimensions provide ample space for writing, sketching, and note-taking. High-Quality Paper: Ensures a smooth and enjoyable writing experience with minimal ink bleed-through. Durable Cover: Protects your notes and ideas, keeping them safe and secure. Versatile Use: Ideal for students, professionals, artists, and anyone who needs extra space for their thoughts. Elegant Design: Simple yet stylish design that suits any environment, from classrooms to offices. Additional Details: Size: A3 (297 x 420 mm) Paper Quality: Premium-grade paper for a smooth writing surface Binding: Durable binding for long-lasting use Pages: Available with lined, plain, or grid pages to suit your preference Perfect for All Your NeedsWhether you''re taking notes in class, drafting project plans at work, or sketching your latest ideas, this A3 notebook is the perfect companion. Its larger size and high-quality paper make it an essential tool for capturing all your important information and creative thoughts.', '<p>This A3 notebook is perfect for all your writing and note-taking needs. With its larger size, you''ll have more space to jot down important information and ideas. The high-quality paper ensures a smooth writing experience, making this notebook a must-have for students and professionals alike. <meta charset="utf-8">Perfect for home &amp; living.</p>
<p><strong>Key Features:</strong></p>
<ul>
<li>
<strong>Spacious Size:</strong> A3 dimensions provide ample space for writing, sketching, and note-taking.</li>
<li>
<strong>High-Quality Paper:</strong> Ensures a smooth and enjoyable writing experience with minimal ink bleed-through.</li>
<li>
<strong>Durable Cover:</strong> Protects your notes and ideas, keeping them safe and secure.</li>
<li>
<strong>Versatile Use:</strong> Ideal for students, professionals, artists, and anyone who needs extra space for their thoughts.</li>
<li>
<strong>Elegant Design:</strong> Simple yet stylish design that suits any environment, from classrooms to offices.</li>
</ul>
<p><strong>Additional Details:</strong></p>
<ul>
<li>
<strong>Size:</strong> A3 (297 x 420 mm)</li>
<li>
<strong>Paper Quality:</strong> Premium-grade paper for a smooth writing surface</li>
<li>
<strong>Binding:</strong> Durable binding for long-lasting use</li>
<li>
<strong>Pages:</strong> Available with lined, plain, or grid pages to suit your preference</li>
</ul>
<p><strong>Perfect for All Your Needs</strong><br>Whether you''re taking notes in class, drafting project plans at work, or sketching your latest ideas, this A3 notebook is the perfect companion. Its larger size and high-quality paper make it an essential tool for capturing all your important information and creative thoughts.</p>
<!---->', 'gimenesdevstore', '', '2024-07-08T14:31:47Z', 'BRL', 43),
('gid://shopify/Product/8062864588977', 'pillow', 'Pillow', 'This pillow is a basic yet essential item for a comfortable night''s sleep. Its soft and supportive design guarantees a restful slumber. Made with high-quality materials, it offers the perfect balance of comfort and durability. Elevate your sleep experience with this must-have pillow. Key Features: Soft and Supportive: Provides the perfect balance of softness and support for a restful sleep. High-Quality Materials: Made with premium materials to ensure comfort and longevity. Durable Design: Built to withstand regular use while maintaining its shape and comfort. Hypoallergenic: Designed to be gentle on the skin and reduce allergens for a healthier sleep environment. Versatile Use: Suitable for all sleeping positions, making it ideal for any sleeper. Additional Details: Material: Premium-quality fabric and fill Sizes: Standard, Queen, and King Care: Machine washable for easy maintenance Elevate Your Sleep ExperienceThis pillow is the perfect home & living addition to your bedding collection, offering superior comfort and support for a better night''s sleep. With its high-quality materials and durable design, you can enjoy restful slumber night after night. Make this essential pillow a part of your sleep routine and wake up feeling refreshed and rejuvenated.', '<p>This pillow is a basic yet essential item for a comfortable night''s sleep. Its soft and supportive design guarantees a restful slumber. Made with high-quality materials, it offers the perfect balance of comfort and durability. Elevate your sleep experience with this must-have pillow.</p>
<p><strong>Key Features:</strong></p>
<ul>
<li>
<strong>Soft and Supportive:</strong> Provides the perfect balance of softness and support for a restful sleep.</li>
<li>
<strong>High-Quality Materials:</strong> Made with premium materials to ensure comfort and longevity.</li>
<li>
<strong>Durable Design:</strong> Built to withstand regular use while maintaining its shape and comfort.</li>
<li>
<strong>Hypoallergenic:</strong> Designed to be gentle on the skin and reduce allergens for a healthier sleep environment.</li>
<li>
<strong>Versatile Use:</strong> Suitable for all sleeping positions, making it ideal for any sleeper.</li>
</ul>
<p><strong>Additional Details:</strong></p>
<ul>
<li>
<strong>Material:</strong> Premium-quality fabric and fill</li>
<li>
<strong>Sizes:</strong> Standard, Queen, and King</li>
<li>
<strong>Care:</strong> Machine washable for easy maintenance</li>
</ul>
<p><strong>Elevate Your Sleep Experience</strong><br>This pillow is the perfect home &amp; living addition to your bedding collection, offering superior comfort and support for a better night''s sleep. With its high-quality materials and durable design, you can enjoy restful slumber night after night. Make this essential pillow a part of your sleep routine and wake up feeling refreshed and rejuvenated.</p>
<!---->', 'gimenesdevstore', '', '2024-07-08T16:11:20Z', 'BRL', 44)
ON CONFLICT (product_group_id) DO NOTHING;

INSERT INTO product_images (product_group_id, url, alt, position) VALUES
('gid://shopify/Product/7948043649201', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Capa-1.png?v=1715906996', '', 0),
('gid://shopify/Product/7948043649201', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/4Capa-1.png?v=1715906990', '', 1),
('gid://shopify/Product/7948043649201', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/FolhaDeRosto-1.png?v=1715907001', '', 2),
('gid://shopify/Product/7948043649201', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/FolhaDeRosto2-1.png?v=1715907007', '', 3),
('gid://shopify/Product/7948043649201', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/FolhaDeRosto3-1.png?v=1715907011', '', 4),
('gid://shopify/Product/7948061180081', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Caneta.png?v=1715908493', '', 0),
('gid://shopify/Product/7948063244465', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/image12.png?v=1715908627', '', 0),
('gid://shopify/Product/7948063244465', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/WhatsAppImage2024-03-07at10.491.png?v=1715908631', '', 1),
('gid://shopify/Product/8028449734833', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/SnapCaseforiPhone_-01.png?v=1718959759', '', 0),
('gid://shopify/Product/8028449734833', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/SnapCaseforiPhone_-02.png?v=1718959759', '', 1),
('gid://shopify/Product/8028449734833', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/SnapCaseforiPhone_-03.png?v=1718959759', '', 2),
('gid://shopify/Product/8028469428401', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/InsulatedTumblerwithaStraw-01.png?v=1718961264', 'White', 0),
('gid://shopify/Product/8028471361713', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/StainlessSteelWaterBottle-01.png?v=1718961427', '', 0),
('gid://shopify/Product/8028471361713', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/StainlessSteelWaterBottle-02.png?v=1718961427', '', 1),
('gid://shopify/Product/8028471361713', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/StainlessSteelWaterBottle-03.png?v=1718961427', '', 2),
('gid://shopify/Product/8058167787697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugwhite.png?v=1720203455', '', 0),
('gid://shopify/Product/8058167787697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugwhite2_3a7438ff-58d5-47b2-81f6-9c684a394b01.png?v=1720204087', '', 1),
('gid://shopify/Product/8058167787697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugdarkblue.png?v=1720203467', '', 2),
('gid://shopify/Product/8058167787697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugblue2.png?v=1720203670', '', 3),
('gid://shopify/Product/8058167787697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugyellow.png?v=1720203467', '', 4),
('gid://shopify/Product/8058167787697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugyellow2.png?v=1720203467', '', 5),
('gid://shopify/Product/8058167787697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/muggreen_bd7cd6a0-d998-445b-864a-ea1edfd97077.png?v=1720203834', '', 6),
('gid://shopify/Product/8058167787697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/muggreen2.png?v=1720203835', '', 7),
('gid://shopify/Product/8062721458353', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bottlewhite_fd186736-da4f-4357-9ebd-83c2cfdd272d.png?v=1720448231', '', 0),
('gid://shopify/Product/8062721458353', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bottleblack_35b1a6dd-b88c-47af-9cda-f97808022be6.png?v=1720448231', '', 1),
('gid://shopify/Product/8062721458353', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bottlegreen_d3747381-8cf3-43e2-ae0b-46addd1459cc.png?v=1720448231', '', 2),
('gid://shopify/Product/8062721458353', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bottleblue_37f67a2f-a8b8-467e-9e3b-4665eba334d4.png?v=1720448231', '', 3),
('gid://shopify/Product/8062721458353', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bottleyellow_33d6873a-5dd7-48c1-98c9-2c3e01beb4ad.png?v=1720448231', '', 4),
('gid://shopify/Product/8062743281841', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookwhite.png?v=1720450803', 'White', 0),
('gid://shopify/Product/8062743281841', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookwhite2.png?v=1720450804', 'White', 1),
('gid://shopify/Product/8062743281841', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookblack.png?v=1720450803', 'Black', 2),
('gid://shopify/Product/8062743281841', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookblack2.png?v=1720450804', 'Black', 3),
('gid://shopify/Product/8062743281841', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookgreen.png?v=1720450803', 'DarkGreen', 4),
('gid://shopify/Product/8062743281841', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookgreen2.png?v=1720450804', 'DarkGreen', 5),
('gid://shopify/Product/8062743281841', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookblue_0999567e-64bd-43fb-bc76-9bdf83dd1942.png?v=1720450803', 'DarkBlue', 6),
('gid://shopify/Product/8062743281841', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookblue2.png?v=1720450804', 'DarkBlue', 7),
('gid://shopify/Product/8062743281841', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookyellow2.png?v=1720450803', 'DarkYellow', 8),
('gid://shopify/Product/8062743281841', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookyellow.png?v=1720450803', 'DarkYellow', 9),
('gid://shopify/Product/8062864588977', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowwhite.png?v=1720454987', 'White', 0),
('gid://shopify/Product/8062864588977', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowblack.png?v=1720454987', 'Black', 1),
('gid://shopify/Product/8062864588977', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowgreen.png?v=1720454987', 'DarkGreen', 2),
('gid://shopify/Product/8062864588977', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowblue.png?v=1720454987', 'DarkBlue', 3),
('gid://shopify/Product/8062864588977', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowyellow.png?v=1720454987', 'DarkYellow', 4);

INSERT INTO product_props (product_group_id, name, value, value_reference, position) VALUES
('gid://shopify/Product/7948063244465', 'TAG', 'capy', NULL, 0),
('gid://shopify/Product/8028449734833', 'COLLECTION', 'Accessories', 'accessories', 0),
('gid://shopify/Product/8028471361713', 'COLLECTION', 'Home & Living', 'stickers', 0),
('gid://shopify/Product/8058167787697', 'COLLECTION', 'Home & Living', 'stickers', 0),
('gid://shopify/Product/8062743281841', 'COLLECTION', 'Home & Living', 'stickers', 0),
('gid://shopify/Product/8062864588977', 'COLLECTION', 'Home & Living', 'stickers', 0);

INSERT INTO variants (variant_id, product_group_id, title, barcode, price, compare_at_price, available, quantity, image_url, image_alt, position) VALUES
('gid://shopify/ProductVariant/44073326837937', 'gid://shopify/Product/7948043649201', 'Default Title', NULL, 499, 599, 0, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Capa-1.png?v=1715906996', '', 0),
('gid://shopify/ProductVariant/44073370648753', 'gid://shopify/Product/7948061180081', 'Default Title', NULL, 3, 4, 0, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Caneta.png?v=1715908493', '', 0),
('gid://shopify/ProductVariant/44073376186545', 'gid://shopify/Product/7948063244465', 'Default Title', NULL, 44, 45, 1, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/image12.png?v=1715908627', '', 0),
('gid://shopify/ProductVariant/44387181199537', 'gid://shopify/Product/8028449734833', 'White', NULL, 15, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/SnapCaseforiPhone_-01.png?v=1718959759', '', 0),
('gid://shopify/ProductVariant/44388190257329', 'gid://shopify/Product/8028469428401', 'White', NULL, 8, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/InsulatedTumblerwithaStraw-01.png?v=1718961264', 'White', 0),
('gid://shopify/ProductVariant/44387173269681', 'gid://shopify/Product/8028471361713', 'White', NULL, 15, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/StainlessSteelWaterBottle-01.png?v=1718961427', '', 0),
('gid://shopify/ProductVariant/44362957095089', 'gid://shopify/Product/8058167787697', 'White', NULL, 15, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugwhite.png?v=1720203455', '', 0),
('gid://shopify/ProductVariant/44362957160625', 'gid://shopify/Product/8058167787697', 'DarkGreen', NULL, 15, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugwhite.png?v=1720203455', '', 1),
('gid://shopify/ProductVariant/44362957193393', 'gid://shopify/Product/8058167787697', 'DarkBlue', NULL, 15, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugwhite.png?v=1720203455', '', 2),
('gid://shopify/ProductVariant/44362957127857', 'gid://shopify/Product/8058167787697', 'DarkYellow', NULL, 15, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugwhite.png?v=1720203455', '', 3),
('gid://shopify/ProductVariant/44376551227569', 'gid://shopify/Product/8062721458353', 'White', NULL, 19, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bottlewhite_fd186736-da4f-4357-9ebd-83c2cfdd272d.png?v=1720448231', '', 0),
('gid://shopify/ProductVariant/44376551260337', 'gid://shopify/Product/8062721458353', 'Black', NULL, 19, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bottlewhite_fd186736-da4f-4357-9ebd-83c2cfdd272d.png?v=1720448231', '', 1),
('gid://shopify/ProductVariant/44376551293105', 'gid://shopify/Product/8062721458353', 'DarkGreen', NULL, 19, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bottlewhite_fd186736-da4f-4357-9ebd-83c2cfdd272d.png?v=1720448231', '', 2),
('gid://shopify/ProductVariant/44376551325873', 'gid://shopify/Product/8062721458353', 'DarkBlue', NULL, 19, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bottlewhite_fd186736-da4f-4357-9ebd-83c2cfdd272d.png?v=1720448231', '', 3),
('gid://shopify/ProductVariant/44376551358641', 'gid://shopify/Product/8062721458353', 'DarkYellow', NULL, 19, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bottlewhite_fd186736-da4f-4357-9ebd-83c2cfdd272d.png?v=1720448231', '', 4),
('gid://shopify/ProductVariant/44376707039409', 'gid://shopify/Product/8062743281841', 'White', NULL, 15, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookwhite.png?v=1720450803', 'White', 0),
('gid://shopify/ProductVariant/44376707072177', 'gid://shopify/Product/8062743281841', 'Black', NULL, 15, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookwhite.png?v=1720450803', 'White', 1),
('gid://shopify/ProductVariant/44376707104945', 'gid://shopify/Product/8062743281841', 'DarkGreen', NULL, 15, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookwhite.png?v=1720450803', 'White', 2),
('gid://shopify/ProductVariant/44376603787441', 'gid://shopify/Product/8062743281841', 'DarkBlue', NULL, 15, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookwhite.png?v=1720450803', 'White', 3),
('gid://shopify/ProductVariant/44376707137713', 'gid://shopify/Product/8062743281841', 'DarkYellow', NULL, 15, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookwhite.png?v=1720450803', 'White', 4),
('gid://shopify/ProductVariant/44376959582385', 'gid://shopify/Product/8062864588977', 'White', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowwhite.png?v=1720454987', 'White', 0),
('gid://shopify/ProductVariant/44376959615153', 'gid://shopify/Product/8062864588977', 'Black', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowwhite.png?v=1720454987', 'White', 1),
('gid://shopify/ProductVariant/44376959647921', 'gid://shopify/Product/8062864588977', 'DarkGreen', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowwhite.png?v=1720454987', 'White', 2),
('gid://shopify/ProductVariant/44376959680689', 'gid://shopify/Product/8062864588977', 'DarkBlue', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowwhite.png?v=1720454987', 'White', 3),
('gid://shopify/ProductVariant/44376959713457', 'gid://shopify/Product/8062864588977', 'DarkYellow', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowwhite.png?v=1720454987', 'White', 4)
ON CONFLICT (variant_id) DO NOTHING;

INSERT INTO variant_options (variant_id, name, value, position) VALUES
('gid://shopify/ProductVariant/44073326837937', 'Title', 'Default Title', 0),
('gid://shopify/ProductVariant/44073370648753', 'Title', 'Default Title', 0),
('gid://shopify/ProductVariant/44073376186545', 'Title', 'Default Title', 0),
('gid://shopify/ProductVariant/44387181199537', 'Color', 'White', 0),
('gid://shopify/ProductVariant/44388190257329', 'Color', 'White', 0),
('gid://shopify/ProductVariant/44387173269681', 'Color', 'White', 0),
('gid://shopify/ProductVariant/44362957095089', 'Color', 'White', 0),
('gid://shopify/ProductVariant/44362957160625', 'Color', 'DarkGreen', 0),
('gid://shopify/ProductVariant/44362957193393', 'Color', 'DarkBlue', 0),
('gid://shopify/ProductVariant/44362957127857', 'Color', 'DarkYellow', 0),
('gid://shopify/ProductVariant/44376551227569', 'Color', 'White', 0),
('gid://shopify/ProductVariant/44376551260337', 'Color', 'Black', 0),
('gid://shopify/ProductVariant/44376551293105', 'Color', 'DarkGreen', 0),
('gid://shopify/ProductVariant/44376551325873', 'Color', 'DarkBlue', 0),
('gid://shopify/ProductVariant/44376551358641', 'Color', 'DarkYellow', 0),
('gid://shopify/ProductVariant/44376707039409', 'Color', 'White', 0),
('gid://shopify/ProductVariant/44376707072177', 'Color', 'Black', 0),
('gid://shopify/ProductVariant/44376707104945', 'Color', 'DarkGreen', 0),
('gid://shopify/ProductVariant/44376603787441', 'Color', 'DarkBlue', 0),
('gid://shopify/ProductVariant/44376707137713', 'Color', 'DarkYellow', 0),
('gid://shopify/ProductVariant/44376959582385', 'Cover color', 'White', 0),
('gid://shopify/ProductVariant/44376959615153', 'Cover color', 'Black', 0),
('gid://shopify/ProductVariant/44376959647921', 'Cover color', 'DarkGreen', 0),
('gid://shopify/ProductVariant/44376959680689', 'Cover color', 'DarkBlue', 0),
('gid://shopify/ProductVariant/44376959713457', 'Cover color', 'DarkYellow', 0);

