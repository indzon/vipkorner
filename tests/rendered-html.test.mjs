import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readAppStyles = async () => {
  const [layout, reskin] = await Promise.all([
    read("design/system/vipkorner-layout.css"),
    read("design/system/vipkorner-reskin.css"),
  ]);

  return `${layout}\n${reskin}`;
};

test("the visual theme preserves the proven responsive layout layer", async () => {
  const [globals, layout, reskin] = await Promise.all([
    read("app/globals.css"),
    read("design/system/vipkorner-layout.css"),
    read("design/system/vipkorner-reskin.css"),
  ]);

  assert.match(globals, /vipkorner-tokens\.css/);
  assert.match(globals, /vipkorner-layout\.css/);
  assert.match(globals, /vipkorner-reskin\.css/);
  assert.doesNotMatch(globals, /vipkorner-theme\.css/);
  assert.match(layout, /\.app-shell\s*\{/);
  assert.match(layout, /@media\s*\(max-width:\s*720px\)/);
  assert.match(reskin, /visual compatibility layer/i);
  assert.doesNotMatch(reskin, /grid-template-columns/);
});

test("the deployed marketing page matches its design source", async () => {
  const [source, deployed] = await Promise.all([
    read("design/marketing/index.html"),
    read("public/marketing.html"),
  ]);

  assert.equal(deployed, source);
});

test("the marketing page uses real app captures without a marquee", async () => {
  const marketing = await read("public/marketing.html");
  const captures = [
    "app-home@2x.png",
    "app-composer@2x.png",
    "app-explore@2x.png",
    "app-messages@2x.png",
    "story-1@2x.png",
    "story-2@2x.png",
    "story-3@2x.png",
    "story-4@2x.png",
    "app-signin@2x.png",
    "app-install@2x.png",
  ];

  captures.forEach((capture) => assert.match(marketing, new RegExp(`/shots/${capture.replace(".", "\\.")}`)));
  assert.doesNotMatch(marketing, /shot-hold|ticker-track|id="ticker"/);
  assert.match(marketing, /--site-gutter:20px/);
  assert.match(marketing, /\[data-parallax\]\{transform:none !important/);
});

test("connection lists remain scoped to the authenticated member", async () => {
  const socialRoute = await read("app/api/social/route.ts");

  assert.match(socialRoute, /params\.get\("list"\)/);
  assert.match(socialRoute, /list === "followers" \|\| list === "following"/);
  assert.match(socialRoute, /bind\(viewer\.id\)\.all\(\)/);
  assert.doesNotMatch(socialRoute, /params\.get\("userId"\)/);
});

test("profile counts refresh without a full page reload", async () => {
  const page = await read("app/page.tsx");

  assert.match(page, /fetch\("\/api\/social\?counts=1"\)/);
  assert.match(page, /window\.setInterval\(refresh, 15000\)/);
  assert.match(page, /window\.addEventListener\("focus", refresh\)/);
  assert.match(page, /onCounts\(result\.counts\)/);
  assert.match(page, /ConnectionListModal/);
});

test("member identity surfaces open profiles with activity avatars", async () => {
  const [page, css, feedRoute, socialRoute] = await Promise.all([
    read("app/page.tsx"),
    readAppStyles(),
    read("app/api/feed/route.ts"),
    read("app/api/social/route.ts"),
  ]);

  assert.match(page, /onViewProfile\(person\.id\)/);
  assert.match(page, /onViewProfile\(activity\.actorId\)/);
  assert.match(page, /className="activity-avatar"/);
  assert.match(page, /className="person-identity"/);
  assert.match(page, /startMemberConversation/);
  assert.match(page, /onMessage\(member\.id\)/);
  assert.match(page, /aria-label={`Message @\$\{member\.username\}`}/);
  assert.match(css, /\.profile-stats \{ display: flex;/);
  assert.match(css, /\.person-identity \{[^}]*align-items: flex-start;[^}]*text-align: left;/);
  assert.match(css, /\.member-message-button/);
  assert.match(feedRoute, /n\.actor_id AS actorId/);
  assert.match(feedRoute, /u\.display_name AS actorDisplayName/);
  assert.match(socialRoute, /params\.get\("profile"\)/);
  assert.doesNotMatch(socialRoute, /profileId[\s\S]*list=followers/);
});

test("repository documentation describes the deployed privacy contract", async () => {
  const [readme, architecture, operations] = await Promise.all([
    read("README.md"),
    read("docs/ARCHITECTURE.md"),
    read("docs/OPERATIONS.md"),
  ]);

  assert.match(readme, /signed-in member can open their own follower and following lists/i);
  assert.match(architecture, /callers cannot request another member’s list/i);
  assert.match(operations, /Push the exact deployed source revision to `indzon\/vipkorner`/);
});

test("unread navigation badges and persisted story reactions stay wired together", async () => {
  const [page, css, feedRoute, storiesRoute, schema, storage, readme, architecture, operations] = await Promise.all([
    read("app/page.tsx"),
    readAppStyles(),
    read("app/api/feed/route.ts"),
    read("app/api/stories/route.ts"),
    read("db/schema.ts"),
    read("db/storage.ts"),
    read("README.md"),
    read("docs/ARCHITECTURE.md"),
    read("docs/OPERATIONS.md"),
  ]);

  assert.match(page, /const unreadMessages = useMemo/);
  assert.match(page, /badge={unreadMessages}/);
  assert.match(page, /className="message-badge"/);
  assert.match(page, /STORY_REACTION_EMOJIS/);
  assert.match(page, /onReact={reactToStory}/);
  assert.match(css, /\.nav-badge, \.message-badge/);
  assert.match(css, /\.story-reactions/);
  assert.match(feedRoute, /AS reactionCount/);
  assert.match(feedRoute, /AS reactionsAllowed/);
  assert.match(storiesRoute, /STORY_REACTIONS/);
  assert.match(storiesRoute, /type = 'story_reaction'/);
  assert.match(schema, /storyReactions = sqliteTable\("story_reactions"/);
  assert.match(storage, /CREATE TABLE IF NOT EXISTS story_reactions/);
  assert.match(readme, /Unread totals appear/);
  assert.match(architecture, /one emoji per `\(story_id, user_id\)`/);
  assert.match(operations, /Messaging and story-reaction smoke test/);
});

test("carousel posts, viewed-story removal, and mobile conversation rows stay wired together", async () => {
  const [page, layout, feedRoute, uploadRoute, postsRoute, schema, storage, readme, architecture, operations] = await Promise.all([
    read("app/page.tsx"),
    read("design/system/vipkorner-layout.css"),
    read("app/api/feed/route.ts"),
    read("app/api/uploads/route.ts"),
    read("app/api/posts/route.ts"),
    read("db/schema.ts"),
    read("db/storage.ts"),
    read("README.md"),
    read("docs/ARCHITECTURE.md"),
    read("docs/OPERATIONS.md"),
  ]);

  assert.match(page, /slice\(0, 10 - files\.length\)/);
  assert.match(page, /itemCaptions/);
  assert.match(page, /postMediaItems\(post\)/);
  assert.match(page, /filter\(\(story\) => !story\.viewed\)/);
  assert.match(page, /new Map<string, Story>/);
  assert.match(page, /follow-success\.json/);
  assert.match(layout, /grid-auto-flow: column/);
  assert.match(feedRoute, /FROM post_media/);
  assert.match(uploadRoute, /INSERT INTO post_media/);
  assert.match(uploadRoute, /position > 9/);
  assert.match(postsRoute, /DELETE FROM post_media/);
  assert.match(schema, /postMedia = sqliteTable\("post_media"/);
  assert.match(schema, /post_media_post_position_uidx/);
  assert.match(storage, /CREATE TABLE IF NOT EXISTS post_media/);
  assert.match(readme, /carousels of up to 10 mixed images and videos/i);
  assert.match(architecture, /## Post carousels/);
  assert.match(operations, /Carousel and responsive UI smoke test/);
});
