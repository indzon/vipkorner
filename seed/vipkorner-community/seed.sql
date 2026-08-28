-- VipKorner fictional adult community seed.
-- Media must be uploaded to R2 under seed/community/ before executing.

INSERT INTO users (
  id, email, username, display_name, bio, website, location, show_location, image_key,
  image_url, role, status, is_public, story_replies,
  high_quality_uploads, adult_confirmed_at, created_at
) VALUES
  ('seed-maya-chen', 'mayawanders@seed.vipkorner.invalid', 'mayawanders', 'Maya Chen', 'Street photographs, long walks, and small city details.', '', 'New York, NY', 1, 'seed/community/mayawanders/avatar.jpg', NULL, 'user', 'active', 1, 1, 1, CAST(strftime('%s','now') AS INTEGER)*1000, CAST(strftime('%s','now') AS INTEGER)*1000 - 7776000000),
  ('seed-jordan-brooks', 'jordansunday@seed.vipkorner.invalid', 'jordansunday', 'Jordan Brooks', 'Movement, records, and making Sundays last a little longer.', '', 'Chicago, IL', 1, 'seed/community/jordansunday/avatar.jpg', NULL, 'user', 'active', 1, 1, 1, CAST(strftime('%s','now') AS INTEGER)*1000, CAST(strftime('%s','now') AS INTEGER)*1000 - 7257600000),
  ('seed-sofia-alvarez', 'sofiasupperclub@seed.vipkorner.invalid', 'sofiasupperclub', 'Sofia Alvarez', 'Cooking for friends and setting one more place at the table.', '', 'Brooklyn, NY', 1, 'seed/community/sofiasupperclub/avatar.jpg', NULL, 'user', 'active', 1, 1, 1, CAST(strftime('%s','now') AS INTEGER)*1000, CAST(strftime('%s','now') AS INTEGER)*1000 - 6739200000),
  ('seed-malik-thompson', 'malikmakes@seed.vipkorner.invalid', 'malikmakes', 'Malik Thompson', 'Furniture maker. Wood grain, good joints, and patient work.', '', 'Detroit, MI', 1, 'seed/community/malikmakes/avatar.jpg', NULL, 'user', 'active', 1, 1, 1, CAST(strftime('%s','now') AS INTEGER)*1000, CAST(strftime('%s','now') AS INTEGER)*1000 - 6220800000),
  ('seed-priya-nair', 'priyascope@seed.vipkorner.invalid', 'priyascope', 'Priya Nair', 'Architecture, books, and the light between buildings.', '', 'Boston, MA', 1, 'seed/community/priyascope/avatar.jpg', NULL, 'user', 'active', 1, 1, 1, CAST(strftime('%s','now') AS INTEGER)*1000, CAST(strftime('%s','now') AS INTEGER)*1000 - 5702400000),
  ('seed-theo-martin', 'theoonfilm@seed.vipkorner.invalid', 'theoonfilm', 'Theo Martin', 'Film editor, city cyclist, collector of quiet frames.', '', 'Philadelphia, PA', 1, 'seed/community/theoonfilm/avatar.jpg', NULL, 'user', 'active', 1, 1, 1, CAST(strftime('%s','now') AS INTEGER)*1000, CAST(strftime('%s','now') AS INTEGER)*1000 - 5184000000)
ON CONFLICT(id) DO UPDATE SET
  email=excluded.email,
  username=excluded.username,
  display_name=excluded.display_name,
  bio=excluded.bio,
  website=excluded.website,
  location=excluded.location,
  show_location=excluded.show_location,
  image_key=excluded.image_key,
  image_url=excluded.image_url,
  role=excluded.role,
  status=excluded.status,
  is_public=excluded.is_public,
  story_replies=excluded.story_replies,
  high_quality_uploads=excluded.high_quality_uploads;

-- Seeded demo members automatically follow the first active administrator.
INSERT OR IGNORE INTO follows (follower_id, followed_id, created_at)
SELECT seeded.id, admin.id, CAST(strftime('%s','now') AS INTEGER)*1000
FROM users seeded
CROSS JOIN (SELECT id FROM users WHERE role = 'admin' AND status = 'active' ORDER BY created_at ASC LIMIT 1) admin
WHERE seeded.id LIKE 'seed-%' AND seeded.status = 'active';

DELETE FROM posts WHERE id LIKE 'seed-post-%';

INSERT INTO posts (id, caption, image_key, image_url, media_type, likes, liked, saved, created_at, user_id) VALUES
  ('seed-post-maya-01', 'The rain finally let the city slow down.', 'seed/community/mayawanders/posts/01.jpg', NULL, 'image', 18, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 5400000, 'seed-maya-chen'),
  ('seed-post-maya-02', 'One camera, one map, no real plan.', 'seed/community/mayawanders/posts/02.jpg', NULL, 'image', 14, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 97200000, 'seed-maya-chen'),
  ('seed-post-maya-03', 'Fire escapes drawing their own skyline.', 'seed/community/mayawanders/posts/03.jpg', NULL, 'image', 22, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 259200000, 'seed-maya-chen'),
  ('seed-post-maya-04', 'Someone left spring on the downtown platform.', 'seed/community/mayawanders/posts/04.jpg', NULL, 'image', 17, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 432000000, 'seed-maya-chen'),
  ('seed-post-maya-05', 'Five quiet minutes above the traffic.', 'seed/community/mayawanders/posts/05.jpg', NULL, 'image', 29, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 691200000, 'seed-maya-chen'),
  ('seed-post-maya-06', 'Contact sheets over camera roll.', 'seed/community/mayawanders/posts/06.jpg', NULL, 'image', 12, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 1036800000, 'seed-maya-chen'),

  ('seed-post-jordan-01', 'Early miles before the city wakes.', 'seed/community/jordansunday/posts/01.jpg', NULL, 'image', 26, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 7200000, 'seed-jordan-brooks'),
  ('seed-post-jordan-02', 'Side A kind of afternoon.', 'seed/community/jordansunday/posts/02.jpg', NULL, 'image', 19, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 115200000, 'seed-jordan-brooks'),
  ('seed-post-jordan-03', 'Notebook, water, then one more round.', 'seed/community/jordansunday/posts/03.jpg', NULL, 'image', 15, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 288000000, 'seed-jordan-brooks'),
  ('seed-post-jordan-04', 'The court after the rain.', 'seed/community/jordansunday/posts/04.jpg', NULL, 'image', 21, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 475200000, 'seed-jordan-brooks'),
  ('seed-post-jordan-05', 'A listening corner earns its keep.', 'seed/community/jordansunday/posts/05.jpg', NULL, 'image', 13, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 734400000, 'seed-jordan-brooks'),
  ('seed-post-jordan-06', 'Took the long way home.', 'seed/community/jordansunday/posts/06.jpg', NULL, 'image', 24, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 950400000, 'seed-jordan-brooks'),
  ('seed-post-jordan-07', 'Recovery can taste this good.', 'seed/community/jordansunday/posts/07.jpg', NULL, 'image', 11, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 1296000000, 'seed-jordan-brooks'),

  ('seed-post-sofia-01', 'There is always room for one more.', 'seed/community/sofiasupperclub/posts/01.jpg', NULL, 'image', 31, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 10800000, 'seed-sofia-alvarez'),
  ('seed-post-sofia-02', 'Low heat and a little patience.', 'seed/community/sofiasupperclub/posts/02.jpg', NULL, 'image', 20, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 140400000, 'seed-sofia-alvarez'),
  ('seed-post-sofia-03', 'Citrus season doing the most.', 'seed/community/sofiasupperclub/posts/03.jpg', NULL, 'image', 27, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 345600000, 'seed-sofia-alvarez'),
  ('seed-post-sofia-04', 'Before the doorbell starts ringing.', 'seed/community/sofiasupperclub/posts/04.jpg', NULL, 'image', 16, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 604800000, 'seed-sofia-alvarez'),
  ('seed-post-sofia-05', 'Market color therapy.', 'seed/community/sofiasupperclub/posts/05.jpg', NULL, 'image', 23, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 1123200000, 'seed-sofia-alvarez'),

  ('seed-post-malik-01', 'Walnut shavings are the best kind of mess.', 'seed/community/malikmakes/posts/01.jpg', NULL, 'image', 19, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 14400000, 'seed-malik-thompson'),
  ('seed-post-malik-02', 'Good joinery should look inevitable.', 'seed/community/malikmakes/posts/02.jpg', NULL, 'image', 28, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 169200000, 'seed-malik-thompson'),
  ('seed-post-malik-03', 'These have been in the family a while.', 'seed/community/malikmakes/posts/03.jpg', NULL, 'image', 14, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 374400000, 'seed-malik-thompson'),
  ('seed-post-malik-04', 'Choosing the board is half the work.', 'seed/community/malikmakes/posts/04.jpg', NULL, 'image', 22, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 547200000, 'seed-malik-thompson'),
  ('seed-post-malik-05', 'Clamp, clean, wait.', 'seed/community/malikmakes/posts/05.jpg', NULL, 'image', 17, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 777600000, 'seed-malik-thompson'),
  ('seed-post-malik-06', 'Finally found its corner.', 'seed/community/malikmakes/posts/06.jpg', NULL, 'image', 34, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 993600000, 'seed-malik-thompson'),
  ('seed-post-malik-07', 'Paper first, wood second.', 'seed/community/malikmakes/posts/07.jpg', NULL, 'image', 18, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 1231200000, 'seed-malik-thompson'),
  ('seed-post-malik-08', 'Morning light in the shop.', 'seed/community/malikmakes/posts/08.jpg', NULL, 'image', 25, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 1555200000, 'seed-malik-thompson'),

  ('seed-post-priya-01', 'Late light makes the elevation.', 'seed/community/priyascope/posts/01.jpg', NULL, 'image', 21, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 18000000, 'seed-priya-nair'),
  ('seed-post-priya-02', 'Found the quiet table.', 'seed/community/priyascope/posts/02.jpg', NULL, 'image', 16, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 201600000, 'seed-priya-nair'),
  ('seed-post-priya-03', 'Thinking with paper again.', 'seed/community/priyascope/posts/03.jpg', NULL, 'image', 24, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 403200000, 'seed-priya-nair'),
  ('seed-post-priya-04', 'The best chapter of the ride.', 'seed/community/priyascope/posts/04.jpg', NULL, 'image', 13, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 648000000, 'seed-priya-nair'),
  ('seed-post-priya-05', 'Stairs doing more than stairs should.', 'seed/community/priyascope/posts/05.jpg', NULL, 'image', 30, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 907200000, 'seed-priya-nair'),
  ('seed-post-priya-06', 'Rain plan: tea, pages, plans.', 'seed/community/priyascope/posts/06.jpg', NULL, 'image', 18, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 1382400000, 'seed-priya-nair'),

  ('seed-post-theo-01', 'The marquee before the crowd.', 'seed/community/theoonfilm/posts/01.jpg', NULL, 'image', 27, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 21600000, 'seed-theo-martin'),
  ('seed-post-theo-02', 'Blue hour commuter.', 'seed/community/theoonfilm/posts/02.jpg', NULL, 'image', 19, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 230400000, 'seed-theo-martin'),
  ('seed-post-theo-03', 'One more cut, then dinner.', 'seed/community/theoonfilm/posts/03.jpg', NULL, 'image', 15, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 460800000, 'seed-theo-martin'),
  ('seed-post-theo-04', 'The city graded its own scene tonight.', 'seed/community/theoonfilm/posts/04.jpg', NULL, 'image', 33, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 820800000, 'seed-theo-martin'),
  ('seed-post-theo-05', 'Still love the sound of the reel.', 'seed/community/theoonfilm/posts/05.jpg', NULL, 'image', 20, 0, 0, CAST(strftime('%s','now') AS INTEGER)*1000 - 1468800000, 'seed-theo-martin');

DELETE FROM stories WHERE id LIKE 'seed-story-%';

INSERT INTO stories (id, caption, image_key, image_url, media_type, created_at, expires_at, user_id, caption_x, caption_y) VALUES
  ('seed-story-maya-01', 'Rainy windows, bright city.', 'seed/community/mayawanders/stories/01.jpg', NULL, 'image', CAST(strftime('%s','now') AS INTEGER)*1000 - 1800000, CAST(strftime('%s','now') AS INTEGER)*1000 + 84600000, 'seed-maya-chen', 50, 84),
  ('seed-story-maya-02', 'Worth the early alarm.', 'seed/community/mayawanders/stories/02.jpg', NULL, 'image', CAST(strftime('%s','now') AS INTEGER)*1000 - 14400000, CAST(strftime('%s','now') AS INTEGER)*1000 + 72000000, 'seed-maya-chen', 50, 82),
  ('seed-story-jordan-01', 'Out before the heat.', 'seed/community/jordansunday/stories/01.jpg', NULL, 'image', CAST(strftime('%s','now') AS INTEGER)*1000 - 3600000, CAST(strftime('%s','now') AS INTEGER)*1000 + 82800000, 'seed-jordan-brooks', 50, 84),
  ('seed-story-sofia-01', 'Table is almost ready.', 'seed/community/sofiasupperclub/stories/01.jpg', NULL, 'image', CAST(strftime('%s','now') AS INTEGER)*1000 - 5400000, CAST(strftime('%s','now') AS INTEGER)*1000 + 81000000, 'seed-sofia-alvarez', 50, 84),
  ('seed-story-sofia-02', 'Save room for this.', 'seed/community/sofiasupperclub/stories/02.jpg', NULL, 'image', CAST(strftime('%s','now') AS INTEGER)*1000 - 19800000, CAST(strftime('%s','now') AS INTEGER)*1000 + 66600000, 'seed-sofia-alvarez', 50, 82),
  ('seed-story-malik-01', 'Dust in the morning light.', 'seed/community/malikmakes/stories/01.jpg', NULL, 'image', CAST(strftime('%s','now') AS INTEGER)*1000 - 7200000, CAST(strftime('%s','now') AS INTEGER)*1000 + 79200000, 'seed-malik-thompson', 50, 84),
  ('seed-story-priya-01', 'Could stay here all afternoon.', 'seed/community/priyascope/stories/01.jpg', NULL, 'image', CAST(strftime('%s','now') AS INTEGER)*1000 - 9000000, CAST(strftime('%s','now') AS INTEGER)*1000 + 77400000, 'seed-priya-nair', 50, 84),
  ('seed-story-priya-02', 'Rain day reading list.', 'seed/community/priyascope/stories/02.jpg', NULL, 'image', CAST(strftime('%s','now') AS INTEGER)*1000 - 23400000, CAST(strftime('%s','now') AS INTEGER)*1000 + 63000000, 'seed-priya-nair', 50, 82),
  ('seed-story-theo-01', 'Last screening, then the ride home.', 'seed/community/theoonfilm/stories/01.jpg', NULL, 'image', CAST(strftime('%s','now') AS INTEGER)*1000 - 10800000, CAST(strftime('%s','now') AS INTEGER)*1000 + 75600000, 'seed-theo-martin', 50, 84);

DELETE FROM follows
WHERE follower_id LIKE 'seed-%' OR followed_id LIKE 'seed-%';

INSERT INTO follows (follower_id, followed_id, created_at) VALUES
  ('seed-maya-chen', 'seed-sofia-alvarez', CAST(strftime('%s','now') AS INTEGER)*1000 - 1209600000),
  ('seed-maya-chen', 'seed-priya-nair', CAST(strftime('%s','now') AS INTEGER)*1000 - 1036800000),
  ('seed-jordan-brooks', 'seed-maya-chen', CAST(strftime('%s','now') AS INTEGER)*1000 - 950400000),
  ('seed-jordan-brooks', 'seed-malik-thompson', CAST(strftime('%s','now') AS INTEGER)*1000 - 864000000),
  ('seed-sofia-alvarez', 'seed-maya-chen', CAST(strftime('%s','now') AS INTEGER)*1000 - 777600000),
  ('seed-sofia-alvarez', 'seed-priya-nair', CAST(strftime('%s','now') AS INTEGER)*1000 - 691200000),
  ('seed-malik-thompson', 'seed-jordan-brooks', CAST(strftime('%s','now') AS INTEGER)*1000 - 604800000),
  ('seed-malik-thompson', 'seed-theo-martin', CAST(strftime('%s','now') AS INTEGER)*1000 - 518400000),
  ('seed-priya-nair', 'seed-maya-chen', CAST(strftime('%s','now') AS INTEGER)*1000 - 432000000),
  ('seed-priya-nair', 'seed-sofia-alvarez', CAST(strftime('%s','now') AS INTEGER)*1000 - 345600000),
  ('seed-theo-martin', 'seed-malik-thompson', CAST(strftime('%s','now') AS INTEGER)*1000 - 259200000),
  ('seed-theo-martin', 'seed-jordan-brooks', CAST(strftime('%s','now') AS INTEGER)*1000 - 172800000);
