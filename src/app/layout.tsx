import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monadic",
  description: "Personal job search platform for early-stage startup roles.",
};

/*
 * DESIGN.md §4 Layout is OPEN, so this is structure only: a landmark-correct
 * shell with a plain list of links and no visual design decisions beyond the
 * token layer. It is not a navigation design and should not be treated as one.
 * Typeface is the token's system-ui placeholder — no webfont is loaded, because
 * DESIGN.md §3 Typography is OPEN too.
 */
const ROUTES = [
  { href: "/jobs", label: "Jobs" },
  { href: "/applications", label: "Applications" },
  { href: "/contacts", label: "Contacts" },
  { href: "/templates", label: "Templates" },
  { href: "/profile", label: "Profile" },
  { href: "/settings/companies", label: "Companies" },
  { href: "/settings/runs", label: "Ingestion" },
] as const;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:bg-surface-raised focus:text-content-primary focus:p-compact"
        >
          Skip to main content
        </a>

        <header className="border-b border-border-subtle">
          <nav aria-label="Main" className="p-comfortable">
            <ul className="flex flex-wrap gap-comfortable">
              {ROUTES.map((route) => (
                <li key={route.href}>
                  <Link href={route.href} className="text-content-secondary underline">
                    {route.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <main id="main" className="p-comfortable">
          {children}
        </main>
      </body>
    </html>
  );
}
