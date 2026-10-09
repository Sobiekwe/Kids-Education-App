-- migration_017: pattern-letter highlights + swap "observe" for "describe".
-- Run on STAGING. Needed by the restructured Pattern Lab lesson.
--
-- 1) words.highlight: [ ] = long vowel letters, { } = silent e (shown in color).
-- 2) "observe" has no long vowel (its e is silent but er says "ur"), so that Stage 2
--    row (id 336, same position in the pool) becomes "describe". Its audio files were
--    generated under new names (336-word-v2.mp3, 336-sentence-v2.mp3).
--    The two audio URLs below are for the STAGING storage project; for production,
--    regenerate the audio and use that project's URLs.

alter table words add column if not exists highlight text;

update words set
  word = 'describe',
  meaning = 'to tell what someone or something is like.',
  sentence = 'Can you describe your favorite toy to the class?',
  part_of_speech = 'verb',
  pronunciation = 'di-ˈskrīb',
  origin = 'Latin',
  pattern_secondary = null,
  audio_word_url = 'https://gnmvxumsuwzgveltdegu.supabase.co/storage/v1/object/public/word-audio/336-word-v2.mp3',
  audio_sentence_url = 'https://gnmvxumsuwzgveltdegu.supabase.co/storage/v1/object/public/word-audio/336-sentence-v2.mp3'
where id = 336 and word = 'observe' and stage = 2;

update words w set highlight = v.h
from (values
  ('shade', 'sh[a]d{e}'),
  ('flame', 'fl[a]m{e}'),
  ('slope', 'sl[o]p{e}'),
  ('globe', 'gl[o]b{e}'),
  ('stripe', 'str[i]p{e}'),
  ('grape', 'gr[a]p{e}'),
  ('flute', 'fl[u]t{e}'),
  ('prize', 'pr[i]z{e}'),
  ('cube', 'c[u]b{e}'),
  ('tune', 't[u]n{e}'),
  ('bike', 'b[i]k{e}'),
  ('chase', 'ch[a]s{e}'),
  ('vase', 'v[a]s{e}'),
  ('kite', 'k[i]t{e}'),
  ('plume', 'pl[u]m{e}'),
  ('tadpole', 'tadp[o]l{e}'),
  ('parade', 'par[a]d{e}'),
  ('escape', 'esc[a]p{e}'),
  ('locate', 'loc[a]t{e}'),
  ('donate', 'don[a]t{e}'),
  ('excite', 'exc[i]t{e}'),
  ('include', 'incl[u]d{e}'),
  ('provide', 'prov[i]d{e}'),
  ('promote', 'prom[o]t{e}'),
  ('describe', 'descr[i]b{e}'),
  ('compose', 'comp[o]s{e}'),
  ('compete', 'comp[e]t{e}'),
  ('reptile', 'rept[i]l{e}'),
  ('decide', 'dec[i]d{e}'),
  ('suppose', 'supp[o]s{e}'),
  ('inhale', 'inh[a]l{e}'),
  ('unite', 'un[i]t{e}'),
  ('delight', 'del[igh]t'),
  ('rotate', 'rot[a]t{e}'),
  ('celebrate', 'celebr[a]t{e}'),
  ('anticipate', 'anticip[a]t{e}'),
  ('dedicate', 'dedic[a]t{e}'),
  ('hibernate', 'hibern[a]t{e}'),
  ('illustrate', 'illustr[a]t{e}'),
  ('imitate', 'imit[a]t{e}'),
  ('navigate', 'navig[a]t{e}'),
  ('estimate', 'estim[a]t{e}'),
  ('evaporate', 'evapor[a]t{e}'),
  ('accelerate', 'acceler[a]t{e}'),
  ('decorate', 'decor[a]t{e}'),
  ('participate', 'particip[a]t{e}'),
  ('cooperate', 'cooper[a]t{e}'),
  ('migrate', 'migr[a]t{e}'),
  ('vibrate', 'vibr[a]t{e}'),
  ('recognize', 'recogn[i]z{e}')
) as v(word, h)
where w.word = v.word and w.stage = 2;

update words w set highlight = v.h
from (values
  ('invite', 'inv[i]t{e}'),
  ('reinstate', 'reinst[a]t{e}'),
  ('basement', 'b[a]s{e}ment'),
  ('proclaim', 'procl[ai]m'),
  ('relief', 'rel[ie]f')
) as v(word, h)
where w.word = v.word and w.stage = 1 and w.grade_level = 4;
