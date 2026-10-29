import type { TaxonomyNode } from "./types";

const leaf = (slug: string, name: string, short: string, content: string): TaxonomyNode => ({ slug, name, short, content });

export const offsetPrinting: TaxonomyNode = {
  slug: "offset-printing",
  name: "Offset Printing",
  short: "High-quality offset printing in Lahore: business cards, brochures, flyers, letterheads, bill books, packaging and more.",
  content: `Offset printing is the best choice when you need sharp, consistent colour across hundreds or thousands of copies. Mix Print Design offers offset printing in Lahore for businesses, schools, clinics, events and brands across Pakistan.

From business cards and brochures to letterheads, envelopes, bill books, calendars, wedding cards and product packaging, we print on a wide range of papers and boards with finishes such as matte or gloss lamination, spot UV, foil and embossing. Larger runs keep the cost per piece low, which makes offset ideal for stationery and marketing material you use every day.

Browse the categories below to see the options, or send us your artwork, quantity and paper preference for a quote. Our design team can create or fix your artwork, and nothing is printed until you approve the proof.`,
  children: [
    {
      slug: "business-cards",
      name: "Business Cards",
      short: "Business card printing in Lahore: matte, gloss, laminated, spot UV, foil, embossed and premium cards.",
      content: `A good business card makes a strong first impression and keeps your contact details in your customer's pocket. Mix Print Design prints business cards in Lahore in a wide range of papers and finishes, from simple matte cards to premium laminated, spot UV, foil and embossed designs.

Choose a finish below to compare options. Standard cards suit everyday networking, while textured, kraft, transparent and specialty cards help creative brands, boutiques and professionals stand out. Single or double-sided printing is available, and round corners add a modern touch.

Upload your own design or ask our designers to create one from your logo. We send a digital proof for approval before printing, and we deliver across Pakistan. Larger quantities lower the price per card, so ask for a quote for your team or multiple names.`,
      children: [
        leaf("matte", "Matte Business Cards", "Classic matte business cards with a smooth, non-reflective finish that is easy to write on.", `Matte business cards have a soft, non-reflective surface that looks professional and is easy to read in any light. They are a reliable everyday choice for professionals, shops and offices in Lahore. Matte card is also easy to write on, which is useful for appointment cards and notes. Pair with a clean design and dark text for the best result.`),
        leaf("shine-gloss", "Shine (Gloss) Business Cards", "Glossy business cards with vivid, shiny colours that make photos and logos pop.", `Shine or gloss business cards have a glossy coating that makes colours brighter and images sharper. They suit brands with bold colours, photos or product images, such as restaurants, salons and retail shops. The shiny finish catches the light and gives the card a lively feel. Ask us to check your design so colours print as vividly as possible.`),
        leaf("matte-lamination", "Matte Lamination Business Cards", "Thick cards with a soft-touch matte lamination for a premium, durable feel.", `Matte lamination adds a thin protective film to both sides of the card, giving it a smooth, velvety feel and extra durability. Laminated cards resist scuffs, moisture and bending, so they look good for longer. This finish is popular with corporate offices, consultants and premium brands in Lahore that want a subtle, high-end look.`),
        leaf("gloss-lamination", "Gloss Lamination Business Cards", "Durable gloss-laminated cards with rich, shiny colours and strong protection.", `Gloss lamination seals the card with a shiny film that deepens colours and protects against moisture and wear. It is a great choice for cards with strong colours or photographs and for businesses whose cards are handled often. The result is a sturdy, vibrant card that keeps its look in wallets and pockets.`),
        leaf("matte-back-side", "Matte Back Side Business Cards", "Cards with a glossy front and matte back, so the back is easy to write on.", `These cards combine a finished front with a matte back side, giving you an attractive face and a writable reverse. They are ideal for appointment cards, loyalty cards and doctors' or salon cards where staff write dates or notes on the back. Share how you plan to use the card and we will suggest the best combination.`),
        leaf("single-colour", "Single Colour Business Cards", "Economical single-colour business cards for large quantities and simple designs.", `Single colour business cards print your design in one ink colour, keeping costs low for large quantities. They are practical for staff cards, wholesale shops, events and simple text-based designs. A well-chosen ink colour on quality card still looks clean and professional. Ask for a quote if you need cards for many names at once.`),
        leaf("round-corner", "Round Corner Business Cards", "Business cards with smooth rounded corners for a modern, friendly look.", `Round corner business cards have gently curved corners that feel comfortable in the hand and look modern. The rounded edges also resist bending and fraying in wallets. This finish suits creative brands, cafés, boutiques and anyone who wants a softer look. It can be combined with lamination and other finishes.`),
        leaf("spot-uv", "Spot UV Business Cards", "Premium cards with glossy spot UV highlights on your logo or text.", `Spot UV adds a raised, glossy coating to selected parts of your design, such as the logo or name, on top of a matte card. The contrast between shiny and matte areas creates a premium effect people notice when they hold the card. Spot UV is popular with corporate, real-estate and fashion brands. We help you set up the artwork correctly for the effect.`),
        leaf("embossed", "Embossed Business Cards", "Embossed business cards with raised logos or text you can feel.", `Embossing presses your logo or text up from the card surface, creating a raised design you can see and feel. It gives a classic, luxurious touch that suits law firms, jewellers, hotels and premium brands. Embossing works best on thicker card and simple shapes. Send us your logo and we will advise what will emboss cleanly.`),
        leaf("foil", "Foil Business Cards", "Gold, silver or coloured foil business cards for a luxury finish.", `Foil stamping applies shiny metallic foil, such as gold, silver or rose gold, to parts of your design. It is one of the most eye-catching finishes and is often combined with matte lamination for a luxury look. Foil cards suit jewellers, wedding planners, boutiques and executives. Share your design and we will mark the areas to be foiled in the proof.`),
        leaf("textured-linen", "Textured / Linen Business Cards", "Textured and linen-finish cards with an elegant, tactile feel.", `Textured and linen business cards have a fine woven pattern you can feel, giving them a classic, crafted character. They suit lawyers, architects, consultants and boutique brands that want a refined, understated card. Simple designs and dark inks look especially elegant on textured stock. Ask us for the available textures and colours.`),
        leaf("kraft", "Kraft Business Cards", "Natural brown kraft cards with an earthy, eco-friendly look.", `Kraft business cards are printed on natural brown paper board for a rustic, eco-friendly feel. They are popular with organic food brands, cafés, handmade products, gift shops and creative studios. Dark or white inks work best on kraft. If you want your brand to feel natural and honest, kraft is a great choice.`),
        leaf("transparent-plastic", "Transparent / Plastic Business Cards", "Clear or frosted plastic business cards that are waterproof and memorable.", `Transparent and plastic business cards are printed on clear or frosted PVC, making them waterproof, durable and very memorable. They suit tech companies, beauty brands, designers and anyone who wants a card people keep. Designs with strong colours and clear empty space work best. Ask us for samples and options before you order.`),
      ],
    },
    {
      slug: "brochures",
      name: "Brochures",
      short: "Brochure printing in Lahore: bi-fold, tri-fold, Z-fold, gate-fold and saddle-stitched booklets.",
      content: `Brochures present your company, products or services in a format customers can take home and read. Mix Print Design prints brochures in Lahore in popular folds and sizes, with full-colour printing on quality art paper and optional lamination.

Choose a bi-fold for a simple four-page layout, a tri-fold for menus and service lists, a Z-fold or gate-fold for a dramatic reveal, or a saddle-stitched booklet when you need more pages. Schools, hospitals, real-estate projects, manufacturers and restaurants across Pakistan use our brochures for marketing and events.

Send us your content and quantity, or ask our designers to lay out the brochure for you. We send a proof to check text and folding before we print.`,
      children: [
        leaf("bi-fold", "Bi-fold Brochures", "Bi-fold brochures folded once into four panels, ideal for company profiles.", `A bi-fold brochure is folded once to create four panels, giving a clean, book-like layout. It suits company profiles, product introductions, event programmes and price lists. Larger sizes such as A4 folded to A5 give plenty of space for images and text. We can design the layout and print it on your choice of paper.`),
        leaf("tri-fold", "Tri-fold Brochures", "Classic tri-fold brochures with six panels for menus, services and promotions.", `Tri-fold brochures are folded twice into three sections, creating six panels that guide readers step by step. They are a favourite for restaurant menus, clinic services, school admissions and promotional handouts. The compact folded size fits easily in stands and envelopes. Share your content and we will arrange it to fold correctly.`),
        leaf("z-fold", "Z-fold Brochures", "Z-fold brochures that open like an accordion for step-by-step information.", `A Z-fold brochure folds in a zig-zag pattern, opening like an accordion to reveal information in sequence. It works well for maps, timelines, product ranges and instructions. Z-folds can also open flat to show a wide panoramic image. Our designers can help plan the panel order so the brochure reads naturally.`),
        leaf("gate-fold", "Gate-fold Brochures", "Gate-fold brochures with two panels opening like doors for a dramatic reveal.", `In a gate-fold brochure the two outer panels fold inward and open like doors to reveal a large central spread. It creates an impressive reveal for product launches, real-estate projects and premium invitations. Gate-folds work best on quality paper with strong imagery. Ask us about sizes and finishes for your project.`),
        leaf("booklet-saddle-stitched", "Booklet / Saddle-stitched", "Multi-page booklets bound with staples on the spine, for catalogues and guides.", `Saddle-stitched booklets are folded sheets stapled along the spine, an affordable way to print multi-page documents. They suit catalogues, annual reports, school magazines, guides and event programmes. Page counts are in multiples of four. Send us your page count and quantity, and we will advise on paper and cover options.`),
      ],
    },
    {
      slug: "flyers-leaflets",
      name: "Flyers & Leaflets",
      short: "Flyer and leaflet printing in Lahore in A4, A5 and DL sizes for promotions, menus and events.",
      content: `Flyers and leaflets are one of the most cost-effective ways to promote an offer, event or new business. Mix Print Design prints flyers in Lahore in A4, A5 and DL sizes, single or double-sided, on glossy or matte paper.

Restaurants use them for menus and deals, schools for admissions, shops for sales and political and community groups for campaigns across Pakistan. Large quantities keep the price per flyer low, which makes door-to-door and in-store distribution affordable.

Choose a size below, then send us your artwork or brief. Our designers can create an eye-catching flyer with clear headlines and contact details, and you approve the proof before printing.`,
      children: [
        leaf("a4-flyers", "A4 Flyers", "Large A4 flyers with plenty of space for menus, notices and detailed offers.", `A4 flyers give you a full page for detailed information, such as restaurant menus, price lists, notices and event schedules. They are easy to read and suit noticeboards, counters and mail drops. Print on one or both sides, with gloss or matte paper. We can help structure the content so the key message stands out.`),
        leaf("a5-flyers", "A5 Flyers", "Handy A5 flyers, the most popular size for promotions and handouts.", `A5 flyers are half the size of A4 and the most popular choice for promotions, handouts and in-store offers. They are easy to carry, cost-effective in large quantities and fit well on counters. Bold headlines and clear contact details make A5 flyers work hard for your business. Ask for a quote by quantity.`),
        leaf("dl-leaflets", "DL Leaflets", "Slim DL leaflets that fit envelopes and display racks.", `DL leaflets have a slim, tall shape that fits standard envelopes and leaflet racks. They are ideal for price lists, appointment reminders, tourist information and direct mail. The narrow format encourages short, focused messages. Share your content and we will suggest a clean, readable layout.`),
      ],
    },
    {
      slug: "letterheads",
      name: "Letterheads",
      short: "Professional letterhead printing in Lahore for offices, schools, clinics and companies.",
      content: `A printed letterhead makes every letter, quotation and invoice look official. Mix Print Design prints letterheads in Lahore for companies, schools, hospitals, law firms and government suppliers across Pakistan.

We print your logo, address and contact details on quality paper that works in office printers, so you can type and print documents on the sheets yourself. Choose single-colour printing for economy, full-colour for logos with many colours, or premium paper for a more impressive feel.

Order letterheads together with envelopes and business cards to keep your stationery consistent. Our designers can create a matching set from your logo, and you approve the proof before we print.`,
      children: [
        leaf("single-colour-letterheads", "Single Colour Letterheads", "Economical one-colour letterheads for everyday office use.", `Single colour letterheads print your logo and details in one ink, keeping costs low for large quantities. They are practical for daily correspondence, quotations and internal documents. A carefully chosen ink colour still looks crisp and professional. Ask for a quote for bulk office stock.`),
        leaf("full-colour-letterheads", "Full Colour Letterheads", "Full-colour letterheads that reproduce your logo and brand colours accurately.", `Full colour letterheads reproduce logos with several colours, gradients or photos exactly as designed. They suit brands that want consistent colours across all stationery. Full colour also allows design elements such as footers, watermarks and coloured borders. We check your colours in the proof before printing.`),
        leaf("premium-paper-letterheads", "Premium Paper Letterheads", "Letterheads on thicker, textured or premium paper for an executive feel.", `Premium paper letterheads use thicker or textured stock that feels substantial in the hand. They suit law firms, consultancies, embassies and executive offices that want correspondence to make a strong impression. Ask us about available papers and whether they suit your office printer.`),
      ],
    },
    {
      slug: "envelopes",
      name: "Envelopes",
      short: "Printed envelopes in Lahore: DL, A4, A5 and window envelopes with your logo and address.",
      content: `Printed envelopes complete your office stationery and make every letter, invoice and invitation look professional. Mix Print Design prints envelopes in Lahore with your logo and return address in popular sizes, including DL, A5 and A4, as well as window envelopes for invoices.

Companies, schools, banks, clinics and wedding planners across Pakistan use our envelopes for correspondence, documents and invitations. Choose the size that fits your letterheads and documents, and match the printing to your business cards and letterheads.

Tell us the size, quantity and design, or let our designers prepare it. You approve the proof before printing, and we can deliver across Pakistan.`,
      children: [
        leaf("dl-envelopes", "DL Envelopes", "Standard DL envelopes for letters folded in three.", `DL envelopes fit an A4 letter folded into three, making them the standard office envelope for correspondence and invoices. We print your logo and return address for a professional look. They pair perfectly with printed letterheads. Ask for a quote for office quantities.`),
        leaf("a4-envelopes", "A4 Envelopes", "Large A4 envelopes for documents, certificates and brochures sent flat.", `A4 envelopes hold documents without folding, which is ideal for certificates, reports, contracts and brochures. Schools, banks and companies use them for official documents. We print your branding on the front for a professional presentation.`),
        leaf("a5-envelopes", "A5 Envelopes", "Medium A5 envelopes for cards, invitations and folded documents.", `A5 envelopes suit greeting cards, invitations and A4 sheets folded once. They are popular for events, wedding cards and promotional mailers. Printed branding adds a personal touch. Share your quantity and design for a quote.`),
        leaf("window-envelopes", "Window Envelopes", "Window envelopes that show the address printed on your invoice or letter.", `Window envelopes have a clear panel that shows the address printed on the document inside, saving time when sending invoices, bills and statements. They are widely used by utilities, schools and businesses that send regular mail. We print your logo and return address on the front.`),
      ],
    },
    {
      slug: "bill-books-invoice-books",
      name: "Bill Books / Invoice Books",
      short: "Bill book and invoice book printing in Lahore with carbonless duplicate and triplicate copies.",
      content: `Bill books and invoice books are essential for shops, wholesalers, workshops, restaurants and service businesses across Pakistan. Mix Print Design prints bill books in Lahore with your business name, logo, address and serial numbering, on carbonless (NCR) paper so every copy is clear without carbon sheets.

Choose duplicate books for a customer copy and an office copy, triplicate books when a third copy is needed, receipt books for payments, or delivery challan books for goods dispatch. Pads are bound with sturdy covers and perforated so pages tear out neatly.

Send us your current bill format or ask our designers to create one. You approve the layout before printing, and we can number each page for easy record keeping.`,
      children: [
        leaf("duplicate-ncr-bill-books", "Duplicate (NCR) Bill Books", "Two-part carbonless bill books with a customer copy and an office copy.", `Duplicate bill books use two-part carbonless paper, so writing on the top sheet creates a clean copy underneath. The customer takes the original and you keep the copy for records. They suit shops, workshops and service businesses. Pages can be numbered and perforated.`),
        leaf("triplicate-ncr-bill-books", "Triplicate (NCR) Bill Books", "Three-part carbonless bill books for customer, office and accounts copies.", `Triplicate bill books produce three copies at once, useful when the customer, the office and the accounts or delivery team each need a copy. They are common with wholesalers, distributors and companies with formal record keeping. We number and bind them to your requirements.`),
        leaf("receipt-books", "Receipt Books", "Printed receipt books for payments, fees and donations.", `Receipt books provide a quick, official record for payments such as school fees, rent, donations and service charges. Printed with your name, logo and serial numbers, they help prevent errors and build trust. Choose single, duplicate or triplicate formats.`),
        leaf("delivery-challan-books", "Delivery Challan Books", "Delivery challan books to record goods dispatched to customers.", `Delivery challan books record goods sent to customers, with space for items, quantities and signatures. They are widely used by manufacturers, distributors and suppliers in Pakistan. Carbonless copies keep your dispatch records accurate. Share your format and we will set it up.`),
      ],
    },
    {
      slug: "files-folders",
      name: "Files & Folders",
      short: "Printed files and presentation folders in Lahore for offices, schools and events.",
      content: `Printed files and folders keep documents organised and present your brand professionally in meetings, admissions and events. Mix Print Design prints presentation folders, file covers and certificate folders in Lahore on sturdy board with your logo and design.

Companies use pocket folders for proposals and press kits, schools and colleges use file covers for admissions and results, and event organisers use certificate folders for awards. Lamination and spot UV can add durability and a premium finish.

Tell us the size, quantity and any pockets or card slots you need. Our designers can create the artwork to match your stationery, and you approve the proof before we print.`,
      children: [
        leaf("presentation-folders", "Presentation Folders", "Pocket folders for proposals, press kits and company profiles.", `Presentation folders have inside pockets to hold documents, brochures and business cards neatly. They make proposals and company profiles look polished in client meetings. Lamination and spot UV give a premium finish. Ask us about pocket and card-slot options.`),
        leaf("file-covers", "File Covers", "Printed file covers for offices, schools and colleges.", `Printed file covers protect documents and carry your branding, ideal for schools, colleges, hospitals and offices. They are used for admissions, patient files, reports and internal records. Choose a sturdy board and simple layout for everyday use.`),
        leaf("certificate-folders", "Certificate Folders", "Elegant folders to present certificates and awards.", `Certificate folders present certificates, degrees and awards in an elegant cover. Schools, universities, training institutes and companies use them for ceremonies and recognition events. Foil or embossed logos add a formal touch. Share the certificate size for a matching folder.`),
      ],
    },
    {
      slug: "stickers-labels",
      name: "Stickers & Labels",
      short: "Sticker and label printing in Lahore: paper, vinyl, die-cut stickers and product labels.",
      content: `Stickers and labels help brand your products, packaging and promotions. Mix Print Design prints stickers and labels in Lahore on paper and vinyl, in sheets or cut to custom shapes, for businesses across Pakistan.

Food and cosmetics brands use product labels with ingredients and barcodes, shops use logo stickers to seal bags and boxes, and marketers use die-cut stickers for giveaways. Waterproof vinyl suits bottles and outdoor use, while paper stickers are economical for packaging and indoor labels.

Tell us the size, shape, material and quantity, and send your artwork or ask our designers for help. We prepare a proof with cut lines so you can check everything before printing.`,
      children: [
        leaf("paper-stickers", "Paper Stickers", "Economical paper stickers for packaging, seals and indoor labels.", `Paper stickers are an economical way to brand bags, boxes and envelopes or to label products for indoor use. They print sharp colours and are available in sheets or cut to shape. Choose gloss or matte paper. Ideal for large quantities at a low price per sticker.`),
        leaf("vinyl-stickers", "Vinyl Stickers", "Durable, waterproof vinyl stickers for bottles, outdoor use and giveaways.", `Vinyl stickers are waterproof, tear-resistant and suitable for bottles, jars, laptops and outdoor surfaces. They keep colours bright and resist moisture and handling. Choose white, clear or other vinyl types depending on your design. Ask us which vinyl suits your surface.`),
        leaf("product-labels", "Product Labels", "Custom product labels with branding, ingredients and barcodes.", `Product labels carry your brand, product details, ingredients and barcodes for food, cosmetics, cleaning products and more. We print them in the size and material that fits your containers. Clear, accurate labels help your products look professional on shop shelves.`),
        leaf("die-cut-stickers", "Die-cut Stickers", "Stickers cut to the exact shape of your logo or design.", `Die-cut stickers are cut around the outline of your logo or artwork, creating eye-catching custom shapes. They are popular for giveaways, packaging and brand merchandise. We prepare a proof showing the cut line before printing so you can check the shape.`),
      ],
    },
    {
      slug: "calendars",
      name: "Calendars",
      short: "Custom calendar printing in Lahore: wall, desk and pocket calendars with your branding.",
      content: `Custom calendars keep your brand in front of customers every day of the year. Mix Print Design prints wall, desk and pocket calendars in Lahore for companies, banks, pharmaceutical firms, schools and shops across Pakistan.

Add your logo, products, contact details and photos to every month, and include important dates such as Islamic and national holidays. Calendars make popular corporate gifts at the start of the year and are a cost-effective way to promote your business.

Tell us the type, size and quantity, and share your photos or ask our designers to create the layout. You approve every page in the proof before we print.`,
      children: [
        leaf("wall-calendars", "Wall Calendars", "Large wall calendars with monthly pages and your branding.", `Wall calendars hang in offices, shops and homes for the whole year, keeping your brand visible every day. Use a page per month with photos of your products or projects. They make excellent New Year gifts for clients. Ask us about sizes and binding options.`),
        leaf("desk-calendars", "Desk Calendars", "Standing desk calendars for office tables and counters.", `Desk calendars stand on office desks and reception counters, where they are seen many times a day. They suit corporate gifting and promotional giveaways. Each page can carry your logo and contact details. We help you plan the layout and holidays.`),
        leaf("pocket-calendars", "Pocket Calendars", "Card-sized pocket calendars that are cheap to give away in bulk.", `Pocket calendars are the size of a business card, with a full year on one side and your branding on the other. They are inexpensive to print in large quantities and easy to hand out at counters and events. A useful, low-cost promotional item.`),
      ],
    },
    {
      slug: "cards-invitations",
      name: "Cards & Invitations",
      short: "Wedding cards, invitations and greeting card printing in Lahore with premium finishes.",
      content: `Beautiful cards and invitations set the tone for weddings, events and celebrations. Mix Print Design prints wedding cards, invitation cards, greeting cards and Eid cards in Lahore, with premium papers and finishes such as foil, embossing and lamination.

Families and event planners across Pakistan use our cards for mehndi, barat and walima invitations, while companies send greeting cards and Eid cards to clients and staff. Our designers can create a design in English, Urdu or both, matching your theme and colours.

Share your event details, wording and quantity, and we will prepare a proof for your approval. Matching envelopes can be printed too.`,
      children: [
        leaf("wedding-cards", "Wedding Cards", "Elegant wedding cards for mehndi, barat and walima in English and Urdu.", `Wedding cards are designed to match your celebration, with elegant layouts in English, Urdu or both. Choose premium papers and finishes such as foil and embossing for a memorable invitation. We can print cards for each function and matching envelopes. Share your wording and theme for a proof.`),
        leaf("invitation-cards", "Invitation Cards", "Invitation cards for birthdays, corporate events, openings and ceremonies.", `Invitation cards set the tone for birthdays, inaugurations, corporate dinners and school functions. We design and print cards in a style that suits your event, from formal to fun. Add RSVP details and maps as needed. Ask for a quote with your quantity.`),
        leaf("greeting-cards", "Greeting Cards", "Custom greeting cards for clients, staff and special occasions.", `Custom greeting cards let businesses thank clients, welcome new customers and celebrate milestones with a personal touch. Print your own message and branding inside. They are a thoughtful alternative to generic cards. We can also print matching envelopes.`),
        leaf("eid-cards", "Eid Cards", "Branded Eid Mubarak cards for clients, staff and family.", `Eid cards are a warm way to greet clients, staff and family during Eid ul Fitr and Eid ul Adha. We design cards with festive themes and your branding or family names. Order early before Eid to plan delivery. Ask for designs in English and Urdu.`),
      ],
    },
    {
      slug: "catalogues",
      name: "Catalogues",
      short: "Product catalogue printing in Lahore: saddle-stitched and perfect-bound catalogues.",
      content: `A printed catalogue showcases your full product range in one professional book that buyers can keep and refer to. Mix Print Design prints catalogues in Lahore for manufacturers, exporters, fashion brands, furniture makers and distributors across Pakistan.

Choose saddle-stitched binding for slimmer catalogues or perfect binding with a flat spine for thicker books. Full-colour printing on quality art paper makes product photos look their best, and a laminated cover keeps the catalogue looking good with frequent use.

Send us your page count, size and quantity, or ask our designers to lay out your products and prices. You approve a full proof before printing.`,
      children: [
        leaf("saddle-stitched-catalogues", "Saddle-stitched Catalogues", "Stapled catalogues for slimmer product ranges and price lists.", `Saddle-stitched catalogues are stapled through the spine, an economical choice for catalogues of up to around sixty pages. They open flat and are easy to mail and hand out at exhibitions. Page counts are in multiples of four. Ask us about paper and cover options.`),
        leaf("perfect-bound-catalogues", "Perfect-bound Catalogues", "Perfect-bound catalogues with a flat printed spine for larger page counts.", `Perfect-bound catalogues have a glued flat spine, giving a book-like finish for larger page counts. The spine can carry your brand name so the catalogue stands out on shelves. Ideal for annual catalogues, look-books and export collections.`),
      ],
    },
    {
      slug: "packaging-boxes",
      name: "Packaging & Boxes",
      short: "Custom printed boxes and packaging in Lahore for products, e-commerce and food.",
      content: `Custom packaging protects your products and turns every delivery into a branding opportunity. Mix Print Design prints product boxes, mailer boxes and food packaging in Lahore for brands, online sellers, bakeries and restaurants across Pakistan.

Choose printed card boxes for cosmetics, medicines and retail products, corrugated mailer boxes for e-commerce shipping, or food-safe boxes for sweets, bakery items and takeaway. Finishes such as lamination, spot UV and foil help premium products stand out.

Share your product dimensions, quantity and artwork, and we will suggest a box style and material. You approve a proof, and sample options can be discussed before a large order.`,
      children: [
        leaf("product-boxes", "Product Boxes", "Printed card boxes for cosmetics, medicines and retail products.", `Printed product boxes present your item professionally on shop shelves and protect it in transit. They are popular for cosmetics, perfumes, medicines, electronics accessories and gifts. Share your product size and we will suggest the right box style and card thickness.`),
        leaf("mailer-boxes", "Mailer Boxes", "Corrugated mailer boxes for e-commerce and subscription deliveries.", `Mailer boxes are sturdy corrugated boxes that protect products during courier delivery and create a memorable unboxing experience. They suit online stores, subscription boxes and gift packs. Print outside only or inside and outside. Ask for a quote with your box size.`),
        leaf("food-packaging", "Food Packaging", "Boxes for sweets, bakery items and takeaway food.", `Food packaging includes boxes for sweets, cakes, bakery items, pizzas and takeaway meals. Branded packaging helps customers remember your shop. Tell us the food type and size so we can recommend suitable materials and styles.`),
      ],
    },
    {
      slug: "posters",
      name: "Posters",
      short: "Poster printing in Lahore in A3 and A2 sizes for promotions, events and education.",
      content: `Posters grab attention on walls, notice boards and shop windows. Mix Print Design prints posters in Lahore for sales, events, admissions, health awareness campaigns and educational displays across Pakistan.

Choose A3 for counters and notice boards or A2 for larger displays. Glossy paper makes images vibrant, while matte paper reduces glare under shop lights. For outdoor or very large formats, see our digital printing services such as flex and vinyl.

Send us your artwork or ask our designers to create a clear, eye-catching layout. You approve the proof before we print.`,
      children: [
        leaf("a3-posters", "A3 Posters", "A3 posters for notice boards, counters and shop windows.", `A3 posters are a practical size for notice boards, counters, clinics and shop windows. They are affordable in bulk for campaigns and events. Bold headlines and clear images help them work from a distance. Ask for a quote by quantity.`),
        leaf("a2-posters", "A2 Posters", "Larger A2 posters for high-impact displays and events.", `A2 posters give double the space of A3 for high-impact displays in malls, schools, exhibitions and events. Large images and short messages work best. Choose gloss or matte paper. Share your design for a proof.`),
      ],
    },
    {
      slug: "paper-bags",
      name: "Paper Bags",
      short: "Printed paper shopping bags in Lahore for boutiques, bakeries and retail stores.",
      content: `Printed paper bags carry your brand out of the shop and around the city. Mix Print Design prints paper shopping bags in Lahore for boutiques, bakeries, pharmacies, gift shops and retail brands across Pakistan.

Choose white or kraft paper, different sizes and handle styles, and add your logo, colours and social media handles. Paper bags are an attractive, eco-friendlier alternative to plastic and make your products feel more premium.

Tell us the size, quantity and design, and we will advise on paper thickness and handles. You approve the proof before printing.`,
      children: [
        leaf("kraft-paper-bags", "Kraft Paper Bags", "Natural kraft paper bags with a rustic, eco-friendly look.", `Kraft paper bags have a natural brown finish that suits organic food stores, bakeries, cafés and handmade brands. They print well with dark inks and simple logos. Choose a size and handle type that fits your products.`),
        leaf("white-paper-bags", "White Paper Bags", "White paper bags that show full-colour branding brightly.", `White paper bags show full-colour designs brightly, making them ideal for boutiques, gift shops and cosmetics brands. Lamination can add strength and a premium feel. Ask us about sizes and handle options.`),
      ],
    },
    {
      slug: "notepads-diaries",
      name: "Notepads & Diaries",
      short: "Branded notepads, prescription pads and diaries printed in Lahore.",
      content: `Branded notepads and diaries are used every day, keeping your name in front of clients and staff. Mix Print Design prints notepads, prescription pads, writing pads and custom diaries in Lahore for offices, doctors, hotels, schools and corporate gifting across Pakistan.

Notepads can be glued at the top for easy tear-off pages, with your logo and contact details on every sheet. Doctors use printed prescription pads, hotels place notepads in rooms, and companies give diaries as New Year gifts.

Tell us the size, number of pages and quantity, and share your design or ask our designers for help. You approve the proof before printing.`,
      children: [
        leaf("notepads", "Notepads", "Tear-off notepads with your logo on every page.", `Branded notepads keep your logo on every page, ideal for offices, hotels, events and giveaways. Pages are glued at the top for clean tear-off. Choose the size and page count that suits your use. Ask for a quote by quantity.`),
        leaf("prescription-pads", "Prescription Pads", "Printed prescription pads for doctors, clinics and hospitals.", `Prescription pads carry the doctor's name, qualifications, clinic address and timings at the top of each sheet. Clinics and hospitals use them daily, so clear layout and good paper matter. Share your details and we will prepare a proof.`),
        leaf("custom-diaries", "Custom Diaries", "Branded diaries for corporate gifting and staff.", `Custom diaries make practical corporate gifts and staff giveaways, especially at the start of the year. Add your logo on the cover and branded pages inside. Ask us about cover materials, sizes and quantities.`),
      ],
    },
    {
      slug: "menu-cards",
      name: "Menu Cards",
      short: "Restaurant menu card printing in Lahore: laminated, folded and takeaway menus.",
      content: `A clear, attractive menu helps customers choose and order more. Mix Print Design prints menu cards in Lahore for restaurants, cafés, food courts, bakeries and caterers across Pakistan.

Choose laminated menus that resist spills and frequent handling for dine-in tables, or folded and flyer-style takeaway menus for delivery orders and counters. Our designers can organise your dishes and prices into easy-to-read sections and add appetising photos.

Send us your menu items and prices, or your current menu to refresh. You approve the proof before printing, and reprints are easy when prices change.`,
      children: [
        leaf("laminated-menu-cards", "Laminated Menu Cards", "Durable laminated menus for dine-in tables.", `Laminated menu cards resist spills, stains and frequent handling, keeping them clean and readable for longer. They suit restaurants, cafés and dhabas with dine-in seating. Choose single sheets or folded menus. Share your items for a proof.`),
        leaf("takeaway-menus", "Takeaway Menus", "Folded takeaway menus for delivery orders and counters.", `Takeaway menus are folded or flyer-style menus customers take home or receive with delivery orders. They include your phone numbers and delivery details to encourage repeat orders. Affordable in large quantities.`),
      ],
    },
    leaf("certificates", "Certificates", "Certificate printing in Lahore for schools, training institutes and events.", `Certificates recognise achievement and should look official and memorable. Mix Print Design prints certificates in Lahore for schools, colleges, universities, training institutes, sports events and companies across Pakistan.

We print on quality paper or card with security-style borders, your logo and signatures, and can add gold foil seals or embossed details for a formal finish. Certificates can be printed with each recipient's name for a personal touch.

Share your certificate design or ask our designers to create one. You approve the proof before printing, and matching certificate folders are available.`),
    leaf("hang-tags", "Hang Tags", "Clothing hang tags and price tags printed in Lahore for fashion brands.", `Hang tags add a finishing touch to clothing, accessories and gifts while carrying your brand, sizes and prices. Mix Print Design prints hang tags in Lahore for fashion brands, boutiques, shoe makers and gift shops across Pakistan.

Choose thick card or kraft board, round corners and punched holes, with finishes such as spot UV, foil or embossing for premium labels. Tags can include barcodes, care instructions and your social media handles.

Tell us the size, quantity and finish, and send your design or ask our designers for help. You approve the proof before printing.`),
  ],
};
