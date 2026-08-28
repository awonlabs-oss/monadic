import { getGuidelines, listExamples } from "@/lib/data/voice";
import { saveGuidelinesAction, addExampleAction, deleteExampleAction } from "./actions";

/*
 * /voice — what the drafter knows about how you write.
 *
 * The facts a draft needs are already in the database: the parsed resume, the
 * job, the contact. This is the part that was missing, and it is the part that
 * separates a competent anonymous email from one that sounds like you.
 *
 * Deliberately two sections, because they do different work. Guidelines are
 * instructions and go into the system prompt. Examples are replayed as prior
 * turns — shown to the model rather than described to it, which is the only
 * thing that reliably transfers the parts of a voice nobody can articulate.
 */

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-subtle border border-border-subtle bg-surface-canvas px-compact py-tight text-body text-content-primary placeholder:text-content-tertiary";

export default async function VoicePage() {
  const [guidelines, examples] = await Promise.all([getGuidelines(), listExamples()]);

  return (
    <div className="flex max-w-reading flex-col gap-loose px-page pt-section pb-page">
      <header className="flex flex-col gap-tight">
        <h1 className="font-display text-display font-semibold italic leading-tight tracking-tight text-content-primary">
          Your voice
        </h1>
        <p className="text-body text-content-secondary">
          What the drafter is told about how you write. It already has your
          resume, the role and the contact — this is the part it cannot infer.
        </p>
      </header>

      <section className="flex flex-col gap-compact rounded-default border border-border-subtle bg-surface-base px-default py-body">
        <div className="flex flex-col gap-tight">
          <h2 className="text-body font-semibold text-content-primary">Guidelines</h2>
          <p className="max-w-reading text-caption leading-relaxed text-content-secondary">
            Rules you can state. These go into the system prompt and override the
            defaults, so be specific — &ldquo;two paragraphs, never open with a
            compliment, sign off with a question&rdquo; beats &ldquo;be
            professional&rdquo;.
          </p>
        </div>

        <form action={saveGuidelinesAction} className="flex flex-col gap-compact">
          <label htmlFor="guidelines" className="sr-only">
            Writing guidelines
          </label>
          <textarea
            id="guidelines"
            name="guidelines"
            rows={8}
            defaultValue={guidelines}
            placeholder={`Two short paragraphs, never three.\nOpen with what I noticed about them or the company, not with myself.\nNever write "I'd love to" or "reach out".\nClose with a question they can answer in one line.\nSign off with just my first name.`}
            className={`${field} resize-y leading-relaxed`}
          />
          <button
            type="submit"
            className="w-fit rounded-subtle bg-accent-default px-body py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover"
          >
            Save guidelines
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-compact">
        <div className="flex flex-col gap-tight">
          <h2 className="text-body font-semibold text-content-primary">
            Example emails
            {examples.length > 0 && (
              <span className="pl-tight tabular-nums text-content-tertiary">
                {examples.length}
              </span>
            )}
          </h2>
          <p className="max-w-reading text-caption leading-relaxed text-content-secondary">
            Emails you actually wrote and were happy with. These are worth more
            than any description: the model is shown them as prior replies and
            matches their length, register and shape. The four most recent are
            used on every draft, so keep the ones that sound most like you.
          </p>
        </div>

        <form
          action={addExampleAction}
          className="flex flex-col gap-compact rounded-default border border-border-subtle bg-surface-base px-default py-body"
        >
          <div className="grid grid-cols-1 gap-compact sm:grid-cols-2">
            <label className="flex flex-col gap-tight text-caption text-content-tertiary">
              What to call it
              <input name="name" required placeholder="Cold email to a recruiter" className={field} />
            </label>
            <label className="flex flex-col gap-tight text-caption text-content-tertiary">
              Subject line
              <input name="subject" placeholder="Optional" className={field} />
            </label>
          </div>
          <label className="flex flex-col gap-tight text-caption text-content-tertiary">
            The email, exactly as you sent it
            <textarea
              name="body"
              rows={8}
              required
              placeholder="Paste it in verbatim — including the sign-off. Anything you tidy up here is a habit the drafter will not learn."
              className={`${field} resize-y leading-relaxed`}
            />
          </label>
          <button
            type="submit"
            className="w-fit rounded-subtle bg-accent-default px-body py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover"
          >
            Add example
          </button>
        </form>

        {examples.length === 0 ? (
          <p className="text-caption text-content-tertiary">
            No examples yet. One good one changes the output noticeably; four is
            plenty.
          </p>
        ) : (
          <ul className="flex flex-col gap-compact">
            {examples.map((example, i) => (
              <li
                key={example.id}
                className="flex flex-col gap-tight rounded-default border border-border-subtle bg-surface-base px-default py-body"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-compact">
                  <span className="text-body font-medium text-content-primary">
                    {example.name}
                  </span>
                  <span className="flex items-center gap-compact text-caption text-content-tertiary">
                    {i < 4 ? (
                      <span className="rounded-tag bg-badge-green-bg px-chip py-xtight font-medium text-badge-green-fg">
                        In use
                      </span>
                    ) : (
                      <span>Not used — only the four most recent are</span>
                    )}
                    <form action={deleteExampleAction}>
                      <input type="hidden" name="id" value={example.id} />
                      <button
                        type="submit"
                        className="underline underline-offset-2 transition-colors hover:text-content-primary"
                      >
                        Remove
                      </button>
                    </form>
                  </span>
                </div>
                {example.subject && (
                  <p className="text-caption text-content-secondary">{example.subject}</p>
                )}
                <p className="line-clamp-3 whitespace-pre-wrap text-caption leading-relaxed text-content-tertiary">
                  {example.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
