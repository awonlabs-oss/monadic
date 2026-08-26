import { redirect } from "next/navigation";

/*
 * The frontpage is design-led and blocked (DESIGN.md §6). This route exists
 * only so that `/` goes somewhere useful; it renders nothing and makes no design
 * decisions. Delete it and build the real page when frames land.
 */
export default function RootPage() {
  redirect("/jobs");
}
