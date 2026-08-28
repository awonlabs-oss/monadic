import type { BoardSource } from "./types";
import ycSeeds from "./companies.yc.json";

/**
 * The seed list. Adding a company is one line here plus `npm run resolve`.
 *
 * `slug` is monadic's internal identifier and must be stable — it is the
 * natural key on the companies table. `atsSlug`/`atsSource` are optional hints:
 * supply them when you already know the board, and the resolver will verify
 * rather than search. Leave them out and the resolver probes.
 *
 * Hand-written, and no longer the whole list. It used to say that discovery
 * from directories or accelerators was out of scope; that rule was overturned
 * deliberately when reach became the goal, because a hand-written list caps the
 * corpus at however many companies someone was willing to type. YC's public
 * directory now supplies a second list — see scripts/discover-yc.ts, which
 * explains why that is a published API rather than the scraping the old rule
 * was written against.
 *
 * The two lists stay separate files on purpose. This one is chosen and edited;
 * companies.yc.json is generated and should never be hand-edited, because the
 * next regeneration would discard the edit. Entries here win every collision.
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
  atsSource?: BoardSource;
  atsSlug?: string;
  /**
   * True for a seed that came from the YC directory rather than from this file.
   *
   * It only changes how hard the resolver guesses. A hand-written entry is
   * worth eleven slug candidates because someone decided that company was worth
   * having; a directory entry is one of thousands, and the speculative forms —
   * `getfoo`, `foohq`, `fooinc` — are both the bulk of the request cost at that
   * scale and the likeliest way to land on a *different* company's board that
   * happens to own the generic slug.
   */
  discovered?: boolean;
}

export const HAND_PICKED: CompanySeed[] = [
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
  { name: "Convex", slug: "convex", websiteUrl: "https://convex.dev", atsSource: "ashby", atsSlug: "convex-dev" },
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
  { name: "Anduril", slug: "anduril", websiteUrl: "https://anduril.com", atsSource: "greenhouse", atsSlug: "andurilindustries" },
  { name: "Applied Intuition", slug: "applied-intuition", websiteUrl: "https://appliedintuition.com" },
  { name: "Shield AI", slug: "shield-ai", websiteUrl: "https://shield.ai" },
  { name: "Saronic", slug: "saronic", websiteUrl: "https://saronic.com" },
  { name: "Hadrian", slug: "hadrian", websiteUrl: "https://hadrian.co" },
  { name: "Varda", slug: "varda", websiteUrl: "https://varda.com", atsSource: "greenhouse", atsSlug: "vardaspace" },
  { name: "Astranis", slug: "astranis", websiteUrl: "https://astranis.com" },
  { name: "Zipline", slug: "zipline", websiteUrl: "https://flyzipline.com" },
  { name: "Skydio", slug: "skydio", websiteUrl: "https://skydio.com" },
  { name: "Nuro", slug: "nuro", websiteUrl: "https://nuro.ai" },

  // ------------------------------------------------------------ marketplace
  { name: "Whatnot", slug: "whatnot", websiteUrl: "https://whatnot.com" },
  { name: "Faire", slug: "faire", websiteUrl: "https://faire.com" },
  { name: "Flexport", slug: "flexport", websiteUrl: "https://flexport.com" },
  { name: "Carta", slug: "carta", websiteUrl: "https://carta.com" },

  // ===========================================================================
  // NYC sweep
  //
  // Added after measuring where the roles this list is meant to surface
  // actually live. Every entry below was verified against its board before
  // being written here, which is why each carries atsSource and usually
  // atsSlug: the resolver confirms a known answer in one request instead of
  // probing eleven candidates across three ATSes.
  //
  // The sweep also settled a question worth recording. 315 companies were
  // probed against Greenhouse, Ashby, Lever, SmartRecruiters, Rippling and
  // Breezy. Every single company that resolved was on one of the first three;
  // SmartRecruiters, Rippling and Breezy returned nothing across the whole
  // sample, and Workable's public board API no longer returns postings at all.
  // Adding pullers for those was considered and dropped — for this segment the
  // three sources here are the market, and volume comes from more companies,
  // not more integrations.
  //
  // Weighted toward companies with a New York office rather than NYC-only, so
  // remote-first companies that would hire into New York stay in the feed.
  // ===========================================================================

  // ------------------------------------ fintech / payments / banking infra
  { name: "Stripe", slug: "stripe", websiteUrl: "https://stripe.com", atsSource: "greenhouse" },
  { name: "Socure", slug: "socure", websiteUrl: "https://socure.com", atsSource: "ashby" },
  { name: "Fireblocks", slug: "fireblocks", websiteUrl: "https://fireblocks.com", atsSource: "greenhouse" },
  { name: "Rho", slug: "rho", websiteUrl: "https://rho.co", atsSource: "ashby" },
  { name: "Gemini", slug: "gemini", websiteUrl: "https://gemini.com", atsSource: "greenhouse" },
  { name: "Forter", slug: "forter", websiteUrl: "https://forter.com", atsSource: "greenhouse" },
  { name: "Betterment", slug: "betterment", websiteUrl: "https://betterment.com", atsSource: "greenhouse" },
  { name: "Riskified", slug: "riskified", websiteUrl: "https://riskified.com", atsSource: "greenhouse" },
  { name: "Alloy", slug: "alloy", websiteUrl: "https://alloy.com", atsSource: "greenhouse" },
  { name: "Ondo Finance", slug: "ondo-finance", websiteUrl: "https://ondo.finance", atsSource: "greenhouse", atsSlug: "ondofinance" },
  { name: "Melio", slug: "melio", websiteUrl: "https://meliopayments.com", atsSource: "greenhouse" },
  { name: "Zeta", slug: "zeta", websiteUrl: "https://zeta.tech", atsSource: "lever" },
  { name: "Vestwell", slug: "vestwell", websiteUrl: "https://vestwell.com", atsSource: "greenhouse" },
  { name: "Parafin", slug: "parafin", websiteUrl: "https://parafin.com", atsSource: "ashby" },
  { name: "Brigit", slug: "brigit", websiteUrl: "https://hellobrigit.com", atsSource: "ashby" },
  { name: "Paxos", slug: "paxos", websiteUrl: "https://paxos.com", atsSource: "ashby" },
  { name: "Ocrolus", slug: "ocrolus", websiteUrl: "https://ocrolus.com", atsSource: "greenhouse", atsSlug: "ocrolusinc" },
  { name: "Orum", slug: "orum", websiteUrl: "https://orum.io", atsSource: "ashby" },
  { name: "Astra", slug: "astra", websiteUrl: "https://astra.finance", atsSource: "ashby" },
  { name: "Current", slug: "current", websiteUrl: "https://current.com", atsSource: "greenhouse" },
  { name: "Capchase", slug: "capchase", websiteUrl: "https://capchase.com", atsSource: "ashby" },
  { name: "Spade", slug: "spade", websiteUrl: "https://spade.com", atsSource: "ashby" },
  { name: "Consensys", slug: "consensys", websiteUrl: "https://consensys.io", atsSource: "greenhouse" },
  { name: "Highnote", slug: "highnote", websiteUrl: "https://highnote.com", atsSource: "greenhouse" },
  { name: "Clearco", slug: "clearco", websiteUrl: "https://clear.co", atsSource: "ashby" },
  { name: "Capitolis", slug: "capitolis", websiteUrl: "https://capitolis.com", atsSource: "greenhouse" },
  { name: "Method Financial", slug: "method-financial", websiteUrl: "https://methodfi.com", atsSource: "greenhouse", atsSlug: "method" },
  { name: "Blockdaemon", slug: "blockdaemon", websiteUrl: "https://blockdaemon.com", atsSource: "ashby" },
  { name: "Marqeta", slug: "marqeta", websiteUrl: "https://marqeta.com", atsSource: "greenhouse" },
  { name: "Slope", slug: "slope", websiteUrl: "https://slope.so", atsSource: "ashby" },

  // ------------------------------------------------------------- insurtech
  { name: "Oscar Health", slug: "oscar-health", websiteUrl: "https://hioscar.com", atsSource: "greenhouse", atsSlug: "oscar" },
  { name: "Ethos", slug: "ethos", websiteUrl: "https://ethoslife.com", atsSource: "greenhouse", atsSlug: "ethoslife" },
  { name: "Coalition", slug: "coalition", websiteUrl: "https://coalitioninc.com", atsSource: "greenhouse" },
  { name: "Lemonade", slug: "lemonade", websiteUrl: "https://lemonade.com", atsSource: "ashby" },
  { name: "Kin Insurance", slug: "kin-insurance", websiteUrl: "https://kin.com", atsSource: "ashby", atsSlug: "kin" },

  // ---------------------------------------------------------- health / bio
  { name: "Included Health", slug: "included-health", websiteUrl: "https://includedhealth.com", atsSource: "lever", atsSlug: "includedhealth" },
  { name: "Hims and Hers", slug: "hims-and-hers", websiteUrl: "https://forhims.com", atsSource: "ashby" },
  { name: "Hinge Health", slug: "hinge-health", websiteUrl: "https://hingehealth.com", atsSource: "ashby" },
  { name: "Equip Health", slug: "equip-health", websiteUrl: "https://equip.health", atsSource: "ashby", atsSlug: "equip" },
  { name: "Iterative Health", slug: "iterative-health", websiteUrl: "https://iterative.health", atsSource: "greenhouse", atsSlug: "iterativehealth" },
  { name: "Ro", slug: "ro", websiteUrl: "https://ro.co", atsSource: "lever" },
  { name: "Rula", slug: "rula", websiteUrl: "https://rula.com", atsSource: "ashby" },
  { name: "Komodo Health", slug: "komodo-health", websiteUrl: "https://komodohealth.com", atsSource: "greenhouse", atsSlug: "komodohealth" },
  { name: "Clipboard Health", slug: "clipboard-health", websiteUrl: "https://clipboardhealth.com", atsSource: "ashby", atsSlug: "clipboard" },
  { name: "Midi Health", slug: "midi-health", websiteUrl: "https://joinmidi.com", atsSource: "greenhouse", atsSlug: "midihealth" },
  { name: "Flatiron Health", slug: "flatiron-health", websiteUrl: "https://flatiron.com", atsSource: "greenhouse", atsSlug: "flatironhealth" },
  { name: "Maven Clinic", slug: "maven-clinic", websiteUrl: "https://mavenclinic.com", atsSource: "greenhouse", atsSlug: "mavenclinic" },
  { name: "Carrot Fertility", slug: "carrot-fertility", websiteUrl: "https://get-carrot.com", atsSource: "greenhouse", atsSlug: "carrotfertility" },
  { name: "Talkspace", slug: "talkspace", websiteUrl: "https://talkspace.com", atsSource: "greenhouse" },
  { name: "Oshi Health", slug: "oshi-health", websiteUrl: "https://oshihealth.com", atsSource: "greenhouse", atsSlug: "oshihealth" },
  { name: "Parsley Health", slug: "parsley-health", websiteUrl: "https://parsleyhealth.com", atsSource: "greenhouse", atsSlug: "parsleyhealth" },
  { name: "Nomad Health", slug: "nomad-health", websiteUrl: "https://nomadhealth.com", atsSource: "ashby", atsSlug: "nomad" },
  { name: "Cedar", slug: "cedar", websiteUrl: "https://cedar.com", atsSource: "ashby" },

  // ---------------------------------------------- media / adtech / martech
  { name: "Braze", slug: "braze", websiteUrl: "https://braze.com", atsSource: "greenhouse" },
  { name: "Klaviyo", slug: "klaviyo", websiteUrl: "https://klaviyo.com", atsSource: "greenhouse" },
  { name: "Zeta Global", slug: "zeta-global", websiteUrl: "https://zetaglobal.com", atsSource: "greenhouse", atsSlug: "zetaglobal" },
  { name: "Mixpanel", slug: "mixpanel", websiteUrl: "https://mixpanel.com", atsSource: "greenhouse" },
  { name: "Taboola", slug: "taboola", websiteUrl: "https://taboola.com", atsSource: "greenhouse" },
  { name: "Attentive", slug: "attentive", websiteUrl: "https://attentive.com", atsSource: "greenhouse" },
  { name: "Amplitude", slug: "amplitude", websiteUrl: "https://amplitude.com", atsSource: "greenhouse" },
  { name: "DoubleVerify", slug: "doubleverify", websiteUrl: "https://doubleverify.com", atsSource: "greenhouse" },
  { name: "Movable Ink", slug: "movable-ink", websiteUrl: "https://movableink.com", atsSource: "greenhouse", atsSlug: "movableink" },
  { name: "Iterable", slug: "iterable", websiteUrl: "https://iterable.com", atsSource: "greenhouse" },
  { name: "Yext", slug: "yext", websiteUrl: "https://yext.com", atsSource: "greenhouse" },
  { name: "Yotpo", slug: "yotpo", websiteUrl: "https://yotpo.com", atsSource: "greenhouse" },
  { name: "Vox Media", slug: "vox-media", websiteUrl: "https://voxmedia.com", atsSource: "greenhouse", atsSlug: "voxmedia" },
  { name: "MNTN", slug: "mntn", websiteUrl: "https://mountain.com", atsSource: "greenhouse" },
  { name: "Substack", slug: "substack", websiteUrl: "https://substack.com", atsSource: "ashby" },
  { name: "Simulmedia", slug: "simulmedia", websiteUrl: "https://simulmedia.com", atsSource: "lever" },
  { name: "Patreon", slug: "patreon", websiteUrl: "https://patreon.com", atsSource: "ashby" },
  { name: "Morning Brew", slug: "morning-brew", websiteUrl: "https://morningbrew.com", atsSource: "lever", atsSlug: "morningbrew" },
  { name: "Kickstarter", slug: "kickstarter", websiteUrl: "https://kickstarter.com", atsSource: "greenhouse" },
  { name: "BuzzFeed", slug: "buzzfeed", websiteUrl: "https://buzzfeed.com", atsSource: "greenhouse" },

  // ----------------------------------------- commerce / DTC / marketplaces
  { name: "Toast", slug: "toast", websiteUrl: "https://toasttab.com", atsSource: "greenhouse" },
  { name: "Peloton", slug: "peloton", websiteUrl: "https://onepeloton.com", atsSource: "greenhouse" },
  { name: "StockX", slug: "stockx", websiteUrl: "https://stockx.com", atsSource: "greenhouse" },
  { name: "Poshmark", slug: "poshmark", websiteUrl: "https://poshmark.com", atsSource: "ashby" },
  { name: "Slice", slug: "slice", websiteUrl: "https://slicelife.com", atsSource: "greenhouse" },
  { name: "Squarespace", slug: "squarespace", websiteUrl: "https://squarespace.com", atsSource: "greenhouse" },
  { name: "SeatGeek", slug: "seatgeek", websiteUrl: "https://seatgeek.com", atsSource: "greenhouse" },
  { name: "Glossier", slug: "glossier", websiteUrl: "https://glossier.com", atsSource: "greenhouse" },
  { name: "Rent the Runway", slug: "rent-the-runway", websiteUrl: "https://renttherunway.com", atsSource: "greenhouse", atsSlug: "renttherunway" },
  { name: "Away", slug: "away", websiteUrl: "https://awaytravel.com", atsSource: "ashby" },
  { name: "Harrys", slug: "harrys", websiteUrl: "https://harrys.com", atsSource: "greenhouse" },
  { name: "Bombas", slug: "bombas", websiteUrl: "https://bombas.com", atsSource: "greenhouse" },
  { name: "Olo", slug: "olo", websiteUrl: "https://olo.com", atsSource: "lever" },
  { name: "Zola", slug: "zola", websiteUrl: "https://zola.com", atsSource: "greenhouse" },
  { name: "Grailed", slug: "grailed", websiteUrl: "https://grailed.com", atsSource: "greenhouse" },
  { name: "Bark", slug: "bark", websiteUrl: "https://bark.co", atsSource: "greenhouse" },

  // ------------------------------------------------ proptech / real estate
  { name: "Roofstock", slug: "roofstock", websiteUrl: "https://roofstock.com", atsSource: "greenhouse" },
  { name: "VTS", slug: "vts", websiteUrl: "https://vts.com", atsSource: "greenhouse" },
  { name: "Latch", slug: "latch", websiteUrl: "https://latch.com", atsSource: "lever" },

  // ---------------------------------------------- HR tech / future of work
  { name: "Justworks", slug: "justworks", websiteUrl: "https://justworks.com", atsSource: "greenhouse" },
  { name: "Gusto", slug: "gusto", websiteUrl: "https://gusto.com", atsSource: "greenhouse" },
  { name: "Ashby", slug: "ashby", websiteUrl: "https://ashbyhq.com", atsSource: "ashby" },
  { name: "Handshake", slug: "handshake", websiteUrl: "https://joinhandshake.com", atsSource: "ashby" },
  { name: "Oyster", slug: "oyster", websiteUrl: "https://oysterhr.com", atsSource: "ashby" },
  { name: "Greenhouse", slug: "greenhouse", websiteUrl: "https://greenhouse.io", atsSource: "greenhouse" },
  { name: "Lattice", slug: "lattice", websiteUrl: "https://lattice.com", atsSource: "greenhouse" },
  { name: "Built In", slug: "built-in", websiteUrl: "https://builtin.com", atsSource: "greenhouse", atsSlug: "builtin" },
  { name: "SeekOut", slug: "seekout", websiteUrl: "https://seekout.com", atsSource: "greenhouse" },
  { name: "Findem", slug: "findem", websiteUrl: "https://findem.ai", atsSource: "lever" },

  // ---------------------------------------------- dev tools / data / infra
  { name: "Datadog", slug: "datadog", websiteUrl: "https://datadoghq.com", atsSource: "greenhouse" },
  { name: "MongoDB", slug: "mongodb", websiteUrl: "https://mongodb.com", atsSource: "greenhouse" },
  { name: "Fivetran", slug: "fivetran", websiteUrl: "https://fivetran.com", atsSource: "greenhouse" },
  { name: "Grafana Labs", slug: "grafana-labs", websiteUrl: "https://grafana.com", atsSource: "greenhouse", atsSlug: "grafanalabs" },
  { name: "Harness", slug: "harness", websiteUrl: "https://harness.io", atsSource: "greenhouse", atsSlug: "harnessinc" },
  { name: "Hightouch", slug: "hightouch", websiteUrl: "https://hightouch.com", atsSource: "greenhouse" },
  { name: "Cribl", slug: "cribl", websiteUrl: "https://cribl.io", atsSource: "greenhouse" },
  { name: "LaunchDarkly", slug: "launchdarkly", websiteUrl: "https://launchdarkly.com", atsSource: "greenhouse" },
  { name: "Fastly", slug: "fastly", websiteUrl: "https://fastly.com", atsSource: "greenhouse" },
  { name: "Amplify", slug: "amplify", websiteUrl: "https://amplify.com", atsSource: "ashby" },
  { name: "Sentry", slug: "sentry", websiteUrl: "https://sentry.io", atsSource: "ashby" },
  { name: "Cockroach Labs", slug: "cockroach-labs", websiteUrl: "https://cockroachlabs.com", atsSource: "greenhouse", atsSlug: "cockroachlabs" },
  { name: "Dataiku", slug: "dataiku", websiteUrl: "https://dataiku.com", atsSource: "greenhouse" },
  { name: "Newsela", slug: "newsela", websiteUrl: "https://newsela.com", atsSource: "greenhouse" },
  { name: "Honeycomb", slug: "honeycomb", websiteUrl: "https://honeycomb.io", atsSource: "greenhouse" },
  { name: "Domino Data Lab", slug: "domino-data-lab", websiteUrl: "https://dominodatalab.com", atsSource: "greenhouse", atsSlug: "dominodatalab" },
  { name: "Vantage", slug: "vantage", websiteUrl: "https://vantage.sh", atsSource: "ashby" },
  { name: "Buildkite", slug: "buildkite", websiteUrl: "https://buildkite.com", atsSource: "greenhouse" },
  { name: "Monte Carlo", slug: "monte-carlo", websiteUrl: "https://montecarlodata.com", atsSource: "ashby", atsSlug: "montecarlodata" },
  { name: "Sisense", slug: "sisense", websiteUrl: "https://sisense.com", atsSource: "greenhouse" },
  { name: "Atlan", slug: "atlan", websiteUrl: "https://atlan.com", atsSource: "ashby" },
  { name: "CircleCI", slug: "circleci", websiteUrl: "https://circleci.com", atsSource: "greenhouse" },
  { name: "Netlify", slug: "netlify", websiteUrl: "https://netlify.com", atsSource: "greenhouse" },
  { name: "Prisma", slug: "prisma", websiteUrl: "https://prisma.io", atsSource: "greenhouse" },
  { name: "Datafold", slug: "datafold", websiteUrl: "https://datafold.com", atsSource: "ashby" },

  // --------------------------------------------------------------- AI / ML
  { name: "Cohere", slug: "cohere", websiteUrl: "https://cohere.com", atsSource: "ashby" },
  { name: "Synthesia", slug: "synthesia", websiteUrl: "https://synthesia.io", atsSource: "ashby" },
  { name: "Snorkel AI", slug: "snorkel-ai", websiteUrl: "https://snorkel.ai", atsSource: "greenhouse", atsSlug: "snorkelai" },
  { name: "Arize AI", slug: "arize-ai", websiteUrl: "https://arize.com", atsSource: "greenhouse", atsSlug: "arizeai" },
  { name: "Anyscale", slug: "anyscale", websiteUrl: "https://anyscale.com", atsSource: "ashby" },
  { name: "LlamaIndex", slug: "llamaindex", websiteUrl: "https://llamaindex.ai", atsSource: "ashby" },
  { name: "Poolside", slug: "poolside", websiteUrl: "https://poolside.ai", atsSource: "ashby" },
  { name: "Typeface", slug: "typeface", websiteUrl: "https://typeface.ai", atsSource: "greenhouse" },
  { name: "Galileo", slug: "galileo", websiteUrl: "https://rungalileo.io", atsSource: "greenhouse" },
  { name: "OpusClip", slug: "opusclip", websiteUrl: "https://opus.pro", atsSource: "ashby" },
  { name: "Labelbox", slug: "labelbox", websiteUrl: "https://labelbox.com", atsSource: "greenhouse" },
  { name: "Descript", slug: "descript", websiteUrl: "https://descript.com", atsSource: "greenhouse" },
  { name: "Fiddler AI", slug: "fiddler-ai", websiteUrl: "https://fiddler.ai", atsSource: "ashby" },
  { name: "Arthur", slug: "arthur", websiteUrl: "https://arthur.ai", atsSource: "ashby" },
  { name: "Weaviate", slug: "weaviate", websiteUrl: "https://weaviate.io", atsSource: "ashby" },

  // -------------------------------------------------------------- security
  { name: "Wiz", slug: "wiz", websiteUrl: "https://wiz.io", atsSource: "greenhouse", atsSlug: "wizinc" },
  { name: "1Password", slug: "1password", websiteUrl: "https://1password.com", atsSource: "ashby" },
  { name: "Axonius", slug: "axonius", websiteUrl: "https://axonius.com", atsSource: "greenhouse" },
  { name: "Torq", slug: "torq", websiteUrl: "https://torq.io", atsSource: "greenhouse" },
  { name: "Dashlane", slug: "dashlane", websiteUrl: "https://dashlane.com", atsSource: "greenhouse" },
  { name: "Orca Security", slug: "orca-security", websiteUrl: "https://orca.security", atsSource: "greenhouse", atsSlug: "orcasecurity" },

  // ----------------------------------- logistics / supply chain / mobility
  { name: "Via", slug: "via", websiteUrl: "https://ridewithvia.com", atsSource: "greenhouse" },
  { name: "Motional", slug: "motional", websiteUrl: "https://motional.com", atsSource: "greenhouse" },
  { name: "project44", slug: "project44", websiteUrl: "https://project44.com", atsSource: "greenhouse" },
  { name: "Loadsmart", slug: "loadsmart", websiteUrl: "https://loadsmart.com", atsSource: "lever" },

  // ----------------------------------------------- legal / govtech / other
  { name: "Axon", slug: "axon", websiteUrl: "https://axon.com", atsSource: "greenhouse" },
  { name: "Relativity", slug: "relativity", websiteUrl: "https://relativity.com", atsSource: "greenhouse" },
  { name: "Mark43", slug: "mark43", websiteUrl: "https://mark43.com", atsSource: "greenhouse" },
  { name: "Ironclad", slug: "ironclad", websiteUrl: "https://ironcladapp.com", atsSource: "ashby", atsSlug: "ironcladhq" },
  { name: "Everlaw", slug: "everlaw", websiteUrl: "https://everlaw.com", atsSource: "greenhouse" },
  { name: "Sayari", slug: "sayari", websiteUrl: "https://sayari.com", atsSource: "greenhouse" },
];

/**
 * Slug candidates to probe, most likely first.
 *
 * ATS slugs are usually the company name with punctuation removed, but the
 * variants differ enough (hyphenated vs collapsed, legal entity vs brand) that
 * probing a small ordered set beats guessing one.
 *
 * The affixed forms at the end exist because the earlier version had a blind
 * spot that cost real volume. Every candidate it built — slug, collapsed,
 * hyphenated, domain, firstWord — derives from the company name, so for a
 * single-word name they all produce the same string and the Set collapses them
 * to one. "Glean" probed exactly one slug, `glean`, and gave up; the real board
 * is `gleanwork` with 116 open roles. Measured across a 315-company sweep these
 * five affixes recovered Glean, Alma (`tryalma`), Wiz (`wizinc`) and Harness
 * (`harnessinc`).
 *
 * They are last on purpose. A resolution failure now costs more requests than
 * it used to — candidates times three ATSes — but resolution is cached on the
 * company row and runs once, so the cost is paid a single time per company and
 * the alternative is silently missing the board.
 */
/**
 * The YC directory's contribution, generated by `npm run discover:yc`.
 *
 * Empty until that script has been run once, which is why an unrun checkout
 * still ingests exactly what it ingested before.
 */
export const YC_COMPANIES: CompanySeed[] = (
  ycSeeds as Array<{ name: string; slug: string; websiteUrl?: string }>
).map((c) => ({ ...c, discovered: true }));

/**
 * Everything to seed, hand-picked first.
 *
 * The order matters to the one caller that dedupes by slug: a hand-written
 * entry carrying an atsSource hint must be the one that survives, not the
 * directory's bare name-and-website version of the same company.
 */
export const COMPANIES: CompanySeed[] = (() => {
  const seen = new Set<string>();
  const out: CompanySeed[] = [];
  for (const seed of [...HAND_PICKED, ...YC_COMPANIES]) {
    if (seen.has(seed.slug)) continue;
    seen.add(seed.slug);
    out.push(seed);
  }
  return out;
})();

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

  /*
   * Four candidates for a directory entry, eleven for a hand-picked one.
   *
   * Measured before it was changed: on a 60-company sample of hiring YC
   * companies, these four resolve 28% of them, and the four are ordered so the
   * two most trustworthy come first. The speculative forms below are worth
   * their cost on a list of a few hundred companies someone chose; on a list of
   * thousands they multiply every unresolved company's request count by nearly
   * three, and each one is a guess at a slug some *other* company may already
   * own. A wrongly matched board is worse than an unmatched one — it fills the
   * feed with a stranger's postings under your company's name, and nothing
   * downstream would flag it.
   */
  const candidates = seed.discovered
    ? [seed.atsSlug, seed.slug, domain, collapsed, hyphenated]
    : [
        seed.atsSlug,
        seed.slug,
        collapsed,
        hyphenated,
        domain,
        firstWord,
        // The legal-entity and product-name forms companies register under.
        `${collapsed}work`,
        `${collapsed}inc`,
        `${collapsed}hq`,
        `get${collapsed}`,
        `try${collapsed}`,
      ];
  return [...new Set(candidates.filter((s): s is string => !!s && s.length > 1))];
}
