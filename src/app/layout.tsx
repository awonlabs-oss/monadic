import type { Metadata } from "next";
import { Figtree, EB_Garamond } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import { ingestionHealth, navCounts } from "@/lib/data/health";
import "./globals.css";

/*
 * Application shell. DESIGN.md section 4, DECIDED for application routes.
 *
 * Fixed 248px sidebar on the warm canvas with a 1px right border; main column
 * fills the rest. The page padding — 40px horizontal, 36px top, both tokens
 * (space/page, space/section) — is applied per route rather than here, because
 * /jobs docks a panel that has to reach the right edge of the viewport.
 *
 * Two faces, self-hosted by next/font — no runtime request to Google and no
 * layout shift. The font/family tokens point at the variables these expose.
 *
 * Figtree carries the interface. It replaced Inter, which was doing nothing
 * wrong and nothing memorable either; Figtree's rounder terminals and taller
 * x-height read warmer at the 13px this app spends most of its time at, which
 * is the difference between a warm palette and a warm product.
 *
 * EB Garamond is italic-only and appears in perhaps six places: page titles,
 * empty states, the wordmark. It is the whole reason the reference sites read
 * as considered rather than generic, and it is also the fastest way to make a
 * dense tool look like a brochure — so it is confined to moments where a human
 * is being addressed directly, and never touches a row, a tag or a figure.
 */

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-figtree",
  display: "swap",
});

const garamond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-garamond",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Monadic",
  description: "Personal job search platform for early-stage startup roles.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [health, counts] = await Promise.all([ingestionHealth(), navCounts()]);

  return (
    <html lang="en" className={`${figtree.variable} ${garamond.variable}`}>
      <body className="min-h-screen bg-surface-canvas text-content-primary antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:m-compact focus:rounded-default focus:bg-surface-base focus:px-comfortable focus:py-compact focus:text-body"
        >
          Skip to main content
        </a>

        <div className="flex min-h-screen">
          <aside className="w-sidebar shrink-0 border-r border-border-subtle">
            <div className="sticky top-0 h-screen">
              <Sidebar health={health} counts={counts} />
            </div>
          </aside>

          {/*
            No padding here. /jobs docks a profile panel flush to the right edge
            of the viewport (frame 22:471), and padding on main would inset the
            dock's border along with the feed. Each route applies its own page
            padding to the column that should have it.
          */}
          <main id="main" className="min-w-0 flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
