import type { TaxonomyNode } from "./types";

const SQFT = "per sq. ft";
const leaf = (slug: string, name: string, short: string, content: string, priceUnit?: string): TaxonomyNode => ({ slug, name, short, content, priceUnit });

export const digitalPrinting: TaxonomyNode = {
  slug: "digital-printing",
  name: "Digital Printing",
  short: "Digital and large-format printing in Lahore: flex, panaflex, vinyl, one-way vision, canvas, standees and backlit film.",
  content: `Digital printing is ideal for large formats, short runs and fast turnarounds. Mix Print Design offers digital and large-format printing in Lahore for shop signage, events, exhibitions, offices and homes across Pakistan.

Print vibrant banners on China flex, Star flex or premium Korean flex, branded panaflex for sign boards, vinyl stickers and one-way vision for windows and vehicles, canvas prints for décor, and roll-up standees for exhibitions. Large-format jobs are usually priced per square foot, so you only pay for the size you need.

Choose a category below to compare materials, or send us the size, quantity and location for a quote. Our designers can prepare print-ready artwork at the right resolution, and you approve the proof before printing.`,
  children: [
    {
      slug: "flex-printing",
      name: "Flex Printing",
      short: "Flex printing in Lahore on China flex, HD Star flex, Star flex and Korean Star flex, priced per sq. ft.",
      priceUnit: SQFT,
      content: `Flex printing is the most popular choice for banners, shop boards, event backdrops and roadside advertising in Pakistan. Mix Print Design prints flex banners in Lahore on several qualities of flex, so you can balance price, sharpness and durability for each job.

China flex is the economical option for short-term promotions and events. Star flex and HD Star flex give sharper prints and better colour for longer use, while Korean Star flex is a premium material for signs that must look good outdoors for a long time. Flex is priced per square foot and can be finished with eyelets, pole pockets or frames.

Tell us the size, quantity and where the banner will be used, and we will recommend the right flex and send a quote.`,
      children: [
        leaf("china-flex", "China Flex", "Economical China flex printing for short-term banners and events.", `China flex is the most economical flex material, ideal for short-term promotions, event banners, political and religious gatherings and temporary signage. It prints bright colours at a low cost per square foot. For signs that must last longer outdoors, consider Star or Korean flex. Ask for a quote with your size.`, SQFT),
        leaf("hd-star-flex", "HD Star Flex", "High-definition Star flex for sharper images and stronger colours.", `HD Star flex is printed at higher resolution for sharper text, smoother gradients and stronger colours. It suits shop boards, exhibition backdrops and banners viewed from close range. A good balance of quality and price for long-term indoor and outdoor use. Priced per square foot.`, SQFT),
        leaf("star-flex", "Star Flex", "Durable Star flex for shop signs and long-lasting banners.", `Star flex is a stronger, better-quality flex than China flex, with improved colour and durability outdoors. It is a popular choice for shop front boards, rooftop signs and banners that stay up for months. Ask us to compare it with HD and Korean Star flex for your budget.`, SQFT),
        leaf("korean-star-flex", "Korean Star Flex", "Premium Korean Star flex for long-lasting outdoor signs.", `Korean Star flex is a premium flex material known for durability and rich colour, making it a good choice for permanent outdoor signs and backlit boards. It holds up well to sun and weather over long periods. Recommended when quality and lifespan matter most. Priced per square foot.`, SQFT),
      ],
    },
    leaf("panaflex", "Panaflex", "Panaflex printing in Lahore for sign boards and large outdoor displays.", `Panaflex is the familiar term in Pakistan for printed flex sign boards and large outdoor displays. Mix Print Design prints panaflex in Lahore for shop fronts, plazas, petrol pumps, schools and hospitals, in front-lit and backlit versions.

Front-lit panaflex is lit by spotlights from the front, while backlit panaflex uses translucent media with lights behind for an even glow at night. We print your design, stretch it on a frame and can coordinate installation for your location.

Send us the size and location, or a photo of the site, and we will recommend the right material and quote per square foot. You approve the design proof before printing.`, SQFT),
    {
      slug: "vinyl-one-way-vision",
      name: "Vinyl / One-way Vision",
      short: "Vinyl printing and one-way vision for windows, walls, vehicles and glass in Lahore.",
      priceUnit: SQFT,
      content: `Printed vinyl sticks to glass, walls, boards and vehicles to turn plain surfaces into branding. Mix Print Design prints vinyl and one-way vision in Lahore for shop windows, offices, clinics, showrooms and vehicles across Pakistan.

Standard vinyl is used for wall graphics, glass decoration, product displays and signage. One-way vision is a perforated vinyl that shows your graphics on the outside while people inside can still see out, making it ideal for shop windows and vehicle rear glass.

Tell us the surface, size and whether the graphics are for indoors or outdoors. We will recommend the right vinyl, prepare the artwork to size and quote per square foot.`,
      children: [
        leaf("vinyl-printing", "Vinyl Printing", "Full-colour vinyl for walls, glass, boards and displays.", `Printed vinyl turns walls, glass partitions, counters and boards into branded surfaces. It is available in gloss or matte finishes and can be cut to shape. Popular for offices, clinics, retail displays and events. Priced per square foot.`, SQFT),
        leaf("one-way-vision", "One-way Vision", "Perforated one-way vision for shop windows and vehicle glass.", `One-way vision vinyl shows your graphics from the outside while keeping the view clear from the inside. It is widely used on shop windows, office glass and vehicle rear windows for advertising without blocking light. Priced per square foot.`, SQFT),
      ],
    },
    {
      slug: "canvas-printing",
      name: "Canvas Printing",
      short: "Canvas printing in Lahore for photos, art and décor, with or without frames.",
      content: `Canvas prints turn photos and artwork into décor for homes, offices, restaurants and hotels. Mix Print Design prints on quality canvas in Lahore, either as rolled prints or stretched on frames ready to hang.

Families print portraits and wedding photos, businesses print brand imagery and Islamic calligraphy, and interior designers order canvas art for projects across Pakistan. Canvas gives a textured, gallery-style look that suits both modern and classic interiors.

Send us your image and preferred size. We will check the resolution so the print looks sharp, and send you a proof before printing.`,
      children: [
        leaf("canvas-prints", "Canvas Prints", "Rolled canvas prints for framing or mounting.", `Rolled canvas prints are printed on textured canvas without a frame, ready for you to frame or mount. They suit artists, photographers and interior projects. We check image resolution before printing to keep the result sharp.`),
        leaf("framed-canvas", "Framed Canvas", "Canvas stretched on frames, ready to hang.", `Framed canvas is stretched over a wooden frame and ready to hang on the wall. It is ideal for portraits, calligraphy, office décor and gifts. Choose the size that suits your wall and we will prepare a proof.`),
      ],
    },
    {
      slug: "standees-roll-up-banners",
      name: "Standees / Roll-up Banners",
      short: "Roll-up standees and X-banners printed in Lahore for exhibitions, events and shops.",
      content: `Standees are portable banners that set up in seconds at exhibitions, seminars, bank branches, malls and shop entrances. Mix Print Design prints roll-up standees and X-banners in Lahore with the printed graphic, stand and carry bag.

Roll-up standees retract into their base for easy transport and are ideal for events and frequent use, while X-banners are a lighter, economical option. Standees help brands across Pakistan promote launches, offers and services wherever customers gather.

Send us your artwork or ask our designers to create a design that reads well from a distance. You approve the proof before printing.`,
      children: [
        leaf("roll-up-standee", "Roll-up Standee", "Retractable roll-up standees with base and carry bag.", `Roll-up standees retract into an aluminium base for quick setup and easy carrying. They are perfect for exhibitions, seminars, reception areas and in-store promotions. The graphic can be replaced later on the same stand. Ask for a quote with your preferred size.`),
        leaf("x-banner", "X-Banner", "Lightweight, economical X-banners for events and shops.", `X-banners use a lightweight X-shaped stand, making them the most economical portable banner. They suit short promotions, events and shop entrances. Easy to assemble and transport.`),
        leaf("backdrop-stands", "Backdrop Stands", "Large backdrop banners for stages, photo walls and press events.", `Backdrop stands hold large printed banners behind stages, reception desks and photo areas at events, launches and press conferences. They create a branded background for photos and videos. Tell us the width and height you need.`),
      ],
    },
    leaf("backlit-film", "Backlit Film", "Backlit film printing in Lahore for light boxes and illuminated displays.", `Backlit film is a translucent material printed for light boxes and illuminated displays, giving rich, even colour when lit from behind. Mix Print Design prints backlit film in Lahore for restaurant menu boards, pharmacies, malls, airports and showroom displays.

Compared with standard media, backlit film shows sharper detail and deeper colours, making product and food photos look appealing. It is ideal for indoor light boxes where viewers are close to the display.

Send us the light box size and your artwork. We will prepare the file at the right resolution and quote per square foot.`, SQFT),
    leaf("wall-graphics-wallpapers", "Wall Graphics & Wallpapers", "Custom wall graphics and printed wallpapers for offices, cafés and homes in Lahore.", `Custom wall graphics and printed wallpapers transform plain walls into branded or decorative features. Mix Print Design prints wall graphics in Lahore for offices, cafés, restaurants, schools, clinics and homes across Pakistan.

Show your company values in the office, add a mural in a restaurant, or create a feature wall at home with your own image. Materials are chosen for the wall surface and how long the graphic needs to last.

Send us the wall measurements and a photo, and our designers can prepare artwork to fit. We quote per square foot and send a proof before printing.`, SQFT),
    leaf("vehicle-branding", "Vehicle Branding", "Vehicle branding and car wraps in Lahore for delivery vans, cars and bikes.", `Vehicle branding turns cars, vans, rickshaws and delivery bikes into moving advertisements. Mix Print Design prints vehicle graphics in Lahore for delivery services, schools, companies and campaigns across Pakistan.

Choose partial graphics such as logos and contact details on doors, or larger wraps for maximum impact, with one-way vision on rear windows. Durable vinyl keeps graphics looking good on the road.

Tell us the vehicle model and the coverage you want, and our designers will prepare a layout to fit. We send a proof and quote before printing.`, SQFT),
    leaf("fabric-sublimation-banners", "Fabric & Sublimation Banners", "Fabric banners, flags and sublimation prints for events and exhibitions.", `Fabric banners and flags printed by sublimation have bright, washable colours and a premium, glare-free look. Mix Print Design prints fabric banners in Lahore for exhibitions, sports events, schools, conferences and brand activations across Pakistan.

Fabric is light to carry, folds without creasing badly and looks great under event lighting. Use it for backdrops, table covers, flags and hanging banners.

Share the size and use, and we will recommend a fabric and finishing. You approve the proof before printing.`, SQFT),
  ],
};
