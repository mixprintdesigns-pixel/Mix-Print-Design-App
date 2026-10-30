import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <BrandLogo className="h-12 w-auto" />
          <p className="mt-2">Quality printing, delivered across Pakistan.</p>
        </div>
        <div>
          <p className="font-semibold text-foreground">Pay with</p>
          <p className="mt-2">JazzCash · Easypaisa · Cash on delivery · Bank transfer</p>
        </div>
        <div>
          <p className="font-semibold text-foreground">Need a design?</p>
          <p className="mt-2">Our designers can create your artwork and send proofs for approval.</p>
        </div>
        <div>
          <p className="font-semibold text-foreground">Affiliates</p>
          <ul className="mt-2 space-y-1">
            <li>
              <Link href="/affiliate" className="hover:text-foreground">
                Affiliate program
              </Link>
            </li>
            <li>
              <Link href="/affiliate/join" className="hover:text-foreground">
                Become an affiliate
              </Link>
            </li>
            <li>
              <Link href="/affiliate/dashboard" className="hover:text-foreground">
                Affiliate dashboard
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
