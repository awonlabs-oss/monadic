import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * Keep a visited feed in the client cache for half a minute.
     *
     * Every page here is force-dynamic, and Next.js does not cache dynamic
     * segments on the client at all by default — `staleTimes.dynamic` is 0
     * since v15. So switching to Jobs and straight back re-ran the whole query
     * both times, and /for-you spends about 1.2 seconds inside recommend_jobs
     * scoring 17,190 postings against the saved criteria. That was the "second
     * or two" on every tab switch: not slow rendering, but no cache to return
     * to.
     *
     * Thirty seconds is chosen against what the data can actually do in that
     * window. Ingestion is a manual command, so the corpus is unchanged between
     * runs; the things that do move — saving, applying, a status change — are
     * writes this app makes itself, and each already calls revalidatePath,
     * which evicts the entry. What is left is a feed that cannot be more than
     * thirty seconds behind a change nobody made.
     *
     * `static` is left at its 5-minute default. It governs the loading
     * boundaries and prefetched shells, which hold no data to go stale.
     */
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
