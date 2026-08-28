import { redirect } from "next/navigation";

/*
 * `/` is the recommendation feed. This route exists only to send it there and
 * makes no design decisions of its own.
 */
/*
 * The only route that never declared this, which is why it was the one Next
 * tried to prerender — and prerendering it meant running the root layout's
 * database reads during the build.
 */
export const dynamic = "force-dynamic";

export default function RootPage() {
  redirect("/for-you");
}
