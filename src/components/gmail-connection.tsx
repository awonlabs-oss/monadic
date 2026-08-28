import Link from "next/link";
import { connectedAccount, googleConfig } from "@/outreach/gmail";

/**
 * Whether Gmail is connected, and how to change that.
 *
 * States it in terms of what monadic can do rather than what was granted:
 * "create drafts" is the fact, and the scope name is not something anyone
 * should have to translate.
 */
export async function GmailConnection({ status }: { status?: string }) {
  const configured = Boolean(googleConfig());
  const account = configured ? await connectedAccount() : null;

  return (
    <section className="flex flex-col gap-compact rounded-default border border-border-subtle bg-surface-base px-default py-body">
      <div className="flex flex-col gap-tight">
        <h2 className="text-body font-semibold text-content-primary">Gmail</h2>
        <p className="max-w-reading text-caption leading-relaxed text-content-secondary">
          Connecting lets you send a drafted email from your own address, or
          save it to your Gmail drafts to finish there. Sending always goes
          through a review screen showing the exact recipient, subject and body
          — monadic never sends anything you have not read on that screen.
        </p>
      </div>

      {!configured ? (
        <p className="text-caption text-content-tertiary">
          Not available on this deployment: GOOGLE_CLIENT_ID and
          GOOGLE_CLIENT_SECRET are unset. See DEPLOY.md.
        </p>
      ) : account ? (
        <div className="flex flex-wrap items-center gap-compact">
          <span className="rounded-tag bg-badge-green-bg px-chip py-xtight text-caption font-medium text-badge-green-fg">
            Connected
          </span>
          <span className="text-caption text-content-secondary">{account.email}</span>
          <form action="/api/google/disconnect" method="post">
            <button
              type="submit"
              className="text-caption text-content-tertiary underline underline-offset-2 transition-colors hover:text-content-primary"
            >
              Disconnect
            </button>
          </form>
        </div>
      ) : (
        <Link
          href="/api/google/connect?next=/profile"
          className="w-fit rounded-subtle bg-accent-default px-body py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover"
        >
          Connect Gmail
        </Link>
      )}

      {status === "connected" && (
        <p className="text-caption text-signal-default">Gmail connected.</p>
      )}
      {status === "denied" && (
        <p className="text-caption text-content-tertiary">
          Connection cancelled. Nothing was changed.
        </p>
      )}
      {status === "failed" && (
        <p className="text-caption text-badge-clay-fg">
          Google would not complete the connection. If monadic has been connected
          before, revoke its access in your Google account and try again — Google
          only returns the durable token on a fresh grant.
        </p>
      )}
      {status === "disconnected" && (
        <p className="text-caption text-content-tertiary">
          Removed from monadic. To revoke the grant itself, use your Google
          account&rsquo;s security settings.
        </p>
      )}
      {status === "unconfigured" && (
        <p className="text-caption text-badge-clay-fg">
          This deployment has no Google credentials configured.
        </p>
      )}
    </section>
  );
}
