/**
 * Turns an ATS location string into cities, countries, and a US-eligibility flag.
 *
 * The input is free text written by whoever posted the job, and across the
 * boards ingested so far it takes at least these shapes:
 *
 *   "San Francisco, CA"
 *   "San Francisco, CA | New York City, NY | Seattle, WA"
 *   "San Francisco, CA • New York, NY • United States"
 *   "San Francisco, California, United States"
 *   "New York, NY (HQ); San Francisco, CA"
 *   "San Francisco, CA, New York, NY, Portland, OR, or Remote within Canada or United States"
 *   "Remote" / "Remote, Anywhere"
 *   "London, UK" / "Tokyo, Japan" / "Vancouver, British Columbia, Canada"
 *
 * Four different separators, and commas doing double duty as both the
 * city/state delimiter and the between-locations delimiter. So parsing splits
 * on the unambiguous separators first, then walks comma tokens looking for a
 * state or country to anchor each city against.
 *
 * The bias throughout is precision over recall: an unrecognised chunk yields no
 * country rather than a guessed one. A wrongly-claimed country would silently
 * hide a real job from a filter, and there would be nothing on screen to
 * suggest why.
 */

const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin",
  WY: "Wyoming", DC: "District of Columbia",
};

const STATE_NAME_TO_CODE = new Map(
  Object.entries(US_STATES).map(([code, name]) => [name.toLowerCase(), code]),
);

/** Non-US markers. Cities are listed because many postings name only a city. */
const COUNTRY_MARKERS: Array<[RegExp, string]> = [
  [/\b(united kingdom|england|scotland|wales|uk|u\.k\.)\b/i, "GB"],
  [/\b(london|manchester|edinburgh|cambridge, uk)\b/i, "GB"],
  [/\b(ireland|dublin)\b/i, "IE"],
  [/\b(germany|berlin|munich|münchen|hamburg|frankfurt)\b/i, "DE"],
  [/\b(france|paris)\b/i, "FR"],
  [/\b(netherlands|amsterdam|utrecht)\b/i, "NL"],
  [/\b(spain|madrid|barcelona)\b/i, "ES"],
  [/\b(portugal|lisbon|lisboa|porto)\b/i, "PT"],
  [/\b(poland|warsaw|kraków|krakow)\b/i, "PL"],
  [/\b(switzerland|zurich|zürich|geneva)\b/i, "CH"],
  [/\b(sweden|stockholm)\b/i, "SE"],
  [/\b(norway|oslo)\b/i, "NO"],
  [/\b(denmark|copenhagen)\b/i, "DK"],
  [/\b(canada|toronto|vancouver|montreal|montréal|ottawa|british columbia|ontario|quebec|québec)\b/i, "CA_COUNTRY"],
  [/\b(india|bangalore|bengaluru|mumbai|delhi|hyderabad|pune|gurgaon|noida)\b/i, "IN"],
  [/\b(singapore)\b/i, "SG"],
  [/\b(japan|tokyo|osaka)\b/i, "JP"],
  [/\b(korea|seoul)\b/i, "KR"],
  [/\b(china|beijing|shanghai|shenzhen|hong kong)\b/i, "CN"],
  [/\b(australia|sydney|melbourne|brisbane)\b/i, "AU"],
  [/\b(new zealand|auckland)\b/i, "NZ"],
  [/\b(brazil|brasil|são paulo|sao paulo)\b/i, "BR"],
  [/\b(mexico|méxico|mexico city|guadalajara)\b/i, "MX"],
  [/\b(israel|tel aviv)\b/i, "IL"],
  [/\b(united arab emirates|dubai|abu dhabi)\b/i, "AE"],
  [/\b(nigeria|lagos|kenya|nairobi|south africa|cape town|johannesburg)\b/i, "AF_OTHER"],
  [/\b(argentina|buenos aires|chile|santiago|colombia|bogot[áa])\b/i, "LATAM_OTHER"],
  [/\b(apac|emea|latam)\b/i, "REGION_OTHER"],
];

const US_MARKERS =
  /\b(united states|usa|u\.s\.a\.|u\.s\.|us only|remote\s*[-–—(]?\s*us\b|americas)\b/i;

const REMOTE_ONLY = /^\s*(fully\s+)?remote(\s*[-–—,]?\s*(anywhere|global|worldwide|flexible))?\s*$/i;

/** Split on the separators that unambiguously divide whole locations. */
const HARD_SEPARATORS = /\s*(?:\||;|•|·|\/{1,2}|\bor\b|\n)\s*/i;

const NOISE = /\((hq|remote|hybrid|onsite|on-site|primary|preferred)\)/gi;

export interface ParsedLocation {
  cities: string[];
  /** ISO-2 where confident. Empty when nothing could be identified. */
  countries: string[];
  /** True when a US-based person could plausibly take the role. */
  usEligible: boolean;
  /** True when the string named no place at all beyond "remote". */
  remoteOnly: boolean;
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase()))
    .join(" ");
}

/**
 * Well-known US cities, so a posting that names only "San Francisco" is still
 * recognised as US. Without this the precision bias throws away 39 currently
 * open SF roles that say nothing else.
 */
const US_CITIES = new Set([
  "san francisco", "new york", "seattle", "boston", "austin", "chicago",
  "los angeles", "denver", "atlanta", "miami", "portland", "san diego",
  "washington", "philadelphia", "dallas", "houston", "phoenix", "minneapolis",
  "detroit", "pittsburgh", "nashville", "salt lake city", "palo alto",
  "mountain view", "menlo park", "sunnyvale", "santa clara", "san jose",
  "oakland", "berkeley", "brooklyn", "jersey city", "arlington", "bellevue",
  "redmond", "boulder", "raleigh", "durham", "charlotte", "columbus",
  "cleveland", "kansas city", "indianapolis", "tampa", "orlando", "sacramento",
  "irvine", "san mateo", "foster city", "redwood city", "culver city",
  "santa monica", "bentonville", "madison", "ann arbor", "chapel hill",
]);

const COUNTRY_WORDS =
  /^(united states|usa|united kingdom|canada|germany|france|india|japan|singapore|australia|ireland|netherlands|spain|portugal|poland|switzerland|sweden|norway|denmark|brazil|mexico|israel|china|korea|new zealand|remote|anywhere|global|worldwide|americas|emea|apac|latam)$/i;

/**
 * Canonical city name, so "New York City" and "New York, NY" group together.
 *
 * `anchored` means a US state followed this token, which is what disambiguates
 * the cities that share a name with their state — New York, Washington and
 * Oklahoma City among them. Unanchored, a bare "New York" is more likely to be
 * the state; anchored by ", NY" it is unambiguously the city.
 */
function canonicalCity(raw: string, anchored = false): string | null {
  const city = raw.replace(NOISE, "").replace(/[.]+$/, "").trim();
  if (!city || city.length < 2 || city.length > 40) return null;
  if (/^\d+$/.test(city)) return null;
  // A country name is never a city. "SF, CA • New York, NY • United States"
  // splits into three chunks and the third one is not a place to filter by.
  if (COUNTRY_WORDS.test(city)) return null;
  // Anywhere in the token, not just as the whole token. Real strings include
  // "Remote (US)", "US - Remote" and "Remote-friendly (travel-required)", none
  // of which are places you can filter a job search by.
  if (/\b(remote|hybrid|on-?site|anywhere|global|worldwide|flexible|travel|various|multiple|other)\b/i.test(city)) {
    return null;
  }

  const lower = city.toLowerCase();
  const aliases: Record<string, string> = {
    "new york city": "New York",
    "nyc": "New York",
    "ny": "New York",
    "sf": "San Francisco",
    "san francisco bay area": "San Francisco",
    "bay area": "San Francisco",
    "washington dc": "Washington",
    "washington, d.c.": "Washington",
    "d.c.": "Washington",
  };
  if (aliases[lower]) return aliases[lower];

  // A bare state name or code is not a city — unless a state followed it, which
  // is what tells "New York, NY" (city) from "New York" (state).
  if (!anchored && STATE_NAME_TO_CODE.has(lower)) return null;
  if (/^[A-Z]{2}$/.test(city) && city in US_STATES) return null;

  return titleCase(lower);
}

export function parseLocation(raw: string | null | undefined): ParsedLocation {
  const empty: ParsedLocation = {
    cities: [],
    countries: [],
    usEligible: false,
    remoteOnly: false,
  };
  if (!raw?.trim()) return empty;

  const text = raw.trim();

  if (REMOTE_ONLY.test(text)) {
    // "Remote" with no country named. Treated as US-eligible: a US-based person
    // can take it, and excluding these would drop genuinely open roles from
    // remote-first companies that never name a country.
    return { cities: [], countries: [], usEligible: true, remoteOnly: true };
  }

  const cities = new Set<string>();
  const countries = new Set<string>();
  let sawUsSignal = false;

  for (const chunk of text.split(HARD_SEPARATORS)) {
    const part = chunk.trim();
    if (!part) continue;

    // Country markers first — they are the most reliable signal in the string,
    // and one non-US marker in a chunk means that chunk is not a US location.
    let chunkCountry: string | null = null;
    for (const [re, code] of COUNTRY_MARKERS) {
      if (re.test(part)) {
        chunkCountry = code === "CA_COUNTRY" ? "CA" : code;
        countries.add(chunkCountry);
        break;
      }
    }

    if (US_MARKERS.test(part)) {
      sawUsSignal = true;
      countries.add("US");
    }

    // Walk comma tokens, anchoring each city on a following state.
    const tokens = part.split(",").map((t) => t.replace(NOISE, "").trim()).filter(Boolean);
    for (let i = 0; i < tokens.length; i += 1) {
      const next = tokens[i + 1];
      if (!next) continue;

      const upper = next.toUpperCase();
      const isStateCode = upper.length === 2 && upper in US_STATES;
      const isStateName = STATE_NAME_TO_CODE.has(next.toLowerCase());

      if (isStateCode || isStateName) {
        // Only a US state if this chunk is not already pinned to another country
        // — "Vancouver, British Columbia, Canada" must not read as US.
        if (!chunkCountry || chunkCountry === "US") {
          const city = canonicalCity(tokens[i], true);
          if (city) cities.add(city);
          sawUsSignal = true;
          countries.add("US");
        }
        i += 1; // consume the state token
      }
    }

    // A chunk with no state and no country, e.g. "San Francisco" alone.
    if (!chunkCountry && tokens.length === 1) {
      const city = canonicalCity(tokens[0]);
      if (city) {
        cities.add(city);
        // Only a US signal when the city is one we actually recognise. An
        // unrecognised bare city name is exactly where a wrong country guess
        // would come from, so it contributes a city and no country.
        if (US_CITIES.has(city.toLowerCase())) {
          sawUsSignal = true;
          countries.add("US");
        }
      }
    }
  }

  countries.delete("REGION_OTHER");
  countries.delete("AF_OTHER");
  countries.delete("LATAM_OTHER");

  return {
    cities: [...cities].sort(),
    countries: [...countries].sort(),
    usEligible: sawUsSignal || countries.has("US"),
    remoteOnly: false,
  };
}
