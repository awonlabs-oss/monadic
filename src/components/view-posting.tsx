import { ExternalLinkIcon } from "./icons";

/**
 * The posting link, for a job you have already applied to.
 *
 * It stands where Apply stood. Offering Apply on something already sent is the
 * app disagreeing with its own record — the board says Applied, the button says
 * you have not — and the cost of believing the button is a duplicate
 * application to the same req, which is the one outcome this page can actually
 * cause.
 *
 * Neutral, not coral. DESIGN.md section 1 gives coral to the action that leaves
 * the app, and this leaves the app too, so the rule reads as though it should
 * apply. It does not, because coral is really marking the *primary* action, and
 * once an application is in, going back to read the posting is not it —
 * following up is. Coral here would put the loudest thing on the page on the
 * one control that changes nothing.
 */
export function ViewPosting({
  url,
  jobTitle,
  companyName,
  size = "card",
}: {
  url: string;
  jobTitle: string;
  companyName: string;
  size?: "card" | "page";
}) {
  const px = size === "page" ? "px-body" : "px-default";

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className={`inline-flex items-center gap-tight rounded-subtle border border-border-subtle bg-surface-base ${px} py-compact text-small font-medium leading-none text-content-secondary transition-colors hover:bg-surface-hover hover:text-content-primary`}
    >
      <ExternalLinkIcon className="size-icon-sm shrink-0" />
      View original posting
      <span className="sr-only">
        {" "}
        for {jobTitle} at {companyName}, opens in a new tab
      </span>
    </a>
  );
}
