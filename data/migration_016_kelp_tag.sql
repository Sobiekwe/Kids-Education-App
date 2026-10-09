-- migration_016: kelp was tagged Soft c and g but has no c or g; move it to Tricky words.
-- Applied to STAGING by console update. Run on production when Stage 2 is promoted.
update words set pattern_primary = 'tricky' where word = 'kelp' and stage = 1;
