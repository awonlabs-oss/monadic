import type { AtsSource } from "./types";

/**
 * The seed list. Adding a company is one line here plus `npm run resolve`.
 *
 * `slug` is monadic's internal identifier and must be stable — it is the
 * natural key on the companies table. `atsSlug`/`atsSource` are optional hints:
 * supply them when you already know the board, and the resolver will verify
 * rather than search. Leave them out and the resolver probes.
 *
 * Hand-written, deliberately. No discovery from directories, accelerators or
 * aggregators — that is out of scope, and scraping YC or Crunchbase to build
 * this file would be exactly that.
 *
 * Weighted toward seed through Series C. The original eighteen were all late
 * stage, which is why the feed had high volume and low variety: a handful of
 * large companies hiring across every function drown out everyone else. These
 * are chosen for being small enough that a posting means something.
 *
 * Expect failures. Companies get acquired, rename, shut down, or move to an ATS
 * with no puller here — and this list is written from knowledge with a cutoff,
 * so some entries are certainly stale. That is fine and visible: a failed
 * resolution is cached and listed on /settings/runs, and removing a line here
 * is how you retire one.
 *
 * No stage or headcount fields. No ATS returns them, and hand-annotating a
 * hundred companies from memory would put wrong numbers on cards with nothing
 * to correct them against.
 */

export interface CompanySeed {
  name: string;
  slug: string;
  websiteUrl?: string;
  careersUrl?: string;
  /** Skip probing when the board is already known. Still verified before use. */
  atsSource?: AtsSource;
  atsSlug?: string;
}

export const COMPANIES: CompanySeed[] = [
  // ---------------------------------------------------------------- original
  { name: "Anthropic", slug: "anthropic", websiteUrl: "https://anthropic.com" },
  { name: "Ramp", slug: "ramp", websiteUrl: "https://ramp.com" },
  { name: "Linear", slug: "linear", websiteUrl: "https://linear.app" },
  { name: "Vercel", slug: "vercel", websiteUrl: "https://vercel.com" },
  { name: "Retool", slug: "retool", websiteUrl: "https://retool.com" },
  { name: "Notion", slug: "notion", websiteUrl: "https://notion.so" },
  { name: "Figma", slug: "figma", websiteUrl: "https://figma.com" },
  { name: "Mercury", slug: "mercury", websiteUrl: "https://mercury.com" },
  { name: "Rippling", slug: "rippling", websiteUrl: "https://rippling.com" },
  { name: "Plaid", slug: "plaid", websiteUrl: "https://plaid.com" },
  { name: "Brex", slug: "brex", websiteUrl: "https://brex.com" },
  { name: "Airtable", slug: "airtable", websiteUrl: "https://airtable.com" },
  { name: "Benchling", slug: "benchling", websiteUrl: "https://benchling.com" },
  { name: "Sourcegraph", slug: "sourcegraph", websiteUrl: "https://sourcegraph.com" },
  { name: "Replit", slug: "replit", websiteUrl: "https://replit.com" },
  { name: "Supabase", slug: "supabase", websiteUrl: "https://supabase.com" },
  { name: "Perplexity", slug: "perplexity", websiteUrl: "https://perplexity.ai" },
  { name: "Scale AI", slug: "scale-ai", websiteUrl: "https://scale.com" },
  { name: "Cursor", slug: "cursor", websiteUrl: "https://cursor.com", atsSlug: "anysphere" },
  { name: "Sierra", slug: "sierra", websiteUrl: "https://sierra.ai" },

  // ------------------------------------------------------------- AI products
  { name: "Harvey", slug: "harvey", websiteUrl: "https://harvey.ai" },
  { name: "Cognition", slug: "cognition", websiteUrl: "https://cognition.ai" },
  { name: "Decagon", slug: "decagon", websiteUrl: "https://decagon.ai" },
  { name: "Cresta", slug: "cresta", websiteUrl: "https://cresta.com" },
  { name: "Hebbia", slug: "hebbia", websiteUrl: "https://hebbia.ai" },
  { name: "Glean", slug: "glean", websiteUrl: "https://glean.com" },
  { name: "Writer", slug: "writer", websiteUrl: "https://writer.com" },
  { name: "ElevenLabs", slug: "elevenlabs", websiteUrl: "https://elevenlabs.io" },
  { name: "Runway", slug: "runway", websiteUrl: "https://runwayml.com" },
  { name: "Luma AI", slug: "luma-ai", websiteUrl: "https://lumalabs.ai" },
  { name: "Suno", slug: "suno", websiteUrl: "https://suno.com" },
  { name: "Abridge", slug: "abridge", websiteUrl: "https://abridge.com" },
  { name: "OpenEvidence", slug: "openevidence", websiteUrl: "https://openevidence.com" },
  { name: "Ambience", slug: "ambience", websiteUrl: "https://ambiencehealthcare.com" },
  { name: "Contextual AI", slug: "contextual-ai", websiteUrl: "https://contextual.ai" },
  { name: "Together AI", slug: "together-ai", websiteUrl: "https://together.ai" },
  { name: "Fireworks AI", slug: "fireworks-ai", websiteUrl: "https://fireworks.ai" },
  { name: "Baseten", slug: "baseten", websiteUrl: "https://baseten.co" },
  { name: "Modal", slug: "modal", websiteUrl: "https://modal.com" },
  { name: "Replicate", slug: "replicate", websiteUrl: "https://replicate.com" },
  { name: "LangChain", slug: "langchain", websiteUrl: "https://langchain.com" },
  { name: "Pinecone", slug: "pinecone", websiteUrl: "https://pinecone.io" },
  { name: "Weights & Biases", slug: "weights-biases", websiteUrl: "https://wandb.ai" },
  { name: "Chroma", slug: "chroma", websiteUrl: "https://trychroma.com" },

  // ------------------------------------------------------- dev tools & infra
  { name: "Railway", slug: "railway", websiteUrl: "https://railway.app" },
  { name: "Render", slug: "render", websiteUrl: "https://render.com" },
  { name: "Fly.io", slug: "fly-io", websiteUrl: "https://fly.io" },
  { name: "Neon", slug: "neon", websiteUrl: "https://neon.tech" },
  { name: "Turso", slug: "turso", websiteUrl: "https://turso.tech" },
  { name: "Convex", slug: "convex", websiteUrl: "https://convex.dev" },
  { name: "Clerk", slug: "clerk", websiteUrl: "https://clerk.com" },
  { name: "WorkOS", slug: "workos", websiteUrl: "https://workos.com" },
  { name: "Stytch", slug: "stytch", websiteUrl: "https://stytch.com" },
  { name: "Resend", slug: "resend", websiteUrl: "https://resend.com" },
  { name: "Knock", slug: "knock", websiteUrl: "https://knock.app" },
  { name: "Inngest", slug: "inngest", websiteUrl: "https://inngest.com" },
  { name: "Temporal", slug: "temporal", websiteUrl: "https://temporal.io" },
  { name: "Dagster", slug: "dagster", websiteUrl: "https://dagster.io" },
  { name: "Prefect", slug: "prefect", websiteUrl: "https://prefect.io" },
  { name: "dbt Labs", slug: "dbt-labs", websiteUrl: "https://getdbt.com" },
  { name: "Airbyte", slug: "airbyte", websiteUrl: "https://airbyte.com" },
  { name: "Hex", slug: "hex", websiteUrl: "https://hex.tech" },
  { name: "Omni", slug: "omni", websiteUrl: "https://omni.co" },
  { name: "MotherDuck", slug: "motherduck", websiteUrl: "https://motherduck.com" },
  { name: "ClickHouse", slug: "clickhouse", websiteUrl: "https://clickhouse.com" },
  { name: "Materialize", slug: "materialize", websiteUrl: "https://materialize.com" },
  { name: "Warp", slug: "warp", websiteUrl: "https://warp.dev" },
  { name: "Zed", slug: "zed", websiteUrl: "https://zed.dev" },
  { name: "Graphite", slug: "graphite", websiteUrl: "https://graphite.dev" },
  { name: "Depot", slug: "depot", websiteUrl: "https://depot.dev" },
  { name: "Tailscale", slug: "tailscale", websiteUrl: "https://tailscale.com" },
  { name: "Ngrok", slug: "ngrok", websiteUrl: "https://ngrok.com" },
  { name: "Doppler", slug: "doppler", websiteUrl: "https://doppler.com" },
  { name: "Infisical", slug: "infisical", websiteUrl: "https://infisical.com" },

  // ------------------------------------------------------------ security
  { name: "Chainguard", slug: "chainguard", websiteUrl: "https://chainguard.dev" },
  { name: "Socket", slug: "socket", websiteUrl: "https://socket.dev" },
  { name: "Semgrep", slug: "semgrep", websiteUrl: "https://semgrep.dev" },
  { name: "Vanta", slug: "vanta", websiteUrl: "https://vanta.com" },
  { name: "Drata", slug: "drata", websiteUrl: "https://drata.com" },
  { name: "Cyera", slug: "cyera", websiteUrl: "https://cyera.io" },
  { name: "Abnormal Security", slug: "abnormal-security", websiteUrl: "https://abnormalsecurity.com" },
  { name: "Material Security", slug: "material-security", websiteUrl: "https://material.security" },
  { name: "Persona", slug: "persona", websiteUrl: "https://withpersona.com" },

  // ------------------------------------------------------------ fintech
  { name: "Modern Treasury", slug: "modern-treasury", websiteUrl: "https://moderntreasury.com" },
  { name: "Increase", slug: "increase", websiteUrl: "https://increase.com" },
  { name: "Column", slug: "column", websiteUrl: "https://column.com" },
  { name: "Lithic", slug: "lithic", websiteUrl: "https://lithic.com" },
  { name: "Unit", slug: "unit", websiteUrl: "https://unit.co" },
  { name: "Middesk", slug: "middesk", websiteUrl: "https://middesk.com" },
  { name: "Nova Credit", slug: "nova-credit", websiteUrl: "https://novacredit.com" },
  { name: "Pave", slug: "pave", websiteUrl: "https://pave.com" },
  { name: "Sardine", slug: "sardine", websiteUrl: "https://sardine.ai" },

  // ------------------------------------------------------------ health
  { name: "Headway", slug: "headway", websiteUrl: "https://headway.co" },
  { name: "Spring Health", slug: "spring-health", websiteUrl: "https://springhealth.com" },
  { name: "Grow Therapy", slug: "grow-therapy", websiteUrl: "https://growtherapy.com" },
  { name: "Alma", slug: "alma", websiteUrl: "https://helloalma.com" },
  { name: "Two Chairs", slug: "two-chairs", websiteUrl: "https://twochairs.com" },
  { name: "Function Health", slug: "function-health", websiteUrl: "https://functionhealth.com" },

  // ------------------------------------------------- hard tech & defence
  { name: "Anduril", slug: "anduril", websiteUrl: "https://anduril.com" },
  { name: "Applied Intuition", slug: "applied-intuition", websiteUrl: "https://appliedintuition.com" },
  { name: "Shield AI", slug: "shield-ai", websiteUrl: "https://shield.ai" },
  { name: "Saronic", slug: "saronic", websiteUrl: "https://saronic.com" },
  { name: "Hadrian", slug: "hadrian", websiteUrl: "https://hadrian.co" },
  { name: "Varda", slug: "varda", websiteUrl: "https://varda.com" },
  { name: "Astranis", slug: "astranis", websiteUrl: "https://astranis.com" },
  { name: "Zipline", slug: "zipline", websiteUrl: "https://flyzipline.com" },
  { name: "Skydio", slug: "skydio", websiteUrl: "https://skydio.com" },
  { name: "Nuro", slug: "nuro", websiteUrl: "https://nuro.ai" },

  // ------------------------------------------------------------ marketplace
  { name: "Whatnot", slug: "whatnot", websiteUrl: "https://whatnot.com" },
  { name: "Faire", slug: "faire", websiteUrl: "https://faire.com" },
  { name: "Flexport", slug: "flexport", websiteUrl: "https://flexport.com" },
  { name: "Carta", slug: "carta", websiteUrl: "https://carta.com" },
];

/**
 * Slug candidates to probe, most likely first.
 *
 * ATS slugs are usually the company name with punctuation removed, but the
 * variants differ enough (hyphenated vs collapsed, legal entity vs brand) that
 * probing a small ordered set beats guessing one.
 */
export function slugCandidates(seed: CompanySeed): string[] {
  const base = seed.name.toLowerCase().trim();
  const collapsed = base.replace(/[^a-z0-9]/g, "");
  const hyphenated = base.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const firstWord = collapsed.replace(/(ai|hq|labs|inc|io|co|dev|app|com)$/, "");
  // A company's own domain is frequently its board slug.
  const domain = seed.websiteUrl
    ?.replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(".")[0];

  const candidates = [seed.atsSlug, seed.slug, collapsed, hyphenated, domain, firstWord];
  return [...new Set(candidates.filter((s): s is string => !!s && s.length > 1))];
}
