/**
 * The only page reachable without a password.
 *
 * Deliberately not the app shell — no sidebar, no counts, nothing that would
 * need a database read before anyone is signed in. It is a card on the canvas
 * and the display face, which is the same treatment every page title carries.
 */

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const next = one(params.next) ?? "/";
  const error = one(params.error);

  return (
    <main className="flex min-h-screen items-center justify-center px-page">
      <div className="flex w-full max-w-sm flex-col gap-comfortable rounded-default border border-border-subtle bg-surface-base px-page py-section shadow-raised">
        <div className="flex flex-col gap-tight">
          <span className="flex items-center gap-tight text-small font-semibold tracking-tight text-content-primary">
            <span aria-hidden="true" className="size-dot-sm rounded-full bg-accent-default" />
            monadic
          </span>
          <h1 className="font-display text-display font-semibold italic leading-tight tracking-tight text-content-primary">
            Sign in
          </h1>
        </div>

        <form
          action="/api/auth/login"
          method="post"
          className="flex flex-col gap-compact"
        >
          <input type="hidden" name="next" value={next} />
          <label htmlFor="password" className="text-caption text-content-tertiary">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            className="rounded-subtle border border-border-subtle bg-surface-canvas px-compact py-tight text-body text-content-primary"
          />

          {error === "wrong" && (
            <p role="alert" className="text-caption text-badge-clay-fg">
              That password is not right.
            </p>
          )}
          {error === "unconfigured" && (
            <p role="alert" className="text-caption text-badge-clay-fg">
              No password is configured for this deployment, so nothing can sign
              in. Set MONADIC_APP_PASSWORD and redeploy.
            </p>
          )}

          <button
            type="submit"
            className="mt-tight rounded-subtle bg-accent-default px-body py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover"
          >
            Continue
          </button>
        </form>

        <p className="text-caption leading-relaxed text-content-tertiary">
          One password for the whole app. It is not an account — it exists so a
          public URL does not hand over a resume and a job pipeline.
        </p>
      </div>
    </main>
  );
}
