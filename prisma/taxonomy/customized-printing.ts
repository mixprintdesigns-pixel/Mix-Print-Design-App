import type { TaxonomyNode } from "./types";

const item = (slug: string, name: string, short: string, content: string): TaxonomyNode => ({ slug, name, short, content, children: [] });

export const customizedPrinting: TaxonomyNode = {
  slug: "customized-printing",
  name: "Customized Printing",
  short: "Customized printing in Lahore: mugs, pens, keychains, T-shirts, caps, shields, acrylic name plates and laser engraving.",
  content: `Customized printing puts your name, logo or message on everyday items that people keep and use. Mix Print Design offers customized printing in Lahore on mugs, pens, keychains, photo frames, T-shirts, caps and safety jackets, plus laser engraving, acrylic name plates and award shields.

Companies order branded giveaways for events and staff, schools order shields and souvenirs, and families order personalised gifts for birthdays, weddings and Eid. Many items can be personalised one by one with different names or photos.

Choose an item below, or send us your idea, quantity and deadline. Our designers can prepare the artwork, and you approve the proof before we produce your order. We deliver across Pakistan.`,
  children: [
    item("pens", "Pens", "Printed and engraved pens with your logo for offices, events and giveaways.", `Branded pens are one of the most useful promotional items, used every day at desks, counters and meetings. Mix Print Design prints and engraves pens in Lahore with your logo, name or message, for corporate giveaways, conferences, schools and hotels across Pakistan.

Choose from everyday plastic pens for large giveaways or metal pens with laser engraving for executive gifts. A clear logo and contact details keep your brand in front of customers long after the event.

Tell us the quantity and the style you prefer, and share your logo. We will suggest suitable options and send a proof before production.`),
    item("keychains", "Keychains", "Custom keychains in acrylic, metal and rubber, printed or engraved in Lahore.", `Custom keychains are small, low-cost gifts that people carry every day. Mix Print Design makes printed and engraved keychains in Lahore for businesses, real-estate projects, car dealers, schools and events.

Choose acrylic keychains with full-colour prints, metal keychains with laser engraving, or custom shapes that match your logo. They make great giveaways, souvenirs and personalised gifts with names or photos.

Share your design, quantity and preferred material, and we will send a proof and quote.`),
    item("mugs", "Mugs", "Custom printed mugs in Lahore with logos, photos and messages.", `Printed mugs are a favourite gift and a long-lasting branding item for offices and cafés. Mix Print Design prints custom mugs in Lahore with your logo, photo or message, for corporate gifts, staff appreciation, birthdays, weddings and Eid.

Choose classic white mugs, coloured inner mugs or magic mugs that reveal the design when filled with a hot drink. Each mug can carry a different name or photo for a personal touch.

Send us your images and quantity, and we will prepare a proof before printing.`),
    item("photo-frames", "Photo Frames", "Personalised photo frames and printed frames for gifts and décor.", `Personalised photo frames turn special memories into lasting gifts. Mix Print Design prints photo frames in Lahore for birthdays, weddings, anniversaries, graduations and corporate recognition.

Choose frames with your printed photo and message, or acrylic and wooden frames with engraved details. They are thoughtful gifts for family and friends, and also suit award ceremonies and staff recognition.

Send us your photo and preferred size, and we will check the image quality and send a proof before printing.`),
    item("t-shirts", "T-Shirts", "Custom T-shirt printing in Lahore for teams, events, brands and schools.", `Custom T-shirts unite teams and promote brands at events, campaigns and sports days. Mix Print Design prints T-shirts in Lahore with your logo, slogan or artwork, for companies, schools, universities, clubs and events across Pakistan.

Choose the shirt colour, sizes and print positions such as front, back and sleeves. Printing methods are chosen according to your design and quantity to keep colours bright and durable.

Tell us the quantity by size, the colours and your design, and we will send a proof and quote before production.`),
    item("safety-jackets", "Safety Jackets", "Printed high-visibility safety jackets with company logos and names.", `Printed safety jackets keep workers visible and identify your company on construction sites, factories, warehouses, events and traffic duties. Mix Print Design prints high-visibility safety jackets in Lahore with your logo, company name and job titles.

Clear branding helps visitors identify staff, improves safety and gives your team a professional look. Jackets can be printed on the front, back or both.

Share your logo, quantity and sizes, and we will send a proof and quote.`),
    item("caps", "Caps", "Custom printed and embroidered caps for teams, events and promotions.", `Custom caps are popular for promotional campaigns, sports teams, staff uniforms and events. Mix Print Design prints caps in Lahore with your logo or slogan for companies, clubs and schools across Pakistan.

Choose cap colours and the print or embroidery position on the front, side or back. Caps make practical giveaways that keep your brand visible outdoors.

Tell us the quantity, colours and your design, and we will send a proof and quote before production.`),
    item("laser-printing", "Laser Printing", "Laser cutting and laser printing for custom shapes, signs and gifts in Lahore.", `Laser printing and laser cutting create precise shapes and detailed designs in materials such as acrylic, wood and card. Mix Print Design offers laser services in Lahore for signage parts, décor, invitations, gifts and branded items.

Laser cutting makes intricate patterns, lettering and custom shapes that are difficult to produce by hand, with clean edges and consistent results across many pieces.

Send us your design or idea, the material and quantity, and we will advise on what is possible and send a quote.`),
    item("laser-marking-engraving", "Laser Marking / Engraving", "Laser engraving and marking on metal, wood and acrylic in Lahore.", `Laser engraving marks names, logos and serial numbers permanently on metal, wood, acrylic and other materials. Mix Print Design offers laser marking and engraving in Lahore for corporate gifts, pens, keychains, plaques, tools and equipment.

Engraving gives a refined, permanent finish that does not wear off like ink, making it ideal for executive gifts, awards and product identification.

Tell us the item, material and design, and we will send a proof and quote.`),
    item("acrylic-name-plates", "Acrylic Name Plates", "Acrylic name plates for homes, offices and doors in Lahore.", `Acrylic name plates give homes, offices and clinics a clean, modern nameplate. Mix Print Design makes acrylic name plates in Lahore for house gates, office doors, desks and reception counters.

Choose clear, frosted or coloured acrylic with printed, cut or engraved lettering, and mount it with stand-off fittings for a floating effect. Urdu and English lettering are both possible.

Share the name, size and style you want, and we will send a design proof before production.`),
    item("small-acrylic-signs-designs", "Small Acrylic Signs & Designs", "Small acrylic signs, table tents, stands and décor pieces.", `Small acrylic signs and designs are useful for counters, desks, events and décor. Mix Print Design makes acrylic table signs, QR code stands, direction signs, menu holders, cake toppers and decorative pieces in Lahore.

Acrylic looks clean and modern, is easy to wipe and can be printed, cut or engraved. Small pieces are ideal for restaurants, clinics, shops, weddings and events.

Tell us what you need, the size and quantity, and we will suggest a design and send a quote.`),
    item("shields-awards", "Shields / Awards", "Custom shields, trophies and awards in Lahore for schools and companies.", `Custom shields and awards recognise achievement at schools, universities, sports events and corporate ceremonies. Mix Print Design makes shields and awards in Lahore in wood, acrylic and metal, with printed or engraved logos, names and messages.

Each award can be personalised with the winner's name and achievement, and designs can match your event theme. Ordering in good time before your ceremony helps us plan production.

Share the number of awards, names and your design ideas, and we will send a proof and quote.`),
  ],
};
