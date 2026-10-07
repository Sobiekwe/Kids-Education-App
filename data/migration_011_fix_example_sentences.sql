-- Migration 011: make each example sentence use its word as the same part of
-- speech the word is listed as. A full review of all words found six that
-- didn't match (e.g. "buttons" is a noun but the sentence used it as a verb).
-- Already applied to STAGING. Run in PRODUCTION only when approved, then
-- regenerate the example-sentence audio for these six words (the old audio
-- still reads the old sentence).
--
-- Matched on (word, grade_level) rather than id so it is safe on any database.

update words set sentence = 'She sewed three shiny buttons onto her new jacket.' where word = 'buttons' and grade_level = 4 and stage = 1;
update words set sentence = 'They live on the opposite side of the street.' where word = 'opposite' and grade_level = 4 and stage = 1;
update words set sentence = 'Three plus three makes six.' where word = 'six' and grade_level = 1;
update words set sentence = 'She used a soft brush to paint the fence.' where word = 'brush' and grade_level = 2;
update words set sentence = 'I finished my cookie, so I asked for another.' where word = 'another' and grade_level = 3;
update words set sentence = 'Ten groups of ten make a hundred.' where word = 'hundred' and grade_level = 3;
