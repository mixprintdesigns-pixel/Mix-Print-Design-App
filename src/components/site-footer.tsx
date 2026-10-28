export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted sm:grid-cols-3">
        <div>
          <p className="text-base font-bold text-foreground">
            Mix<span className="text-brand">Print</span>
          </p>
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
      </div>
    </footer>
  );
}
