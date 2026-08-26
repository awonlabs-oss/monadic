import { decodeEntities } from "@/ingest/normalize";

/**
 * Turns an ATS description into a block model.
 *
 * The stored HTML is written by whoever posted the job and reaches us through a
 * third party, so it is never rendered as markup. There is no
 * dangerouslySetInnerHTML here and no sanitiser to get subtly wrong: this reads
 * the tags, keeps the structure they describe, and throws the tags away. What
 * comes out is data, and every character of it renders as a text node.
 *
 * Structure is worth recovering rather than flattening — measured over 400 open
 * postings the descriptions contain 16,720 <p>, 15,366 <li>, 3,030 <h2> and
 * 2,812 <ul>. Rendering that as one block of prose, which is what stripHtml
 * produces, throws away the shape the poster wrote and makes the page unusable.
 * They also contain 36 <iframe>s, which is the other half of why nothing here
 * is passed through.
 *
 * Formatting is kept to what survives a change of typeface: headings, lists,
 * bold, italics, links and rules. Colours, font sizes and inline styles are
 * dropped on purpose — the token layer decides how this looks, not the ATS.
 */

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
}

export type Block =
  | { kind: "heading"; runs: Run[] }
  | { kind: "paragraph"; runs: Run[] }
  | { kind: "list"; ordered: boolean; items: Run[][] }
  | { kind: "rule" };

/** Everything inside these is discarded, including nested tags. */
const DROPPED = new Set(["script", "style", "iframe", "noscript", "svg", "table"]);

/** Tags that end the current paragraph without contributing anything. */
const BLOCK_TAGS = new Set(["p", "div", "section", "article", "header", "footer", "blockquote"]);

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

const TOKEN = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)/g;
const HREF = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

/**
 * Links are kept only when they go somewhere a browser should follow. An ATS
 * description is third-party text, so `javascript:` and `data:` URLs are
 * dropped to plain text rather than rendered as anchors.
 */
function safeHref(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const href = decodeEntities(raw).trim();
  return /^(https?:\/\/|mailto:|tel:)/i.test(href) ? href : undefined;
}

export function parseDescription(html: string | null): Block[] {
  if (!html) return [];

  const blocks: Block[] = [];
  let runs: Run[] = [];
  let heading = false;

  // Depth counters rather than booleans: <strong><strong>x</strong>y</strong>
  // is malformed but real, and a boolean would un-bold the y.
  let bold = 0;
  let italic = 0;
  let href: string | undefined;
  let drop = 0;

  let list: { ordered: boolean; items: Run[][] } | null = null;
  let item: Run[] | null = null;

  const target = () => (item ?? runs);

  function push(text: string) {
    if (!text) return;
    const dest = target();
    const run: Run = { text };
    if (bold > 0) run.bold = true;
    if (italic > 0) run.italic = true;
    if (href) run.href = href;

    // Merge into the previous run when the formatting is identical, so a
    // paragraph broken across five <span>s is one run rather than five.
    const prev = dest[dest.length - 1];
    if (
      prev &&
      !!prev.bold === !!run.bold &&
      !!prev.italic === !!run.italic &&
      prev.href === run.href
    ) {
      prev.text += run.text;
      return;
    }
    dest.push(run);
  }

  function trim(list: Run[]): Run[] {
    const out = list.map((r) => ({ ...r }));
    if (out.length > 0) out[0].text = out[0].text.replace(/^\s+/, "");
    if (out.length > 0) out[out.length - 1].text = out[out.length - 1].text.replace(/\s+$/, "");
    return out.filter((r) => r.text.length > 0);
  }

  function flush() {
    const trimmed = trim(runs);
    runs = [];
    if (trimmed.length === 0) {
      heading = false;
      return;
    }
    blocks.push({ kind: heading ? "heading" : "paragraph", runs: trimmed });
    heading = false;
  }

  function closeItem() {
    if (!item || !list) return;
    const trimmed = trim(item);
    if (trimmed.length > 0) list.items.push(trimmed);
    item = null;
  }

  function closeList() {
    closeItem();
    if (list && list.items.length > 0) {
      blocks.push({ kind: "list", ordered: list.ordered, items: list.items });
    }
    list = null;
  }

  for (const match of html.matchAll(TOKEN)) {
    const [, rawTag, attrs, text] = match;

    if (text !== undefined) {
      if (drop === 0) push(decodeEntities(text).replace(/\s+/g, " "));
      continue;
    }

    const tag = rawTag.toLowerCase();
    const closing = match[0].startsWith("</");

    if (DROPPED.has(tag)) {
      // A self-closing dropped tag never sees its closing form.
      if (closing) drop = Math.max(0, drop - 1);
      else if (!match[0].endsWith("/>")) drop += 1;
      continue;
    }
    if (drop > 0) continue;

    if (HEADINGS.has(tag)) {
      if (closing) flush();
      else {
        flush();
        closeList();
        heading = true;
      }
      continue;
    }

    switch (tag) {
      case "br":
        flush();
        break;
      case "hr":
        flush();
        closeList();
        blocks.push({ kind: "rule" });
        break;
      case "ul":
      case "ol":
        if (closing) closeList();
        else {
          flush();
          closeList();
          list = { ordered: tag === "ol", items: [] };
        }
        break;
      case "li":
        if (closing) closeItem();
        else {
          closeItem();
          // A stray <li> outside any list still reads as a bullet.
          if (!list) list = { ordered: false, items: [] };
          item = [];
        }
        break;
      case "strong":
      case "b":
        bold += closing ? -1 : 1;
        bold = Math.max(0, bold);
        break;
      case "em":
      case "i":
        italic += closing ? -1 : 1;
        italic = Math.max(0, italic);
        break;
      case "a":
        if (closing) href = undefined;
        else {
          const m = attrs ? HREF.exec(attrs) : null;
          href = safeHref(m ? (m[1] ?? m[2] ?? m[3] ?? null) : null);
        }
        break;
      default:
        if (BLOCK_TAGS.has(tag)) {
          flush();
          if (!closing) closeList();
        }
        // span, font, and anything else unrecognised are transparent: their
        // text still counts, their styling does not.
        break;
    }
  }

  closeList();
  flush();
  return blocks;
}
