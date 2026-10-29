import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { CategoryCard } from "@/components/catalog/category-card";
import { getCategoryTree } from "@/lib/catalog/queries";
import { serviceUrl } from "@/lib/catalog/tree";
import { pageMetadata } from "@/lib/content/seo-pages";

export const generateMetadata = () => pageMetadata("services");

// One level at a time: this page lists only the main services. Each service page lists its own
// categories, each category its sub-categories, and the last level its products.
export default async function ServicesPage() {
  const services = await getCategoryTree();
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <Breadcrumbs items={[{ name: "Services", href: "/services" }]} />
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Our printing &amp; signage services</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            Board making, offset printing, digital printing and customized printing in Lahore. Choose a service to see what we make, or ask for a
            quote on WhatsApp.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12">
        {services.length === 0 ? (
          <p className="text-muted">Services will appear here soon.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" data-testid="main-services">
            {services.map((service, i) => (
              <CategoryCard key={service.id} category={service} href={serviceUrl(service.path)} index={i} headingLevel={2} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
