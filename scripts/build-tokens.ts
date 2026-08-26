/**
 * design/tokens.json -> src/styles/tokens.generated.css
 *
 * tokens.json is the only tracked source of design values in this repo. The
 * output of this script is gitignored, which is what makes the no-raw-values
 * rule checkable: a hex code anywhere under src/ is by definition a violation,
 * because the legitimate ones only ever exist in generated CSS.
 *
 * Runs on predev and prebuild, so a token change cannot fail to propagate.
 *
 * Tailwind v4 derives utilities from the CSS variable namespace a token lands
 * in, so the mapping below is not cosmetic — it decides which utilities exist.
 * A token with no namespace mapping would silently produce no utility, so an
 * unmapped group is a hard error rather than a skip.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(root, "design/tokens.json");
const OUTPUT = resolve(root, "src/styles/tokens.generated.css");

type Leaf = { value: string; status?: string };
type Node = { [key: string]: Node | Leaf | string };

const isLeaf = (n: unknown): n is Leaf =>
  typeof n === "object" && n !== null && typeof (n as Leaf).value === "string";

/**
 * Maps a token path to a Tailwind v4 theme variable.
 *
 *   color.surface.raised  -> --color-surface-raised  ->  bg-surface-raised
 *   space.comfortable     -> --spacing-comfortable   ->  p-comfortable, gap-comfortable
 *   radius.subtle         -> --radius-subtle         ->  rounded-subtle
 *   font.family.sans      -> --font-sans             ->  font-sans
 *   font.size.body        -> --text-body             ->  text-body
 *   font.weight.medium    -> --font-weight-medium    ->  font-medium
 *   font.leading.tight    -> --leading-tight         ->  leading-tight
 *   shadow.raised         -> --shadow-raised         ->  shadow-raised
 *   layout.content-max    -> --container-content     ->  max-w-content
 */
function toThemeVariable(path: string[]): string {
  const [group, ...rest] = path;
  const tail = rest.join("-");

  switch (group) {
    case "color":
      return `--color-${tail}`;
    case "space":
      return `--spacing-${tail}`;
    case "radius":
      return `--radius-${tail}`;
    case "shadow":
      return `--shadow-${tail}`;
    case "layout":
      // `content-max` reads as `max-w-content-max` otherwise.
      return `--container-${tail.replace(/-max$/, "")}`;
    case "font": {
      const [subgroup, ...name] = rest;
      const n = name.join("-");
      switch (subgroup) {
        case "family":
          return `--font-${n}`;
        case "size":
          return `--text-${n}`;
        case "weight":
          return `--font-weight-${n}`;
        case "leading":
          return `--leading-${n}`;
        case "tracking":
          return `--tracking-${n}`;
        default:
          throw new Error(
            `Unmapped font subgroup "${subgroup}" at token path ${path.join(".")}. ` +
              `Add it to toThemeVariable() in scripts/build-tokens.ts.`,
          );
      }
    }
    default:
      throw new Error(
        `Unmapped token group "${group}" at token path ${path.join(".")}. ` +
          `Add it to toThemeVariable() in scripts/build-tokens.ts, choosing the ` +
          `Tailwind v4 namespace whose utilities this token should generate.`,
      );
  }
}

function walk(
  node: Node,
  path: string[],
  out: Array<{ variable: string; value: string; path: string; status?: string }>,
) {
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$")) continue; // $comment, $project
    const next = [...path, key];
    if (isLeaf(child)) {
      out.push({
        variable: toThemeVariable(next),
        value: child.value,
        path: next.join("."),
        status: child.status,
      });
    } else if (typeof child === "object" && child !== null) {
      walk(child as Node, next, out);
    }
  }
}

const raw = readFileSync(SOURCE, "utf8");
let parsed: Node;
try {
  parsed = JSON.parse(raw) as Node;
} catch (cause) {
  throw new Error(`design/tokens.json is not valid JSON: ${(cause as Error).message}`);
}

const tokens: Array<{ variable: string; value: string; path: string; status?: string }> = [];
walk(parsed, [], tokens);

if (tokens.length === 0) {
  throw new Error("design/tokens.json produced no tokens. Refusing to write an empty theme.");
}

const duplicates = tokens
  .map((t) => t.variable)
  .filter((v, i, all) => all.indexOf(v) !== i);
if (duplicates.length > 0) {
  throw new Error(
    `Two tokens map to the same CSS variable: ${[...new Set(duplicates)].join(", ")}. ` +
      `One would silently overwrite the other.`,
  );
}

const width = Math.max(...tokens.map((t) => t.variable.length));
const body = tokens
  .map((t) => `  ${t.variable.padEnd(width)}: ${t.value};`)
  .join("\n");

const placeholders = tokens.filter((t) => t.status === "placeholder").length;

const css = `/*
 * GENERATED FILE — DO NOT EDIT.
 *
 * Written by scripts/build-tokens.ts from design/tokens.json.
 * Edit the token, not this file. Runs automatically on predev and prebuild.
 *
 * ${tokens.length} tokens, ${placeholders} still marked placeholder.
 */

@theme {
  /*
   * Drops Tailwind's default color palette entirely. bg-red-500 and
   * text-slate-900 do not exist in this project — only the semantic colors
   * below. This turns the token rule from something to remember into
   * something the build enforces.
   */
  --color-*: initial;

${body}
}
`;

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, css, "utf8");

console.log(
  `tokens: wrote ${tokens.length} tokens to src/styles/tokens.generated.css` +
    (placeholders > 0 ? ` (${placeholders} placeholder)` : ""),
);
