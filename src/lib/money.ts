const options = { style: "currency", currency: "PKR", currencyDisplay: "code" } as const;
const whole = new Intl.NumberFormat("en-PK", { ...options, maximumFractionDigits: 0 });
const withPaisa = new Intl.NumberFormat("en-PK", { ...options, minimumFractionDigits: 2 });

/** Formats integer paisa as rupees: 125000 -> "PKR 1,250", 250 -> "PKR 2.50". */
export function formatPKR(minor: number): string {
  const formatter = minor % 100 === 0 ? whole : withPaisa;
  return formatter.format(minor / 100).replace(/ /g, " ");
}
