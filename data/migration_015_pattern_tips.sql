-- migration_015: clearer tips for Long vowels and Soft c and g.
-- Run on STAGING first.
update patterns set tip = 'A long vowel makes the same sound as its letter name: the a in cake sounds like the letter A, and the e in be sounds like the letter E.' where id = 'long_vowels';
update patterns set tip = 'When c or g comes before e, i, or y, c says s (as in city) and g says j (as in gem). Otherwise they are hard: c says k (cat) and g says g (go). A few words break the rule, like get and give.' where id = 'soft_c_g';
