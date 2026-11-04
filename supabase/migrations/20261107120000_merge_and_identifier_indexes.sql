-- Phase 10A: indexes justified by measurement (20,000 Seedlings, 5,000 retired, local development database).
--
-- resolve_retired_identifier compares an upper-cased, #-stripped identifier against retired aliases. Without this index every lookup
-- scanned seedling_identifiers: 300 hits took about 636 ms, and 11.6 ms after the index was added. The expression must match the
-- function's text exactly, so the index is used.
--
-- The canonical-history walk and the resolver follow merged_into_id downwards. Without this partial index each recursion level scanned
-- all Seedlings. The index is partial, so ordinary Seedlings are not indexed at all.
--
-- Public Search is not indexed here. Its matching uses strpos over normalised text, which no btree or trigram index serves, and the
-- measured cost was flat at about 1.7 ms per query at this size. Search semantics are unchanged.

create index seedling_identifiers_retired_text_idx
  on public.seedling_identifiers (upper(regexp_replace(identifier, '^#', '')))
  where is_retired_alias;

create index seedlings_merged_into_idx
  on public.seedlings (merged_into_id)
  where merged_into_id is not null;
