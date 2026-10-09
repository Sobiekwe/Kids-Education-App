-- migration_018: points rebalance. Avatar prices are about 4x higher so one quiz
-- sitting can no longer buy the whole shop. Absolute values (not cost * 4), so it
-- is safe to run twice. Avatars a child already owns stay owned (child_avatars is
-- untouched). Free avatars (fox, panda) stay free.
-- Quiz payout changes in code: base 3 (was 5), speed bonus up to 2 (was 5),
-- streak bonus 5 per 5 correct in a row (was 10).

update avatars a set cost = v.cost
from (values
  ('lion', 80),
  ('frog', 80),
  ('tiger', 120),
  ('koala', 120),
  ('owl', 160),
  ('unicorn', 200),
  ('robot', 240),
  ('dragon', 260),
  ('dino', 300),
  ('shark', 360),
  ('wizard', 400),
  ('superhero', 480)
) as v(id, cost)
where a.id = v.id;
