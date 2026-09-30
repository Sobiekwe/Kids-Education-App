-- Migration 002: multi-grade support (grades 1-6) + parent-managed children.
-- Run this in the Supabase SQL Editor AFTER schema.sql / seed_words.sql have
-- already been run once. Safe to run once; re-running skips what already exists.

-- 1. Tag existing words with their grade level (the 50 official words are Grade 4).
alter table words add column if not exists grade_level int not null default 4;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'words_grade_level_check') then
    alter table words add constraint words_grade_level_check check (grade_level between 1 and 6);
  end if;
end $$;

-- 2. Children move from config.js into a real table the parent can manage.
create table if not exists children (
  id text primary key,
  name text not null,
  grade_level int not null check (grade_level between 1 and 6),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Preserve the two existing children (same ids used in sessions/attempts so
-- their history stays linked) — both were on the Grade 4 list.
insert into children (id, name, grade_level) values
  ('child1', 'Netochukwu', 4),
  ('child2', 'Chioma', 4)
on conflict (id) do nothing;

-- 3. Seed words for grades 1, 2, 3, 5, and 6 (Grade 4 already seeded).
--    A unique constraint on (word, grade_level) lets these inserts be re-run
--    safely without creating duplicates.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'words_word_grade_unique') then
    alter table words add constraint words_word_grade_unique unique (word, grade_level);
  end if;
end $$;

insert into words (word, meaning, sentence, part_of_speech, list_version, grade_level) values
  ('cat', 'a small furry pet that says meow.', 'Our cat likes to sleep on the warm windowsill.', 'noun', 'grade1-2026-2027', 1),
  ('dog', 'a furry pet that barks and likes to play.', 'The dog ran to fetch the ball.', 'noun', 'grade1-2026-2027', 1),
  ('sun', 'the bright star in the sky that gives us light and heat.', 'The sun was shining on the playground.', 'noun', 'grade1-2026-2027', 1),
  ('hop', 'to jump on one or both feet.', 'The bunny likes to hop across the yard.', 'verb', 'grade1-2026-2027', 1),
  ('big', 'large in size.', 'We saw a big truck on the highway.', 'adjective', 'grade1-2026-2027', 1),
  ('red', 'the color of an apple or a stop sign.', 'She picked the red crayon to color the heart.', 'adjective', 'grade1-2026-2027', 1),
  ('run', 'to move quickly using your legs.', 'We like to run around the park after school.', 'verb', 'grade1-2026-2027', 1),
  ('top', 'the highest part of something.', 'A flag waved at the top of the pole.', 'noun', 'grade1-2026-2027', 1),
  ('wet', 'covered in water or another liquid.', 'My shoes got wet in the rain.', 'adjective', 'grade1-2026-2027', 1),
  ('six', 'the number after five.', 'She counted six ducks in the pond.', 'noun', 'grade1-2026-2027', 1),
  ('bus', 'a large vehicle that carries many people.', 'We ride the yellow bus to school.', 'noun', 'grade1-2026-2027', 1),
  ('box', 'a container, usually with four sides, used to hold things.', 'He packed his toys into a big box.', 'noun', 'grade1-2026-2027', 1),
  ('fun', 'enjoyable and full of happiness.', 'The field trip was really fun.', 'adjective', 'grade1-2026-2027', 1),
  ('milk', 'a white drink that comes from cows and other animals.', 'I drink a glass of milk with breakfast.', 'noun', 'grade1-2026-2027', 1),
  ('jump', 'to push off the ground with your legs into the air.', 'The kids like to jump on the trampoline.', 'verb', 'grade1-2026-2027', 1)
on conflict (word, grade_level) do nothing;

insert into words (word, meaning, sentence, part_of_speech, list_version, grade_level) values
  ('happy', 'feeling good and cheerful.', 'She felt happy when she opened her birthday present.', 'adjective', 'grade2-2026-2027', 2),
  ('chair', 'a piece of furniture you sit on.', 'He pulled up a chair to the table.', 'noun', 'grade2-2026-2027', 2),
  ('whale', 'a very large animal that lives in the ocean.', 'We saw a whale splash near the boat.', 'noun', 'grade2-2026-2027', 2),
  ('train', 'a long vehicle that runs on tracks and carries people or goods.', 'The train pulled into the station right on time.', 'noun', 'grade2-2026-2027', 2),
  ('brush', 'a tool with bristles used for cleaning, painting, or grooming hair.', 'Remember to brush your teeth before bed.', 'noun', 'grade2-2026-2027', 2),
  ('small', 'little in size.', 'The kitten was too small to jump onto the couch.', 'adjective', 'grade2-2026-2027', 2),
  ('plant', 'a living thing that grows in soil, like a flower or tree.', 'We watered the plant every morning.', 'noun', 'grade2-2026-2027', 2),
  ('sunny', 'bright with sunshine.', 'It was a sunny day, perfect for the beach.', 'adjective', 'grade2-2026-2027', 2),
  ('lunch', 'the meal eaten in the middle of the day.', 'We eat lunch together at noon.', 'noun', 'grade2-2026-2027', 2),
  ('smile', 'to curve your mouth up to show you''re happy.', 'She couldn''t help but smile at the funny joke.', 'verb', 'grade2-2026-2027', 2),
  ('snack', 'a small amount of food eaten between meals.', 'He had crackers as an afternoon snack.', 'noun', 'grade2-2026-2027', 2),
  ('stone', 'a small piece of rock.', 'She skipped a stone across the lake.', 'noun', 'grade2-2026-2027', 2),
  ('apple', 'a round fruit that can be red, green, or yellow.', 'I packed an apple in my lunch box.', 'noun', 'grade2-2026-2027', 2),
  ('dream', 'a series of thoughts or images that happen while you sleep.', 'I had a strange dream about flying.', 'noun', 'grade2-2026-2027', 2),
  ('crawl', 'to move slowly on your hands and knees.', 'The baby started to crawl across the floor.', 'verb', 'grade2-2026-2027', 2),
  ('spend', 'to use money to buy something, or to use time doing something.', 'We spend every summer visiting our grandparents.', 'verb', 'grade2-2026-2027', 2),
  ('thank', 'to tell someone you are grateful.', 'I want to thank you for the gift.', 'verb', 'grade2-2026-2027', 2),
  ('class', 'a group of students who learn together.', 'Our class went on a field trip to the zoo.', 'noun', 'grade2-2026-2027', 2),
  ('shape', 'the outline or form of something, like a circle or square.', 'The cloud had the shape of a dragon.', 'noun', 'grade2-2026-2027', 2),
  ('plane', 'a flying vehicle with wings and engines.', 'We watched the plane take off from the runway.', 'noun', 'grade2-2026-2027', 2)
on conflict (word, grade_level) do nothing;

insert into words (word, meaning, sentence, part_of_speech, list_version, grade_level) values
  ('because', 'for the reason that.', 'She stayed inside because it was raining.', 'conjunction', 'grade3-2026-2027', 3),
  ('special', 'better or more important than usual.', 'Today is a special day — it''s her birthday.', 'adjective', 'grade3-2026-2027', 3),
  ('different', 'not the same as another thing.', 'The twins have very different personalities.', 'adjective', 'grade3-2026-2027', 3),
  ('remember', 'to keep something in your mind or recall it later.', 'Please remember to bring your umbrella.', 'verb', 'grade3-2026-2027', 3),
  ('sentence', 'a group of words that expresses a complete thought.', 'She wrote a long sentence about her summer vacation.', 'noun', 'grade3-2026-2027', 3),
  ('together', 'with each other, in the same place or time.', 'The friends walked to school together.', 'adverb', 'grade3-2026-2027', 3),
  ('favorite', 'liked more than all others.', 'Pizza is my favorite food.', 'adjective', 'grade3-2026-2027', 3),
  ('another', 'one more, or a different one.', 'Can I have another cookie, please?', 'pronoun', 'grade3-2026-2027', 3),
  ('morning', 'the early part of the day, before noon.', 'We go for a walk every morning.', 'noun', 'grade3-2026-2027', 3),
  ('picture', 'a drawing, painting, or photograph of something.', 'She hung a picture of her family on the wall.', 'noun', 'grade3-2026-2027', 3),
  ('hundred', 'the number 100.', 'There were about a hundred people at the fair.', 'noun', 'grade3-2026-2027', 3),
  ('thirsty', 'feeling like you need to drink something.', 'After running, he was very thirsty.', 'adjective', 'grade3-2026-2027', 3),
  ('promise', 'to say you will definitely do something.', 'I promise to clean my room after lunch.', 'verb', 'grade3-2026-2027', 3),
  ('journey', 'a long trip from one place to another.', 'The family began their journey across the country.', 'noun', 'grade3-2026-2027', 3),
  ('island', 'a piece of land completely surrounded by water.', 'They took a boat to a small island.', 'noun', 'grade3-2026-2027', 3),
  ('gentle', 'kind, soft, and calm.', 'She gave the puppy a gentle pat on the head.', 'adjective', 'grade3-2026-2027', 3),
  ('whisper', 'to speak very softly and quietly.', 'He had to whisper so he wouldn''t wake the baby.', 'verb', 'grade3-2026-2027', 3),
  ('harvest', 'the gathering of crops that are ready to eat.', 'Farmers work hard during the fall harvest.', 'noun', 'grade3-2026-2027', 3),
  ('treasure', 'a collection of valuable things, like gold or jewels.', 'The pirates buried their treasure on the island.', 'noun', 'grade3-2026-2027', 3),
  ('complete', 'having all the parts; finished.', 'Make sure your homework is complete before dinner.', 'adjective', 'grade3-2026-2027', 3),
  ('mystery', 'something that is difficult to explain or understand.', 'The missing cookies were a real mystery.', 'noun', 'grade3-2026-2027', 3),
  ('crayon', 'a stick of colored wax used for drawing.', 'She colored the sky with a blue crayon.', 'noun', 'grade3-2026-2027', 3),
  ('holiday', 'a special day when people celebrate or don''t have to work or go to school.', 'Our favorite holiday is Thanksgiving.', 'noun', 'grade3-2026-2027', 3),
  ('kitchen', 'the room in a house where food is cooked.', 'Grandma was baking cookies in the kitchen.', 'noun', 'grade3-2026-2027', 3),
  ('library', 'a place with many books that people can read or borrow.', 'We checked out three books from the library.', 'noun', 'grade3-2026-2027', 3)
on conflict (word, grade_level) do nothing;

insert into words (word, meaning, sentence, part_of_speech, list_version, grade_level) values
  ('achieve', 'to successfully reach a goal through effort.', 'She trained all year to achieve her personal best.', 'verb', 'grade5-2026-2027', 5),
  ('guarantee', 'to promise that something will definitely happen or be true.', 'The store will guarantee a refund if you''re not satisfied.', 'verb', 'grade5-2026-2027', 5),
  ('necessary', 'needed in order for something to happen.', 'A good night''s sleep is necessary before a big test.', 'adjective', 'grade5-2026-2027', 5),
  ('occasion', 'a particular time or event.', 'We saved the fancy dishes for a special occasion.', 'noun', 'grade5-2026-2027', 5),
  ('embarrass', 'to make someone feel awkward, ashamed, or self-conscious.', 'He didn''t want to embarrass his sister in front of her friends.', 'verb', 'grade5-2026-2027', 5),
  ('definitely', 'without any doubt; certainly.', 'We will definitely go to the game if it doesn''t rain.', 'adverb', 'grade5-2026-2027', 5),
  ('government', 'the group of people who officially run a country, state, or city.', 'The government passed a new law about clean water.', 'noun', 'grade5-2026-2027', 5),
  ('environment', 'the natural world, including land, air, water, plants, and animals.', 'Recycling helps protect the environment.', 'noun', 'grade5-2026-2027', 5),
  ('independence', 'freedom from being controlled by another person or country.', 'The colony fought for its independence.', 'noun', 'grade5-2026-2027', 5),
  ('recommend', 'to suggest that something is good or suitable.', 'My teacher would recommend that book to anyone who likes mysteries.', 'verb', 'grade5-2026-2027', 5),
  ('particular', 'specific, or relating to one thing rather than others in general.', 'There was one particular song stuck in her head all day.', 'adjective', 'grade5-2026-2027', 5),
  ('immediately', 'right away, without any delay.', 'Come inside immediately — it''s starting to storm.', 'adverb', 'grade5-2026-2027', 5),
  ('vocabulary', 'all the words a person knows or uses.', 'Reading every night has really grown her vocabulary.', 'noun', 'grade5-2026-2027', 5),
  ('convenience', 'the quality of being easy or useful for someone.', 'The corner store is known for its convenience.', 'noun', 'grade5-2026-2027', 5),
  ('appreciate', 'to be thankful for something, or to understand its true value.', 'I really appreciate you helping me move these boxes.', 'verb', 'grade5-2026-2027', 5),
  ('apparent', 'clear and easy to see or understand.', 'It was apparent that he had practiced his lines a lot.', 'adjective', 'grade5-2026-2027', 5),
  ('enthusiasm', 'strong excitement or interest in something.', 'The new coach brought a lot of enthusiasm to the team.', 'noun', 'grade5-2026-2027', 5),
  ('magnificent', 'extremely beautiful, grand, or impressive.', 'The view from the mountaintop was magnificent.', 'adjective', 'grade5-2026-2027', 5),
  ('opportunity', 'a chance to do something.', 'The internship was a great opportunity to learn new skills.', 'noun', 'grade5-2026-2027', 5),
  ('unfortunately', 'used to say something disappointing or unlucky happened.', 'Unfortunately, the picnic was canceled because of the rain.', 'adverb', 'grade5-2026-2027', 5),
  ('temperature', 'a measurement of how hot or cold something is.', 'The temperature dropped quickly after the sun went down.', 'noun', 'grade5-2026-2027', 5),
  ('disappoint', 'to fail to meet someone''s hopes or expectations.', 'He didn''t want to disappoint his teammates by missing practice.', 'verb', 'grade5-2026-2027', 5),
  ('additional', 'more than what already exists; extra.', 'The teacher gave us an additional day to finish the project.', 'adjective', 'grade5-2026-2027', 5),
  ('atmosphere', 'the layer of gases surrounding a planet, or the general mood of a place.', 'The campfire gave the campsite a cozy atmosphere.', 'noun', 'grade5-2026-2027', 5),
  ('population', 'the total number of people living in a place.', 'The population of the small town grew every year.', 'noun', 'grade5-2026-2027', 5),
  ('ceremony', 'a formal event held to mark an important occasion.', 'Her whole family came to the graduation ceremony.', 'noun', 'grade5-2026-2027', 5),
  ('marvelous', 'extremely good or pleasing; wonderful.', 'The chef prepared a marvelous three-course meal.', 'adjective', 'grade5-2026-2027', 5),
  ('sufficient', 'enough for a particular purpose.', 'We packed sufficient snacks for the whole road trip.', 'adjective', 'grade5-2026-2027', 5),
  ('courageous', 'brave in the face of danger or difficulty.', 'The firefighter made a courageous rescue from the burning building.', 'adjective', 'grade5-2026-2027', 5),
  ('imaginary', 'existing only in the mind; not real.', 'When she was little, she had an imaginary friend named Ruby.', 'adjective', 'grade5-2026-2027', 5)
on conflict (word, grade_level) do nothing;

insert into words (word, meaning, sentence, part_of_speech, list_version, grade_level) values
  ('conscience', 'an inner sense of right and wrong that guides your behavior.', 'His conscience wouldn''t let him keep the extra change the cashier gave him.', 'noun', 'grade6-2026-2027', 6),
  ('questionnaire', 'a set of written questions used to gather information from people.', 'Everyone at the school filled out a questionnaire about lunch options.', 'noun', 'grade6-2026-2027', 6),
  ('bureaucracy', 'a system of government or organization with many official rules and steps.', 'Getting the permit required going through a lot of bureaucracy.', 'noun', 'grade6-2026-2027', 6),
  ('miscellaneous', 'made up of a mix of different things that don''t fit one category.', 'The junk drawer was full of miscellaneous odds and ends.', 'adjective', 'grade6-2026-2027', 6),
  ('exaggerate', 'to describe something as bigger, better, or worse than it really is.', 'He tends to exaggerate how far he can throw a football.', 'verb', 'grade6-2026-2027', 6),
  ('controversy', 'a strong public disagreement about something.', 'The new stadium plan caused a lot of controversy in town.', 'noun', 'grade6-2026-2027', 6),
  ('phenomenon', 'a fact, event, or thing that is unusual or notable.', 'The northern lights are a beautiful natural phenomenon.', 'noun', 'grade6-2026-2027', 6),
  ('privilege', 'a special right or advantage given to a person or group.', 'It''s a privilege to be picked as team captain.', 'noun', 'grade6-2026-2027', 6),
  ('resilience', 'the ability to recover quickly from difficulties.', 'Her resilience helped her bounce back after a tough season.', 'noun', 'grade6-2026-2027', 6),
  ('unanimous', 'fully agreed on by everyone.', 'The vote to end class early was unanimous.', 'adjective', 'grade6-2026-2027', 6),
  ('subordinate', 'lower in rank or importance than something else.', 'In the story, the knight was subordinate to the king.', 'adjective', 'grade6-2026-2027', 6),
  ('perpendicular', 'at a right angle (90 degrees) to something else.', 'The wall was built perpendicular to the fence.', 'adjective', 'grade6-2026-2027', 6),
  ('ambiguous', 'having more than one possible meaning; unclear.', 'The directions were so ambiguous that we got lost twice.', 'adjective', 'grade6-2026-2027', 6),
  ('hierarchy', 'a system that ranks people or things one above another.', 'The ant colony has a clear hierarchy led by the queen.', 'noun', 'grade6-2026-2027', 6),
  ('collaborate', 'to work together with others on a project.', 'The two classes decided to collaborate on the science fair project.', 'verb', 'grade6-2026-2027', 6),
  ('plagiarism', 'using someone else''s words or ideas and presenting them as your own.', 'The teacher explained why plagiarism is never allowed in essays.', 'noun', 'grade6-2026-2027', 6),
  ('coincidence', 'when two things happen at the same time by chance, without being planned.', 'It was quite a coincidence that we wore matching shirts.', 'noun', 'grade6-2026-2027', 6),
  ('legitimate', 'real, genuine, or allowed according to the rules.', 'He had a legitimate excuse for turning in the assignment late.', 'adjective', 'grade6-2026-2027', 6),
  ('sustainable', 'able to continue over time without running out or causing harm.', 'The farm uses sustainable methods to protect the soil.', 'adjective', 'grade6-2026-2027', 6),
  ('hypothesis', 'an idea or explanation that can be tested with an experiment.', 'Our hypothesis was that plants grow faster with more sunlight.', 'noun', 'grade6-2026-2027', 6),
  ('infrastructure', 'the basic systems a place needs, like roads, bridges, and power lines.', 'The city invested in new infrastructure after the storm.', 'noun', 'grade6-2026-2027', 6),
  ('entrepreneur', 'a person who starts and runs their own business.', 'She became an entrepreneur after opening her own bakery.', 'noun', 'grade6-2026-2027', 6),
  ('deteriorate', 'to become progressively worse.', 'The old bridge began to deteriorate after years of heavy traffic.', 'verb', 'grade6-2026-2027', 6),
  ('jurisdiction', 'the official power or authority to make legal decisions in an area.', 'The case fell under the jurisdiction of the state court.', 'noun', 'grade6-2026-2027', 6),
  ('perseverance', 'continued effort to do or achieve something despite difficulty.', 'It took real perseverance to finish the marathon after twisting her ankle.', 'noun', 'grade6-2026-2027', 6),
  ('reconnaissance', 'the act of gathering information about an area, often for military or exploration purposes.', 'The scouts went ahead on a quick reconnaissance of the trail.', 'noun', 'grade6-2026-2027', 6),
  ('camouflage', 'colors or patterns that help something blend in with its surroundings.', 'The chameleon''s camouflage made it almost invisible on the branch.', 'noun', 'grade6-2026-2027', 6),
  ('chronological', 'arranged in the order in which things happened.', 'She organized the photos in chronological order by year.', 'adjective', 'grade6-2026-2027', 6),
  ('idiosyncrasy', 'a unique habit or quirk that makes someone or something different.', 'One of his idiosyncrasies is always tapping his pencil before a test.', 'noun', 'grade6-2026-2027', 6),
  ('acquaintance', 'a person you know slightly, but who is not a close friend.', 'He ran into an old acquaintance from summer camp at the mall.', 'noun', 'grade6-2026-2027', 6),
  ('indispensable', 'absolutely necessary; impossible to do without.', 'A good map became indispensable once they left cell phone range.', 'adjective', 'grade6-2026-2027', 6),
  ('correspondence', 'letters or messages exchanged between people.', 'The museum displayed old correspondence between the two explorers.', 'noun', 'grade6-2026-2027', 6),
  ('extracurricular', 'describing an activity done outside of regular school classes.', 'Robotics club is her favorite extracurricular activity.', 'adjective', 'grade6-2026-2027', 6),
  ('conscientious', 'careful to do things correctly and thoroughly.', 'He''s a conscientious student who always double-checks his work.', 'adjective', 'grade6-2026-2027', 6),
  ('discrepancy', 'a difference between two things that should match.', 'There was a discrepancy between the two receipts, so she called the store.', 'noun', 'grade6-2026-2027', 6)
on conflict (word, grade_level) do nothing;

-- This is a private household app with no logins — Row Level Security stays
-- OFF on the children table too, same as the rest (see schema.sql's note).
