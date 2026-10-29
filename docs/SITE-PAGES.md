# Website pages, services, reviews, contact and AI assistant

## Pages
| Route | What it shows | Managed in |
| --- | --- | --- |
| `/` | Hero with logo and Shop Now / Get a Quote, top (featured) products, services, customer reviews, then the existing category and affiliate sections | Products (featured flag), Admin → Services, Admin → Reviews |
| `/services`, `/services/[slug]` | Service category → sub-type → quality, each with image, description, Get Quote (contact form, pre-filled) and WhatsApp buttons, plus linked products | Admin → Services |
| `/about` | Story, mission, owner profile, "why choose us" | Admin → About page |
| `/contact` | Contact form, phone/WhatsApp, email, address, Facebook, Google map | Messages in Admin → Contact messages |

## Services
- Initial categories come from the business: **Board Maker** (sub-types Backlit, Front-lit, 3D), **Offset Printing**, **Digital Printing**. They are created by the database migration, so they exist in every environment.
- Qualities, images and more categories or sub-types are added in Admin → Services. Every level can be edited, reordered, hidden or deleted. Deleting is blocked while products are linked; hide it instead.
- **Products appear automatically**: link a product to any level in Admin → Services ("Link a product…"). Only published products are shown.

## Customer reviews
Admin → Reviews: add, edit, publish/hide, reorder, delete. The home page section stays hidden until at least one review is published. No sample reviews are included: add genuine customer reviews only.

## Contact form
Each submission is saved to the database first, then emailed to **mixprintdesigns@gmail.com** with the sender as reply-to. Email uses Resend: set `RESEND_API_KEY` and `EMAIL_FROM` (an address on a domain you verify in Resend). If email is not configured or fails, the message is still in Admin → Contact messages, marked "Not emailed". Protection: hidden honeypot field and 5 messages per 10 minutes per visitor.

## AI chat assistant
- A floating button on every page opens the chat. The conversation is kept while browsing (this tab only).
- **Knowledge base:** published products (prices, options, tiers, discounts), visible services, About, contact details, affiliate terms and ordering information are indexed into the `KnowledgeChunk` table and searched with PostgreSQL full-text search. The index rebuilds automatically when any of that content changes.
- **With `ANTHROPIC_API_KEY`:** the best matching pages are sent to Claude (`claude-opus-5-5` by default, low effort for quick chat replies; override with `CHAT_MODEL`). Claude answers with links to site pages. When the site doesn't cover a question, it can use Anthropic's server-side web search (max 2 searches, located in Lahore) for general printing knowledge, under instructions to stay on Mix Print Design topics and never name or recommend other printing businesses. Server-side refusal fallbacks are enabled (`fallbacks: "default"`).
- **Without a key, or if the API is unavailable:** the assistant lists the best matching pages with links, and offers WhatsApp/contact when nothing matches.
- **Security:** the API key is only used on the server (`/api/chat`). Rate limit: 8 questions per minute and 150 per day per visitor. Input limited to 1,000 characters.
- **Cost:** each AI answer is one Claude request (plus any web searches). Watch usage in the Anthropic Console; lower cost by switching `CHAT_MODEL` to a smaller model if quality holds.
