import { Sidebar } from "@/components/sidebar";
import { ProfileDock } from "@/components/profile-dock";
import { shellHealth, shellCounts } from "@/lib/data/health";

/*
 * Application shell. DESIGN.md section 4, DECIDED for application routes.
 *
 * Fixed 248px sidebar on the warm canvas with a 1px right border; main column
 * fills the rest. The page padding — 40px horizontal, 36px top, both tokens
 * (space/page, space/section) — is applied per route rather than here, because
 * /jobs docks a panel that has to reach the right edge of the viewport.
 *
 * It lives in a route group rather than at the root so that /login does not get
 * it. That was the bug: the shell was the root layout, so the sign-in screen
 * rendered the nav, the job counts, the sync status and the profile dock behind
 * the password form — every one of them a server-rendered read of the signed-in
 * user's data, sitting in the HTML of the one page anybody can reach. `(app)`
 * adds no path segment, so no URL changes.
 *
 * Nothing here is prerenderable: these two reads sign in to Supabase, and a
 * build that needs a live database to compile fails on a fresh deployment.
 */
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [health, counts] = await Promise.all([shellHealth(), shellCounts()]);

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:m-compact focus:rounded-default focus:bg-surface-base focus:px-comfortable focus:py-compact focus:text-body"
      >
        Skip to main content
      </a>

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

      {/*
        The profile docks here, on every route, rather than being rendered
        by one page and reachable from a nav item on the others.

        It is reference material — the thing you read a posting against —
        so it belongs beside whatever you are reading, not behind a
        navigation that costs you your place in the feed. Rendered in the
        layout, it also survives navigation instead of unmounting and
        refetching on each route change.
      */}
      <ProfileDock />
    </div>
  );
}
