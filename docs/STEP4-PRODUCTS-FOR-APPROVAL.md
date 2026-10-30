# Step 4: products for approval

**Nothing here has been added to the website yet.** Reply "yes" to approve, or tell me what to change.

## Before you approve
- **Reference site:** printiostic.com is blocked in this coding session (403), so I could not read its products or prices. This list uses your own catalogue.
  - To compare with the reference site, allow `printiostic.com` in the environment's **Network access** setting. I will then add any missing products and a reference price column.
- **Prices:**
  - The starting prices are left empty. Those products show **"Get Quote"** and **"Order on WhatsApp"**, and no price is shown.
  - When you type a price in Admin, the product shows it automatically.
- **Images:**
  - Each product gets 2–3 original AI images: front view, angle view and in-use view.
  - Use the **Admin → Products → (product) → "Create an original image with AI"** buttons. They run on Vercel with your `IMAGE_API_KEY`.
  - This session cannot reach OpenAI, so the images will be made after you approve.
- **Content:** every product gets the same content shown in the 3 samples below:
  - SEO title (60 characters or fewer) and meta description (155 or fewer)
  - clean URL
  - short description and full description (150–300 words with H2 sections)
  - 3–5 FAQs with FAQ schema, plus Product and Breadcrumb schema

## Full product list
The full product table (about 100 products, with their options and gift tags) is in [CATALOGUE-PROPOSAL.md](CATALOGUE-PROPOSAL.md), section 7. The only change is **Sign Board Maker**, which now matches your latest structure:

| Product | Category (last level) | Options |
| --- | --- | --- |
| Simple Acrylic Sign | 3D Sign Board → Simple Acrylic Sign | Size in sq. ft · acrylic colour · thickness (3 / 5 mm) · lighting (none / LED) · installation |
| Logo Board with Acrylic Sign | 3D Sign Board → Logo Board with Acrylic Sign | Size · backing board (ACP / PVC / wood) · lighting · installation |
| Frame with Acrylic Sign | 3D Sign Board → Frame with Acrylic Sign | Size · frame colour (silver / black / gold) · lighting · installation |
| Aluminium with Acrylic Sign | 3D Sign Board → Aluminium with Acrylic Sign | Size · ACP colour · front-lit or back-lit LED · installation |
| Glitter Sign | 3D Sign Board → Glitter Sign | Size · glitter colour · backing · installation |
| Normal / Medium / Premium Backlit Sign Board (3 products) | Backlit Sign Board → each level | Size in sq. ft · frame (iron / aluminium) · LED modules · installation |
| Normal / Medium / Premium Front-lit Sign Board (3 products) | Front-lit Sign Board → each level | Size in sq. ft · frame · spotlights (2 / 4) · installation |

---

## Sample 1: Matte Business Cards
- **Category:** Offset Printing → Business Cards → Matte
- **URL:** `/products/offset-printing/business-cards/matte/matte-business-cards`
- **SEO title (49 characters):** Matte Business Cards Printing in Lahore | Mix Print Design
- **Meta description (147 characters):** Smooth, non-glare matte business cards printed on thick card in Lahore. Choose size, sides and quantity, then order on WhatsApp. Delivery across Pakistan.
- **Short description:** Classic matte business cards on thick 350–400gsm card, easy to read and easy to write on.
- **Options (price per option can be set in admin):**
  - Size: Standard 3.5×2 in · Square 2.5×2.5 in
  - Card: 350gsm · 400gsm
  - Printed sides: Front only · Front & back
  - Quantity: 100 · 250 · 500 · 1000
- **Full description (about 190 words):**
  - **Professional matte business cards in Lahore.** Matte business cards have a soft, non-reflective surface that looks clean and professional in any light. They are the everyday choice for doctors, lawyers, shop owners, sales teams and offices, and the matte surface is easy to write on for appointments and notes.
  - **Sizes and card.** Choose the standard 3.5 × 2 inch size or a modern square card, on 350gsm or thicker 400gsm card. Print on one side or both.
  - **Design and proof.** Send your logo and details on WhatsApp, or ask our designers to create the card for you. We send a digital proof, and nothing is printed until you approve it.
  - **Why Mix Print Design.** Sharp offset printing, accurate colours, careful cutting and friendly service from our studio on Raiwind Road, Lahore.
  - **Delivery.** Collect in Lahore, or we deliver across Pakistan.
- **FAQs:**
  1. *How long does printing take?* Usually 2–3 working days after you approve the proof.
  2. *Can you design my card?* Yes. Our designers can create a new design or improve your current card.
  3. *What is the minimum quantity?* 100 cards.
  4. *Can I write on matte cards?* Yes. Matte card takes pen and pencil well, unlike gloss.

## Sample 2: Bill Book / Invoice Book
- **Category:** Offset Printing → Bill Books / Invoice Books
- **URL:** `/products/offset-printing/bill-books-invoice-books/bill-book-printing`
- **SEO title (47 characters):** Bill Book Printing in Lahore | Mix Print Design
- **Meta description (150 characters):** Custom bill books and invoice books with numbering in duplicate, triplicate or carbonless copies. A5, A4 or 7×10 in. Order on WhatsApp in Lahore.
- **Short description:** Numbered bill books and invoice books in duplicate, triplicate or carbonless copies, with your logo and details.
- **Options:**
  - Size: A5 · A4 · 7×10 in
  - Colours: 1 colour · 4 colour
  - Paper: 68gm · 80gm · 90gm art · 113gm art
  - Copies: Duplicate · Triplicate · Carbonless (NCR)
  - Numbering: Yes · No
  - Quantity in books: 5 · 10 · 25 · 50
- **Full description (about 200 words):**
  - **Bill books that keep your business organised.** Printed bill books and invoice books give every sale a neat, numbered record. They suit shops, wholesalers, workshops, restaurants, transporters and service businesses across Lahore.
  - **Sizes, paper and copies.** Choose A5, A4 or 7×10 inch books on 68gm, 80gm, 90gm art or 113gm art paper. Pick duplicate or triplicate sets, or carbonless (NCR) paper that copies without carbon sheets. Each copy can be a different colour so the customer and office copies are easy to tell apart.
  - **Numbering and binding.** Serial numbering runs across the whole order. Books are glued and stapled with a sturdy cover.
  - **Why Mix Print Design.** We set up your logo, address, NTN and terms and send a proof before printing.
  - **Delivery.** Collect from Raiwind Road, Lahore, or we deliver across Pakistan.
- **FAQs:**
  1. *What is the difference between duplicate and carbonless?* Duplicate books use carbon sheets; carbonless (NCR) paper copies without carbon.
  2. *Can the books be numbered?* Yes, with continuous serial numbers.
  3. *How many sets are in a book?* Usually 50 sets per book; other counts are available.
  4. *Can you add my NTN and terms?* Yes. Send them with your logo and we include them in the design.

## Sample 3: White Photo Mug
- **Category:** Customized Printing → Mugs → White Mug
- **URL:** `/products/customized-printing/mugs/white-mug/white-photo-mug`
- **SEO title (53 characters):** Custom Printed Mugs in Lahore | Mix Print Design
- **Meta description (148 characters):** Personalised white mugs printed with your photo, name or logo. Ideal for gifts, Eid and corporate events. Order on WhatsApp, delivery across Pakistan.
- **Short description:** A glossy white ceramic mug printed with your photo, name or logo in bright, long-lasting colours.
- **Options:**
  - Size: 11 oz · 15 oz
  - Print: One side · Wrap-around
  - Gift box: No · Yes
  - Quantity: 1 or more
- **Gift tags:** Birthday · Anniversary · Valentine's Day · Mother's Day · Father's Day · Eid · Corporate Gifts
- **Full description (about 170 words):**
  - **A gift they will use every day.** A custom printed mug turns a favourite photo, a name or a company logo into a gift that is used every day. Printed mugs are popular for birthdays, anniversaries, Eid, Mother's and Father's Day, and as corporate giveaways in Lahore.
  - **Print and sizes.** Choose a classic 11 oz or a larger 15 oz white ceramic mug. Print on one side, or wrap the design all the way around. Sublimation printing gives bright colours that do not peel.
  - **Bulk and corporate orders.** Add your logo for staff gifts, events and promotions, with bulk pricing on larger quantities.
  - **Why Mix Print Design.** We check your photo quality, prepare a preview, and pack every mug safely, with an optional gift box.
  - **Delivery.** Collect in Lahore, or we deliver across Pakistan.
- **FAQs:**
  1. *Is the print dishwasher safe?* Hand washing is best to keep colours bright for years.
  2. *Can I order just one mug?* Yes, single mugs are welcome.
  3. *Can you print a collage of photos?* Yes. Send up to 6 photos and we arrange them.
  4. *Do you deliver outside Lahore?* Yes, we deliver across Pakistan.

---

## What I will add after you approve
1. A **FAQ section** on product pages, with **FAQPage schema**, editable in admin.
2. Products with **no price**: they show "Get Quote" and "Order on WhatsApp" instead of a price.
3. **All approved products**, with their content and options, added through a migration that only adds rows. A dated backup is taken first.
4. **Images:** you press "Create an original image with AI" for each product. Alternatively, I can add an admin button that makes all images for one category at a time.
