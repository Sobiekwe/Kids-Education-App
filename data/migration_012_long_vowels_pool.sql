-- Migration 012: the remaining 40 Stage 2 long_vowels words (with the 10 from
-- migration_010 this makes the 50-word long-vowels pool: 17 easy, 17 medium,
-- 16 hard). Reviewed and approved by Simon. Origins are best-effort and
-- origin_verified stays false. Audio is generated afterwards.
-- Requires migration_010 (the stage column). Safe to re-run: duplicates skipped.

insert into words
  (word, meaning, sentence, part_of_speech, grade_level, stage, list_version, pattern_primary, pattern_secondary, origin)
values
  ('shade', 'a cool, darker spot where the sun''s light is blocked.', 'We ate our picnic lunch in the shade of a big oak tree.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'English'),
  ('flame', 'the glowing, moving part of a fire.', 'The candle flame flickered when the door opened.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'French'),
  ('slope', 'ground that tilts up or down, like the side of a hill.', 'We pulled our sleds up the snowy slope.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'English'),
  ('globe', 'a round model of the Earth.', 'She spun the globe and pointed to Brazil.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('stripe', 'a long, narrow band of color.', 'Each stripe on the flag was a different color.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Dutch'),
  ('grape', 'a small, round, juicy fruit that grows in bunches.', 'He popped a green grape into his mouth.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'French'),
  ('flute', 'a thin musical instrument you play by blowing across a hole.', 'Maya practices her flute after school.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'French'),
  ('prize', 'something given to the winner of a contest.', 'The winner of the spelling bee took home a shiny prize.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'French'),
  ('cube', 'a solid shape with six equal square sides.', 'Each ice cube melted in the warm lemonade.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Greek'),
  ('tune', 'a group of musical notes that make a song you can hum.', 'I can''t get that happy tune out of my head.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'English'),
  ('bike', 'a vehicle with two wheels that you ride by pedaling.', 'She rode her bike to the library.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, null),
  ('chase', 'to run after something to catch it.', 'The puppy loves to chase the ball across the yard.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'French'),
  ('vase', 'a container used to hold cut flowers.', 'Dad put the fresh tulips in a tall glass vase.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('kite', 'a light toy that flies in the wind on a long string.', 'The red kite soared high above the beach.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'English'),
  ('plume', 'a large, soft feather, or a tall cloud that rises like one.', 'A plume of steam rose from the hot soup.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('escape', 'to get away from a place or danger.', 'The hamster found a way to escape from its cage.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('locate', 'to find the place where something is.', 'Use the map to locate the nearest library.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('donate', 'to give something to help others.', 'We will donate our old books to the school library.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('excite', 'to make someone feel happy and eager.', 'The news of the field trip will excite the whole class.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('include', 'to have something as a part of a whole.', 'Please include your name at the top of the page.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', 'word_parts', 'Latin'),
  ('provide', 'to give or supply what is needed.', 'The school will provide pencils for the test.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('promote', 'to help something grow or become better known.', 'Posters will promote our school book fair.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('observe', 'to watch carefully.', 'Scientists observe the stars with powerful telescopes.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', 'word_parts', 'Latin'),
  ('compose', 'to create music or writing.', 'She wants to compose a song for her grandmother''s birthday.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('celebrate', 'to do something fun for a special day or event.', 'We will celebrate Grandma''s birthday with a big dinner.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('anticipate', 'to expect something and get ready for it.', 'Weather experts anticipate rain tomorrow, so pack an umbrella.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('dedicate', 'to give your time or effort fully to something.', 'She will dedicate every Saturday to practicing piano.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('hibernate', 'to spend the winter in a deep sleep, as some animals do.', 'Bears hibernate in caves until spring.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('illustrate', 'to draw pictures for a book or to explain with examples.', 'He will illustrate the class storybook with colorful drawings.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('imitate', 'to copy the way someone looks, sounds, or acts.', 'Parrots can imitate the sounds they hear.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('navigate', 'to find the way across a place, such as the sea or a road.', 'Sailors once used the stars to navigate across the ocean.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('estimate', 'to make a careful guess about a number or amount.', 'Can you estimate how many marbles are in the jar?', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('evaporate', 'to change from a liquid into a gas, like water drying into the air.', 'Puddles evaporate quickly on a hot, sunny day.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('accelerate', 'to go faster.', 'The bicycle began to accelerate as it rolled down the hill.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', 'word_parts', 'Latin'),
  ('decorate', 'to make something look nicer by adding pretty things.', 'We will decorate the classroom for the party.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('participate', 'to take part in an activity.', 'Every student can participate in the talent show.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', 'word_parts', 'Latin'),
  ('cooperate', 'to work together toward a goal.', 'Teammates must cooperate to win the relay race.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', 'word_parts', 'Latin'),
  ('migrate', 'to travel to another place for a season, as birds do.', 'Geese migrate south before winter.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('vibrate', 'to shake with quick, tiny movements.', 'The guitar string will vibrate when you pluck it.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('recognize', 'to know someone or something because you have seen it before.', 'I didn''t recognize my teacher without her glasses.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', 'tricky', 'Latin')
on conflict (word, grade_level) do nothing;
