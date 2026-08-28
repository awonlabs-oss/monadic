import { redirect } from "next/navigation";

/*
 * `/` is the recommendation feed. This route exists only to send it there and
 * makes no design decisions of its own.
 */
export default function RootPage() {
  redirect("/for-you");
}
