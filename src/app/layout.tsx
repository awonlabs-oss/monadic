import type { Metadata } from "next";
import { Figtree, EB_Garamond } from "next/font/google";
import "./globals.css";

/*
 * The document, and nothing else.
 *
 * The shell moved to (app)/layout.tsx. It used to live here, which meant every
 * route got the sidebar and the profile dock — including /login, whose own
 * docstring says it is "deliberately not the app shell". It was: the page
 * rendered a bare card, and the layout wrapped it in the nav, the counts and
 * the dock anyway. So the sign-in screen showed the tabs, the job counts, the
 * sync status and the profile before anyone had typed the password, and none of
 * that was recoverable from inside the page.
 *
 * A route group fixes it at the level the problem lives at. `(app)` adds no
 * path segment, so every URL is unchanged; it just gives the authenticated
 * routes a layout that /login does not share. This file keeps what genuinely
 * belongs to every document: the html and body elements, the fonts, and the
 * stylesheet.
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
  // 600 as well as 400. A page title set in semibold with only the regular
  // weight loaded gets a browser-synthesised bold — the outlines smeared
  // sideways — and on a serif that reads as a rendering fault rather than as
  // emphasis. The weight has to be a real cut.
  weight: ["400", "600"],
  style: ["italic"],
  variable: "--font-garamond",
  display: "swap",
});

/*
 * Nothing in this app is prerenderable.
 *
 * Every page already declares force-dynamic, but the layout did not, and `/`
 * did not either — so Next prerendered `/` at build time, which ran this
 * layout, which signs in to Supabase. A build that cannot compile without a
 * reachable, seeded database is a build that fails on a fresh Vercel project
 * with "Error occurred prerendering page /". Declared here as well as on the
 * pages because the layout is what actually touches the database.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Monadic",
  description: "Personal job search platform for early-stage startup roles.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${figtree.variable} ${garamond.variable}`}>
      <body className="min-h-screen bg-surface-canvas text-content-primary antialiased">
        {children}
      </body>
    </html>
  );
}
