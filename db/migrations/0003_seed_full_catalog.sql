-- Catálogo completo da loja.
--
-- GERADO por scripts/generate-catalog-migration.ts — não edite à mão.
-- Para atualizar: `npm run catalog:generate`, que cria a PRÓXIMA migration.
-- Nunca reescreva uma migration já aplicada; ela não roda de novo, só faz os
-- bancos divergirem.
--
-- Fonte: Shopify Storefront API da loja `gimenesdevstore` (a mesma que o app
-- Shopify consulta em runtime). São os produtos REAIS da loja — ids, handles,
-- preços e URLs de imagem de verdade —, então a vitrine fica idêntica à que o
-- Shopify serviria.
--
-- 58 produtos, 289 variantes, 184 imagens, 76 tags/coleções, 500 opções.

DELETE FROM variant_options WHERE variant_id IN (
  SELECT variant_id FROM variants WHERE product_group_id LIKE 'gid://shopify/%'
);
DELETE FROM variants       WHERE product_group_id LIKE 'gid://shopify/%';
DELETE FROM product_props  WHERE product_group_id LIKE 'gid://shopify/%';
DELETE FROM product_images WHERE product_group_id LIKE 'gid://shopify/%';
DELETE FROM products       WHERE product_group_id LIKE 'gid://shopify/%';

-- 58 produtos
INSERT INTO products (product_group_id, handle, title, description, description_html, vendor, product_type, created_at, currency_code, position) VALUES
  ('gid://shopify/Product/7947981127857', 'code-deco', 'Code Deco Sticker', 'Unlock the charm of coding with our Code Deco Sticker! Featuring the iconic ''Code Deco'' emblem, this sticker is more than just a decal—it''s a symbol of innovation and creativity. Stick it proudly on your laptop, notebook, or anywhere you want to showcase your coding prowess and love for Deco.cx. Let your tech gear shine with the flair of our Code Deco Sticker!', '<p><meta charset="utf-8"><span>Unlock the charm of coding with our Code Deco Sticker! Featuring the iconic ''Code Deco'' emblem, this sticker is more than just a decal—it''s a symbol of innovation and creativity. Stick it proudly on your laptop, notebook, or anywhere you want to showcase your coding prowess and love for Deco.cx. Let your tech gear shine with the flair of our Code Deco Sticker!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-16T22:59:41Z', 'BRL', 0),
  ('gid://shopify/Product/7948021399729', 'cookie-capy-monster', 'Cookie Capy Monster', 'Meet your coding companion, the Cookie Capy Monster Plushie! With its irresistibly adorable capybara design and insatiable appetite for cookies, this plushie brings a whole new level of sweetness to your coding adventures. Whether you''re debugging a pesky bug or celebrating a successful deployment, this lovable plushie is always by your side, ready to offer cuddles and smiles. Embrace the coding cuteness with your very own Cookie Capy Monster!', '<p><meta charset="utf-8"><span>Meet your coding companion, the Cookie Capy Monster Plushie! With its irresistibly adorable capybara design and insatiable appetite for cookies, this plushie brings a whole new level of sweetness to your coding adventures. Whether you''re debugging a pesky bug or celebrating a successful deployment, this lovable plushie is always by your side, ready to offer cuddles and smiles. Embrace the coding cuteness with your very own Cookie Capy Monster!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-16T23:53:11Z', 'BRL', 1),
  ('gid://shopify/Product/7948021825713', 'd', 'D-Lightful Deco Sticker', 'Add a touch of D-light to your tech gear with our D-Lightful Deco Sticker! Featuring the iconic ''D'' emblem of Deco.cx, this sticker is more than just a sticker—it''s a symbol of innovation and creativity. Stick it on your laptop, notebook, or any surface that needs a dose of Deco charm. Let your tech shine bright with this D-Lightful addition to your collection!', '<p><meta charset="utf-8"><span>Add a touch of D-light to your tech gear with our D-Lightful Deco Sticker! Featuring the iconic ''D'' emblem of Deco.cx, this sticker is more than just a sticker—it''s a symbol of innovation and creativity. Stick it on your laptop, notebook, or any surface that needs a dose of Deco charm. Let your tech shine bright with this D-Lightful addition to your collection!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-16T23:54:17Z', 'BRL', 2),
  ('gid://shopify/Product/7948024381617', 'deco', 'Deco Delights Sticker Pack', 'Spruce up your tech gear with our Deco Delights Sticker Pack! Bursting with quirky designs and tech-inspired humor, these stickers are a must-have for any coding connoisseur. From witty puns to whimsical illustrations, each sticker adds a touch of personality to your laptop, water bottle, or workspace. Stick ''em, peel ''em, and let your tech shine with a dash of Deco flair!', '<p><meta charset="utf-8"><span>Spruce up your tech gear with our Deco Delights Sticker Pack! Bursting with quirky designs and tech-inspired humor, these stickers are a must-have for any coding connoisseur. From witty puns to whimsical illustrations, each sticker adds a touch of personality to your laptop, water bottle, or workspace. Stick ''em, peel ''em, and let your tech shine with a dash of Deco flair!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-16T23:59:53Z', 'BRL', 3),
  ('gid://shopify/Product/7948024742065', 'developer-community', 'Developer Community Sticker', 'Join the tribe of tech titans with our Developer Community Sticker! This sticker isn''t just a decal; it''s a badge of honor for those who thrive in the world of ones and zeros. Stick it proudly on your laptop, notebook, or anywhere you want to proclaim your allegiance to the global developer community. Let your tech gear be a beacon of unity and innovation with our Developer Community Sticker!', '<p><meta charset="utf-8"><span>Join the tribe of tech titans with our Developer Community Sticker! This sticker isn''t just a decal; it''s a badge of honor for those who thrive in the world of ones and zeros. Stick it proudly on your laptop, notebook, or anywhere you want to proclaim your allegiance to the global developer community. Let your tech gear be a beacon of unity and innovation with our Developer Community Sticker!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T00:00:52Z', 'BRL', 4),
  ('gid://shopify/Product/7948026118321', 'deco-cx', 'Deco.cx Sticker', 'Declare your allegiance to innovation with our Deco.cx Sticker! Featuring the iconic ''Deco.cx'' logo, this sticker is more than just a decal—it''s a bold statement of your dedication to cutting-edge web development. Stick it proudly on your laptop, notebook, or anywhere you want to showcase your love for Deco.cx. Let your tech gear speak volumes with the unmistakable flair of our Deco.cx Sticker!', '<p><meta charset="utf-8"><span>Declare your allegiance to innovation with our Deco.cx Sticker! Featuring the iconic ''Deco.cx'' logo, this sticker is more than just a decal—it''s a bold statement of your dedication to cutting-edge web development. Stick it proudly on your laptop, notebook, or anywhere you want to showcase your love for Deco.cx. Let your tech gear speak volumes with the unmistakable flair of our Deco.cx Sticker!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T00:04:09Z', 'BRL', 5),
  ('gid://shopify/Product/7948026314929', 'deco-inside', 'Deco Inside Sticker', 'Peel back the curtain and reveal the inner workings of Deco.cx with our Deco Inside Sticker! This sticker isn''t just a piece of flair; it''s a window into the world of Deco. Stick it proudly on your laptop, water bottle, or anywhere you want to show off your Deco pride. With its sleek design and tech-inspired aesthetic, it''s the perfect accessory for any true Deco enthusiast.', '<p><meta charset="utf-8"><span>Peel back the curtain and reveal the inner workings of Deco.cx with our Deco Inside Sticker! This sticker isn''t just a piece of flair; it''s a window into the world of Deco. Stick it proudly on your laptop, water bottle, or anywhere you want to show off your Deco pride. With its sleek design and tech-inspired aesthetic, it''s the perfect accessory for any true Deco enthusiast.</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T00:04:41Z', 'BRL', 6),
  ('gid://shopify/Product/7948026544305', 'deco-rainbow', 'Deco Rainbow Sticker', 'Add a splash of color to your tech gear with our Deco Rainbow Sticker! Featuring a vibrant rainbow design infused with the spirit of Deco.cx, this sticker is more than just a decal—it''s a symbol of diversity, creativity, and innovation. Stick it proudly on your laptop, notebook, or any surface that needs a pop of color and a touch of Deco magic. Let your tech shine bright with the rainbow flair of our Deco Rainbow Sticker!', '<p><meta charset="utf-8"><span>Add a splash of color to your tech gear with our Deco Rainbow Sticker! Featuring a vibrant rainbow design infused with the spirit of Deco.cx, this sticker is more than just a decal—it''s a symbol of diversity, creativity, and innovation. Stick it proudly on your laptop, notebook, or any surface that needs a pop of color and a touch of Deco magic. Let your tech shine bright with the rainbow flair of our Deco Rainbow Sticker!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T00:05:11Z', 'BRL', 7),
  ('gid://shopify/Product/7948026740913', 'developers-developers-developers', 'Developers Developers Developers Sticker', 'Channel the spirit of tech enthusiasm with our Developers Developers Developers Sticker! Inspired by the legendary chant, this sticker encapsulates the passion and energy of the coding community. Stick it proudly on your laptop, notebook, or any surface, and let the world know that you''re a developer on a mission. With each peel, you''re not just adding a sticker—you''re unleashing a wave of coding fervor!', '<p><meta charset="utf-8"><span>Channel the spirit of tech enthusiasm with our Developers Developers Developers Sticker! Inspired by the legendary chant, this sticker encapsulates the passion and energy of the coding community. Stick it proudly on your laptop, notebook, or any surface, and let the world know that you''re a developer on a mission. With each peel, you''re not just adding a sticker—you''re unleashing a wave of coding fervor!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T00:05:40Z', 'BRL', 8),
  ('gid://shopify/Product/7948027297969', 'get-side-done', 'Get Site Done Sticker', 'Boost your productivity with our Get Site Done Sticker! Inspired by the mantra of efficiency, this sticker is more than just a decal—it''s a call to action for developers on a mission. Stick it proudly on your laptop, notebook, or any surface that needs a reminder to stay focused and get things done. Let this sticker be your daily dose of motivation as you conquer your coding challenges and achieve greatness!', '<p><meta charset="utf-8"><span>Boost your productivity with our Get Site Done Sticker! Inspired by the mantra of efficiency, this sticker is more than just a decal—it''s a call to action for developers on a mission. Stick it proudly on your laptop, notebook, or any surface that needs a reminder to stay focused and get things done. Let this sticker be your daily dose of motivation as you conquer your coding challenges and achieve greatness!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T00:06:44Z', 'BRL', 9),
  ('gid://shopify/Product/7948027461809', 'give-me-a-br', 'Give Me a br Sticker', 'Indicate your temporary coding hiatus with our Give Me a br Sticker! Whether you''re grabbing a coffee or taking a quick stretch break, this sticker lets your fellow developers know that you''ll be right back to conquer more code. Stick it on your laptop, desk, or anywhere you need to announce your coding pause with style. Keep calm and code on!', '<p><meta charset="utf-8"><span>Indicate your temporary coding hiatus with our Give Me a br Sticker! Whether you''re grabbing a coffee or taking a quick stretch break, this sticker lets your fellow developers know that you''ll be right back to conquer more code. Stick it on your laptop, desk, or anywhere you need to announce your coding pause with style. Keep calm and code on!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T00:07:20Z', 'BRL', 10),
  ('gid://shopify/Product/7948027658417', 'i-center-divs', 'Div Centering Master Sticker', 'Show off your div centering skills with our ''I Center Divs'' Sticker! Perfect for web developers who know the importance of perfectly aligned elements, this sticker is a badge of honor for those who master the art of CSS. Stick it proudly on your laptop, notebook, or anywhere you want to showcase your prowess in the world of web design. Let your fellow devs know that you''re the go-to guru for all things div alignment!', '<p><meta charset="utf-8"><span>Show off your div centering skills with our ''I Center Divs'' Sticker! Perfect for web developers who know the importance of perfectly aligned elements, this sticker is a badge of honor for those who master the art of CSS. Stick it proudly on your laptop, notebook, or anywhere you want to showcase your prowess in the world of web design. Let your fellow devs know that you''re the go-to guru for all things div alignment!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T00:08:00Z', 'BRL', 11),
  ('gid://shopify/Product/7948027920561', 'id-rather-be-coding', 'I''d Rather Be Coding Sticker', 'Express your love for coding with our ''I''d Rather Be Coding'' Sticker! Whether you''re stuck in traffic or waiting in line, this sticker lets everyone know where your heart truly lies—behind a keyboard, writing lines of code. Stick it proudly on your laptop, water bottle, or anywhere you need a reminder of your true passion. Embrace the coding life with this playful declaration of devotion!', '<p><meta charset="utf-8"><span>Express your love for coding with our ''I''d Rather Be Coding'' Sticker! Whether you''re stuck in traffic or waiting in line, this sticker lets everyone know where your heart truly lies—behind a keyboard, writing lines of code. Stick it proudly on your laptop, water bottle, or anywhere you need a reminder of your true passion. Embrace the coding life with this playful declaration of devotion!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T00:08:42Z', 'BRL', 12),
  ('gid://shopify/Product/7948028215473', 'its-not-a-bug', 'It''s Not a Bug, It''s a Feature Sticker', 'Embrace the quirks of coding with our ''It''s Not a Bug, It''s a Feature'' Sticker! Perfect for those moments when your code behaves unexpectedly but you decide to roll with it and call it a feature instead. Stick it proudly on your laptop, notebook, or anywhere you want to add a touch of humor to your tech gear. Let this sticker be a playful reminder that sometimes the best solutions come from unexpected sources!', '<p><meta charset="utf-8"><span>Embrace the quirks of coding with our ''It''s Not a Bug, It''s a Feature'' Sticker! Perfect for those moments when your code behaves unexpectedly but you decide to roll with it and call it a feature instead. Stick it proudly on your laptop, notebook, or anywhere you want to add a touch of humor to your tech gear. Let this sticker be a playful reminder that sometimes the best solutions come from unexpected sources!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T00:09:17Z', 'BRL', 13),
  ('gid://shopify/Product/7948028412081', 'it-works', 'It Works Sticker', 'Celebrate your coding victories with our ''It Works'' Sticker! Perfect for those moments when your code finally compiles, your bug fix works like a charm, or your project comes together seamlessly. Stick it proudly on your laptop, notebook, or anywhere you want to commemorate your triumphs in the world of coding. Let this sticker be a reminder that with perseverance and problem-solving, anything is possible in the realm of programming!', '<p><meta charset="utf-8"><span>Celebrate your coding victories with our ''It Works'' Sticker! Perfect for those moments when your code finally compiles, your bug fix works like a charm, or your project comes together seamlessly. Stick it proudly on your laptop, notebook, or anywhere you want to commemorate your triumphs in the world of coding. Let this sticker be a reminder that with perseverance and problem-solving, anything is possible in the realm of programming!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T00:09:50Z', 'BRL', 14),
  ('gid://shopify/Product/7948028706993', 'judging-cwv', 'CWV Champion Sticker', 'Celebrate your commitment to Core Web Vitals with our CWV Champion Sticker! Perfect for developers dedicated to optimizing user experience and performance, this sticker is a badge of honor for those who prioritize website speed and responsiveness. Stick it proudly on your laptop, notebook, or anywhere you want to showcase your dedication to crafting top-notch digital experiences. Let this sticker be a symbol of your commitment to excellence in web development!', '<p><meta charset="utf-8"><span>Celebrate your commitment to Core Web Vitals with our CWV Champion Sticker! Perfect for developers dedicated to optimizing user experience and performance, this sticker is a badge of honor for those who prioritize website speed and responsiveness. Stick it proudly on your laptop, notebook, or anywhere you want to showcase your dedication to crafting top-notch digital experiences. Let this sticker be a symbol of your commitment to excellence in web development!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T00:10:34Z', 'BRL', 15),
  ('gid://shopify/Product/7948029034673', 'tech-stack', 'Tech Stack Warrior Sticker', 'Declare your allegiance to your tech stack with our Tech Stack Warrior Sticker! Whether you''re a master of JSX, a wizard with TailwindCSS, or a TypeScript titan, this sticker celebrates your expertise in your chosen tools. Stick it proudly on your laptop, notebook, or anywhere you want to showcase your dedication to your tech stack. Let this sticker be a symbol of your prowess in the world of web development!', '<p><meta charset="utf-8"><span>Declare your allegiance to your tech stack with our Tech Stack Warrior Sticker! Whether you''re a master of JSX, a wizard with TailwindCSS, or a TypeScript titan, this sticker celebrates your expertise in your chosen tools. Stick it proudly on your laptop, notebook, or anywhere you want to showcase your dedication to your tech stack. Let this sticker be a symbol of your prowess in the world of web development!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T00:11:17Z', 'BRL', 16),
  ('gid://shopify/Product/7948043649201', 'the-syntax-scribbler-notebook', 'The Syntax Scribbler Notebook', 'Unlock your creative potential with The Syntax Scribbler Notebook! Perfect for capturing code snippets, sketching algorithms, or jotting down those lightbulb moments that strike between sprints. This notebook is designed with developers in mind, featuring a sleek design inspired by JSX, TailwindCSS, and Typescript. Whether you''re debugging or brainstorming, it''s the ultimate companion for turning your ideas into reality. Get ready to script your success!', '<p><meta charset="utf-8"><span>Unlock your creative potential with The Syntax Scribbler Notebook! Perfect for capturing code snippets, sketching algorithms, or jotting down those lightbulb moments that strike between sprints. This notebook is designed with developers in mind, featuring a sleek design inspired by JSX, TailwindCSS, and Typescript. Whether you''re debugging or brainstorming, it''s the ultimate companion for turning your ideas into reality. Get ready to script your success!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T00:50:41Z', 'BRL', 17),
  ('gid://shopify/Product/7948045648049', 'dev-mode-tee', 'Dev Mode Tee', 'Keep it simple and stylish with the Dev Mode Tee. Perfect for coding marathons or casual meetups, this shirt blends comfort with a minimalist design. Show off your tech passion effortlessly.', '<p><meta charset="utf-8"><span>Keep it simple and stylish with the Dev Mode Tee. Perfect for coding marathons or casual meetups, this shirt blends comfort with a minimalist design. Show off your tech passion effortlessly.</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T00:56:47Z', 'BRL', 18),
  ('gid://shopify/Product/7948053151921', 'the-future-of-web-dev-sweatshirt', 'The Future of Web Dev Sweatshirt', 'Embrace innovation with The Future of Web Dev Sweatshirt. Cozy, stylish, and perfect for any coding session, this sweatshirt showcases your commitment to the cutting-edge world of web development. Stay warm, stay ahead, and let everyone know you''re building the future, one line of code at a time.', '<p><meta charset="utf-8"><span>Embrace innovation with The Future of Web Dev Sweatshirt. Cozy, stylish, and perfect for any coding session, this sweatshirt showcases your commitment to the cutting-edge world of web development. Stay warm, stay ahead, and let everyone know you''re building the future, one line of code at a time.</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T01:09:04Z', 'BRL', 19),
  ('gid://shopify/Product/7948058198193', 'ctrl-shift-tote-bag', 'Ctrl+Shift+Tote Bag', 'Carry your code in style with the Ctrl+Shift+Tote Bag! Perfect for hauling your laptop, snacks, and a stack of coding books, this tote bag is a developer''s best friend. With enough room for all your essentials and a witty design that''ll make your fellow devs chuckle, it''s the ultimate accessory for any coding adventure. Just remember: when in doubt, Ctrl+Shift+Tote!', '<p><meta charset="utf-8"><span>Carry your code in style with the Ctrl+Shift+Tote Bag! Perfect for hauling your laptop, snacks, and a stack of coding books, this tote bag is a developer''s best friend. With enough room for all your essentials and a witty design that''ll make your fellow devs chuckle, it''s the ultimate accessory for any coding adventure. Just remember: when in doubt, Ctrl+Shift+Tote!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T01:12:00Z', 'BRL', 20),
  ('gid://shopify/Product/7948059082929', 'code-wizard-hat', 'Code Wizard Hat', 'Step into the realm of coding magic with the Code Wizard Hat! This enchanting accessory is not your ordinary headgear; it''s a symbol of your mastery over the digital realm. Crafted with the finest fabric and imbued with developer humor, it''s perfect for shielding your eyes from the glare of your monitor or adding a touch of whimsy to your daily stand-ups. Wear it proudly, and let your inner code wizard shine!', '<p><meta charset="utf-8"><span>Step into the realm of coding magic with the Code Wizard Hat! This enchanting accessory is not your ordinary headgear; it''s a symbol of your mastery over the digital realm. Crafted with the finest fabric and imbued with developer humor, it''s perfect for shielding your eyes from the glare of your monitor or adding a touch of whimsy to your daily stand-ups. Wear it proudly, and let your inner code wizard shine!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T01:13:11Z', 'BRL', 21),
  ('gid://shopify/Product/7948060065969', 'code-commando-backpack', 'Code Commando Backpack', 'Gear up like a true coding commando with our Code Commando Backpack! This rugged yet stylish backpack is designed to carry all your coding essentials, from laptops to snacks and everything in between. With its sleek design and tech-inspired details, it''s the perfect companion for your coding missions. Whether you''re hacking away at the office or venturing into the digital wilderness, this backpack has your back, literally! So sling it on, and let''s code like pros!', '<p><meta charset="utf-8"><span>Gear up like a true coding commando with our Code Commando Backpack! This rugged yet stylish backpack is designed to carry all your coding essentials, from laptops to snacks and everything in between. With its sleek design and tech-inspired details, it''s the perfect companion for your coding missions. Whether you''re hacking away at the office or venturing into the digital wilderness, this backpack has your back, literally! So sling it on, and let''s code like pros!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T01:14:12Z', 'BRL', 22),
  ('gid://shopify/Product/7948061180081', 'pixel-perfection-pen', 'Pixel Perfection Pen', 'Unlock your creativity with the Pixel Perfection Pen! Crafted for developers who believe every line of code is a work of art, this sleek pen is more than just a writing instrument—it''s a tool for bringing your digital dreams to life. Whether you''re sketching wireframes, jotting down algorithms, or signing off on your latest masterpiece, the Pixel Perfection Pen ensures your ideas flow smoothly onto the canvas of the digital world. So grab hold of your creativity and let your code be as precise as your strokes!', '<p><meta charset="utf-8"><span>Unlock your creativity with the Pixel Perfection Pen! Crafted for developers who believe every line of code is a work of art, this sleek pen is more than just a writing instrument—it''s a tool for bringing your digital dreams to life. Whether you''re sketching wireframes, jotting down algorithms, or signing off on your latest masterpiece, the Pixel Perfection Pen ensures your ideas flow smoothly onto the canvas of the digital world. So grab hold of your creativity and let your code be as precise as your strokes!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T01:15:06Z', 'BRL', 23),
  ('gid://shopify/Product/7948063244465', 'capy-coding-companion', 'Capy Coding Companion', 'Introducing your ultimate coding companion, the Capy Coding Companion! This stuffed capybara isn''t just cute—it''s also your partner in programming crime. Whether you''re tackling tough algorithms or debugging like a pro, this plush pal is here to keep you company and provide endless cuddles. So snuggle up, grab your keyboard, and let''s code away with our favorite fluffy friend by our side!', '<p><meta charset="utf-8"><span>Introducing your ultimate coding companion, the Capy Coding Companion! This stuffed capybara isn''t just cute—it''s also your partner in programming crime. Whether you''re tackling tough algorithms or debugging like a pro, this plush pal is here to keep you company and provide endless cuddles. So snuggle up, grab your keyboard, and let''s code away with our favorite fluffy friend by our side!</span></p>
<!---->', 'gimenesdevstore', '', '2024-05-17T01:17:27Z', 'BRL', 24),
  ('gid://shopify/Product/8017994252465', 'eco-raglan-hoodie', 'Eco Raglan Hoodie', 'Unisex Raglan Hoodie: The Perfect Addition to Your Wardrobe Hoodies have become a staple in the fashion world and, with the right accessories, can be styled for almost any occasion. Now is the perfect time to add the Unisex Raglan Hoodie to your store. It''s incredibly soft, comfortable, and features a brushed lining. Available in a range of rich, classic colors, you can choose the ones that best fit your store''s aesthetic or offer them all! Composition:- Exterior: 100% organic cotton- Charcoal Melange: 60% cotton, 40% recycled polyester- Interior (all colors): 80% organic cotton, 20% recycled polyester Features:- Fabric weight: 8.3 oz/yd² (280 g/m²)- Charcoal Melange fabric weight: 10.3 oz/yd² (348 g/m²)- Brushed lining- Regular fit- Raglan sleeves- Ribbed cuffs and hem- Neck tape- Drawstrings with metal eyelets and stoppers- Jersey-lined hood Certifications:- GRS (Global Recycled Standard)- OCS (Organic Content Standard)- GOTS (Global Organic Textile Standard)- OEKO-TEX Standard 100- PETA-Approved Vegan Blank product sourced from Bangladesh.', '<p>Unisex Raglan Hoodie: The Perfect Addition to Your Wardrobe</p>
<p>Hoodies have become a staple in the fashion world and, with the right accessories, can be styled for almost any occasion. Now is the perfect time to add the Unisex Raglan Hoodie to your store. It''s incredibly soft, comfortable, and features a brushed lining. Available in a range of rich, classic colors, you can choose the ones that best fit your store''s aesthetic or offer them all!</p>
<p>Composition:<br>- Exterior: 100% organic cotton<br>- Charcoal Melange: 60% cotton, 40% recycled polyester<br>- Interior (all colors): 80% organic cotton, 20% recycled polyester</p>
<p>Features:<br>- Fabric weight: 8.3 oz/yd² (280 g/m²)<br>- Charcoal Melange fabric weight: 10.3 oz/yd² (348 g/m²)<br>- Brushed lining<br>- Regular fit<br>- Raglan sleeves<br>- Ribbed cuffs and hem<br>- Neck tape<br>- Drawstrings with metal eyelets and stoppers<br>- Jersey-lined hood</p>
<p>Certifications:<br>- GRS (Global Recycled Standard)<br>- OCS (Organic Content Standard)<br>- GOTS (Global Organic Textile Standard)<br>- OEKO-TEX Standard 100<br>- PETA-Approved Vegan</p>
<p>Blank product sourced from Bangladesh.</p>
<!---->', 'gimenesdevstore', '', '2024-06-14T14:23:12Z', 'BRL', 25),
  ('gid://shopify/Product/8017999659185', 'minimalist-backpack', 'Minimalist Backpack', 'Introducing the All-Over Print Minimalist Backpack: The Perfect Companion for People on the Go! Designed for those with an active lifestyle, this spacious backpack is crafted from water-resistant material, making it ideal for any adventure. Customize your own All-Over Print Minimalist Backpack and enjoy its practical features, including a large inside pocket for a laptop and a hidden pocket to keep valuable items secure and accessible during travel. Specifications:- Material: 100% polyester- Fabric weight: 9.56 oz./yd.² (325 g/m²), weight may vary by 5%- Dimensions: 16.1″ (41 cm) height, 12.2″ (31 cm) width, 5.5″ (14 cm) diameter- Capacity: 5.3 gallons (20 liters)- Max weight: 44 lbs (20 kg)- Water-resistant material Features:- Large inside pocket with a separate compartment for a 15″ laptop- Hidden pocket with zipper on the back of the bag- Top zipper with 2 sliders and zipper pulls- Silky lining, piped inside hems, and a soft mesh back- Padded ergonomic bag straps made from polyester- Printed, cut, and hand-sewn by our expert in-house team Certifications:- Download CPSIA compliance certificates- Download the fabric safety test certificate Blank product components are sourced from China.Product code: #601A This accessory is made on demand with no minimum order requirements.', '<p>Introducing the All-Over Print Minimalist Backpack: The Perfect Companion for People on the Go!</p>
<p>Designed for those with an active lifestyle, this spacious backpack is crafted from water-resistant material, making it ideal for any adventure. Customize your own All-Over Print Minimalist Backpack and enjoy its practical features, including a large inside pocket for a laptop and a hidden pocket to keep valuable items secure and accessible during travel.</p>
<p>Specifications:<br>- Material: 100% polyester<br>- Fabric weight: 9.56 oz./yd.² (325 g/m²), weight may vary by 5%<br>- Dimensions: 16.1″ (41 cm) height, 12.2″ (31 cm) width, 5.5″ (14 cm) diameter<br>- Capacity: 5.3 gallons (20 liters)<br>- Max weight: 44 lbs (20 kg)<br>- Water-resistant material</p>
<p>Features:<br>- Large inside pocket with a separate compartment for a 15″ laptop<br>- Hidden pocket with zipper on the back of the bag<br>- Top zipper with 2 sliders and zipper pulls<br>- Silky lining, piped inside hems, and a soft mesh back<br>- Padded ergonomic bag straps made from polyester<br>- Printed, cut, and hand-sewn by our expert in-house team</p>
<p>Certifications:<br>- Download CPSIA compliance certificates<br>- Download the fabric safety test certificate</p>
<p>Blank product components are sourced from China.<br>Product code: #601A</p>
<p>This accessory is made on demand with no minimum order requirements.</p>
<!---->', 'gimenesdevstore', '', '2024-06-14T14:33:28Z', 'BRL', 26),
  ('gid://shopify/Product/8018004148401', 'organic-bucket-hat', 'Organic Bucket Hat', 'The Organic Bucket Hat is your go-to accessory for sun protection and style. This premium-quality hat, available in trendy earth tones, is crafted from breathable material and features clean stitching, ensuring it’s both functional and fashionable. Whether for personal use or to offer to your customers, this summer essential is a must-have! Features: 100% organic cotton twill Classic brim High profile One size fits most Certifications: Fabric certified by GOTS (Global Organic Textile Standard) OEKO-TEX Standard 100 certified Details: Blank product sourced from China Learn more about eco-friendly product certificates in our FAQ article! This accessory is made on demand with no minimum order requirements.', '<p>The Organic Bucket Hat is your go-to accessory for sun protection and style. This premium-quality hat, available in trendy earth tones, is crafted from breathable material and features clean stitching, ensuring it’s both functional and fashionable. Whether for personal use or to offer to your customers, this summer essential is a must-have!</p>
<p><strong>Features:</strong></p>
<ul>
<li>100% organic cotton twill</li>
<li>Classic brim</li>
<li>High profile</li>
<li>One size fits most</li>
</ul>
<p><strong>Certifications:</strong></p>
<ul>
<li>Fabric certified by GOTS (Global Organic Textile Standard)</li>
<li>OEKO-TEX Standard 100 certified</li>
</ul>
<p><strong>Details:</strong></p>
<ul>
<li>Blank product sourced from China</li>
<li>Learn more about eco-friendly product certificates in our FAQ article!</li>
</ul>
<p>This accessory is made on demand with no minimum order requirements.</p>
<!---->', 'gimenesdevstore', '', '2024-06-14T14:41:05Z', 'BRL', 27),
  ('gid://shopify/Product/8018011291825', 'high-top-canvas-shoes', 'High Top Canvas Shoes', 'Shoes might be at the bottom of our outfits, but they often steal all the attention. Introducing the High Top Canvas Shoes, printed, cut, and handmade to bring a classic, old-school vibe to any look. These shoes can be the "cherry on top" of your customers'' outfits. Make your brand stand out by placing your logo on the box, insole, and tongue of the shoe. Expand your store''s offerings with this uniquely designed footwear! Features:- 100% polyester canvas upper side- Ethylene-vinyl acetate (EVA) rubber outsole- Breathable lining- Faux leather toe cap- Removable insole- Padded collar, lace-up front Details:- Blank product sourced from China Disclaimers:- Availability is limited to select countries. Ensure customers are aware of any shipping restrictions.- The branded shoebox serves as the primary packaging; dents and scratches may occur.- A strong glue smell is typical upon arrival; allow shoes to air out for a few days to eliminate the odor.- Shoes are set to US sizes by default. Refer to our size guide for international sizing. This product is manufactured on demand with no minimum order requirements.', '<p>Shoes might be at the bottom of our outfits, but they often steal all the attention. Introducing the High Top Canvas Shoes, printed, cut, and handmade to bring a classic, old-school vibe to any look. These shoes can be the "cherry on top" of your customers'' outfits. Make your brand stand out by placing your logo on the box, insole, and tongue of the shoe. Expand your store''s offerings with this uniquely designed footwear!</p>
<p><strong>Features:</strong><br>- 100% polyester canvas upper side<br>- Ethylene-vinyl acetate (EVA) rubber outsole<br>- Breathable lining<br>- Faux leather toe cap<br>- Removable insole<br>- Padded collar, lace-up front</p>
<p><strong>Details:</strong><br>- Blank product sourced from China</p>
<p><strong>Disclaimers</strong>:<br>- Availability is limited to select countries. Ensure customers are aware of any shipping restrictions.<br>- The branded shoebox serves as the primary packaging; dents and scratches may occur.<br>- A strong glue smell is typical upon arrival; allow shoes to air out for a few days to eliminate the odor.<br>- Shoes are set to US sizes by default. Refer to our size guide for international sizing.</p>
<p>This product is manufactured on demand with no minimum order requirements.</p>
<!---->', 'gimenesdevstore', '', '2024-06-14T14:52:19Z', 'BRL', 28),
  ('gid://shopify/Product/8028434006193', 'high-top-canvas-shoes-1', 'Women''s Slides', 'Footwear can elevate any outfit, whether it''s a perfect match or a bold contrast. Offer your customers the chance to discover their ideal pair by creating your own line of branded shoes! Our handmade High Top Canvas Shoes exude a vintage charm and are the perfect finishing touch for a variety of fashion styles. Expand your product range and present your vision of the ideal shoe to your customers. 100% polyester canvas upper EVA rubber outsole for comfort and durability Customizable branding on the box, insole, and shoe tongue Faux leather toe cap for added style Removable insole for convenience Padded collar and lace-up front for a secure fit Sourced from China Important Notes: This product is available in select countries only. Make sure to inform your customers about the shipping limitations on your online store. The shoes come packaged in a branded shoebox, which may show some dents and scratches. A noticeable glue odor may be present upon arrival. Allow the shoes to air out for a few days to eliminate the smell. Our shoes are initially sized according to US standards. Refer to our size guide to convert sizes for other regions. Each pair is made to order with no minimum quantity required.', '<p>Footwear can elevate any outfit, whether it''s a perfect match or a bold contrast. Offer your customers the chance to discover their ideal pair by creating your own line of branded shoes! Our handmade High Top Canvas Shoes exude a vintage charm and are the perfect finishing touch for a variety of fashion styles. Expand your product range and present your vision of the ideal shoe to your customers.</p>
<ul>
<li>100% polyester canvas upper</li>
<li>EVA rubber outsole for comfort and durability</li>
<li>Customizable branding on the box, insole, and shoe tongue</li>
<li>Faux leather toe cap for added style</li>
<li>Removable insole for convenience</li>
<li>Padded collar and lace-up front for a secure fit</li>
<li>Sourced from China</li>
</ul>
<p><strong>Important Notes:</strong></p>
<ul>
<li>This product is available in select countries only. Make sure to inform your customers about the shipping limitations on your online store.</li>
<li>The shoes come packaged in a branded shoebox, which may show some dents and scratches.</li>
<li>A noticeable glue odor may be present upon arrival. Allow the shoes to air out for a few days to eliminate the smell.</li>
<li>Our shoes are initially sized according to US standards. Refer to our size guide to convert sizes for other regions.</li>
</ul>
<p>Each pair is made to order with no minimum quantity required.</p>
<!---->', 'gimenesdevstore', '', '2024-06-21T08:35:15Z', 'BRL', 29),
  ('gid://shopify/Product/8028449734833', 'snap-case-for-iphone®', 'Snap Case for iPhone®', 'Searching for a premium phone case to keep your device protected? Look no further! Our Snap Case for iPhone® combines a slim and lightweight design with a classy, minimalist aesthetic. This case is available with all-over print sublimation, ensuring your custom design looks top-notch. - Constructed from durable polycarbonate (PC) material- Compatible with wireless charging- Precisely aligned port openings for ease of use- Available in both matte and gloss finishes- Sourced from the Republic of Korea Important Notes: - Avoid exposing the case to liquids with high alcohol content, as this may cause the design to wear off. - Keep the case out of direct sunlight to prevent yellowing.- This product is available for shipping in the US, Canada, Europe, the UK, Australia, and New Zealand only. Please select an alternative product if shipping outside these regions. Ensure your customers are aware of this limitation if selling on your online store. Note: iPhone® is a trademark of Apple Inc., registered in the US and other countries and regions. This accessory is made on demand with no minimum order requirements.', '<p>Searching for a premium phone case to keep your device protected? Look no further! Our Snap Case for iPhone® combines a slim and lightweight design with a classy, minimalist aesthetic. This case is available with all-over print sublimation, ensuring your custom design looks top-notch.</p>
<p>- Constructed from durable polycarbonate (PC) material<br>- Compatible with wireless charging<br>- Precisely aligned port openings for ease of use<br>- Available in both matte and gloss finishes<br>- Sourced from the Republic of Korea</p>
<p><strong>Important Notes:</strong></p>
<p>- Avoid exposing the case to liquids with high alcohol content, as this may cause the design to wear off. <br>- Keep the case out of direct sunlight to prevent yellowing.<br>- This product is available for shipping in the US, Canada, Europe, the UK, Australia, and New Zealand only. Please select an alternative product if shipping outside these regions. Ensure your customers are aware of this limitation if selling on your online store.</p>
<p><strong>Note:</strong></p>
<p> iPhone® is a trademark of Apple Inc., registered in the US and other countries and regions.</p>
<p>This accessory is made on demand with no minimum order requirements.</p>
<!---->', 'gimenesdevstore', '', '2024-06-21T08:50:01Z', 'BRL', 30),
  ('gid://shopify/Product/8028458057905', 'eco-tote-bag-econscious', 'Eco Tote Bag | Econscious', 'Embrace the eco-friendly trend with style! Design your own artwork and feature it on this organic cotton twill tote bag. With a spacious print area and solid color, your design is sure to pop. This versatile tote is perfect for groceries, books, and much more. - Made from 100% certified organic cotton 3/1 twill- Fabric weight: 8 oz/yd² (272 g/m²)- Dimensions: 16″ × 14 ½″ × 5″ (40.6 cm × 35.6 cm × 12.7 cm)- Weight capacity: 30 lbs (13.6 kg)- Dual 1″ (2.5 cm) wide straps, 24.5″ (62.2 cm) in length- Open main compartment- Optional double-sided print available for an additional $5.95 (€5.25)- Certified by OCS (Organic Content Standard) and GOTS (Global Organic Textile Standard)- OEKO-TEX Standard 100 certified and PETA-Approved Vegan- Sourced from India Our organic cotton products are cultivated using organic compost and biological pest control, without synthetic substances or genetic modifications. For more information on eco-friendly certifications, check out our FAQ article! This accessory is made on demand with no minimum order requirements.', '<p>Embrace the eco-friendly trend with style! Design your own artwork and feature it on this organic cotton twill tote bag. With a spacious print area and solid color, your design is sure to pop. This versatile tote is perfect for groceries, books, and much more.</p>
<p>- Made from 100% certified organic cotton 3/1 twill<br>- Fabric weight: 8 oz/yd² (272 g/m²)<br>- Dimensions: 16″ × 14 ½″ × 5″ (40.6 cm × 35.6 cm × 12.7 cm)<br>- Weight capacity: 30 lbs (13.6 kg)<br>- Dual 1″ (2.5 cm) wide straps, 24.5″ (62.2 cm) in length<br>- Open main compartment<br>- Optional double-sided print available for an additional $5.95 (€5.25)<br>- Certified by OCS (Organic Content Standard) and GOTS (Global Organic Textile Standard)<br>- OEKO-TEX Standard 100 certified and PETA-Approved Vegan<br>- Sourced from India</p>
<p>Our organic cotton products are cultivated using organic compost and biological pest control, without synthetic substances or genetic modifications.</p>
<p>For more information on eco-friendly certifications, check out our FAQ article!</p>
<p>This accessory is made on demand with no minimum order requirements.</p>
<!---->', 'gimenesdevstore', '', '2024-06-21T09:00:35Z', 'BRL', 31),
  ('gid://shopify/Product/8028460482737', 'all-over-print-tote-bag', 'All-Over Print Tote Bag', 'This All-Over Print Tote Bag is a stylish and practical addition to anyone''s wardrobe. Featuring dual handles made from 100% natural cotton bull denim, it offers easy carrying and versatility. Whether you need to carry a laptop, notebook, or other daily essentials, this bag can handle it all with a weight capacity of up to 44 lbs. All it needs is your unique designs to become a bestseller in your online store! Made from 100% spun polyester fabric Fabric weight (US): 7.22 oz/yd² (245 g/m²) (may vary by 5%) Fabric weight (EU): 6.64 oz/yd² (225 g/m²) (may vary by 5%) Bag dimensions: 15″ × 15″ (38.1 × 38.1 cm) Capacity: 2.6 US gallons (10 liters) Maximum weight limit: 44 lbs (20 kg) Dual handles made of 100% natural cotton bull denim Handle length: 11.8″ (30 cm), width: 1″ (2.5 cm) Handle design may vary slightly based on fulfillment location Printed, cut, and hand-sewn by our in-house team Fabric is OEKO-TEX Standard 100 certified Blank product components sourced from Israel Product code: #603 This accessory is made on demand with no minimum order requirements.', '<p>This All-Over Print Tote Bag is a stylish and practical addition to anyone''s wardrobe. Featuring dual handles made from 100% natural cotton bull denim, it offers easy carrying and versatility. Whether you need to carry a laptop, notebook, or other daily essentials, this bag can handle it all with a weight capacity of up to 44 lbs. All it needs is your unique designs to become a bestseller in your online store!</p>
<ul>
<li>Made from 100% spun polyester fabric</li>
<li>Fabric weight (US): 7.22 oz/yd² (245 g/m²) (may vary by 5%)</li>
<li>Fabric weight (EU): 6.64 oz/yd² (225 g/m²) (may vary by 5%)</li>
<li>Bag dimensions: 15″ × 15″ (38.1 × 38.1 cm)</li>
<li>Capacity: 2.6 US gallons (10 liters)</li>
<li>Maximum weight limit: 44 lbs (20 kg)</li>
<li>Dual handles made of 100% natural cotton bull denim</li>
<li>Handle length: 11.8″ (30 cm), width: 1″ (2.5 cm)</li>
<li>Handle design may vary slightly based on fulfillment location</li>
<li>Printed, cut, and hand-sewn by our in-house team</li>
<li>Fabric is OEKO-TEX Standard 100 certified</li>
<li>Blank product components sourced from Israel</li>
<li>Product code: #603</li>
</ul>
<p>This accessory is made on demand with no minimum order requirements.</p>
<!---->', 'gimenesdevstore', '', '2024-06-21T09:04:10Z', 'BRL', 32),
  ('gid://shopify/Product/8028465987761', 'sublimation-flip-flops', 'Sublimation Flip Flops', 'Enhance your long summer days with these customizable flip flops. Featuring a comfortable rubber sole lined with soft polyester fabric, they are perfect for showcasing your vibrant prints. Let your creativity soar and design a pair of flip flops that embodies fun and adventure. - Durable rubber sole- Customizable 100% polyester fabric lining- Black Y-shaped rubber straps- Toe post style for a classic fit- Sourced from China This product is made on demand with no minimum order requirements.', '<p>Enhance your long summer days with these customizable flip flops. Featuring a comfortable rubber sole lined with soft polyester fabric, they are perfect for showcasing your vibrant prints. Let your creativity soar and design a pair of flip flops that embodies fun and adventure.</p>
<p>- Durable rubber sole<br>- Customizable 100% polyester fabric lining<br>- Black Y-shaped rubber straps<br>- Toe post style for a classic fit<br>- Sourced from China</p>
<p>This product is made on demand with no minimum order requirements.</p>
<!---->', 'gimenesdevstore', '', '2024-06-21T09:11:03Z', 'BRL', 33),
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
  ('gid://shopify/Product/8028479979697', 'all-over-print-bomber-jacket', 'All-Over Print Bomber Jacket', 'From runways to park strolls, layered looks are trending, and nothing adds more flair than a custom All-Over Print Unisex Bomber Jacket. This women''s jacket is a blank canvas, allowing you to design everything from the exterior to the fully customizable inside label. Prepare your designs and create a line of unique and stylish Bomber Jackets! - 100% polyester- Fabric weight (may vary by 5%): 6.49 oz/yd² (220 g/m²)- Brushed fleece interior for added comfort- Unisex fit- Overlock seams for durability- Sturdy neck tape- Silver YKK zipper- Two self-fabric pockets- Custom logo placement on the inside of the lower hem- Printed, cut, and hand-sewn by our skilled in-house team- OEKO-TEX Standard 100 certified fabric- Blank product components sourced from the US and China- Product code: #144 This product is made on demand with no minimum order requirements.', '<p>From runways to park strolls, layered looks are trending, and nothing adds more flair than a custom All-Over Print Unisex Bomber Jacket. This women''s jacket is a blank canvas, allowing you to design everything from the exterior to the fully customizable inside label. Prepare your designs and create a line of unique and stylish Bomber Jackets!</p>
<p>- 100% polyester<br>- Fabric weight (may vary by 5%): 6.49 oz/yd² (220 g/m²)<br>- Brushed fleece interior for added comfort<br>- Unisex fit<br>- Overlock seams for durability<br>- Sturdy neck tape<br>- Silver YKK zipper<br>- Two self-fabric pockets<br>- Custom logo placement on the inside of the lower hem<br>- Printed, cut, and hand-sewn by our skilled in-house team<br>- OEKO-TEX Standard 100 certified fabric<br>- Blank product components sourced from the US and China<br>- Product code: #144</p>
<p>This product is made on demand with no minimum order requirements.</p>
<!---->', 'gimenesdevstore', '', '2024-06-21T09:29:35Z', 'BRL', 36),
  ('gid://shopify/Product/8028483518641', 'premium-sweatshirt-cotton-heritage', 'Premium Sweatshirt | Cotton Heritage', 'This men''s Premium Sweatshirt features a classic crew neck, a flattering unisex fit, and a soft 100% cotton exterior. You can customize the front, sleeves, and labels of this pullover. Get creative and add this versatile piece to your store! - 100% cotton face- 65% cotton, 35% polyester blend- Charcoal Heather variant: 55% cotton, 45% polyester- Fabric weight: 8.5 oz/yd² (288.2 g/m²)- Tightly knit 3-end fleece- Side-seamed construction- Self-fabric patch on the back- Double-needle stitched rib collar, cuffs, and hem- Tear-away label- Blank product sourced from Pakistan **Disclaimer:** For legal reasons, this product includes a manufacturer''s side tag. The tag is discreet and will not compromise the integrity of your design. This product is made on demand with no minimum order requirements.', '<p>This men''s Premium Sweatshirt features a classic crew neck, a flattering unisex fit, and a soft 100% cotton exterior. You can customize the front, sleeves, and labels of this pullover. Get creative and add this versatile piece to your store!</p>
<p>- 100% cotton face<br>- 65% cotton, 35% polyester blend<br>- Charcoal Heather variant: 55% cotton, 45% polyester<br>- Fabric weight: 8.5 oz/yd² (288.2 g/m²)<br>- Tightly knit 3-end fleece<br>- Side-seamed construction<br>- Self-fabric patch on the back<br>- Double-needle stitched rib collar, cuffs, and hem<br>- Tear-away label<br>- Blank product sourced from Pakistan</p>
<p>**Disclaimer:** For legal reasons, this product includes a manufacturer''s side tag. The tag is discreet and will not compromise the integrity of your design.</p>
<p>This product is made on demand with no minimum order requirements.</p>
<!---->', 'gimenesdevstore', '', '2024-06-21T09:34:12Z', 'BRL', 37),
  ('gid://shopify/Product/8053302821041', 'hoodie', 'Hoodie', 'Discover the comfort and style of our men''s Zipless Sweatshirt. Ideal for any occasion, this sweatshirt is the perfect piece to keep you warm and looking casual. Key Features: High-Quality Fabric: Made of cotton and polyester, ensuring softness and durability. Classic Design: Straight and fitted cut with a round neckline and ribbed cuffs for a perfect fit. Versatility: Available in various solid colors, easy to match with any look. Superior Comfort: Fleece interior provides a soft and cozy feel on the skin. Practicality: Easy to wash and maintain, ideal for everyday use. Additional Details: Composition: 70% Cotton, 30% Polyester Sizes: S, M, L, XL Care: Machine wash cold, do not bleach, tumble dry low. Style and Comfort for All OccasionsOur Zipless Sweatshirt is the perfect choice for those seeking a versatile and comfortable piece. Whether for a casual outing, a relaxing afternoon at home, or a trip to the gym, this sweatshirt offers the best in style and practicality.', '<p>Discover the comfort and style of our men''s Zipless Sweatshirt. Ideal for any occasion, this sweatshirt is the perfect piece to keep you warm and looking casual.</p>
<p>Key Features:</p>
<ul>
<li>
<strong>High-Quality Fabric:</strong> Made of cotton and polyester, ensuring softness and durability.</li>
<li>
<strong>Classic Design:</strong> Straight and fitted cut with a round neckline and ribbed cuffs for a perfect fit.</li>
<li>
<strong>Versatility:</strong> Available in various solid colors, easy to match with any look.</li>
<li>
<strong>Superior Comfort:</strong> Fleece interior provides a soft and cozy feel on the skin.</li>
<li>
<strong>Practicality:</strong> Easy to wash and maintain, ideal for everyday use.</li>
</ul>
<p>Additional Details:</p>
<ul>
<li>
<strong>Composition:</strong> 70% Cotton, 30% Polyester</li>
<li>
<strong>Sizes:</strong> S, M, L, XL</li>
<li>
<strong>Care:</strong> Machine wash cold, do not bleach, tumble dry low.</li>
</ul>
<p><strong>Style and Comfort for All Occasions</strong><br>Our Zipless Sweatshirt is the perfect choice for those seeking a versatile and comfortable piece. Whether for a casual outing, a relaxing afternoon at home, or a trip to the gym, this sweatshirt offers the best in style and practicality.</p>
<!---->', 'gimenesdevstore', '', '2024-07-03T16:46:03Z', 'BRL', 38),
  ('gid://shopify/Product/8055939563697', 'winter-hat', 'Winter Hat', 'This Winter Hat is made from comfortable cotton and is available in a variety of colors. Stay warm and stylish this winter with this versatile and cozy hat. Perfect for any outdoor activity or simply adding a pop of color to your wardrobe. Key Features: Comfortable Cotton: Made from soft and breathable cotton for all-day comfort. Warm and Cozy: Provides excellent warmth, making it ideal for cold winter days. Variety of Colors: Available in a range of colors to match any outfit or style. Versatile Design: Perfect for any outdoor activity or adding a stylish touch to your winter wardrobe. Durable Quality: High-quality construction ensures lasting wear and durability. Additional Details: Material: 100% Cotton Sizes: One size fits most Care: Hand wash cold, lay flat to dry, do not bleach Stay Warm and StylishThis Winter Hat is the perfect accessory for staying warm and looking stylish during the colder months. Its comfortable cotton material and versatile design make it an essential addition to your winter wardrobe, whether you''re heading outdoors or just want to add a pop of color to your look.', '<p>This Winter Hat is made from comfortable cotton and is available in a variety of colors. Stay warm and stylish this winter with this versatile and cozy hat. Perfect for any outdoor activity or simply adding a pop of color to your wardrobe.</p>
<p><strong>Key Features:</strong></p>
<ul>
<li>
<strong>Comfortable Cotton:</strong> Made from soft and breathable cotton for all-day comfort.</li>
<li>
<strong>Warm and Cozy:</strong> Provides excellent warmth, making it ideal for cold winter days.</li>
<li>
<strong>Variety of Colors:</strong> Available in a range of colors to match any outfit or style.</li>
<li>
<strong>Versatile Design:</strong> Perfect for any outdoor activity or adding a stylish touch to your winter wardrobe.</li>
<li>
<strong>Durable Quality:</strong> High-quality construction ensures lasting wear and durability.</li>
</ul>
<p><strong>Additional Details:</strong></p>
<ul>
<li>
<strong>Material:</strong> 100% Cotton</li>
<li>
<strong>Sizes:</strong> One size fits most</li>
<li>
<strong>Care:</strong> Hand wash cold, lay flat to dry, do not bleach</li>
</ul>
<p><strong>Stay Warm and Stylish</strong><br>This Winter Hat is the perfect accessory for staying warm and looking stylish during the colder months. Its comfortable cotton material and versatile design make it an essential addition to your winter wardrobe, whether you''re heading outdoors or just want to add a pop of color to your look.</p>
<!---->', 'gimenesdevstore', '', '2024-07-04T20:59:48Z', 'BRL', 39);

INSERT INTO products (product_group_id, handle, title, description, description_html, vendor, product_type, created_at, currency_code, position) VALUES
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
  ('gid://shopify/Product/8058279133361', 't-shirt', 'T-shirt', 'Elevate your everyday wardrobe with our Basic Women''s T-Shirt. This essential piece is designed to offer ultimate comfort and timeless style, making it a must-have for every woman''s closet. Key Features: Premium Fabric: Made from 100% soft, breathable cotton for all-day comfort. Flattering Fit: Tailored cut that hugs your body in all the right places without being too tight. Versatile Style: Available in a range of classic colors, perfect for layering or wearing alone. Durability: High-quality stitching and fabric that withstands regular wear and washing. Comfort: Lightweight and soft against the skin, perfect for any season. Additional Details: Composition: 100% Cotton Sizes: XS, S, M, L, XL Care Instructions: Machine wash cold, tumble dry low, do not bleach.', '<p> Elevate your everyday wardrobe with our Basic Women''s T-Shirt. This essential piece is designed to offer ultimate comfort and timeless style, making it a must-have for every woman''s closet.</p>
<p><strong>Key Features:</strong></p>
<ul>
<li>
<strong>Premium Fabric:</strong> Made from 100% soft, breathable cotton for all-day comfort.</li>
<li>
<strong>Flattering Fit:</strong> Tailored cut that hugs your body in all the right places without being too tight.</li>
<li>
<strong>Versatile Style:</strong> Available in a range of classic colors, perfect for layering or wearing alone.</li>
<li>
<strong>Durability:</strong> High-quality stitching and fabric that withstands regular wear and washing.</li>
<li>
<strong>Comfort:</strong> Lightweight and soft against the skin, perfect for any season.</li>
</ul>
<p><strong>Additional Details:</strong></p>
<ul>
<li>
<strong>Composition:</strong> 100% Cotton</li>
<li>
<strong>Sizes:</strong> XS, S, M, L, XL</li>
<li>
<strong>Care Instructions:</strong> Machine wash cold, tumble dry low, do not bleach.</li>
</ul>
<!---->', 'gimenesdevstore', '', '2024-07-05T20:15:55Z', 'BRL', 41),
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
<!---->', 'gimenesdevstore', '', '2024-07-08T16:11:20Z', 'BRL', 44),
  ('gid://shopify/Product/8063131091121', 'oversize-t-shirt', 'Oversize T-shirt', 'Introducing our Oversize T-shirt, perfect for men seeking a basic, comfortable fit. This t-shirt is designed with an oversized silhouette, providing a modern and relaxed look. Featuring an adorable illustration of a capybara, this shirt adds a touch of playfulness to your wardrobe. Experience ultimate comfort and style with our Oversize T-shirt. Key Features: Oversized Silhouette: Designed for a relaxed and comfortable fit, perfect for a modern, laid-back style. High-Quality Fabric: Made from soft and durable materials for long-lasting comfort. Playful Design: Features a charming illustration of a capybara, adding a fun and unique element to your wardrobe. Versatile Wear: Ideal for casual outings, lounging at home, or pairing with your favorite jeans or shorts. Easy Care: Machine washable for effortless maintenance. Additional Details: Material: Premium-quality fabric blend Sizes: Available in a range of men’s sizes Care: Machine wash cold, tumble dry low, do not bleach Ultimate Comfort and StyleOur Oversize T-shirt offers the perfect blend of comfort and style, making it a must-have for any wardrobe. Whether you''re out and about or relaxing at home, this t-shirt ensures you stay comfortable while showcasing a playful and modern look. Add a touch of fun to your everyday attire with this stylish Oversize T-shirt.', '<p>Introducing our Oversize T-shirt, perfect for men seeking a basic, comfortable fit. This t-shirt is designed with an oversized silhouette, providing a modern and relaxed look. Featuring an adorable illustration of a capybara, this shirt adds a touch of playfulness to your wardrobe. Experience ultimate comfort and style with our Oversize T-shirt.</p>
<p><strong>Key Features:</strong></p>
<ul>
<li>
<strong>Oversized Silhouette:</strong> Designed for a relaxed and comfortable fit, perfect for a modern, laid-back style.</li>
<li>
<strong>High-Quality Fabric:</strong> Made from soft and durable materials for long-lasting comfort.</li>
<li>
<strong>Playful Design:</strong> Features a charming illustration of a capybara, adding a fun and unique element to your wardrobe.</li>
<li>
<strong>Versatile Wear:</strong> Ideal for casual outings, lounging at home, or pairing with your favorite jeans or shorts.</li>
<li>
<strong>Easy Care:</strong> Machine washable for effortless maintenance.</li>
</ul>
<p><strong>Additional Details:</strong></p>
<ul>
<li>
<strong>Material:</strong> Premium-quality fabric blend</li>
<li>
<strong>Sizes:</strong> Available in a range of men’s sizes</li>
<li>
<strong>Care:</strong> Machine wash cold, tumble dry low, do not bleach</li>
</ul>
<p><strong>Ultimate Comfort and Style</strong><br>Our Oversize T-shirt offers the perfect blend of comfort and style, making it a must-have for any wardrobe. Whether you''re out and about or relaxing at home, this t-shirt ensures you stay comfortable while showcasing a playful and modern look. Add a touch of fun to your everyday attire with this stylish Oversize T-shirt.</p>
<!---->', 'gimenesdevstore', '', '2024-07-08T19:59:28Z', 'BRL', 45),
  ('gid://shopify/Product/8063210782897', 'rain-jacket', 'Rain Jacket', 'Stay protected from the rain with our durable men''s Rain Jacket. Made with waterproof material, this jacket will keep you dry and comfortable in any weather. Its lightweight design and adjustable hood make it perfect for outdoor activities. Stay prepared and stay dry with our Rain Jacket. Key Features: Waterproof Material: Ensures complete protection from rain, keeping you dry and comfortable. Durable Construction: Made from high-quality materials designed to withstand the elements. Lightweight Design: Easy to wear and carry, making it perfect for on-the-go use. Adjustable Hood: Provides a customizable fit for added protection and comfort. Versatile Use: Ideal for outdoor activities like hiking, camping, or everyday wear in wet weather. Additional Details: Material: Waterproof and breathable fabric blend Sizes: Available in a range of sizes Care: Machine wash cold, hang to dry, do not bleach Stay Dry and ComfortableOur Rain Jacket is the perfect solution for staying dry and comfortable in any weather. Its durable, lightweight design and adjustable hood make it an essential piece for all your outdoor adventures. Be prepared for any rainy day with this reliable and stylish rain jacket.', '<p>Stay protected from the rain with our durable men''s Rain Jacket. Made with waterproof material, this jacket will keep you dry and comfortable in any weather. Its lightweight design and adjustable hood make it perfect for outdoor activities. Stay prepared and stay dry with our Rain Jacket.</p>
<p><strong>Key Features:</strong></p>
<ul>
<li>
<strong>Waterproof Material:</strong> Ensures complete protection from rain, keeping you dry and comfortable.</li>
<li>
<strong>Durable Construction:</strong> Made from high-quality materials designed to withstand the elements.</li>
<li>
<strong>Lightweight Design:</strong> Easy to wear and carry, making it perfect for on-the-go use.</li>
<li>
<strong>Adjustable Hood:</strong> Provides a customizable fit for added protection and comfort.</li>
<li>
<strong>Versatile Use:</strong> Ideal for outdoor activities like hiking, camping, or everyday wear in wet weather.</li>
</ul>
<p><strong>Additional Details:</strong></p>
<ul>
<li>
<strong>Material:</strong> Waterproof and breathable fabric blend</li>
<li>
<strong>Sizes:</strong> Available in a range of sizes</li>
<li>
<strong>Care:</strong> Machine wash cold, hang to dry, do not bleach</li>
</ul>
<p><strong>Stay Dry and Comfortable</strong><br>Our Rain Jacket is the perfect solution for staying dry and comfortable in any weather. Its durable, lightweight design and adjustable hood make it an essential piece for all your outdoor adventures. Be prepared for any rainy day with this reliable and stylish rain jacket.</p>
<!---->', 'gimenesdevstore', '', '2024-07-08T22:08:10Z', 'BRL', 46),
  ('gid://shopify/Product/8064139296945', 'woman-sweatshirt', 'Women''s Sweatshirt', 'This cotton sweatshirt for women is a basic wardrobe must-have. Its high-quality material provides warmth and comfort while its simple design makes it versatile for any outfit. Stay cozy and stylish in this essential piece. Key Features: Premium Cotton Fabric: Made from high-quality cotton for maximum warmth and comfort. Simple Design: Clean and classic look that pairs well with any outfit. Versatile Wear: Perfect for layering or wearing on its own, suitable for any casual occasion. Comfortable Fit: Designed for a relaxed and cozy fit, ensuring all-day comfort. Durable Quality: Constructed to withstand regular wear and washing. Additional Details: Material: 100% Cotton Sizes: Available in a range of women’s sizes Care: Machine wash cold, tumble dry low, do not bleach Cozy and Stylish for Everyday WearThis cotton sweatshirt is an essential addition to your wardrobe, offering both style and comfort. Its high-quality material and versatile design make it perfect for any casual outing, ensuring you stay warm and fashionable throughout the day.', '<p>This cotton sweatshirt for women is a basic wardrobe must-have. Its high-quality material provides warmth and comfort while its simple design makes it versatile for any outfit. Stay cozy and stylish in this essential piece.</p>
<p><strong>Key Features:</strong></p>
<ul>
<li>
<strong>Premium Cotton Fabric:</strong> Made from high-quality cotton for maximum warmth and comfort.</li>
<li>
<strong>Simple Design:</strong> Clean and classic look that pairs well with any outfit.</li>
<li>
<strong>Versatile Wear:</strong> Perfect for layering or wearing on its own, suitable for any casual occasion.</li>
<li>
<strong>Comfortable Fit:</strong> Designed for a relaxed and cozy fit, ensuring all-day comfort.</li>
<li>
<strong>Durable Quality:</strong> Constructed to withstand regular wear and washing.</li>
</ul>
<p><strong>Additional Details:</strong></p>
<ul>
<li>
<strong>Material:</strong> 100% Cotton</li>
<li>
<strong>Sizes:</strong> Available in a range of women’s sizes</li>
<li>
<strong>Care:</strong> Machine wash cold, tumble dry low, do not bleach</li>
</ul>
<p><strong>Cozy and Stylish for Everyday Wear</strong><br>This cotton sweatshirt is an essential addition to your wardrobe, offering both style and comfort. Its high-quality material and versatile design make it perfect for any casual outing, ensuring you stay warm and fashionable throughout the day.</p>
<!---->', 'gimenesdevstore', '', '2024-07-09T16:32:13Z', 'BRL', 47),
  ('gid://shopify/Product/8064194740401', 'woman-t-shirt', 'Women''s T-shirt', 'This women''s t-shirt is designed for comfort and style. Its lightweight and airy fabric makes it perfect for casual wear. Stay comfortable and stylish all day long. Key Features: Lightweight Fabric: Made from breathable and airy material, ensuring you stay cool and comfortable. Stylish Design: Simple yet elegant design that pairs well with any casual outfit. Perfect Fit: Tailored for a flattering fit that enhances your silhouette. Versatile Wear: Ideal for everyday use, whether you''re running errands, lounging at home, or out with friends. Durable Quality: High-quality construction ensures long-lasting wear. Additional Details: Material: Soft, lightweight fabric blend Sizes: Available in a range of women''s sizes Care: Machine wash cold, tumble dry low, do not bleach Comfort and Style for Everyday WearThis women''s t-shirt is the perfect addition to your casual wardrobe. Its lightweight and airy fabric ensures you stay comfortable, while its stylish design keeps you looking great all day long. Whether you''re at home or on the go, this t-shirt is your go-to choice for effortless style and comfort.', '<p>This women''s t-shirt is designed for comfort and style. Its lightweight and airy fabric makes it perfect for casual wear. Stay comfortable and stylish all day long.</p>
<p><strong>Key Features:</strong></p>
<ul>
<li>
<strong>Lightweight Fabric:</strong> Made from breathable and airy material, ensuring you stay cool and comfortable.</li>
<li>
<strong>Stylish Design:</strong> Simple yet elegant design that pairs well with any casual outfit.</li>
<li>
<strong>Perfect Fit:</strong> Tailored for a flattering fit that enhances your silhouette.</li>
<li>
<strong>Versatile Wear:</strong> Ideal for everyday use, whether you''re running errands, lounging at home, or out with friends.</li>
<li>
<strong>Durable Quality:</strong> High-quality construction ensures long-lasting wear.</li>
</ul>
<p><strong>Additional Details:</strong></p>
<ul>
<li>
<strong>Material:</strong> Soft, lightweight fabric blend</li>
<li>
<strong>Sizes:</strong> Available in a range of women''s sizes</li>
<li>
<strong>Care:</strong> Machine wash cold, tumble dry low, do not bleach</li>
</ul>
<p><strong>Comfort and Style for Everyday Wear</strong><br>This women''s t-shirt is the perfect addition to your casual wardrobe. Its lightweight and airy fabric ensures you stay comfortable, while its stylish design keeps you looking great all day long. Whether you''re at home or on the go, this t-shirt is your go-to choice for effortless style and comfort.</p>
<!---->', 'gimenesdevstore', '', '2024-07-09T16:59:04Z', 'BRL', 48),
  ('gid://shopify/Product/8064252870833', 'kids-t-shirt', 'Kids T-shirt', 'This kids t-shirt is the perfect choice for your little one''s wardrobe. Made with comfortable and high-quality fabric, it provides both style and durability. With a simple and versatile design, it is suitable for any occasion. Let your child stand out in this stylish and comfortable t-shirt. Key Features: Premium Quality Fabric: Soft and durable material ensures long-lasting wear and comfort for your child. Versatile Design: Simple yet stylish, making it easy to pair with any outfit for any occasion. Comfortable Fit: Designed for a relaxed and comfortable fit, perfect for active play and everyday wear. Easy Care: Machine washable for hassle-free cleaning and maintenance. Additional Details: Material: High-quality cotton blend for softness and durability Sizes: Available in a range of children’s sizes Care: Machine wash cold, tumble dry low, do not bleach Stylish and ComfortableThis kids t-shirt combines style and practicality, making it a must-have for your child''s wardrobe. Whether for school, playdates, or family outings, this t-shirt ensures your little one looks and feels great, no matter the occasion.', '<p>This kids t-shirt is the perfect choice for your little one''s wardrobe. Made with comfortable and high-quality fabric, it provides both style and durability. With a simple and versatile design, it is suitable for any occasion. Let your child stand out in this stylish and comfortable t-shirt.</p>
<p><strong>Key Features:</strong></p>
<ul>
<li>
<strong>Premium Quality Fabric:</strong> Soft and durable material ensures long-lasting wear and comfort for your child.</li>
<li>
<strong>Versatile Design:</strong> Simple yet stylish, making it easy to pair with any outfit for any occasion.</li>
<li>
<strong>Comfortable Fit:</strong> Designed for a relaxed and comfortable fit, perfect for active play and everyday wear.</li>
<li>
<strong>Easy Care:</strong> Machine washable for hassle-free cleaning and maintenance.</li>
</ul>
<p><strong>Additional Details:</strong></p>
<ul>
<li>
<strong>Material:</strong> High-quality cotton blend for softness and durability</li>
<li>
<strong>Sizes:</strong> Available in a range of children’s sizes</li>
<li>
<strong>Care:</strong> Machine wash cold, tumble dry low, do not bleach</li>
</ul>
<p><strong>Stylish and Comfortable</strong><br>This kids t-shirt combines style and practicality, making it a must-have for your child''s wardrobe. Whether for school, playdates, or family outings, this t-shirt ensures your little one looks and feels great, no matter the occasion.</p>
<!---->', 'gimenesdevstore', '', '2024-07-09T17:52:29Z', 'BRL', 49),
  ('gid://shopify/Product/8064255099057', 'kids-t-shirt-with-illustration', 'Kids t-shirt with illustration', 'Introducing our kids t-shirt featuring a charming illustration of two capybara friends! Made with high-quality fabric, this shirt is perfect for any little animal lover. With every purchase, a percentage of proceeds will go towards wildlife conservation efforts. Get yours today and support a great cause! Key Features: Adorable Design: Features a delightful illustration of two capybara friends that will capture any child''s heart. High-Quality Fabric: Made from soft, durable materials to ensure comfort and longevity. Perfect for Animal Lovers: Ideal for kids who love animals and want to show their support for wildlife. Supports Conservation: A portion of the proceeds from each sale is donated to wildlife conservation efforts. Versatile Wear: Suitable for everyday activities, from playdates to school. Additional Details: Material: Premium-quality cotton blend Sizes: Available in a range of children’s sizes Care: Machine wash cold, tumble dry low, do not bleach Comfort, Style, and a Great CauseThis kids t-shirt combines adorable style and superior comfort with a meaningful purpose. Perfect for any little animal lover, it''s a great way to support wildlife conservation while adding a charming piece to your child''s wardrobe. Get yours today and make a positive impact!', '<p>Introducing our kids t-shirt featuring a charming illustration of two capybara friends! Made with high-quality fabric, this shirt is perfect for any little animal lover. With every purchase, a percentage of proceeds will go towards wildlife conservation efforts. Get yours today and support a great cause!</p>
<p><strong>Key Features:</strong></p>
<ul>
<li>
<strong>Adorable Design:</strong> Features a delightful illustration of two capybara friends that will capture any child''s heart.</li>
<li>
<strong>High-Quality Fabric:</strong> Made from soft, durable materials to ensure comfort and longevity.</li>
<li>
<strong>Perfect for Animal Lovers:</strong> Ideal for kids who love animals and want to show their support for wildlife.</li>
<li>
<strong>Supports Conservation:</strong> A portion of the proceeds from each sale is donated to wildlife conservation efforts.</li>
<li>
<strong>Versatile Wear:</strong> Suitable for everyday activities, from playdates to school.</li>
</ul>
<p><strong>Additional Details:</strong></p>
<ul>
<li>
<strong>Material:</strong> Premium-quality cotton blend</li>
<li>
<strong>Sizes:</strong> Available in a range of children’s sizes</li>
<li>
<strong>Care:</strong> Machine wash cold, tumble dry low, do not bleach</li>
</ul>
<p><strong>Comfort, Style, and a Great Cause</strong><br>This kids t-shirt combines adorable style and superior comfort with a meaningful purpose. Perfect for any little animal lover, it''s a great way to support wildlife conservation while adding a charming piece to your child''s wardrobe. Get yours today and make a positive impact!</p>
<!---->', 'gimenesdevstore', '', '2024-07-09T17:55:04Z', 'BRL', 50),
  ('gid://shopify/Product/8064416579761', 'kids-t-shirt-long-sleeve', 'Kids t-shirt long sleeve', 'This kids long sleeve t-shirt is made of comfortable cotton for all-day wear. Perfect for any child, it ensures both comfort and style. Key Features: Comfortable Fabric: Made from soft, breathable cotton that feels great against the skin. Long Sleeve Design: Provides extra coverage and warmth, ideal for cooler weather. Stylish and Versatile: Simple design that pairs well with any outfit, suitable for various occasions. Durable Quality: High-quality construction ensures lasting wear and durability. Additional Details: Material: 100% Cotton Sizes: Available in a range of children’s sizes Care: Machine wash cold, tumble dry low, do not bleach Comfort and Style for All-Day WearThis kids long sleeve t-shirt is the perfect addition to your child''s wardrobe. Its comfortable and durable cotton fabric ensures they stay cozy and stylish throughout the day, whether at school, play, or family outings.', '<p>This kids long sleeve t-shirt is made of comfortable cotton for all-day wear. Perfect for any child, it ensures both comfort and style.</p>
<p><strong>Key Features:</strong></p>
<ul>
<li>
<strong>Comfortable Fabric:</strong> Made from soft, breathable cotton that feels great against the skin.</li>
<li>
<strong>Long Sleeve Design:</strong> Provides extra coverage and warmth, ideal for cooler weather.</li>
<li>
<strong>Stylish and Versatile:</strong> Simple design that pairs well with any outfit, suitable for various occasions.</li>
<li>
<strong>Durable Quality:</strong> High-quality construction ensures lasting wear and durability.</li>
</ul>
<p><strong>Additional Details:</strong></p>
<ul>
<li>
<strong>Material:</strong> 100% Cotton</li>
<li>
<strong>Sizes:</strong> Available in a range of children’s sizes</li>
<li>
<strong>Care:</strong> Machine wash cold, tumble dry low, do not bleach</li>
</ul>
<p><strong>Comfort and Style for All-Day Wear</strong><br>This kids long sleeve t-shirt is the perfect addition to your child''s wardrobe. Its comfortable and durable cotton fabric ensures they stay cozy and stylish throughout the day, whether at school, play, or family outings.</p>
<!---->', 'gimenesdevstore', '', '2024-07-09T21:14:22Z', 'BRL', 51),
  ('gid://shopify/Product/8064452657329', 'dad-hat', 'Dad hat', 'The Dad Hat, a basic and exclusive accessory, is the perfect addition to any wardrobe. This adjustable hat provides comfort and style while effortlessly completing any outfit. So go ahead, make a statement with the timeless Dad Hat. Key Features: Classic Design: Timeless and versatile, perfect for any casual look. Adjustable Fit: Easily customizable to fit any head size, ensuring maximum comfort. Premium Quality: Made from high-quality materials for durability and a comfortable feel. Versatile Accessory: Complements a wide range of outfits, from casual to sporty. Effortless Style: Adds a touch of effortless cool to any ensemble, making it a must-have staple. Additional Details: Material: High-quality fabric for durability and comfort Adjustability: One size fits all with an adjustable strap Care: Spot clean for easy maintenance Timeless and StylishThe Dad Hat is more than just an accessory; it''s a statement of effortless style and comfort. Perfect for any occasion, this hat is a must-have addition to your wardrobe, offering a blend of practicality and timeless fashion.', '<p>The Dad Hat, a basic and exclusive accessory, is the perfect addition to any wardrobe. This adjustable hat provides comfort and style while effortlessly completing any outfit. So go ahead, make a statement with the timeless Dad Hat.</p>
<p><strong>Key Features:</strong></p>
<ul>
<li>
<strong>Classic Design:</strong> Timeless and versatile, perfect for any casual look.</li>
<li>
<strong>Adjustable Fit:</strong> Easily customizable to fit any head size, ensuring maximum comfort.</li>
<li>
<strong>Premium Quality:</strong> Made from high-quality materials for durability and a comfortable feel.</li>
<li>
<strong>Versatile Accessory:</strong> Complements a wide range of outfits, from casual to sporty.</li>
<li>
<strong>Effortless Style:</strong> Adds a touch of effortless cool to any ensemble, making it a must-have staple.</li>
</ul>
<p><strong>Additional Details:</strong></p>
<ul>
<li>
<strong>Material:</strong> High-quality fabric for durability and comfort</li>
<li>
<strong>Adjustability:</strong> One size fits all with an adjustable strap</li>
<li>
<strong>Care:</strong> Spot clean for easy maintenance</li>
</ul>
<p><strong>Timeless and Stylish</strong><br>The Dad Hat is more than just an accessory; it''s a statement of effortless style and comfort. Perfect for any occasion, this hat is a must-have addition to your wardrobe, offering a blend of practicality and timeless fashion.</p>
<!---->', 'gimenesdevstore', '', '2024-07-09T21:53:16Z', 'BRL', 52),
  ('gid://shopify/Product/8064464126129', 'retro-code-tee', 'Retro Code Tee', 'Introducing the Retro Code Tee, a stylish and comfortable t-shirt with a vintage design. Made from high-quality materials, this tee is perfect for everyday wear and is sure to become your new favorite. Show off your love for all things retro in this must-have tee. Key Features: Vintage Design: Features a retro-inspired design that adds a touch of nostalgia to your wardrobe. High-Quality Materials: Made from soft and durable fabric for long-lasting comfort and wear. Stylish and Comfortable: Combines style and comfort, making it ideal for everyday use. Perfect Fit: Tailored to provide a flattering fit for all body types. Versatile Wear: Easy to pair with jeans, shorts, or skirts for a casual, stylish look. Additional Details: Material: Premium-quality fabric blend Sizes: Available in a range of sizes Care: Machine wash cold, tumble dry low, do not bleach Show Your Retro LoveThe Retro Code Tee is the perfect addition to your wardrobe, offering a blend of style, comfort, and vintage charm. Whether you''re a fan of all things retro or just looking for a cool new tee, this shirt is sure to become your go-to favorite for any casual occasion.', '<p>Introducing the Retro Code Tee, a stylish and comfortable t-shirt with a vintage design. Made from high-quality materials, this tee is perfect for everyday wear and is sure to become your new favorite. Show off your love for all things retro in this must-have tee.</p>
<p><strong>Key Features:</strong></p>
<ul>
<li>
<strong>Vintage Design:</strong> Features a retro-inspired design that adds a touch of nostalgia to your wardrobe.</li>
<li>
<strong>High-Quality Materials:</strong> Made from soft and durable fabric for long-lasting comfort and wear.</li>
<li>
<strong>Stylish and Comfortable:</strong> Combines style and comfort, making it ideal for everyday use.</li>
<li>
<strong>Perfect Fit:</strong> Tailored to provide a flattering fit for all body types.</li>
<li>
<strong>Versatile Wear:</strong> Easy to pair with jeans, shorts, or skirts for a casual, stylish look.</li>
</ul>
<p><strong>Additional Details:</strong></p>
<ul>
<li>
<strong>Material:</strong> Premium-quality fabric blend</li>
<li>
<strong>Sizes:</strong> Available in a range of sizes</li>
<li>
<strong>Care:</strong> Machine wash cold, tumble dry low, do not bleach</li>
</ul>
<p><strong>Show Your Retro Love</strong><br>The Retro Code Tee is the perfect addition to your wardrobe, offering a blend of style, comfort, and vintage charm. Whether you''re a fan of all things retro or just looking for a cool new tee, this shirt is sure to become your go-to favorite for any casual occasion.</p>
<!---->', 'gimenesdevstore', '', '2024-07-09T22:05:04Z', 'BRL', 53),
  ('gid://shopify/Product/8064476217521', 'kids-long-sleeve-t-shirt-capybara', 'Kids long sleeve T-shirt capybara', 'Introduce your child to the world of adorable animals with our Kids Long Sleeve T-Shirt featuring an illustration of two friendly capybaras. Made from high-quality materials, this shirt is perfect for both playtime and learning about the wonders of nature. Key Features: Charming Design: Delightful illustration of two capybaras that sparks curiosity and joy. Premium Quality Fabric: Crafted from soft and durable cotton, ensuring comfort and longevity. Perfect for Play and Learning: Ideal for everyday adventures and educational moments about nature and wildlife. Comfortable Fit: Long sleeves provide extra warmth and coverage, making it suitable for various weather conditions. Easy Care: Machine washable for convenient and hassle-free maintenance. Additional Details: Composition: 100% Cotton Sizes: Available in a range of children''s sizes Care: Machine wash cold, tumble dry low, do not bleach Fun and EducationalOur Kids Long Sleeve T-Shirt with the capybara illustration is more than just clothing; it''s an opportunity to inspire a love for animals and nature in your child. Perfect for school, playdates, or family outings, this shirt combines fun, comfort, and learning in one delightful package.', '<p>Introduce your child to the world of adorable animals with our Kids Long Sleeve T-Shirt featuring an illustration of two friendly capybaras. Made from high-quality materials, this shirt is perfect for both playtime and learning about the wonders of nature.</p>
<p><strong>Key Features:</strong></p>
<ul>
<li>
<strong>Charming Design:</strong> Delightful illustration of two capybaras that sparks curiosity and joy.</li>
<li>
<strong>Premium Quality Fabric:</strong> Crafted from soft and durable cotton, ensuring comfort and longevity.</li>
<li>
<strong>Perfect for Play and Learning:</strong> Ideal for everyday adventures and educational moments about nature and wildlife.</li>
<li>
<strong>Comfortable Fit:</strong> Long sleeves provide extra warmth and coverage, making it suitable for various weather conditions.</li>
<li>
<strong>Easy Care:</strong> Machine washable for convenient and hassle-free maintenance.</li>
</ul>
<p><strong>Additional Details:</strong></p>
<ul>
<li>
<strong>Composition:</strong> 100% Cotton</li>
<li>
<strong>Sizes:</strong> Available in a range of children''s sizes</li>
<li>
<strong>Care:</strong> Machine wash cold, tumble dry low, do not bleach</li>
</ul>
<p><strong>Fun and Educational</strong><br>Our Kids Long Sleeve T-Shirt with the capybara illustration is more than just clothing; it''s an opportunity to inspire a love for animals and nature in your child. Perfect for school, playdates, or family outings, this shirt combines fun, comfort, and learning in one delightful package.</p>
<!---->', 'gimenesdevstore', '', '2024-07-09T22:15:42Z', 'BRL', 54),
  ('gid://shopify/Product/9092843339953', 'deco-tee', 'Deco Tee', 'The Deco Tee is the essential piece of your wardrobe. Made from premium heavyweight cotton, this oversized tee features the iconic Deco logo on the left chest — bold, clean, and unmistakably Deco. Available in classic Black and White. 100% heavyweight cotton Oversized fit Left chest logo print Available in Black and White', '<p>The Deco Tee is the essential piece of your wardrobe. Made from premium heavyweight cotton, this oversized tee features the iconic Deco logo on the left chest — bold, clean, and unmistakably Deco. Available in classic Black and White.</p><ul>
<li>100% heavyweight cotton</li>
<li>Oversized fit</li>
<li>Left chest logo print</li>
<li>Available in Black and White</li>
</ul>', 'Deco', 'T-Shirt', '2026-07-27T22:59:08Z', 'BRL', 55),
  ('gid://shopify/Product/9092843438257', 'deco-sweatpants', 'Deco Sweatpants', 'The Deco Sweatpants are built for comfort without sacrificing style. Featuring an oversized "d" arrow graphic on the leg, these black joggers are the perfect match for your Deco fits. Elastic waistband, cuffed ankles, and a relaxed fit make these your go-to for any occasion. Premium fleece cotton blend Elastic waistband with drawstring Cuffed ankles Oversized Deco "d" arrow graphic on leg Available in Black', '<p>The Deco Sweatpants are built for comfort without sacrificing style. Featuring an oversized "d" arrow graphic on the leg, these black joggers are the perfect match for your Deco fits. Elastic waistband, cuffed ankles, and a relaxed fit make these your go-to for any occasion.</p><ul>
<li>Premium fleece cotton blend</li>
<li>Elastic waistband with drawstring</li>
<li>Cuffed ankles</li>
<li>Oversized Deco "d" arrow graphic on leg</li>
<li>Available in Black</li>
</ul>', 'Deco', 'Sweatpants', '2026-07-27T22:59:40Z', 'BRL', 56),
  ('gid://shopify/Product/9092843733169', 'deco-cap', 'Deco Cap', 'The Deco Cap is the finishing touch to any fit. This structured black dad cap features the Deco logo embroidered on the front panel in bold lime green and dark green — clean, iconic, and built to last. One size fits most with an adjustable strap at the back. Structured dad cap style Embroidered Deco logo on front panel Adjustable strap One size fits most Available in Black', '<p>The Deco Cap is the finishing touch to any fit. This structured black dad cap features the Deco logo embroidered on the front panel in bold lime green and dark green — clean, iconic, and built to last. One size fits most with an adjustable strap at the back.</p><ul>
<li>Structured dad cap style</li>
<li>Embroidered Deco logo on front panel</li>
<li>Adjustable strap</li>
<li>One size fits most</li>
<li>Available in Black</li>
</ul>', 'Deco', 'Hat', '2026-07-27T23:02:01Z', 'BRL', 57);

-- 184 imagens -> isVariantOf.image[]
INSERT INTO product_images (product_group_id, url, alt, position) VALUES
  ('gid://shopify/Product/7947981127857', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/codedeco-1.png?v=1715900166', '', 0),
  ('gid://shopify/Product/7948021399729', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/cookiecapybaramonster-12.png?v=1715903587', '', 0),
  ('gid://shopify/Product/7948021825713', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/d-12.png?v=1715903635', '', 0),
  ('gid://shopify/Product/7948024381617', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/deco-12_6f3e1e94-66e9-4a91-a929-8b05e2038d1f.png?v=1715903966', '', 0),
  ('gid://shopify/Product/7948024742065', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/decocommunity-12.png?v=1715904191', '', 0),
  ('gid://shopify/Product/7948026118321', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/decocx-12.png?v=1715904232', '', 0),
  ('gid://shopify/Product/7948026314929', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/decoinside-12.png?v=1715904266', '', 0),
  ('gid://shopify/Product/7948026544305', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/decorainbow-12.png?v=1715904296', '', 0),
  ('gid://shopify/Product/7948026740913', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/developersdevelopers-12.png?v=1715904329', '', 0),
  ('gid://shopify/Product/7948027297969', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/GetSiteDone-12.png?v=1715904367', '', 0),
  ('gid://shopify/Product/7948027461809', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/givemeabr-12.png?v=1715904430', '', 0),
  ('gid://shopify/Product/7948027658417', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/icenterdivs-12.png?v=1715904455', '', 0),
  ('gid://shopify/Product/7948027920561', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/iratherbecoding-12.png?v=1715904494', '', 0),
  ('gid://shopify/Product/7948028215473', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/itsnotabug-12.png?v=1715904540', '', 0),
  ('gid://shopify/Product/7948028412081', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/itworks-12.png?v=1715904574', '', 0),
  ('gid://shopify/Product/7948028706993', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/judgingCWV-12.png?v=1715904606', '', 0),
  ('gid://shopify/Product/7948029034673', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/techstack-12.png?v=1715904652', '', 0),
  ('gid://shopify/Product/7948043649201', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Capa-1.png?v=1715906996', '', 0),
  ('gid://shopify/Product/7948043649201', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/4Capa-1.png?v=1715906990', '', 1),
  ('gid://shopify/Product/7948043649201', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/FolhaDeRosto-1.png?v=1715907001', '', 2),
  ('gid://shopify/Product/7948043649201', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/FolhaDeRosto2-1.png?v=1715907007', '', 3),
  ('gid://shopify/Product/7948043649201', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/FolhaDeRosto3-1.png?v=1715907011', '', 4),
  ('gid://shopify/Product/7948045648049', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/camisetabordadi.jpg?v=1715907347', '', 0),
  ('gid://shopify/Product/7948053151921', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Moletom.png?v=1715908132', '', 0),
  ('gid://shopify/Product/7948058198193', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Option2.png?v=1715908310', '', 0),
  ('gid://shopify/Product/7948059082929', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Bone.jpg?v=1715908377', '', 0),
  ('gid://shopify/Product/7948060065969', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Mochila.png?v=1715908449', '', 0),
  ('gid://shopify/Product/7948061180081', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Caneta.png?v=1715908493', '', 0),
  ('gid://shopify/Product/7948063244465', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/image12.png?v=1715908627', '', 0),
  ('gid://shopify/Product/7948063244465', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/WhatsAppImage2024-03-07at10.491.png?v=1715908631', '', 1),
  ('gid://shopify/Product/8017994252465', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Hoodie01.png?v=1718374884', '', 0),
  ('gid://shopify/Product/8017994252465', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Hoodie02.png?v=1718374884', '', 1),
  ('gid://shopify/Product/8017994252465', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Hoodie03.png?v=1718374884', '', 2),
  ('gid://shopify/Product/8017994252465', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Hoodie04.png?v=1718374884', '', 3),
  ('gid://shopify/Product/8017999659185', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/MinimalistBackpack01.png?v=1718375563', 'White', 0),
  ('gid://shopify/Product/8017999659185', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/MinimalistBackpack02.png?v=1718375563', 'White', 1),
  ('gid://shopify/Product/8017999659185', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/MinimalistBackpack04.png?v=1718375564', 'White', 2),
  ('gid://shopify/Product/8018004148401', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/OrganicBucketHat01.png?v=1718376053', 'White', 0),
  ('gid://shopify/Product/8018004148401', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/OrganicBucketHat02.png?v=1718376053', 'White', 1),
  ('gid://shopify/Product/8018004148401', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/OrganicBucketHat04.png?v=1718376053', 'White', 2);

INSERT INTO product_images (product_group_id, url, alt, position) VALUES
  ('gid://shopify/Product/8018004148401', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/OrganicBucketHat03.png?v=1718376053', 'White', 3),
  ('gid://shopify/Product/8018004148401', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Organic-Bucket-Hat-Blue.png?v=1719863177', 'Blue', 4),
  ('gid://shopify/Product/8018004148401', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/OrganicBucketHatBlue02_cc0748eb-1cf2-47ec-a6bc-aeb78a348cc2.png?v=1719864023', 'Blue', 5),
  ('gid://shopify/Product/8018004148401', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/OrganicBucketHatBlue04.png?v=1719865020', 'Blue', 6),
  ('gid://shopify/Product/8018004148401', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/OrganicBucketHat03Blue.png?v=1719864374', 'Blue', 7),
  ('gid://shopify/Product/8018011291825', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/HighTopCanvasShoes01.png?v=1718376705', '', 0),
  ('gid://shopify/Product/8018011291825', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/HighTopCanvasShoes02.png?v=1718376705', '', 1),
  ('gid://shopify/Product/8018011291825', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/HighTopCanvasShoes03.png?v=1718376706', '', 2),
  ('gid://shopify/Product/8018011291825', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/HighTopCanvasShoes04.png?v=1718376705', '', 3),
  ('gid://shopify/Product/8028434006193', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Women_sSlides-01.png?v=1718959177', '', 0),
  ('gid://shopify/Product/8028434006193', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Women_sSlides-02.png?v=1718959177', '', 1),
  ('gid://shopify/Product/8028434006193', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Women_sSlides-03.png?v=1718959177', '', 2),
  ('gid://shopify/Product/8028434006193', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Women_sSlides-04.png?v=1718959177', '', 3),
  ('gid://shopify/Product/8028449734833', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/SnapCaseforiPhone_-01.png?v=1718959759', '', 0),
  ('gid://shopify/Product/8028449734833', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/SnapCaseforiPhone_-02.png?v=1718959759', '', 1),
  ('gid://shopify/Product/8028449734833', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/SnapCaseforiPhone_-03.png?v=1718959759', '', 2),
  ('gid://shopify/Product/8028458057905', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/EcoToteBag_Econscious.png?v=1718960341', '', 0),
  ('gid://shopify/Product/8028460482737', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bagwhite2_f19309fe-ef20-4524-9abd-78b13961118c.png?v=1720113087', 'White', 0),
  ('gid://shopify/Product/8028460482737', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bagwhite1.png?v=1720108112', 'White', 1),
  ('gid://shopify/Product/8028460482737', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bagwhite3.png?v=1720113506', 'White', 2),
  ('gid://shopify/Product/8028460482737', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bagyellow2_1ec29de6-05b3-45b0-98f6-a7023ba84acd.png?v=1720113093', 'DarkYellow', 3),
  ('gid://shopify/Product/8028460482737', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bagyellow1.png?v=1720108117', 'DarkYellow', 4),
  ('gid://shopify/Product/8028460482737', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bagyellow3.png?v=1720113499', 'DarkYellow', 5),
  ('gid://shopify/Product/8028460482737', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/baggreen2_22d9b0c7-dabc-4489-b910-8fbab5b8972f.png?v=1720113090', 'DarkGreen', 6),
  ('gid://shopify/Product/8028460482737', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/baggreen1.png?v=1720108126', 'DarkGreen', 7),
  ('gid://shopify/Product/8028460482737', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/baggreen3.png?v=1720108126', 'DarkGreen', 8),
  ('gid://shopify/Product/8028465987761', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/SublimationFlipFlops-01.png?v=1718961039', '', 0),
  ('gid://shopify/Product/8028465987761', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/SublimationFlipFlops-02.png?v=1718961040', '', 1),
  ('gid://shopify/Product/8028469428401', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/InsulatedTumblerwithaStraw-01.png?v=1718961264', 'White', 0),
  ('gid://shopify/Product/8028471361713', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/StainlessSteelWaterBottle-01.png?v=1718961427', '', 0),
  ('gid://shopify/Product/8028471361713', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/StainlessSteelWaterBottle-02.png?v=1718961427', '', 1),
  ('gid://shopify/Product/8028471361713', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/StainlessSteelWaterBottle-03.png?v=1718961427', '', 2),
  ('gid://shopify/Product/8028479979697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/All-OverPrintBomberJacket-01.png?v=1718962143', 'White', 0),
  ('gid://shopify/Product/8028479979697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/All-OverPrintBomberJacket-02.png?v=1718962143', 'White', 1),
  ('gid://shopify/Product/8028479979697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/All-OverPrintBomberJacket-03.png?v=1718962143', 'White', 2),
  ('gid://shopify/Product/8028483518641', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/PremiumSweatshirt_CottonHeritage.png?v=1718962431', 'White', 0),
  ('gid://shopify/Product/8028483518641', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/PremiumSweatshirt_CottonHeritage-02.png?v=1718962430', 'White', 1),
  ('gid://shopify/Product/8053302821041', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hoodie1white_7bba5f48-51c0-415f-8164-5b87f8d4e2a1.png?v=1720104676', 'White', 0),
  ('gid://shopify/Product/8053302821041', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hoodie2white.png?v=1720024822', 'White', 1),
  ('gid://shopify/Product/8053302821041', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hoodie1blue.png?v=1720104288', 'Blue', 2);

INSERT INTO product_images (product_group_id, url, alt, position) VALUES
  ('gid://shopify/Product/8053302821041', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hoodie2blue.png?v=1720104293', 'Blue', 3),
  ('gid://shopify/Product/8053302821041', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hoodiegreen1.png?v=1720105044', 'Green', 4),
  ('gid://shopify/Product/8053302821041', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hoodiegreen2.png?v=1720105044', 'Green', 5),
  ('gid://shopify/Product/8055939563697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/winterhatwhite_4401879a-3ef0-482c-93b9-9fddfc6196a4.png?v=1720207452', '', 0),
  ('gid://shopify/Product/8055939563697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/winterhatblue_c85c3a66-1d87-4f5e-8f88-3c7805ceba46.png?v=1720207128', '', 1),
  ('gid://shopify/Product/8055939563697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/winterhatyellow_091e14a5-a12f-4c90-8797-75cf1fb7cf31.png?v=1720207452', '', 2),
  ('gid://shopify/Product/8055939563697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/winterhatgreen_d0fa89e5-189d-4a3d-bb8f-8dd27fe188d9.png?v=1720207452', '', 3),
  ('gid://shopify/Product/8058167787697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugwhite.png?v=1720203455', '', 0),
  ('gid://shopify/Product/8058167787697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugwhite2_3a7438ff-58d5-47b2-81f6-9c684a394b01.png?v=1720204087', '', 1),
  ('gid://shopify/Product/8058167787697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugdarkblue.png?v=1720203467', '', 2),
  ('gid://shopify/Product/8058167787697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugblue2.png?v=1720203670', '', 3),
  ('gid://shopify/Product/8058167787697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugyellow.png?v=1720203467', '', 4),
  ('gid://shopify/Product/8058167787697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugyellow2.png?v=1720203467', '', 5),
  ('gid://shopify/Product/8058167787697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/muggreen_bd7cd6a0-d998-445b-864a-ea1edfd97077.png?v=1720203834', '', 6),
  ('gid://shopify/Product/8058167787697', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/muggreen2.png?v=1720203835', '', 7),
  ('gid://shopify/Product/8058279133361', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 0),
  ('gid://shopify/Product/8058279133361', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite2.png?v=1720439900', 'White', 1),
  ('gid://shopify/Product/8058279133361', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtblack.png?v=1720211356', 'Black', 2),
  ('gid://shopify/Product/8058279133361', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtblack2.1.png?v=1720439900', 'Black', 3),
  ('gid://shopify/Product/8058279133361', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtblue.png?v=1720211357', 'DarkBlue', 4),
  ('gid://shopify/Product/8058279133361', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtblue2.1.png?v=1720439900', 'DarkBlue', 5),
  ('gid://shopify/Product/8058279133361', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtgreen.png?v=1720211356', 'DarkGreen', 6),
  ('gid://shopify/Product/8058279133361', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtgreen2.png?v=1720439900', 'DarkGreen', 7),
  ('gid://shopify/Product/8058279133361', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtyellow.png?v=1720211357', 'DarkYellow', 8),
  ('gid://shopify/Product/8058279133361', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtyello2.png?v=1720439900', 'DarkYellow', 9),
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
  ('gid://shopify/Product/8062743281841', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookyellow.png?v=1720450803', 'DarkYellow', 9);

INSERT INTO product_images (product_group_id, url, alt, position) VALUES
  ('gid://shopify/Product/8062864588977', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowwhite.png?v=1720454987', 'White', 0),
  ('gid://shopify/Product/8062864588977', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowblack.png?v=1720454987', 'Black', 1),
  ('gid://shopify/Product/8062864588977', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowgreen.png?v=1720454987', 'DarkGreen', 2),
  ('gid://shopify/Product/8062864588977', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowblue.png?v=1720454987', 'DarkBlue', 3),
  ('gid://shopify/Product/8062864588977', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowyellow.png?v=1720454987', 'DarkYellow', 4),
  ('gid://shopify/Product/8063131091121', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 0),
  ('gid://shopify/Product/8063131091121', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite2.png?v=1720468627', '', 1),
  ('gid://shopify/Product/8063131091121', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizeblack.png?v=1720468627', '', 2),
  ('gid://shopify/Product/8063131091121', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizeblack2.png?v=1720468627', '', 3),
  ('gid://shopify/Product/8063131091121', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizegreen.png?v=1720468627', '', 4),
  ('gid://shopify/Product/8063131091121', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizegreen2.png?v=1720468627', '', 5),
  ('gid://shopify/Product/8063131091121', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizeblue.png?v=1720468627', '', 6),
  ('gid://shopify/Product/8063131091121', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizeblue2.png?v=1720468627', '', 7),
  ('gid://shopify/Product/8063131091121', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizeyellow.png?v=1720468627', '', 8),
  ('gid://shopify/Product/8063131091121', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizeyellow2.png?v=1720468627', '', 9),
  ('gid://shopify/Product/8063210782897', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/rainjackwhite1.png?v=1720476378', 'White', 0),
  ('gid://shopify/Product/8063210782897', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/rainjackwhite2.jpg?v=1720476378', 'White', 1),
  ('gid://shopify/Product/8063210782897', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/rainjackblack1.png?v=1720476378', 'Black', 2),
  ('gid://shopify/Product/8063210782897', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/rainjackblack2.jpg?v=1720476378', 'Black', 3),
  ('gid://shopify/Product/8064139296945', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 0),
  ('gid://shopify/Product/8064139296945', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatblack.png?v=1720542637', '', 1),
  ('gid://shopify/Product/8064139296945', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatgreen.png?v=1720542637', '', 2),
  ('gid://shopify/Product/8064139296945', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatblue.png?v=1720542636', '', 3),
  ('gid://shopify/Product/8064139296945', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatyellow.png?v=1720542636', '', 4),
  ('gid://shopify/Product/8064194740401', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 0),
  ('gid://shopify/Product/8064194740401', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wtshirtblack.png?v=1720544147', '', 1),
  ('gid://shopify/Product/8064194740401', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtgreen.png?v=1720544147', '', 2),
  ('gid://shopify/Product/8064194740401', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtblue.png?v=1720544148', '', 3),
  ('gid://shopify/Product/8064194740401', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtyellow.png?v=1720544148', '', 4),
  ('gid://shopify/Product/8064252870833', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite1.png?v=1720547464', 'White', 0),
  ('gid://shopify/Product/8064252870833', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite1.1.png?v=1720547464', 'White', 1),
  ('gid://shopify/Product/8064252870833', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtblack1.png?v=1720547463', 'Black', 2),
  ('gid://shopify/Product/8064252870833', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtblack1.1.png?v=1720547464', 'Black', 3),
  ('gid://shopify/Product/8064252870833', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtgreen1.png?v=1720547464', 'Green', 4),
  ('gid://shopify/Product/8064252870833', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtgreen1.1.png?v=1720547463', 'Green', 5),
  ('gid://shopify/Product/8064255099057', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite2.png?v=1720547598', 'White', 0),
  ('gid://shopify/Product/8064255099057', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtblack2.png?v=1720547598', 'Black', 1),
  ('gid://shopify/Product/8064255099057', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtgreen2.png?v=1720547598', 'Green', 2),
  ('gid://shopify/Product/8064416579761', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidsweatwhite.png?v=1720559566', 'White', 0),
  ('gid://shopify/Product/8064416579761', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatblack.png?v=1720559565', 'Black', 1);

INSERT INTO product_images (product_group_id, url, alt, position) VALUES
  ('gid://shopify/Product/8064416579761', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatgreen.png?v=1720559566', 'Green', 2),
  ('gid://shopify/Product/8064452657329', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hatwhite1.png?v=1720561913', '', 0),
  ('gid://shopify/Product/8064452657329', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hatwhite2.png?v=1720561913', '', 1),
  ('gid://shopify/Product/8064452657329', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hatblack1.png?v=1720561915', '', 2),
  ('gid://shopify/Product/8064452657329', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hatblack2.png?v=1720561913', '', 3),
  ('gid://shopify/Product/8064452657329', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hatblue1.png?v=1720561913', '', 4),
  ('gid://shopify/Product/8064452657329', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hatblue2.png?v=1720561913', '', 5),
  ('gid://shopify/Product/8064452657329', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hatgreen.png?v=1720561913', '', 6),
  ('gid://shopify/Product/8064452657329', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hatgreen2.png?v=1720561913', '', 7),
  ('gid://shopify/Product/8064452657329', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hatyellow.png?v=1720561913', '', 8),
  ('gid://shopify/Product/8064452657329', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hatyellow2.png?v=1720561913', '', 9),
  ('gid://shopify/Product/8064464126129', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/webdevwhite.png?v=1720562681', 'White', 0),
  ('gid://shopify/Product/8064464126129', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/webdevblack.png?v=1720562681', 'Black', 1),
  ('gid://shopify/Product/8064476217521', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatwhite2.png?v=1720563225', 'White', 0),
  ('gid://shopify/Product/8064476217521', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatblack2.png?v=1720563225', 'Black', 1),
  ('gid://shopify/Product/8064476217521', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatgreen2.png?v=1720563225', 'Green', 2),
  ('gid://shopify/Product/9092843339953', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/ChatGPT_Image_Jul_27_2026_05_43_37_PM_08be1f13-f559-4d18-afc6-6f019b05e312.png?v=1785193117', 'Deco Tee White - Front', 0),
  ('gid://shopify/Product/9092843339953', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/image_cb40eb97-9af0-43df-9d64-11380fd4cc26.png?v=1785193123', 'Deco Tee White - Back', 1),
  ('gid://shopify/Product/9092843339953', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/image.png?v=1785193123', 'Deco Tee Black - Back', 2),
  ('gid://shopify/Product/9092843339953', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/ChatGPT_Image_Jul_27_2026_06_54_44_PM_7fbb06dd-c26b-4c57-9883-ae39f251ee63.png?v=1785193120', 'Deco Tee Black - Front', 3),
  ('gid://shopify/Product/9092843438257', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/ChatGPT_Image_Jul_27_2026_07_02_39_PM_052f1c2d-1eba-4521-ba9b-1a7c7ba0de3b.png?v=1785193169', 'Deco Sweatpants Black - Front', 0),
  ('gid://shopify/Product/9092843438257', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/image_375976c4-99c8-4afe-9671-7b7058b149b7.png?v=1785193172', 'Deco Sweatpants Black - Back', 1),
  ('gid://shopify/Product/9092843733169', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/image_f0ad58ea-f114-4b03-a8ff-611f4b34f5af.png?v=1785193203', 'Deco Cap Black - Side', 0),
  ('gid://shopify/Product/9092843733169', 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/ChatGPT_Image_Jul_27_2026_07_44_32_PM_1ecc4532-f4d7-402f-89ad-94e95cb54947.png?v=1785193199', 'Deco Cap Black - Front', 1);

-- 76 tags/coleções -> isVariantOf.additionalProperty[]
INSERT INTO product_props (product_group_id, name, value, value_reference, position) VALUES
  ('gid://shopify/Product/7947981127857', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/7947981127857', 'COLLECTION', 'Stickers', 'deco-stickers', 1),
  ('gid://shopify/Product/7948021399729', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/7948021825713', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/7948021825713', 'COLLECTION', 'Stickers', 'deco-stickers', 1),
  ('gid://shopify/Product/7948024381617', 'COLLECTION', 'Stickers', 'deco-stickers', 0),
  ('gid://shopify/Product/7948024742065', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/7948024742065', 'COLLECTION', 'Stickers', 'deco-stickers', 1),
  ('gid://shopify/Product/7948026118321', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/7948026118321', 'COLLECTION', 'Stickers', 'deco-stickers', 1),
  ('gid://shopify/Product/7948026314929', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/7948026314929', 'COLLECTION', 'Stickers', 'deco-stickers', 1),
  ('gid://shopify/Product/7948026544305', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/7948026544305', 'COLLECTION', 'Stickers', 'deco-stickers', 1),
  ('gid://shopify/Product/7948026740913', 'COLLECTION', 'Stickers', 'deco-stickers', 0),
  ('gid://shopify/Product/7948027297969', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/7948027297969', 'COLLECTION', 'Stickers', 'deco-stickers', 1),
  ('gid://shopify/Product/7948027461809', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/7948027461809', 'COLLECTION', 'Stickers', 'deco-stickers', 1),
  ('gid://shopify/Product/7948027658417', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/7948027658417', 'COLLECTION', 'Stickers', 'deco-stickers', 1),
  ('gid://shopify/Product/7948027920561', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/7948027920561', 'COLLECTION', 'Stickers', 'deco-stickers', 1),
  ('gid://shopify/Product/7948028215473', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/7948028215473', 'COLLECTION', 'Stickers', 'deco-stickers', 1),
  ('gid://shopify/Product/7948028412081', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/7948028412081', 'COLLECTION', 'Stickers', 'deco-stickers', 1),
  ('gid://shopify/Product/7948028706993', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/7948028706993', 'COLLECTION', 'Stickers', 'deco-stickers', 1),
  ('gid://shopify/Product/7948029034673', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/7948029034673', 'COLLECTION', 'Stickers', 'deco-stickers', 1),
  ('gid://shopify/Product/7948045648049', 'COLLECTION', 'Shirts', 'shirts', 0),
  ('gid://shopify/Product/7948053151921', 'COLLECTION', 'Hoodies & Sweatshirts', 'hoodies-sweatshirts', 0),
  ('gid://shopify/Product/7948058198193', 'COLLECTION', 'Accessories', 'accessories', 0),
  ('gid://shopify/Product/7948059082929', 'COLLECTION', 'Accessories', 'accessories', 0),
  ('gid://shopify/Product/7948060065969', 'COLLECTION', 'Accessories', 'accessories', 0),
  ('gid://shopify/Product/7948063244465', 'TAG', 'capy', NULL, 0),
  ('gid://shopify/Product/8017994252465', 'COLLECTION', 'Hoodies & Sweatshirts', 'hoodies-sweatshirts', 0),
  ('gid://shopify/Product/8017999659185', 'COLLECTION', 'Accessories', 'accessories', 0),
  ('gid://shopify/Product/8018004148401', 'COLLECTION', 'Accessories', 'accessories', 0);

INSERT INTO product_props (product_group_id, name, value, value_reference, position) VALUES
  ('gid://shopify/Product/8028449734833', 'COLLECTION', 'Accessories', 'accessories', 0),
  ('gid://shopify/Product/8028458057905', 'COLLECTION', 'Accessories', 'accessories', 0),
  ('gid://shopify/Product/8028460482737', 'COLLECTION', 'Accessories', 'accessories', 0),
  ('gid://shopify/Product/8028471361713', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/8028479979697', 'COLLECTION', 'Jackets & Outerwear', 'jackets-outerwear', 0),
  ('gid://shopify/Product/8028483518641', 'COLLECTION', 'Shirts', 'shirts', 0),
  ('gid://shopify/Product/8053302821041', 'COLLECTION', 'Hoodies & Sweatshirts', 'hoodies-sweatshirts', 0),
  ('gid://shopify/Product/8055939563697', 'COLLECTION', 'Accessories', 'accessories', 0),
  ('gid://shopify/Product/8058167787697', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/8058279133361', 'COLLECTION', 'Shirts', 'shirts', 0),
  ('gid://shopify/Product/8062743281841', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/8062864588977', 'COLLECTION', 'Home & Living', 'stickers', 0),
  ('gid://shopify/Product/8063131091121', 'COLLECTION', 'Shirts', 'shirts', 0),
  ('gid://shopify/Product/8063210782897', 'COLLECTION', 'Jackets & Outerwear', 'jackets-outerwear', 0),
  ('gid://shopify/Product/8064139296945', 'COLLECTION', 'Hoodies & Sweatshirts', 'hoodies-sweatshirts', 0),
  ('gid://shopify/Product/8064194740401', 'COLLECTION', 'Shirts', 'shirts', 0),
  ('gid://shopify/Product/8064452657329', 'COLLECTION', 'Accessories', 'accessories', 0),
  ('gid://shopify/Product/8064464126129', 'COLLECTION', 'Shirts', 'shirts', 0),
  ('gid://shopify/Product/9092843339953', 'TAG', 'deco', NULL, 0),
  ('gid://shopify/Product/9092843339953', 'TAG', 'essentials', NULL, 1),
  ('gid://shopify/Product/9092843339953', 'TAG', 'merch', NULL, 2),
  ('gid://shopify/Product/9092843339953', 'TAG', 'shirt', NULL, 3),
  ('gid://shopify/Product/9092843339953', 'TAG', 'tee', NULL, 4),
  ('gid://shopify/Product/9092843339953', 'COLLECTION', 'Shirts', 'shirts', 5),
  ('gid://shopify/Product/9092843438257', 'TAG', 'bottoms', NULL, 0),
  ('gid://shopify/Product/9092843438257', 'TAG', 'deco', NULL, 1),
  ('gid://shopify/Product/9092843438257', 'TAG', 'joggers', NULL, 2),
  ('gid://shopify/Product/9092843438257', 'TAG', 'merch', NULL, 3),
  ('gid://shopify/Product/9092843438257', 'TAG', 'sweatpants', NULL, 4),
  ('gid://shopify/Product/9092843438257', 'COLLECTION', 'Bottoms', 'bottoms', 5),
  ('gid://shopify/Product/9092843733169', 'TAG', 'accessories', NULL, 0),
  ('gid://shopify/Product/9092843733169', 'TAG', 'cap', NULL, 1),
  ('gid://shopify/Product/9092843733169', 'TAG', 'deco', NULL, 2),
  ('gid://shopify/Product/9092843733169', 'TAG', 'hat', NULL, 3),
  ('gid://shopify/Product/9092843733169', 'TAG', 'merch', NULL, 4),
  ('gid://shopify/Product/9092843733169', 'COLLECTION', 'Accessories', 'accessories', 5);

-- 289 variantes -> hasVariant[] + offers
INSERT INTO variants (variant_id, product_group_id, title, barcode, price, compare_at_price, available, quantity, image_url, image_alt, position) VALUES
  ('gid://shopify/ProductVariant/44073229418673', 'gid://shopify/Product/7947981127857', 'Default Title', NULL, 12, 24, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/codedeco-1.png?v=1715900166', '', 0),
  ('gid://shopify/ProductVariant/44073283125425', 'gid://shopify/Product/7948021399729', 'Default Title', NULL, 12, 24, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/cookiecapybaramonster-12.png?v=1715903587', '', 0),
  ('gid://shopify/ProductVariant/44073283682481', 'gid://shopify/Product/7948021825713', 'Default Title', NULL, 99, 120, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/d-12.png?v=1715903635', '', 0),
  ('gid://shopify/ProductVariant/44073287385265', 'gid://shopify/Product/7948024381617', 'Default Title', NULL, 140, 220, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/deco-12_6f3e1e94-66e9-4a91-a929-8b05e2038d1f.png?v=1715903966', '', 0),
  ('gid://shopify/ProductVariant/44073288368305', 'gid://shopify/Product/7948024742065', 'Default Title', NULL, 40, 45, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/decocommunity-12.png?v=1715904191', '', 0),
  ('gid://shopify/ProductVariant/44073292366001', 'gid://shopify/Product/7948026118321', 'Default Title', NULL, 80, 99, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/decocx-12.png?v=1715904232', '', 0),
  ('gid://shopify/ProductVariant/44073292824753', 'gid://shopify/Product/7948026314929', 'Default Title', NULL, 99, 199, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/decoinside-12.png?v=1715904266', '', 0),
  ('gid://shopify/ProductVariant/44073293119665', 'gid://shopify/Product/7948026544305', 'Default Title', NULL, 11, 12, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/decorainbow-12.png?v=1715904296', '', 0),
  ('gid://shopify/ProductVariant/44073293512881', 'gid://shopify/Product/7948026740913', 'Default Title', NULL, 11, 15, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/developersdevelopers-12.png?v=1715904329', '', 0),
  ('gid://shopify/ProductVariant/44073294561457', 'gid://shopify/Product/7948027297969', 'Default Title', NULL, 42, 49, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/GetSiteDone-12.png?v=1715904367', '', 0),
  ('gid://shopify/ProductVariant/44073294954673', 'gid://shopify/Product/7948027461809', 'Default Title', NULL, 12, 56, 0, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/givemeabr-12.png?v=1715904430', '', 0),
  ('gid://shopify/ProductVariant/44073295216817', 'gid://shopify/Product/7948027658417', 'Default Title', NULL, 44, 56, 0, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/icenterdivs-12.png?v=1715904455', '', 0),
  ('gid://shopify/ProductVariant/44073295577265', 'gid://shopify/Product/7948027920561', 'Default Title', NULL, 11, 19, 0, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/iratherbecoding-12.png?v=1715904494', '', 0),
  ('gid://shopify/ProductVariant/44073295904945', 'gid://shopify/Product/7948028215473', 'Default Title', NULL, 22, 25, 1, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/itsnotabug-12.png?v=1715904540', '', 0),
  ('gid://shopify/ProductVariant/44073296265393', 'gid://shopify/Product/7948028412081', 'Default Title', NULL, 22, 25, 0, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/itworks-12.png?v=1715904574', '', 0),
  ('gid://shopify/ProductVariant/44073296691377', 'gid://shopify/Product/7948028706993', 'Default Title', NULL, 99, 120, 1, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/judgingCWV-12.png?v=1715904606', '', 0),
  ('gid://shopify/ProductVariant/44073297150129', 'gid://shopify/Product/7948029034673', 'Default Title', NULL, 1.99, 2.99, 0, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/techstack-12.png?v=1715904652', '', 0),
  ('gid://shopify/ProductVariant/44073326837937', 'gid://shopify/Product/7948043649201', 'Default Title', NULL, 499, 599, 0, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Capa-1.png?v=1715906996', '', 0),
  ('gid://shopify/ProductVariant/44073330344113', 'gid://shopify/Product/7948045648049', 'Default Title', NULL, 11, 13, 1, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/camisetabordadi.jpg?v=1715907347', '', 0),
  ('gid://shopify/ProductVariant/44073351545009', 'gid://shopify/Product/7948053151921', 'Default Title', NULL, 100, NULL, 1, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Moletom.png?v=1715908132', '', 0),
  ('gid://shopify/ProductVariant/44073362063537', 'gid://shopify/Product/7948058198193', 'Default Title', NULL, 44, NULL, 1, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Option2.png?v=1715908310', '', 0),
  ('gid://shopify/ProductVariant/44073366290609', 'gid://shopify/Product/7948059082929', 'Default Title', NULL, 99, 139, 1, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Bone.jpg?v=1715908377', '', 0),
  ('gid://shopify/ProductVariant/44073367961777', 'gid://shopify/Product/7948060065969', 'Default Title', NULL, 11, NULL, 0, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Mochila.png?v=1715908449', '', 0),
  ('gid://shopify/ProductVariant/44073370648753', 'gid://shopify/Product/7948061180081', 'Default Title', NULL, 3, 4, 0, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Caneta.png?v=1715908493', '', 0),
  ('gid://shopify/ProductVariant/44073376186545', 'gid://shopify/Product/7948063244465', 'Default Title', NULL, 44, 45, 1, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/image12.png?v=1715908627', '', 0),
  ('gid://shopify/ProductVariant/44253778804913', 'gid://shopify/Product/8017994252465', 'S / White', NULL, 40, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Hoodie01.png?v=1718374884', '', 0),
  ('gid://shopify/ProductVariant/44253778837681', 'gid://shopify/Product/8017994252465', 'S / LightBlue', NULL, 40, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Hoodie01.png?v=1718374884', '', 1),
  ('gid://shopify/ProductVariant/44253778870449', 'gid://shopify/Product/8017994252465', 'S / Gray', NULL, 40, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Hoodie01.png?v=1718374884', '', 2),
  ('gid://shopify/ProductVariant/44253778903217', 'gid://shopify/Product/8017994252465', 'M / White', NULL, 40, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Hoodie01.png?v=1718374884', '', 3),
  ('gid://shopify/ProductVariant/44253778935985', 'gid://shopify/Product/8017994252465', 'M / LightBlue', NULL, 40, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Hoodie01.png?v=1718374884', '', 4),
  ('gid://shopify/ProductVariant/44253778968753', 'gid://shopify/Product/8017994252465', 'M / Gray', NULL, 40, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Hoodie01.png?v=1718374884', '', 5),
  ('gid://shopify/ProductVariant/44253779001521', 'gid://shopify/Product/8017994252465', 'L / White', NULL, 40, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Hoodie01.png?v=1718374884', '', 6),
  ('gid://shopify/ProductVariant/44253779034289', 'gid://shopify/Product/8017994252465', 'L / LightBlue', NULL, 40, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Hoodie01.png?v=1718374884', '', 7),
  ('gid://shopify/ProductVariant/44253779067057', 'gid://shopify/Product/8017994252465', 'L / Gray', NULL, 40, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Hoodie01.png?v=1718374884', '', 8),
  ('gid://shopify/ProductVariant/44253779099825', 'gid://shopify/Product/8017994252465', 'XL / White', NULL, 40, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Hoodie01.png?v=1718374884', '', 9),
  ('gid://shopify/ProductVariant/44253779132593', 'gid://shopify/Product/8017994252465', 'XL / LightBlue', NULL, 40, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Hoodie01.png?v=1718374884', '', 10),
  ('gid://shopify/ProductVariant/44253779165361', 'gid://shopify/Product/8017994252465', 'XL / Gray', NULL, 40, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Hoodie01.png?v=1718374884', '', 11),
  ('gid://shopify/ProductVariant/44387240509617', 'gid://shopify/Product/8017999659185', 'White', NULL, 50, 38, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/MinimalistBackpack01.png?v=1718375563', 'White', 0),
  ('gid://shopify/ProductVariant/44253868097713', 'gid://shopify/Product/8018004148401', 'White', NULL, 20, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/OrganicBucketHat01.png?v=1718376053', 'White', 0),
  ('gid://shopify/ProductVariant/44253868130481', 'gid://shopify/Product/8018004148401', 'LightBlue', NULL, 20, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/OrganicBucketHat01.png?v=1718376053', 'White', 1);

INSERT INTO variants (variant_id, product_group_id, title, barcode, price, compare_at_price, available, quantity, image_url, image_alt, position) VALUES
  ('gid://shopify/ProductVariant/44253913055409', 'gid://shopify/Product/8018011291825', '1', NULL, 40, 50, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/HighTopCanvasShoes01.png?v=1718376705', '', 0),
  ('gid://shopify/ProductVariant/44253913088177', 'gid://shopify/Product/8018011291825', '1.5', NULL, 40, 50, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/HighTopCanvasShoes01.png?v=1718376705', '', 1),
  ('gid://shopify/ProductVariant/44253913120945', 'gid://shopify/Product/8018011291825', '2', NULL, 40, 50, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/HighTopCanvasShoes01.png?v=1718376705', '', 2),
  ('gid://shopify/ProductVariant/44253913153713', 'gid://shopify/Product/8018011291825', '2.5', NULL, 40, 50, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/HighTopCanvasShoes01.png?v=1718376705', '', 3),
  ('gid://shopify/ProductVariant/44253913186481', 'gid://shopify/Product/8018011291825', '3', NULL, 40, 50, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/HighTopCanvasShoes01.png?v=1718376705', '', 4),
  ('gid://shopify/ProductVariant/44253913219249', 'gid://shopify/Product/8018011291825', '3.5', NULL, 40, 50, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/HighTopCanvasShoes01.png?v=1718376705', '', 5),
  ('gid://shopify/ProductVariant/44253913252017', 'gid://shopify/Product/8018011291825', '4', NULL, 40, 50, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/HighTopCanvasShoes01.png?v=1718376705', '', 6),
  ('gid://shopify/ProductVariant/44253913284785', 'gid://shopify/Product/8018011291825', '4.5', NULL, 40, 50, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/HighTopCanvasShoes01.png?v=1718376705', '', 7),
  ('gid://shopify/ProductVariant/44387108978865', 'gid://shopify/Product/8028434006193', 'White / 7', NULL, 25, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Women_sSlides-01.png?v=1718959177', '', 0),
  ('gid://shopify/ProductVariant/44387109011633', 'gid://shopify/Product/8028434006193', 'White / 7.5', NULL, 25, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Women_sSlides-01.png?v=1718959177', '', 1),
  ('gid://shopify/ProductVariant/44387109044401', 'gid://shopify/Product/8028434006193', 'White / 8', NULL, 25, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Women_sSlides-01.png?v=1718959177', '', 2),
  ('gid://shopify/ProductVariant/44387109077169', 'gid://shopify/Product/8028434006193', 'White / 8.5', NULL, 25, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Women_sSlides-01.png?v=1718959177', '', 3),
  ('gid://shopify/ProductVariant/44387109109937', 'gid://shopify/Product/8028434006193', 'White / 9', NULL, 25, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Women_sSlides-01.png?v=1718959177', '', 4),
  ('gid://shopify/ProductVariant/44387109142705', 'gid://shopify/Product/8028434006193', 'White / 9.5', NULL, 25, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Women_sSlides-01.png?v=1718959177', '', 5),
  ('gid://shopify/ProductVariant/44387109175473', 'gid://shopify/Product/8028434006193', 'White / 10', NULL, 25, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Women_sSlides-01.png?v=1718959177', '', 6),
  ('gid://shopify/ProductVariant/44387109208241', 'gid://shopify/Product/8028434006193', 'White / 10.5', NULL, 25, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/Women_sSlides-01.png?v=1718959177', '', 7),
  ('gid://shopify/ProductVariant/44387181199537', 'gid://shopify/Product/8028449734833', 'White', NULL, 15, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/SnapCaseforiPhone_-01.png?v=1718959759', '', 0),
  ('gid://shopify/ProductVariant/44290541191345', 'gid://shopify/Product/8028458057905', 'Default Title', NULL, 12.5, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/EcoToteBag_Econscious.png?v=1718960341', '', 0),
  ('gid://shopify/ProductVariant/44349559308465', 'gid://shopify/Product/8028460482737', 'White', NULL, 25, NULL, 1, 18, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bagwhite2_f19309fe-ef20-4524-9abd-78b13961118c.png?v=1720113087', 'White', 0),
  ('gid://shopify/ProductVariant/44349559341233', 'gid://shopify/Product/8028460482737', 'DarkYellow', NULL, 25, NULL, 1, 17, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bagwhite2_f19309fe-ef20-4524-9abd-78b13961118c.png?v=1720113087', 'White', 1),
  ('gid://shopify/ProductVariant/44356910514353', 'gid://shopify/Product/8028460482737', 'DarkGreen', NULL, 25, NULL, 1, 18, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bagwhite2_f19309fe-ef20-4524-9abd-78b13961118c.png?v=1720113087', 'White', 2),
  ('gid://shopify/ProductVariant/45147561623729', 'gid://shopify/Product/8028460482737', 'DarkBlue', NULL, 25, NULL, 1, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bagwhite2_f19309fe-ef20-4524-9abd-78b13961118c.png?v=1720113087', 'White', 3),
  ('gid://shopify/ProductVariant/44387155345585', 'gid://shopify/Product/8028465987761', 'White / 7.5', NULL, 10, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/SublimationFlipFlops-01.png?v=1718961039', '', 0),
  ('gid://shopify/ProductVariant/44387155378353', 'gid://shopify/Product/8028465987761', 'White / 8', NULL, 10, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/SublimationFlipFlops-01.png?v=1718961039', '', 1),
  ('gid://shopify/ProductVariant/44387155411121', 'gid://shopify/Product/8028465987761', 'White / 8.5', NULL, 10, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/SublimationFlipFlops-01.png?v=1718961039', '', 2),
  ('gid://shopify/ProductVariant/44387155443889', 'gid://shopify/Product/8028465987761', 'White / 9', NULL, 10, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/SublimationFlipFlops-01.png?v=1718961039', '', 3),
  ('gid://shopify/ProductVariant/44387155476657', 'gid://shopify/Product/8028465987761', 'White / 9.5', NULL, 10, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/SublimationFlipFlops-01.png?v=1718961039', '', 4),
  ('gid://shopify/ProductVariant/44387155509425', 'gid://shopify/Product/8028465987761', 'White / 10', NULL, 10, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/SublimationFlipFlops-01.png?v=1718961039', '', 5),
  ('gid://shopify/ProductVariant/44388190257329', 'gid://shopify/Product/8028469428401', 'White', NULL, 8, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/InsulatedTumblerwithaStraw-01.png?v=1718961264', 'White', 0),
  ('gid://shopify/ProductVariant/44387173269681', 'gid://shopify/Product/8028471361713', 'White', NULL, 15, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/StainlessSteelWaterBottle-01.png?v=1718961427', '', 0),
  ('gid://shopify/ProductVariant/44388210835633', 'gid://shopify/Product/8028479979697', 'White / XS', NULL, 0, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/All-OverPrintBomberJacket-01.png?v=1718962143', 'White', 0),
  ('gid://shopify/ProductVariant/44388210868401', 'gid://shopify/Product/8028479979697', 'White / S', NULL, 0, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/All-OverPrintBomberJacket-01.png?v=1718962143', 'White', 1),
  ('gid://shopify/ProductVariant/44388210901169', 'gid://shopify/Product/8028479979697', 'White / M', NULL, 0, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/All-OverPrintBomberJacket-01.png?v=1718962143', 'White', 2),
  ('gid://shopify/ProductVariant/44388210933937', 'gid://shopify/Product/8028479979697', 'White / L', NULL, 0, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/All-OverPrintBomberJacket-01.png?v=1718962143', 'White', 3),
  ('gid://shopify/ProductVariant/44388210966705', 'gid://shopify/Product/8028479979697', 'White / XL', NULL, 0, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/All-OverPrintBomberJacket-01.png?v=1718962143', 'White', 4),
  ('gid://shopify/ProductVariant/44387222945969', 'gid://shopify/Product/8028483518641', 'White / XS', NULL, 22.5, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/PremiumSweatshirt_CottonHeritage.png?v=1718962431', 'White', 0),
  ('gid://shopify/ProductVariant/44387222978737', 'gid://shopify/Product/8028483518641', 'White / S', NULL, 22.5, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/PremiumSweatshirt_CottonHeritage.png?v=1718962431', 'White', 1),
  ('gid://shopify/ProductVariant/44387223011505', 'gid://shopify/Product/8028483518641', 'White / M', NULL, 22.5, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/PremiumSweatshirt_CottonHeritage.png?v=1718962431', 'White', 2),
  ('gid://shopify/ProductVariant/44387223044273', 'gid://shopify/Product/8028483518641', 'White / L', NULL, 22.5, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/PremiumSweatshirt_CottonHeritage.png?v=1718962431', 'White', 3),
  ('gid://shopify/ProductVariant/44387223077041', 'gid://shopify/Product/8028483518641', 'White / XL', NULL, 22.5, NULL, 1, 20, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/PremiumSweatshirt_CottonHeritage.png?v=1718962431', 'White', 4);

INSERT INTO variants (variant_id, product_group_id, title, barcode, price, compare_at_price, available, quantity, image_url, image_alt, position) VALUES
  ('gid://shopify/ProductVariant/44349535125681', 'gid://shopify/Product/8053302821041', 'White', NULL, 70, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hoodie1white_7bba5f48-51c0-415f-8164-5b87f8d4e2a1.png?v=1720104676', 'White', 0),
  ('gid://shopify/ProductVariant/44349535158449', 'gid://shopify/Product/8053302821041', 'LightBlue', NULL, 70, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hoodie1white_7bba5f48-51c0-415f-8164-5b87f8d4e2a1.png?v=1720104676', 'White', 1),
  ('gid://shopify/ProductVariant/44356536991921', 'gid://shopify/Product/8053302821041', 'DarkGreen', NULL, 70, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hoodie1white_7bba5f48-51c0-415f-8164-5b87f8d4e2a1.png?v=1720104676', 'White', 2),
  ('gid://shopify/ProductVariant/44358659965105', 'gid://shopify/Product/8055939563697', 'White', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/winterhatwhite_4401879a-3ef0-482c-93b9-9fddfc6196a4.png?v=1720207452', '', 0),
  ('gid://shopify/ProductVariant/44358659997873', 'gid://shopify/Product/8055939563697', 'DarkBlue', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/winterhatwhite_4401879a-3ef0-482c-93b9-9fddfc6196a4.png?v=1720207452', '', 1),
  ('gid://shopify/ProductVariant/44358660030641', 'gid://shopify/Product/8055939563697', 'DarkYellow', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/winterhatwhite_4401879a-3ef0-482c-93b9-9fddfc6196a4.png?v=1720207452', '', 2),
  ('gid://shopify/ProductVariant/44358660063409', 'gid://shopify/Product/8055939563697', 'DarkGreen', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/winterhatwhite_4401879a-3ef0-482c-93b9-9fddfc6196a4.png?v=1720207452', '', 3),
  ('gid://shopify/ProductVariant/44362957095089', 'gid://shopify/Product/8058167787697', 'White', NULL, 15, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugwhite.png?v=1720203455', '', 0),
  ('gid://shopify/ProductVariant/44362957160625', 'gid://shopify/Product/8058167787697', 'DarkGreen', NULL, 15, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugwhite.png?v=1720203455', '', 1),
  ('gid://shopify/ProductVariant/44362957193393', 'gid://shopify/Product/8058167787697', 'DarkBlue', NULL, 15, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugwhite.png?v=1720203455', '', 2),
  ('gid://shopify/ProductVariant/44362957127857', 'gid://shopify/Product/8058167787697', 'DarkYellow', NULL, 15, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/mugwhite.png?v=1720203455', '', 3),
  ('gid://shopify/ProductVariant/44363187880113', 'gid://shopify/Product/8058279133361', 'White / XS', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 0),
  ('gid://shopify/ProductVariant/44363187912881', 'gid://shopify/Product/8058279133361', 'White / S', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 1),
  ('gid://shopify/ProductVariant/44363187945649', 'gid://shopify/Product/8058279133361', 'White / M', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 2),
  ('gid://shopify/ProductVariant/44363187978417', 'gid://shopify/Product/8058279133361', 'White / L', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 3),
  ('gid://shopify/ProductVariant/44363188011185', 'gid://shopify/Product/8058279133361', 'White / XL', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 4),
  ('gid://shopify/ProductVariant/44363188043953', 'gid://shopify/Product/8058279133361', 'DarkYellow / XS', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 5),
  ('gid://shopify/ProductVariant/44363188076721', 'gid://shopify/Product/8058279133361', 'DarkYellow / S', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 6),
  ('gid://shopify/ProductVariant/44363188109489', 'gid://shopify/Product/8058279133361', 'DarkYellow / M', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 7),
  ('gid://shopify/ProductVariant/44363188142257', 'gid://shopify/Product/8058279133361', 'DarkYellow / L', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 8),
  ('gid://shopify/ProductVariant/44363188175025', 'gid://shopify/Product/8058279133361', 'DarkYellow / XL', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 9),
  ('gid://shopify/ProductVariant/44363188207793', 'gid://shopify/Product/8058279133361', 'DarkGreen / XS', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 10),
  ('gid://shopify/ProductVariant/44363188240561', 'gid://shopify/Product/8058279133361', 'DarkGreen / S', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 11),
  ('gid://shopify/ProductVariant/44363188273329', 'gid://shopify/Product/8058279133361', 'DarkGreen / M', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 12),
  ('gid://shopify/ProductVariant/44363188306097', 'gid://shopify/Product/8058279133361', 'DarkGreen / L', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 13),
  ('gid://shopify/ProductVariant/44363188338865', 'gid://shopify/Product/8058279133361', 'DarkGreen / XL', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 14),
  ('gid://shopify/ProductVariant/44363188535473', 'gid://shopify/Product/8058279133361', 'Black / XS', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 15),
  ('gid://shopify/ProductVariant/44363188568241', 'gid://shopify/Product/8058279133361', 'Black / S', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 16),
  ('gid://shopify/ProductVariant/44363188601009', 'gid://shopify/Product/8058279133361', 'Black / M', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 17),
  ('gid://shopify/ProductVariant/44363188633777', 'gid://shopify/Product/8058279133361', 'Black / L', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 18),
  ('gid://shopify/ProductVariant/44363188666545', 'gid://shopify/Product/8058279133361', 'Black / XL', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/womenshirtwhite_7bd5efae-e5a2-47de-a6db-956a2766ede7.png?v=1720211357', 'White', 19),
  ('gid://shopify/ProductVariant/44376551227569', 'gid://shopify/Product/8062721458353', 'White', NULL, 19, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bottlewhite_fd186736-da4f-4357-9ebd-83c2cfdd272d.png?v=1720448231', '', 0),
  ('gid://shopify/ProductVariant/44376551260337', 'gid://shopify/Product/8062721458353', 'Black', NULL, 19, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bottlewhite_fd186736-da4f-4357-9ebd-83c2cfdd272d.png?v=1720448231', '', 1),
  ('gid://shopify/ProductVariant/44376551293105', 'gid://shopify/Product/8062721458353', 'DarkGreen', NULL, 19, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bottlewhite_fd186736-da4f-4357-9ebd-83c2cfdd272d.png?v=1720448231', '', 2),
  ('gid://shopify/ProductVariant/44376551325873', 'gid://shopify/Product/8062721458353', 'DarkBlue', NULL, 19, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bottlewhite_fd186736-da4f-4357-9ebd-83c2cfdd272d.png?v=1720448231', '', 3),
  ('gid://shopify/ProductVariant/44376551358641', 'gid://shopify/Product/8062721458353', 'DarkYellow', NULL, 19, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/bottlewhite_fd186736-da4f-4357-9ebd-83c2cfdd272d.png?v=1720448231', '', 4),
  ('gid://shopify/ProductVariant/44376707039409', 'gid://shopify/Product/8062743281841', 'White', NULL, 15, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookwhite.png?v=1720450803', 'White', 0),
  ('gid://shopify/ProductVariant/44376707072177', 'gid://shopify/Product/8062743281841', 'Black', NULL, 15, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookwhite.png?v=1720450803', 'White', 1),
  ('gid://shopify/ProductVariant/44376707104945', 'gid://shopify/Product/8062743281841', 'DarkGreen', NULL, 15, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookwhite.png?v=1720450803', 'White', 2),
  ('gid://shopify/ProductVariant/44376603787441', 'gid://shopify/Product/8062743281841', 'DarkBlue', NULL, 15, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookwhite.png?v=1720450803', 'White', 3);

INSERT INTO variants (variant_id, product_group_id, title, barcode, price, compare_at_price, available, quantity, image_url, image_alt, position) VALUES
  ('gid://shopify/ProductVariant/44376707137713', 'gid://shopify/Product/8062743281841', 'DarkYellow', NULL, 15, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/notebookwhite.png?v=1720450803', 'White', 4),
  ('gid://shopify/ProductVariant/44376959582385', 'gid://shopify/Product/8062864588977', 'White', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowwhite.png?v=1720454987', 'White', 0),
  ('gid://shopify/ProductVariant/44376959615153', 'gid://shopify/Product/8062864588977', 'Black', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowwhite.png?v=1720454987', 'White', 1),
  ('gid://shopify/ProductVariant/44376959647921', 'gid://shopify/Product/8062864588977', 'DarkGreen', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowwhite.png?v=1720454987', 'White', 2),
  ('gid://shopify/ProductVariant/44376959680689', 'gid://shopify/Product/8062864588977', 'DarkBlue', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowwhite.png?v=1720454987', 'White', 3),
  ('gid://shopify/ProductVariant/44376959713457', 'gid://shopify/Product/8062864588977', 'DarkYellow', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/pillowwhite.png?v=1720454987', 'White', 4),
  ('gid://shopify/ProductVariant/44387232350385', 'gid://shopify/Product/8063131091121', 'White / S', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 0),
  ('gid://shopify/ProductVariant/44377571623089', 'gid://shopify/Product/8063131091121', 'White / XS', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 1),
  ('gid://shopify/ProductVariant/44387232383153', 'gid://shopify/Product/8063131091121', 'White / M', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 2),
  ('gid://shopify/ProductVariant/44387232415921', 'gid://shopify/Product/8063131091121', 'White / L', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 3),
  ('gid://shopify/ProductVariant/44387232448689', 'gid://shopify/Product/8063131091121', 'White / XL', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 4),
  ('gid://shopify/ProductVariant/44387232481457', 'gid://shopify/Product/8063131091121', 'Black / S', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 5),
  ('gid://shopify/ProductVariant/44377571655857', 'gid://shopify/Product/8063131091121', 'Black / XS', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 6),
  ('gid://shopify/ProductVariant/44387232514225', 'gid://shopify/Product/8063131091121', 'Black / M', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 7),
  ('gid://shopify/ProductVariant/44387232546993', 'gid://shopify/Product/8063131091121', 'Black / L', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 8),
  ('gid://shopify/ProductVariant/44387232579761', 'gid://shopify/Product/8063131091121', 'Black / XL', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 9),
  ('gid://shopify/ProductVariant/44387232612529', 'gid://shopify/Product/8063131091121', 'DarkGreen / S', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 10),
  ('gid://shopify/ProductVariant/44377571688625', 'gid://shopify/Product/8063131091121', 'DarkGreen / XS', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 11),
  ('gid://shopify/ProductVariant/44387232645297', 'gid://shopify/Product/8063131091121', 'DarkGreen / M', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 12),
  ('gid://shopify/ProductVariant/44387232678065', 'gid://shopify/Product/8063131091121', 'DarkGreen / L', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 13),
  ('gid://shopify/ProductVariant/44387232710833', 'gid://shopify/Product/8063131091121', 'DarkGreen / XL', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 14),
  ('gid://shopify/ProductVariant/44387232743601', 'gid://shopify/Product/8063131091121', 'DarkBlue / S', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 15),
  ('gid://shopify/ProductVariant/44377571721393', 'gid://shopify/Product/8063131091121', 'DarkBlue / XS', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 16),
  ('gid://shopify/ProductVariant/44387232776369', 'gid://shopify/Product/8063131091121', 'DarkBlue / M', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 17),
  ('gid://shopify/ProductVariant/44387232809137', 'gid://shopify/Product/8063131091121', 'DarkBlue / L', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 18),
  ('gid://shopify/ProductVariant/44387232841905', 'gid://shopify/Product/8063131091121', 'DarkBlue / XL', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 19),
  ('gid://shopify/ProductVariant/44387232874673', 'gid://shopify/Product/8063131091121', 'DarkYellow / S', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 20),
  ('gid://shopify/ProductVariant/44377571754161', 'gid://shopify/Product/8063131091121', 'DarkYellow / XS', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 21),
  ('gid://shopify/ProductVariant/44387232907441', 'gid://shopify/Product/8063131091121', 'DarkYellow / M', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 22),
  ('gid://shopify/ProductVariant/44387232940209', 'gid://shopify/Product/8063131091121', 'DarkYellow / L', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 23),
  ('gid://shopify/ProductVariant/44387232972977', 'gid://shopify/Product/8063131091121', 'DarkYellow / XL', NULL, 35, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/oversizewhite.png?v=1720468627', '', 24),
  ('gid://shopify/ProductVariant/44377712853169', 'gid://shopify/Product/8063210782897', 'White / XS', NULL, 65, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/rainjackwhite1.png?v=1720476378', 'White', 0),
  ('gid://shopify/ProductVariant/44377712885937', 'gid://shopify/Product/8063210782897', 'White / S', NULL, 65, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/rainjackwhite1.png?v=1720476378', 'White', 1),
  ('gid://shopify/ProductVariant/44377712918705', 'gid://shopify/Product/8063210782897', 'White / M', NULL, 65, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/rainjackwhite1.png?v=1720476378', 'White', 2),
  ('gid://shopify/ProductVariant/44377712951473', 'gid://shopify/Product/8063210782897', 'White / L', NULL, 65, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/rainjackwhite1.png?v=1720476378', 'White', 3),
  ('gid://shopify/ProductVariant/44377712984241', 'gid://shopify/Product/8063210782897', 'White / XL', NULL, 65, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/rainjackwhite1.png?v=1720476378', 'White', 4),
  ('gid://shopify/ProductVariant/44377713017009', 'gid://shopify/Product/8063210782897', 'Black / XS', NULL, 65, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/rainjackwhite1.png?v=1720476378', 'White', 5),
  ('gid://shopify/ProductVariant/44377713049777', 'gid://shopify/Product/8063210782897', 'Black / S', NULL, 65, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/rainjackwhite1.png?v=1720476378', 'White', 6),
  ('gid://shopify/ProductVariant/44377713082545', 'gid://shopify/Product/8063210782897', 'Black / M', NULL, 65, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/rainjackwhite1.png?v=1720476378', 'White', 7),
  ('gid://shopify/ProductVariant/44377713115313', 'gid://shopify/Product/8063210782897', 'Black / L', NULL, 65, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/rainjackwhite1.png?v=1720476378', 'White', 8);

INSERT INTO variants (variant_id, product_group_id, title, barcode, price, compare_at_price, available, quantity, image_url, image_alt, position) VALUES
  ('gid://shopify/ProductVariant/44377713148081', 'gid://shopify/Product/8063210782897', 'Black / XL', NULL, 65, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/rainjackwhite1.png?v=1720476378', 'White', 9),
  ('gid://shopify/ProductVariant/44379882553521', 'gid://shopify/Product/8064139296945', 'White / XS', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 0),
  ('gid://shopify/ProductVariant/44379882586289', 'gid://shopify/Product/8064139296945', 'White / S', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 1),
  ('gid://shopify/ProductVariant/44379882619057', 'gid://shopify/Product/8064139296945', 'White / M', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 2),
  ('gid://shopify/ProductVariant/44379882651825', 'gid://shopify/Product/8064139296945', 'White / L', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 3),
  ('gid://shopify/ProductVariant/44379882684593', 'gid://shopify/Product/8064139296945', 'White / XL', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 4),
  ('gid://shopify/ProductVariant/44379882717361', 'gid://shopify/Product/8064139296945', 'Black / XS', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 5),
  ('gid://shopify/ProductVariant/44379882750129', 'gid://shopify/Product/8064139296945', 'Black / S', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 6),
  ('gid://shopify/ProductVariant/44379882782897', 'gid://shopify/Product/8064139296945', 'Black / M', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 7),
  ('gid://shopify/ProductVariant/44379882815665', 'gid://shopify/Product/8064139296945', 'Black / L', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 8),
  ('gid://shopify/ProductVariant/44379882848433', 'gid://shopify/Product/8064139296945', 'Black / XL', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 9),
  ('gid://shopify/ProductVariant/44379882881201', 'gid://shopify/Product/8064139296945', 'DarkBlue / XS', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 10),
  ('gid://shopify/ProductVariant/44379882913969', 'gid://shopify/Product/8064139296945', 'DarkBlue / S', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 11),
  ('gid://shopify/ProductVariant/44379882946737', 'gid://shopify/Product/8064139296945', 'DarkBlue / M', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 12),
  ('gid://shopify/ProductVariant/44379882979505', 'gid://shopify/Product/8064139296945', 'DarkBlue / L', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 13),
  ('gid://shopify/ProductVariant/44379883012273', 'gid://shopify/Product/8064139296945', 'DarkBlue / XL', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 14),
  ('gid://shopify/ProductVariant/44379883045041', 'gid://shopify/Product/8064139296945', 'DarkGreen / XS', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 15),
  ('gid://shopify/ProductVariant/44379883077809', 'gid://shopify/Product/8064139296945', 'DarkGreen / S', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 16),
  ('gid://shopify/ProductVariant/44379883110577', 'gid://shopify/Product/8064139296945', 'DarkGreen / M', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 17),
  ('gid://shopify/ProductVariant/44379883143345', 'gid://shopify/Product/8064139296945', 'DarkGreen / L', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 18),
  ('gid://shopify/ProductVariant/44379883176113', 'gid://shopify/Product/8064139296945', 'DarkGreen / XL', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 19),
  ('gid://shopify/ProductVariant/44379883208881', 'gid://shopify/Product/8064139296945', 'DarkYellow / XS', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 20),
  ('gid://shopify/ProductVariant/44379883241649', 'gid://shopify/Product/8064139296945', 'DarkYellow / S', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 21),
  ('gid://shopify/ProductVariant/44379883274417', 'gid://shopify/Product/8064139296945', 'DarkYellow / M', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 22),
  ('gid://shopify/ProductVariant/44379883307185', 'gid://shopify/Product/8064139296945', 'DarkYellow / L', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 23),
  ('gid://shopify/ProductVariant/44379883339953', 'gid://shopify/Product/8064139296945', 'DarkYellow / XL', NULL, 45, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/sweatwhite.png?v=1720542637', '', 24),
  ('gid://shopify/ProductVariant/44379963949233', 'gid://shopify/Product/8064194740401', 'Black / XS', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 0),
  ('gid://shopify/ProductVariant/44379963982001', 'gid://shopify/Product/8064194740401', 'Black / S', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 1),
  ('gid://shopify/ProductVariant/44379964014769', 'gid://shopify/Product/8064194740401', 'Black / M', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 2),
  ('gid://shopify/ProductVariant/44379964047537', 'gid://shopify/Product/8064194740401', 'Black / L', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 3),
  ('gid://shopify/ProductVariant/44379964080305', 'gid://shopify/Product/8064194740401', 'Black / XL', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 4),
  ('gid://shopify/ProductVariant/44379965325489', 'gid://shopify/Product/8064194740401', 'White / XS', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 5),
  ('gid://shopify/ProductVariant/44379965358257', 'gid://shopify/Product/8064194740401', 'White / S', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 6),
  ('gid://shopify/ProductVariant/44379965391025', 'gid://shopify/Product/8064194740401', 'White / M', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 7),
  ('gid://shopify/ProductVariant/44379965423793', 'gid://shopify/Product/8064194740401', 'White / L', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 8),
  ('gid://shopify/ProductVariant/44379965456561', 'gid://shopify/Product/8064194740401', 'White / XL', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 9),
  ('gid://shopify/ProductVariant/44379965489329', 'gid://shopify/Product/8064194740401', 'DarkGreen / XS', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 10),
  ('gid://shopify/ProductVariant/44379965522097', 'gid://shopify/Product/8064194740401', 'DarkGreen / S', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 11),
  ('gid://shopify/ProductVariant/44379965554865', 'gid://shopify/Product/8064194740401', 'DarkGreen / M', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 12),
  ('gid://shopify/ProductVariant/44379965587633', 'gid://shopify/Product/8064194740401', 'DarkGreen / L', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 13);

INSERT INTO variants (variant_id, product_group_id, title, barcode, price, compare_at_price, available, quantity, image_url, image_alt, position) VALUES
  ('gid://shopify/ProductVariant/44379965620401', 'gid://shopify/Product/8064194740401', 'DarkGreen / XL', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 14),
  ('gid://shopify/ProductVariant/44379965653169', 'gid://shopify/Product/8064194740401', 'DarkBlue / XS', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 15),
  ('gid://shopify/ProductVariant/44379965685937', 'gid://shopify/Product/8064194740401', 'DarkBlue / S', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 16),
  ('gid://shopify/ProductVariant/44379965718705', 'gid://shopify/Product/8064194740401', 'DarkBlue / M', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 17),
  ('gid://shopify/ProductVariant/44379965751473', 'gid://shopify/Product/8064194740401', 'DarkBlue / L', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 18),
  ('gid://shopify/ProductVariant/44379965784241', 'gid://shopify/Product/8064194740401', 'DarkBlue / XL', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 19),
  ('gid://shopify/ProductVariant/44379965817009', 'gid://shopify/Product/8064194740401', 'DarkYellow / XS', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 20),
  ('gid://shopify/ProductVariant/44379965849777', 'gid://shopify/Product/8064194740401', 'DarkYellow / S', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 21),
  ('gid://shopify/ProductVariant/44379965882545', 'gid://shopify/Product/8064194740401', 'DarkYellow / M', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 22),
  ('gid://shopify/ProductVariant/44379965915313', 'gid://shopify/Product/8064194740401', 'DarkYellow / L', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 23),
  ('gid://shopify/ProductVariant/44379965948081', 'gid://shopify/Product/8064194740401', 'DarkYellow / XL', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/wshirtwhite.png?v=1720544147', '', 24),
  ('gid://shopify/ProductVariant/44380253782193', 'gid://shopify/Product/8064252870833', 'White / XS', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite1.png?v=1720547464', 'White', 0),
  ('gid://shopify/ProductVariant/44380253814961', 'gid://shopify/Product/8064252870833', 'White / S', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite1.png?v=1720547464', 'White', 1),
  ('gid://shopify/ProductVariant/44380253847729', 'gid://shopify/Product/8064252870833', 'White / M', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite1.png?v=1720547464', 'White', 2),
  ('gid://shopify/ProductVariant/44380253880497', 'gid://shopify/Product/8064252870833', 'White / L', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite1.png?v=1720547464', 'White', 3),
  ('gid://shopify/ProductVariant/44380253913265', 'gid://shopify/Product/8064252870833', 'White / XL', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite1.png?v=1720547464', 'White', 4),
  ('gid://shopify/ProductVariant/44380253946033', 'gid://shopify/Product/8064252870833', 'Black / XS', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite1.png?v=1720547464', 'White', 5),
  ('gid://shopify/ProductVariant/44380253978801', 'gid://shopify/Product/8064252870833', 'Black / S', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite1.png?v=1720547464', 'White', 6),
  ('gid://shopify/ProductVariant/44380254011569', 'gid://shopify/Product/8064252870833', 'Black / M', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite1.png?v=1720547464', 'White', 7),
  ('gid://shopify/ProductVariant/44380254044337', 'gid://shopify/Product/8064252870833', 'Black / L', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite1.png?v=1720547464', 'White', 8),
  ('gid://shopify/ProductVariant/44380254077105', 'gid://shopify/Product/8064252870833', 'Black / XL', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite1.png?v=1720547464', 'White', 9),
  ('gid://shopify/ProductVariant/44380254109873', 'gid://shopify/Product/8064252870833', 'DarkGreen / XS', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite1.png?v=1720547464', 'White', 10),
  ('gid://shopify/ProductVariant/44380254142641', 'gid://shopify/Product/8064252870833', 'DarkGreen / S', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite1.png?v=1720547464', 'White', 11),
  ('gid://shopify/ProductVariant/44380254175409', 'gid://shopify/Product/8064252870833', 'DarkGreen / M', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite1.png?v=1720547464', 'White', 12),
  ('gid://shopify/ProductVariant/44380254208177', 'gid://shopify/Product/8064252870833', 'DarkGreen / L', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite1.png?v=1720547464', 'White', 13),
  ('gid://shopify/ProductVariant/44380254240945', 'gid://shopify/Product/8064252870833', 'DarkGreen / XL', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite1.png?v=1720547464', 'White', 14),
  ('gid://shopify/ProductVariant/44380266332337', 'gid://shopify/Product/8064255099057', 'White / XS', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite2.png?v=1720547598', 'White', 0),
  ('gid://shopify/ProductVariant/44380266365105', 'gid://shopify/Product/8064255099057', 'White / S', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite2.png?v=1720547598', 'White', 1),
  ('gid://shopify/ProductVariant/44380266397873', 'gid://shopify/Product/8064255099057', 'White / M', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite2.png?v=1720547598', 'White', 2),
  ('gid://shopify/ProductVariant/44380266430641', 'gid://shopify/Product/8064255099057', 'White / L', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite2.png?v=1720547598', 'White', 3),
  ('gid://shopify/ProductVariant/44380266463409', 'gid://shopify/Product/8064255099057', 'White / XL', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite2.png?v=1720547598', 'White', 4),
  ('gid://shopify/ProductVariant/44380266496177', 'gid://shopify/Product/8064255099057', 'Black / XS', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite2.png?v=1720547598', 'White', 5),
  ('gid://shopify/ProductVariant/44380266528945', 'gid://shopify/Product/8064255099057', 'Black / S', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite2.png?v=1720547598', 'White', 6),
  ('gid://shopify/ProductVariant/44380266561713', 'gid://shopify/Product/8064255099057', 'Black / M', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite2.png?v=1720547598', 'White', 7),
  ('gid://shopify/ProductVariant/44380266594481', 'gid://shopify/Product/8064255099057', 'Black / L', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite2.png?v=1720547598', 'White', 8),
  ('gid://shopify/ProductVariant/44380266627249', 'gid://shopify/Product/8064255099057', 'Black / XL', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite2.png?v=1720547598', 'White', 9),
  ('gid://shopify/ProductVariant/44380266660017', 'gid://shopify/Product/8064255099057', 'DarkGreen / XS', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite2.png?v=1720547598', 'White', 10),
  ('gid://shopify/ProductVariant/44380266692785', 'gid://shopify/Product/8064255099057', 'DarkGreen / S', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite2.png?v=1720547598', 'White', 11),
  ('gid://shopify/ProductVariant/44380266725553', 'gid://shopify/Product/8064255099057', 'DarkGreen / M', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite2.png?v=1720547598', 'White', 12),
  ('gid://shopify/ProductVariant/44380266758321', 'gid://shopify/Product/8064255099057', 'DarkGreen / L', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite2.png?v=1720547598', 'White', 13);

INSERT INTO variants (variant_id, product_group_id, title, barcode, price, compare_at_price, available, quantity, image_url, image_alt, position) VALUES
  ('gid://shopify/ProductVariant/44380266791089', 'gid://shopify/Product/8064255099057', 'DarkGreen / XL', NULL, 20, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidshirtwhite2.png?v=1720547598', 'White', 14),
  ('gid://shopify/ProductVariant/44380685631665', 'gid://shopify/Product/8064416579761', 'White / XS', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidsweatwhite.png?v=1720559566', 'White', 0),
  ('gid://shopify/ProductVariant/44380685664433', 'gid://shopify/Product/8064416579761', 'White / S', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidsweatwhite.png?v=1720559566', 'White', 1),
  ('gid://shopify/ProductVariant/44380685697201', 'gid://shopify/Product/8064416579761', 'White / M', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidsweatwhite.png?v=1720559566', 'White', 2),
  ('gid://shopify/ProductVariant/44380685729969', 'gid://shopify/Product/8064416579761', 'White / L', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidsweatwhite.png?v=1720559566', 'White', 3),
  ('gid://shopify/ProductVariant/44380685762737', 'gid://shopify/Product/8064416579761', 'White / XL', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidsweatwhite.png?v=1720559566', 'White', 4),
  ('gid://shopify/ProductVariant/44380685795505', 'gid://shopify/Product/8064416579761', 'Black / XS', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidsweatwhite.png?v=1720559566', 'White', 5),
  ('gid://shopify/ProductVariant/44380685828273', 'gid://shopify/Product/8064416579761', 'Black / S', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidsweatwhite.png?v=1720559566', 'White', 6),
  ('gid://shopify/ProductVariant/44380685861041', 'gid://shopify/Product/8064416579761', 'Black / M', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidsweatwhite.png?v=1720559566', 'White', 7),
  ('gid://shopify/ProductVariant/44380685893809', 'gid://shopify/Product/8064416579761', 'Black / L', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidsweatwhite.png?v=1720559566', 'White', 8),
  ('gid://shopify/ProductVariant/44380685926577', 'gid://shopify/Product/8064416579761', 'Black / XL', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidsweatwhite.png?v=1720559566', 'White', 9),
  ('gid://shopify/ProductVariant/44380685959345', 'gid://shopify/Product/8064416579761', 'DarkGreen / XS', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidsweatwhite.png?v=1720559566', 'White', 10),
  ('gid://shopify/ProductVariant/44380685992113', 'gid://shopify/Product/8064416579761', 'DarkGreen / S', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidsweatwhite.png?v=1720559566', 'White', 11),
  ('gid://shopify/ProductVariant/44380686024881', 'gid://shopify/Product/8064416579761', 'DarkGreen / M', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidsweatwhite.png?v=1720559566', 'White', 12),
  ('gid://shopify/ProductVariant/44380686057649', 'gid://shopify/Product/8064416579761', 'DarkGreen / L', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidsweatwhite.png?v=1720559566', 'White', 13),
  ('gid://shopify/ProductVariant/44380686090417', 'gid://shopify/Product/8064416579761', 'DarkGreen / XL', NULL, 29, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidsweatwhite.png?v=1720559566', 'White', 14),
  ('gid://shopify/ProductVariant/44380819194033', 'gid://shopify/Product/8064452657329', 'White', NULL, 25, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hatwhite1.png?v=1720561913', '', 0),
  ('gid://shopify/ProductVariant/44380819226801', 'gid://shopify/Product/8064452657329', 'Black', NULL, 25, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hatwhite1.png?v=1720561913', '', 1),
  ('gid://shopify/ProductVariant/44380819259569', 'gid://shopify/Product/8064452657329', 'DarkBlue', NULL, 25, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hatwhite1.png?v=1720561913', '', 2),
  ('gid://shopify/ProductVariant/44380819292337', 'gid://shopify/Product/8064452657329', 'DarkGreen', NULL, 25, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hatwhite1.png?v=1720561913', '', 3),
  ('gid://shopify/ProductVariant/44380819325105', 'gid://shopify/Product/8064452657329', 'DarkYellow', NULL, 25, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/hatwhite1.png?v=1720561913', '', 4),
  ('gid://shopify/ProductVariant/44380862939313', 'gid://shopify/Product/8064464126129', 'White / XS', NULL, 0, NULL, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/webdevwhite.png?v=1720562681', 'White', 0),
  ('gid://shopify/ProductVariant/44380862972081', 'gid://shopify/Product/8064464126129', 'White / S', NULL, 0, NULL, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/webdevwhite.png?v=1720562681', 'White', 1),
  ('gid://shopify/ProductVariant/44380863004849', 'gid://shopify/Product/8064464126129', 'White / M', NULL, 0, NULL, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/webdevwhite.png?v=1720562681', 'White', 2),
  ('gid://shopify/ProductVariant/44380863037617', 'gid://shopify/Product/8064464126129', 'White / L', NULL, 0, NULL, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/webdevwhite.png?v=1720562681', 'White', 3),
  ('gid://shopify/ProductVariant/44380863070385', 'gid://shopify/Product/8064464126129', 'White / XL', NULL, 0, NULL, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/webdevwhite.png?v=1720562681', 'White', 4),
  ('gid://shopify/ProductVariant/44380863103153', 'gid://shopify/Product/8064464126129', 'Black / XS', NULL, 0, NULL, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/webdevwhite.png?v=1720562681', 'White', 5),
  ('gid://shopify/ProductVariant/44380863135921', 'gid://shopify/Product/8064464126129', 'Black / S', NULL, 0, NULL, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/webdevwhite.png?v=1720562681', 'White', 6),
  ('gid://shopify/ProductVariant/44380863168689', 'gid://shopify/Product/8064464126129', 'Black / M', NULL, 0, NULL, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/webdevwhite.png?v=1720562681', 'White', 7),
  ('gid://shopify/ProductVariant/44380863201457', 'gid://shopify/Product/8064464126129', 'Black / L', NULL, 0, NULL, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/webdevwhite.png?v=1720562681', 'White', 8),
  ('gid://shopify/ProductVariant/44380863234225', 'gid://shopify/Product/8064464126129', 'Black / XL', NULL, 0, NULL, 1, 100, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/webdevwhite.png?v=1720562681', 'White', 9),
  ('gid://shopify/ProductVariant/44380894003377', 'gid://shopify/Product/8064476217521', 'White / XS', NULL, 30, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatwhite2.png?v=1720563225', 'White', 0),
  ('gid://shopify/ProductVariant/44380894036145', 'gid://shopify/Product/8064476217521', 'White / S', NULL, 30, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatwhite2.png?v=1720563225', 'White', 1),
  ('gid://shopify/ProductVariant/44380894068913', 'gid://shopify/Product/8064476217521', 'White / M', NULL, 30, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatwhite2.png?v=1720563225', 'White', 2),
  ('gid://shopify/ProductVariant/44380894101681', 'gid://shopify/Product/8064476217521', 'White / L', NULL, 30, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatwhite2.png?v=1720563225', 'White', 3),
  ('gid://shopify/ProductVariant/44380894134449', 'gid://shopify/Product/8064476217521', 'White / XL', NULL, 30, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatwhite2.png?v=1720563225', 'White', 4),
  ('gid://shopify/ProductVariant/44380894167217', 'gid://shopify/Product/8064476217521', 'Black / XS', NULL, 30, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatwhite2.png?v=1720563225', 'White', 5),
  ('gid://shopify/ProductVariant/44380894199985', 'gid://shopify/Product/8064476217521', 'Black / S', NULL, 30, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatwhite2.png?v=1720563225', 'White', 6),
  ('gid://shopify/ProductVariant/44380894232753', 'gid://shopify/Product/8064476217521', 'Black / M', NULL, 30, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatwhite2.png?v=1720563225', 'White', 7),
  ('gid://shopify/ProductVariant/44380894265521', 'gid://shopify/Product/8064476217521', 'Black / L', NULL, 30, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatwhite2.png?v=1720563225', 'White', 8);

INSERT INTO variants (variant_id, product_group_id, title, barcode, price, compare_at_price, available, quantity, image_url, image_alt, position) VALUES
  ('gid://shopify/ProductVariant/44380894298289', 'gid://shopify/Product/8064476217521', 'Black / XL', NULL, 30, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatwhite2.png?v=1720563225', 'White', 9),
  ('gid://shopify/ProductVariant/44380894331057', 'gid://shopify/Product/8064476217521', 'DarkGreen / XS', NULL, 30, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatwhite2.png?v=1720563225', 'White', 10),
  ('gid://shopify/ProductVariant/44380894363825', 'gid://shopify/Product/8064476217521', 'DarkGreen / S', NULL, 30, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatwhite2.png?v=1720563225', 'White', 11),
  ('gid://shopify/ProductVariant/44380894396593', 'gid://shopify/Product/8064476217521', 'DarkGreen / M', NULL, 30, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatwhite2.png?v=1720563225', 'White', 12),
  ('gid://shopify/ProductVariant/44380894429361', 'gid://shopify/Product/8064476217521', 'DarkGreen / L', NULL, 30, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatwhite2.png?v=1720563225', 'White', 13),
  ('gid://shopify/ProductVariant/44380894462129', 'gid://shopify/Product/8064476217521', 'DarkGreen / XL', NULL, 30, NULL, 1, 50, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/kidssweatwhite2.png?v=1720563225', 'White', 14),
  ('gid://shopify/ProductVariant/47781418401969', 'gid://shopify/Product/9092843339953', 'Default Title', NULL, 89, NULL, 0, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/ChatGPT_Image_Jul_27_2026_05_43_37_PM_08be1f13-f559-4d18-afc6-6f019b05e312.png?v=1785193117', 'Deco Tee White - Front', 0),
  ('gid://shopify/ProductVariant/47781418500273', 'gid://shopify/Product/9092843438257', 'Default Title', NULL, 149, NULL, 0, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/ChatGPT_Image_Jul_27_2026_07_02_39_PM_052f1c2d-1eba-4521-ba9b-1a7c7ba0de3b.png?v=1785193169', 'Deco Sweatpants Black - Front', 0),
  ('gid://shopify/ProductVariant/47781419024561', 'gid://shopify/Product/9092843733169', 'Default Title', NULL, 79, NULL, 0, 0, 'https://cdn.shopify.com/s/files/1/0584/1338/3857/files/image_f0ad58ea-f114-4b03-a8ff-611f4b34f5af.png?v=1785193203', 'Deco Cap Black - Side', 0);

-- 500 opções -> additionalProperty[] da variante
INSERT INTO variant_options (variant_id, name, value, position) VALUES
  ('gid://shopify/ProductVariant/44073229418673', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073283125425', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073283682481', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073287385265', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073288368305', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073292366001', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073292824753', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073293119665', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073293512881', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073294561457', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073294954673', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073295216817', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073295577265', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073295904945', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073296265393', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073296691377', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073297150129', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073326837937', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073330344113', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073351545009', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073362063537', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073366290609', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073367961777', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073370648753', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44073376186545', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44253778804913', 'Size', 'S', 0),
  ('gid://shopify/ProductVariant/44253778804913', 'Color', 'White', 1),
  ('gid://shopify/ProductVariant/44253778837681', 'Size', 'S', 0),
  ('gid://shopify/ProductVariant/44253778837681', 'Color', 'LightBlue', 1),
  ('gid://shopify/ProductVariant/44253778870449', 'Size', 'S', 0),
  ('gid://shopify/ProductVariant/44253778870449', 'Color', 'Gray', 1),
  ('gid://shopify/ProductVariant/44253778903217', 'Size', 'M', 0),
  ('gid://shopify/ProductVariant/44253778903217', 'Color', 'White', 1),
  ('gid://shopify/ProductVariant/44253778935985', 'Size', 'M', 0),
  ('gid://shopify/ProductVariant/44253778935985', 'Color', 'LightBlue', 1),
  ('gid://shopify/ProductVariant/44253778968753', 'Size', 'M', 0),
  ('gid://shopify/ProductVariant/44253778968753', 'Color', 'Gray', 1),
  ('gid://shopify/ProductVariant/44253779001521', 'Size', 'L', 0),
  ('gid://shopify/ProductVariant/44253779001521', 'Color', 'White', 1),
  ('gid://shopify/ProductVariant/44253779034289', 'Size', 'L', 0);

INSERT INTO variant_options (variant_id, name, value, position) VALUES
  ('gid://shopify/ProductVariant/44253779034289', 'Color', 'LightBlue', 1),
  ('gid://shopify/ProductVariant/44253779067057', 'Size', 'L', 0),
  ('gid://shopify/ProductVariant/44253779067057', 'Color', 'Gray', 1),
  ('gid://shopify/ProductVariant/44253779099825', 'Size', 'XL', 0),
  ('gid://shopify/ProductVariant/44253779099825', 'Color', 'White', 1),
  ('gid://shopify/ProductVariant/44253779132593', 'Size', 'XL', 0),
  ('gid://shopify/ProductVariant/44253779132593', 'Color', 'LightBlue', 1),
  ('gid://shopify/ProductVariant/44253779165361', 'Size', 'XL', 0),
  ('gid://shopify/ProductVariant/44253779165361', 'Color', 'Gray', 1),
  ('gid://shopify/ProductVariant/44387240509617', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44253868097713', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44253868130481', 'Color', 'LightBlue', 0),
  ('gid://shopify/ProductVariant/44253913055409', 'Shoe size', '1', 0),
  ('gid://shopify/ProductVariant/44253913088177', 'Shoe size', '1.5', 0),
  ('gid://shopify/ProductVariant/44253913120945', 'Shoe size', '2', 0),
  ('gid://shopify/ProductVariant/44253913153713', 'Shoe size', '2.5', 0),
  ('gid://shopify/ProductVariant/44253913186481', 'Shoe size', '3', 0),
  ('gid://shopify/ProductVariant/44253913219249', 'Shoe size', '3.5', 0),
  ('gid://shopify/ProductVariant/44253913252017', 'Shoe size', '4', 0),
  ('gid://shopify/ProductVariant/44253913284785', 'Shoe size', '4.5', 0),
  ('gid://shopify/ProductVariant/44387108978865', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387108978865', 'Shoe size', '7', 1),
  ('gid://shopify/ProductVariant/44387109011633', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387109011633', 'Shoe size', '7.5', 1),
  ('gid://shopify/ProductVariant/44387109044401', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387109044401', 'Shoe size', '8', 1),
  ('gid://shopify/ProductVariant/44387109077169', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387109077169', 'Shoe size', '8.5', 1),
  ('gid://shopify/ProductVariant/44387109109937', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387109109937', 'Shoe size', '9', 1),
  ('gid://shopify/ProductVariant/44387109142705', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387109142705', 'Shoe size', '9.5', 1),
  ('gid://shopify/ProductVariant/44387109175473', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387109175473', 'Shoe size', '10', 1),
  ('gid://shopify/ProductVariant/44387109208241', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387109208241', 'Shoe size', '10.5', 1),
  ('gid://shopify/ProductVariant/44387181199537', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44290541191345', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/44349559308465', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44349559341233', 'Color', 'DarkYellow', 0);

INSERT INTO variant_options (variant_id, name, value, position) VALUES
  ('gid://shopify/ProductVariant/44356910514353', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/45147561623729', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44387155345585', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387155345585', 'Shoe size', '7.5', 1),
  ('gid://shopify/ProductVariant/44387155378353', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387155378353', 'Shoe size', '8', 1),
  ('gid://shopify/ProductVariant/44387155411121', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387155411121', 'Shoe size', '8.5', 1),
  ('gid://shopify/ProductVariant/44387155443889', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387155443889', 'Shoe size', '9', 1),
  ('gid://shopify/ProductVariant/44387155476657', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387155476657', 'Shoe size', '9.5', 1),
  ('gid://shopify/ProductVariant/44387155509425', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387155509425', 'Shoe size', '10', 1),
  ('gid://shopify/ProductVariant/44388190257329', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387173269681', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44388210835633', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44388210835633', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44388210868401', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44388210868401', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44388210901169', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44388210901169', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44388210933937', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44388210933937', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44388210966705', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44388210966705', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44387222945969', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387222945969', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44387222978737', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387222978737', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44387223011505', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387223011505', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44387223044273', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387223044273', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44387223077041', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387223077041', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44349535125681', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44349535158449', 'Color', 'LightBlue', 0),
  ('gid://shopify/ProductVariant/44356536991921', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44358659965105', 'Color', 'White', 0);

INSERT INTO variant_options (variant_id, name, value, position) VALUES
  ('gid://shopify/ProductVariant/44358659997873', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44358660030641', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44358660063409', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44362957095089', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44362957160625', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44362957193393', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44362957127857', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44363187880113', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44363187880113', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44363187912881', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44363187912881', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44363187945649', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44363187945649', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44363187978417', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44363187978417', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44363188011185', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44363188011185', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44363188043953', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44363188043953', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44363188076721', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44363188076721', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44363188109489', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44363188109489', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44363188142257', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44363188142257', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44363188175025', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44363188175025', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44363188207793', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44363188207793', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44363188240561', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44363188240561', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44363188273329', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44363188273329', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44363188306097', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44363188306097', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44363188338865', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44363188338865', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44363188535473', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44363188535473', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44363188568241', 'Color', 'Black', 0);

INSERT INTO variant_options (variant_id, name, value, position) VALUES
  ('gid://shopify/ProductVariant/44363188568241', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44363188601009', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44363188601009', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44363188633777', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44363188633777', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44363188666545', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44363188666545', 'Size', 'XL', 1),
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
  ('gid://shopify/ProductVariant/44376959713457', 'Cover color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44387232350385', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387232350385', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44377571623089', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44377571623089', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44387232383153', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387232383153', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44387232415921', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387232415921', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44387232448689', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44387232448689', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44387232481457', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44387232481457', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44377571655857', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44377571655857', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44387232514225', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44387232514225', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44387232546993', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44387232546993', 'Size', 'L', 1);

INSERT INTO variant_options (variant_id, name, value, position) VALUES
  ('gid://shopify/ProductVariant/44387232579761', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44387232579761', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44387232612529', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44387232612529', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44377571688625', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44377571688625', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44387232645297', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44387232645297', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44387232678065', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44387232678065', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44387232710833', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44387232710833', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44387232743601', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44387232743601', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44377571721393', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44377571721393', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44387232776369', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44387232776369', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44387232809137', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44387232809137', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44387232841905', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44387232841905', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44387232874673', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44387232874673', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44377571754161', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44377571754161', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44387232907441', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44387232907441', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44387232940209', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44387232940209', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44387232972977', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44387232972977', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44377712853169', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44377712853169', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44377712885937', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44377712885937', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44377712918705', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44377712918705', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44377712951473', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44377712951473', 'Size', 'L', 1);

INSERT INTO variant_options (variant_id, name, value, position) VALUES
  ('gid://shopify/ProductVariant/44377712984241', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44377712984241', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44377713017009', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44377713017009', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44377713049777', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44377713049777', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44377713082545', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44377713082545', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44377713115313', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44377713115313', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44377713148081', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44377713148081', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44379882553521', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44379882553521', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44379882586289', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44379882586289', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44379882619057', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44379882619057', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44379882651825', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44379882651825', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44379882684593', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44379882684593', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44379882717361', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44379882717361', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44379882750129', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44379882750129', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44379882782897', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44379882782897', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44379882815665', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44379882815665', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44379882848433', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44379882848433', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44379882881201', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44379882881201', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44379882913969', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44379882913969', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44379882946737', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44379882946737', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44379882979505', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44379882979505', 'Size', 'L', 1);

INSERT INTO variant_options (variant_id, name, value, position) VALUES
  ('gid://shopify/ProductVariant/44379883012273', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44379883012273', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44379883045041', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44379883045041', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44379883077809', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44379883077809', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44379883110577', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44379883110577', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44379883143345', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44379883143345', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44379883176113', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44379883176113', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44379883208881', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44379883208881', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44379883241649', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44379883241649', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44379883274417', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44379883274417', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44379883307185', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44379883307185', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44379883339953', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44379883339953', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44379963949233', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44379963949233', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44379963982001', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44379963982001', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44379964014769', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44379964014769', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44379964047537', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44379964047537', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44379964080305', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44379964080305', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44379965325489', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44379965325489', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44379965358257', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44379965358257', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44379965391025', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44379965391025', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44379965423793', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44379965423793', 'Size', 'L', 1);

INSERT INTO variant_options (variant_id, name, value, position) VALUES
  ('gid://shopify/ProductVariant/44379965456561', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44379965456561', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44379965489329', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44379965489329', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44379965522097', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44379965522097', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44379965554865', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44379965554865', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44379965587633', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44379965587633', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44379965620401', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44379965620401', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44379965653169', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44379965653169', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44379965685937', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44379965685937', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44379965718705', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44379965718705', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44379965751473', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44379965751473', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44379965784241', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44379965784241', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44379965817009', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44379965817009', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44379965849777', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44379965849777', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44379965882545', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44379965882545', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44379965915313', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44379965915313', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44379965948081', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44379965948081', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44380253782193', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380253782193', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44380253814961', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380253814961', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44380253847729', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380253847729', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44380253880497', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380253880497', 'Size', 'L', 1);

INSERT INTO variant_options (variant_id, name, value, position) VALUES
  ('gid://shopify/ProductVariant/44380253913265', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380253913265', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44380253946033', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380253946033', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44380253978801', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380253978801', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44380254011569', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380254011569', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44380254044337', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380254044337', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44380254077105', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380254077105', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44380254109873', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380254109873', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44380254142641', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380254142641', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44380254175409', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380254175409', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44380254208177', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380254208177', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44380254240945', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380254240945', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44380266332337', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380266332337', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44380266365105', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380266365105', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44380266397873', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380266397873', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44380266430641', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380266430641', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44380266463409', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380266463409', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44380266496177', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380266496177', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44380266528945', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380266528945', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44380266561713', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380266561713', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44380266594481', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380266594481', 'Size', 'L', 1);

INSERT INTO variant_options (variant_id, name, value, position) VALUES
  ('gid://shopify/ProductVariant/44380266627249', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380266627249', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44380266660017', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380266660017', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44380266692785', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380266692785', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44380266725553', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380266725553', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44380266758321', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380266758321', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44380266791089', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380266791089', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44380685631665', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380685631665', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44380685664433', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380685664433', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44380685697201', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380685697201', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44380685729969', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380685729969', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44380685762737', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380685762737', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44380685795505', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380685795505', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44380685828273', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380685828273', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44380685861041', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380685861041', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44380685893809', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380685893809', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44380685926577', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380685926577', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44380685959345', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380685959345', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44380685992113', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380685992113', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44380686024881', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380686024881', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44380686057649', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380686057649', 'Size', 'L', 1);

INSERT INTO variant_options (variant_id, name, value, position) VALUES
  ('gid://shopify/ProductVariant/44380686090417', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380686090417', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44380819194033', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380819226801', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380819259569', 'Color', 'DarkBlue', 0),
  ('gid://shopify/ProductVariant/44380819292337', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380819325105', 'Color', 'DarkYellow', 0),
  ('gid://shopify/ProductVariant/44380862939313', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380862939313', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44380862972081', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380862972081', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44380863004849', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380863004849', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44380863037617', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380863037617', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44380863070385', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380863070385', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44380863103153', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380863103153', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44380863135921', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380863135921', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44380863168689', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380863168689', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44380863201457', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380863201457', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44380863234225', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380863234225', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44380894003377', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380894003377', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44380894036145', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380894036145', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44380894068913', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380894068913', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44380894101681', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380894101681', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44380894134449', 'Color', 'White', 0),
  ('gid://shopify/ProductVariant/44380894134449', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44380894167217', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380894167217', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44380894199985', 'Color', 'Black', 0);

INSERT INTO variant_options (variant_id, name, value, position) VALUES
  ('gid://shopify/ProductVariant/44380894199985', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44380894232753', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380894232753', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44380894265521', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380894265521', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44380894298289', 'Color', 'Black', 0),
  ('gid://shopify/ProductVariant/44380894298289', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/44380894331057', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380894331057', 'Size', 'XS', 1),
  ('gid://shopify/ProductVariant/44380894363825', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380894363825', 'Size', 'S', 1),
  ('gid://shopify/ProductVariant/44380894396593', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380894396593', 'Size', 'M', 1),
  ('gid://shopify/ProductVariant/44380894429361', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380894429361', 'Size', 'L', 1),
  ('gid://shopify/ProductVariant/44380894462129', 'Color', 'DarkGreen', 0),
  ('gid://shopify/ProductVariant/44380894462129', 'Size', 'XL', 1),
  ('gid://shopify/ProductVariant/47781418401969', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/47781418500273', 'Title', 'Default Title', 0),
  ('gid://shopify/ProductVariant/47781419024561', 'Title', 'Default Title', 0);

