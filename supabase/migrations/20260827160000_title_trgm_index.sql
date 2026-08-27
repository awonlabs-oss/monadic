-- monadic — index the title matching that /for-you does per row
--
-- recommend_jobs measured at 1,184ms against real criteria, where the same
-- function with no criteria at all runs in 214ms. The difference is the role
-- test, which for every eligible posting evaluates a trigram similarity and
-- builds a tsvector from the title on the fly:
--
--     e.title ilike '%' || r || '%'
--     or extensions.similarity(e.title, r) > 0.35
--     or to_tsvector('english', e.title) @@ plainto_tsquery('english', r)
--
-- Neither of the last two could use an index, because neither had one. The
-- corpus is 17,190 open postings and the scoring runs before the match floor
-- discards anything, so this is the whole set, every time the page loads.
--
-- Two indexes, matching the two expressions. The tsvector one is an exact
-- expression match for the third clause. The trigram one supports both the
-- ilike and, via the % operator, the similarity test.
--
-- Whether the planner uses them is a separate question from whether they exist:
-- the role list arrives as an array and is unnested, so the comparison is
-- against a set rather than a constant, and a lateral of that shape does not
-- always index. Kept only if measurement says it helps.

create index if not exists jobs_title_trgm_idx
  on public.jobs using gin (title extensions.gin_trgm_ops);

create index if not exists jobs_title_tsv_idx
  on public.jobs using gin (to_tsvector('english', title));

analyze public.jobs;
