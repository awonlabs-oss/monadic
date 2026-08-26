import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import { ingestionHealth, navCounts } from "@/lib/data/health";
import "./globals.css";

/*
 * Application shell. DESIGN.md section 4, DECIDED for application routes.
 *
 * Fixed 248px sidebar on the warm canvas with a 1px right border; main column
 * fills the rest with 40px horizontal and 36px top padding. Both values are
 * tokens (space/page, space/section), not literals.
 *
 * Inter is self-hosted by next/font — no runtime request to Google, and no
 * layout shift. The token font/family/sans points at the variable this exposes.
 */

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
    <html lang="en" className={inter.variable}>
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

          <main id="main" className="min-w-0 flex-1 px-page pt-section pb-page">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
