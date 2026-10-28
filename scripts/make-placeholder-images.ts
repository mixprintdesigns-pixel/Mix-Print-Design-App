// Generates simple SVG placeholder photos for the demo catalog into public/products.
// Replace them with real product photography before launch.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { imagePath, products } from "../prisma/seed-data";

const palettes = [
  ["#c2185b", "#fce4ec"],
  ["#0891b2", "#e0f7fa"],
  ["#ca8a04", "#fef9c3"],
  ["#1c1917", "#f5f5f4"],
];

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const outDir = join(process.cwd(), "public", "products");
mkdirSync(outDir, { recursive: true });

products.forEach((product, p) => {
  product.imageViews.forEach((view, i) => {
    const [ink, paper] = palettes[(p + i) % palettes.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <rect width="800" height="600" fill="${paper}"/>
  <g transform="rotate(${(i % 2 ? 4 : -5)} 400 300)">
    <rect x="190" y="150" width="420" height="270" rx="18" fill="#ffffff" stroke="${ink}" stroke-width="4"/>
    <rect x="190" y="150" width="140" height="270" rx="18" fill="${ink}" opacity="0.9"/>
    <circle cx="260" cy="230" r="34" fill="#ffffff" opacity="0.85"/>
    <rect x="360" y="200" width="200" height="18" rx="9" fill="${ink}"/>
    <rect x="360" y="235" width="150" height="12" rx="6" fill="${ink}" opacity="0.5"/>
    <rect x="360" y="260" width="170" height="12" rx="6" fill="${ink}" opacity="0.35"/>
  </g>
  <text x="400" y="510" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="${ink}">${escape(product.name)}</text>
  <text x="400" y="552" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="${ink}" opacity="0.7">${escape(view)}</text>
</svg>
`;
    writeFileSync(join(process.cwd(), "public", imagePath(product.slug, i)), svg);
  });
});
console.log(`Wrote placeholder images to ${outDir}`);
