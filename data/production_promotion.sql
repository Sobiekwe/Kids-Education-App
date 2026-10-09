-- PRODUCTION PROMOTION BUNDLE for Stage 2 (Pattern Lab).
-- Run ONCE in the PRODUCTION Supabase project's SQL Editor (project pbcenkjcxjikoupamdfb).
-- It combines migrations 010, 012, 013, 014 (by word, not id), 015, 016, 017 (by word),
-- 018 and the elite/woven fixes, in the right order. Nothing in it uses staging ids, so it is
-- safe on production. Stage 1 words, children, points and owned avatars are not changed
-- (avatar PRICES change; owned avatars stay owned).
-- Run it BEFORE the matching code is merged to main, or the live app's word query will fail.

-- ===== 1. Stage column + first 10 Stage 2 words (migration 010) =====
alter table words add column if not exists stage int not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'words_stage_check') then
    alter table words add constraint words_stage_check check (stage in (1, 2));
  end if;
end $$;

insert into words
  (word, meaning, sentence, part_of_speech, grade_level, stage, list_version, pattern_primary, pattern_secondary, origin)
values
  ('tadpole', 'a young frog that lives in water and has a tail.', 'The tadpole wiggled through the pond until it grew legs.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', 'word_parts', 'English'),
  ('compete', 'to try to win by doing better than others.', 'Six teams will compete in the science fair this spring.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('reptile', 'a cold-blooded animal with scaly skin, such as a snake or lizard.', 'A lizard is a reptile that loves to bask on warm rocks.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('decide', 'to make up your mind about something.', 'It took her a while to decide which book to borrow.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('parade', 'a public procession with music, floats, or marchers.', 'We waved flags as the parade marched down Main Street.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'French'),
  ('suppose', 'to think something is probably true.', 'I suppose it will rain, since the sky is so dark.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', 'word_parts', 'Latin'),
  ('inhale', 'to breathe in.', 'Inhale slowly through your nose before you dive.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', 'word_parts', 'Latin'),
  ('unite', 'to join together as one.', 'The whole town came out to unite behind the school band.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('delight', 'great joy or pleasure.', 'The puppy jumped with delight when its owner came home.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', 'tricky', 'French'),
  ('rotate', 'to turn around a center point, like a wheel.', 'The fan blades rotate faster on the highest setting.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin')
on conflict (word, grade_level) do nothing;


-- ===== 2. The other 40 Stage 2 words (migration 012) =====
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


-- ===== 3. Pattern Lab: session modes, difficulty tiers, lab clock (migration 013) =====
alter table sessions drop constraint if exists sessions_mode_check;
alter table sessions add constraint sessions_mode_check
  check (mode in ('practice', 'quiz', 'review', 'learn_gate', 'lab', 'lab_check'));

alter table sessions add column if not exists pattern_id text references patterns(id);

alter table words add column if not exists difficulty int not null default 2;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'words_difficulty_check') then
    alter table words add constraint words_difficulty_check check (difficulty between 1 and 3);
  end if;
end $$;

alter table word_progress add column if not exists lab_last_shown_at timestamptz;

-- Tier the 50 long_vowels words (17 easy, 17 medium, 16 hard).
update words set difficulty = 1 where stage = 2 and word in
  ('tadpole','parade','shade','flame','slope','globe','stripe','grape','flute','prize','cube','tune','bike','chase','vase','kite','plume');
update words set difficulty = 2 where stage = 2 and word in
  ('compete','reptile','decide','suppose','inhale','unite','delight','rotate','escape','locate','donate','excite','include','provide','promote','observe','compose');
update words set difficulty = 3 where stage = 2 and word in
  ('celebrate','anticipate','dedicate','hibernate','illustrate','imitate','navigate','estimate','evaporate','accelerate','decorate','participate','cooperate','migrate','vibrate','recognize');


-- ===== 4. "observe" is not a long vowel word: swap it for "describe" (migration 017, by word) =====
alter table words add column if not exists highlight text;
update words set
  word = 'describe',
  meaning = 'to tell what someone or something is like.',
  sentence = 'Can you describe your favorite toy to the class?',
  part_of_speech = 'verb',
  origin = 'Latin',
  pattern_secondary = null
where word = 'observe' and stage = 2;

-- ===== 5. Pronunciations, by word (migration 014) =====
alter table words add column if not exists pronunciation text;
update words w set pronunciation = v.p
from (values
  ('buttons', 'ˈbə-tᵊnz'),
  ('cuddle', 'ˈkə-dᵊl'),
  ('puffy', 'ˈpə-fē'),
  ('tiptoed', 'ˈtip-ˌtōd'),
  ('clever', 'ˈkle-vər'),
  ('basement', 'ˈbās-mənt'),
  ('burlap', 'ˈbər-ˌlap'),
  ('wetlands', 'ˈwet-ˌlandz'),
  ('invite', 'in-ˈvīt'),
  ('butterflies', 'ˈbə-tər-ˌflīz'),
  ('kelp', 'ˈkelp'),
  ('property', 'ˈprä-pər-tē'),
  ('carefully', 'ˈker-f(ə-)lē'),
  ('sniffling', 'ˈsni-f(ə-)liŋ'),
  ('beneath', 'bi-ˈnēth'),
  ('tractor', 'ˈtrak-tər'),
  ('permit', 'pər-ˈmit'),
  ('awning', 'ˈȯ-niŋ'),
  ('fickle', 'ˈfi-kəl'),
  ('relief', 'ri-ˈlēf'),
  ('lunar', 'ˈlü-nər'),
  ('boycotting', 'ˈbȯi-ˌkä-tiŋ'),
  ('molten', 'ˈmōl-tᵊn'),
  ('elite', 'i-ˈlēt'),
  ('woven', 'ˈwō-vən'),
  ('proclaim', 'prō-ˈklām'),
  ('thimble', 'ˈthim-bəl'),
  ('custody', 'ˈkə-stə-dē'),
  ('granola', 'grə-ˈnō-lə'),
  ('warrior', 'ˈwȯr-yər'),
  ('rigid', 'ˈri-jəd'),
  ('fierce', 'ˈfirs'),
  ('laughter', 'ˈlaf-tər'),
  ('salary', 'ˈsa-lə-rē'),
  ('disappear', 'ˌdis-ə-ˈpir'),
  ('hurdler', 'ˈhər-dᵊl-ər'),
  ('lounge', 'ˈlau̇nj'),
  ('jovial', 'ˈjō-vē-əl'),
  ('inferior', 'in-ˈfir-ē-ər'),
  ('December', 'di-ˈsem-bər'),
  ('duration', 'du̇-ˈrā-shən'),
  ('dictionary', 'ˈdik-shə-ˌner-ē'),
  ('business', 'ˈbiz-nəs'),
  ('reinstate', 'ˌrē-ən-ˈstāt'),
  ('examine', 'ig-ˈza-mən'),
  ('versus', 'ˈvər-səs'),
  ('lullaby', 'ˈlə-lə-ˌbī'),
  ('opposite', 'ˈä-pə-zət'),
  ('tissues', 'ˈti-(ˌ)shüz'),
  ('marlin', 'ˈmär-lən'),
  ('cat', 'ˈkat'),
  ('dog', 'ˈdȯg'),
  ('sun', 'ˈsən'),
  ('hop', 'ˈhäp'),
  ('big', 'ˈbig'),
  ('red', 'ˈred'),
  ('run', 'ˈrən'),
  ('top', 'ˈtäp'),
  ('wet', 'ˈwet'),
  ('six', 'ˈsiks'),
  ('bus', 'ˈbəs'),
  ('box', 'ˈbäks'),
  ('fun', 'ˈfən'),
  ('milk', 'ˈmilk'),
  ('jump', 'ˈjəmp'),
  ('happy', 'ˈha-pē'),
  ('chair', 'ˈcher'),
  ('whale', 'ˈ(h)wāl'),
  ('train', 'ˈtrān'),
  ('brush', 'ˈbrəsh'),
  ('small', 'ˈsmȯl'),
  ('plant', 'ˈplant'),
  ('sunny', 'ˈsə-nē'),
  ('lunch', 'ˈlənch'),
  ('smile', 'ˈsmī(-ə)l'),
  ('snack', 'ˈsnak'),
  ('stone', 'ˈstōn'),
  ('apple', 'ˈa-pəl'),
  ('dream', 'ˈdrēm'),
  ('crawl', 'ˈkrȯl'),
  ('spend', 'ˈspend'),
  ('thank', 'ˈthaŋk'),
  ('class', 'ˈklas'),
  ('shape', 'ˈshāp'),
  ('plane', 'ˈplān'),
  ('because', 'bi-ˈkȯz'),
  ('special', 'ˈspe-shəl'),
  ('different', 'ˈdi-f(ə-)rənt'),
  ('remember', 'ri-ˈmem-bər'),
  ('sentence', 'ˈsen-tᵊn(t)s'),
  ('together', 'tə-ˈge-t͟hər'),
  ('favorite', 'ˈfā-v(ə-)rət'),
  ('another', 'ə-ˈnə-t͟hər'),
  ('morning', 'ˈmȯr-niŋ'),
  ('picture', 'ˈpik-chər'),
  ('hundred', 'ˈhən-drəd'),
  ('thirsty', 'ˈthər-stē'),
  ('promise', 'ˌprä-mə-ˈsē'),
  ('journey', 'ˈjər-nē'),
  ('island', 'ˈī-lənd'),
  ('gentle', 'ˈjen-tᵊl'),
  ('whisper', 'ˈ(h)wi-spər'),
  ('harvest', 'ˈhär-vəst'),
  ('treasure', 'ˈtre-zhər'),
  ('complete', 'kəm-ˈplēt'),
  ('mystery', 'ˈmi-st(ə-)rē'),
  ('crayon', 'ˈkrā-ˌän'),
  ('holiday', 'ˈhä-lə-ˌdā'),
  ('kitchen', 'ˈki-chən'),
  ('library', 'ˈlī-ˌbrer-ē'),
  ('achieve', 'ə-ˈchēv'),
  ('guarantee', 'ˌger-ən-ˈtē'),
  ('necessary', 'ˈne-sə-ˌser-ē'),
  ('occasion', 'ə-ˈkā-zhən'),
  ('embarrass', 'im-ˈber-əs'),
  ('definitely', 'ˈde-fə-nit-lē'),
  ('government', 'ˈgə-vər(n)-mənt'),
  ('environment', 'in-ˈvī-rə(n)-mənt'),
  ('independence', 'ˌin-də-ˈpen-dən(t)s'),
  ('recommend', 'ˌre-kə-ˈmend'),
  ('particular', 'pər-ˈti-kyə-lər'),
  ('immediately', 'i-ˈmē-dē-ət-lē'),
  ('vocabulary', 'vō-ˈka-byə-ˌler-ē'),
  ('convenience', 'kən-ˈvēn-yən(t)s'),
  ('appreciate', 'ə-ˈprē-shē-ˌāt'),
  ('apparent', 'ə-ˈper-ənt'),
  ('enthusiasm', 'in-ˈthü-zē-ˌa-zəm'),
  ('magnificent', 'mag-ˈni-fə-sənt'),
  ('opportunity', 'ˌä-pər-ˈtü-nə-tē'),
  ('unfortunately', 'ˌən-ˈfȯrch-nət-lē'),
  ('temperature', 'ˈtem-pər-ˌchu̇r'),
  ('disappoint', 'ˌdis-ə-ˈpȯint'),
  ('additional', 'ə-ˈdi-sh(ə-)nəl'),
  ('atmosphere', 'ˈat-mə-ˌsfir'),
  ('population', 'ˌpä-pyə-ˈlā-shən'),
  ('ceremony', 'ˈser-ə-ˌmō-nē'),
  ('marvelous', 'ˈmärv-(ə-)ləs'),
  ('sufficient', 'sə-ˈfi-shənt'),
  ('courageous', 'kə-ˈrā-jəs'),
  ('imaginary', 'i-ˈma-jə-ˌner-ē'),
  ('conscience', 'ˈkän(t)-shən(t)s'),
  ('questionnaire', 'ˌkwes-chə-ˈner'),
  ('bureaucracy', 'byu̇-ˈrä-krə-sē'),
  ('miscellaneous', 'ˌmi-sə-ˈlā-nē-əs'),
  ('exaggerate', 'ig-ˈza-jə-ˌrāt'),
  ('controversy', 'ˈkän-trə-ˌvər-sē'),
  ('phenomenon', 'fi-ˈnä-mə-ˌnän'),
  ('privilege', 'ˈpriv-lij'),
  ('resilience', 'ri-ˈzil-yən(t)s'),
  ('unanimous', 'yu̇-ˈna-nə-məs'),
  ('subordinate', 'sə-ˈbȯr-də-nət'),
  ('perpendicular', 'ˌpər-pən-ˈdi-kyə-lər'),
  ('ambiguous', 'am-ˈbi-gyə-wəs'),
  ('hierarchy', 'ˈhī-(ə-)ˌrär-kē'),
  ('collaborate', 'kə-ˈla-bə-ˌrāt'),
  ('plagiarism', 'ˈplā-jə-ˌri-zəm'),
  ('coincidence', 'kō-ˈin(t)-sə-dən(t)s'),
  ('legitimate', 'li-ˈji-tə-mət'),
  ('sustainable', 'sə-ˈstā-nə-bəl'),
  ('hypothesis', 'hī-ˈpä-thə-səs'),
  ('infrastructure', 'ˈin-frə-ˌstrək-chər'),
  ('entrepreneur', 'ˌän-trə-p(r)ə-ˈnər'),
  ('deteriorate', 'di-ˈtir-ē-ə-ˌrāt'),
  ('jurisdiction', 'ˌju̇r-əs-ˈdik-shən'),
  ('perseverance', 'ˌpər-sə-ˈvir-ən(t)s'),
  ('reconnaissance', 'ri-ˈkä-nə-zən(t)s'),
  ('camouflage', 'ˈka-mə-ˌfläzh'),
  ('chronological', 'ˌkrä-nə-ˈlä-ji-kəl'),
  ('idiosyncrasy', 'ˌi-dē-ə-ˈsiŋ-krə-sē'),
  ('acquaintance', 'ə-ˈkwān-tᵊn(t)s'),
  ('indispensable', 'ˌin-di-ˈspen(t)-sə-bəl'),
  ('correspondence', 'ˌkȯr-ə-ˈspän-dən(t)s'),
  ('extracurricular', 'ˌek-strə-kə-ˈri-kyə-lər'),
  ('conscientious', 'ˌkän(t)-shē-ˈen(t)-shəs'),
  ('discrepancy', 'di-ˈskre-pən-sē'),
  ('tadpole', 'ˈtad-ˌpōl'),
  ('compete', 'kəm-ˈpēt'),
  ('reptile', 'ˈrep-ˌtī(-ə)l'),
  ('decide', 'di-ˈsīd'),
  ('parade', 'pə-ˈrād'),
  ('suppose', 'sə-ˈpōz'),
  ('inhale', 'in-ˈhāl'),
  ('unite', 'yu̇-ˈnīt'),
  ('delight', 'di-ˈlīt'),
  ('rotate', 'ˈrō-ˌtāt'),
  ('shade', 'ˈshād'),
  ('flame', 'ˈflām'),
  ('slope', 'ˈslōp'),
  ('globe', 'ˈglōb'),
  ('stripe', 'ˈstrīp'),
  ('grape', 'ˈgrāp'),
  ('flute', 'ˈflüt'),
  ('prize', 'ˈprīz'),
  ('cube', 'ˈkyüb'),
  ('tune', 'ˈtün'),
  ('bike', 'ˈbīk'),
  ('chase', 'ˈchās'),
  ('vase', 'ˈvās'),
  ('kite', 'ˈkīt'),
  ('plume', 'ˈplüm'),
  ('escape', 'i-ˈskāp'),
  ('locate', 'ˈlō-ˌkāt'),
  ('donate', 'ˈdō-ˌnāt'),
  ('excite', 'ik-ˈsīt'),
  ('include', 'in-ˈklüd'),
  ('provide', 'prə-ˈvīd'),
  ('promote', 'prə-ˈmōt'),
  ('describe', 'di-ˈskrīb'),
  ('compose', 'kəm-ˈpōz'),
  ('celebrate', 'ˈse-lə-ˌbrāt'),
  ('anticipate', 'an-ˈti-sə-ˌpāt'),
  ('dedicate', 'ˈde-di-ˌkāt'),
  ('hibernate', 'ˈhī-bər-ˌnāt'),
  ('illustrate', 'ˈi-lə-ˌstrāt'),
  ('imitate', 'ˈi-mə-ˌtāt'),
  ('navigate', 'ˈna-və-ˌgāt'),
  ('estimate', 'ˈe-stə-ˌmāt'),
  ('evaporate', 'i-ˈva-p(ə-)ˌrāt'),
  ('accelerate', 'ik-ˈse-lə-ˌrāt'),
  ('decorate', 'ˈde-kə-ˌrāt'),
  ('participate', 'pär-ˈti-sə-ˌpāt'),
  ('cooperate', 'kō-ˈä-pə-ˌrāt'),
  ('migrate', 'ˈmī-ˌgrāt'),
  ('vibrate', 'ˈvī-ˌbrāt'),
  ('recognize', 'ˈre-kig-ˌnīz')
) as v(word, p)
where w.word = v.word;

-- ===== 6. Clearer pattern tips (migration 015) =====
update patterns set tip = 'A long vowel makes the same sound as its letter name: the a in cake sounds like the letter A, and the e in be sounds like the letter E.' where id = 'long_vowels';
update patterns set tip = 'When c or g comes before e, i, or y, c says s (as in city) and g says j (as in gem). Otherwise they are hard: c says k (cat) and g says g (go). A few words break the rule, like get and give.' where id = 'soft_c_g';


-- ===== 7. kelp has no c or g: move it to Tricky words (migration 016) =====
update words set pattern_primary = 'tricky' where word = 'kelp' and stage = 1;

-- ===== 8. Pattern-letter highlights (migration 017) =====
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


-- ===== 9. elite and woven fixes =====
update words set meaning = 'among the very best; top-level.' where word = 'elite' and grade_level = 4 and stage = 1;
update words set
  part_of_speech = 'adjective',
  sentence = 'She carried a woven basket full of fresh bread.',
  audio_sentence_url = 'https://pbcenkjcxjikoupamdfb.supabase.co/storage/v1/object/public/word-audio/25-sentence-v2.mp3'
where word = 'woven' and grade_level = 4 and stage = 1;

-- ===== 10. Points rebalance: avatar prices about 4x (migration 018) =====
update avatars a set cost = v.cost
from (values
  ('lion', 80), ('frog', 80), ('tiger', 120), ('koala', 120), ('owl', 160), ('unicorn', 200),
  ('robot', 240), ('dragon', 260), ('dino', 300), ('shark', 360), ('wizard', 400), ('superhero', 480)
) as v(id, cost)
where a.id = v.id;
