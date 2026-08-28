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
  assert.match(deployed, />Shorts<\/a>/);
  assert.match(deployed, /24-hour Shorts/);
  assert.doesNotMatch(deployed, />Stories<\/a>/);
});

test("Shorts terminology is used across every user-facing app surface", async () => {
  const [page, login, layout, storiesRoute] = await Promise.all([
    read("app/page.tsx"),
    read("app/login/page.tsx"),
    read("app/layout.tsx"),
    read("app/api/stories/route.ts"),
  ]);

  assert.match(page, /aria-label="Shorts"/);
  assert.match(page, />Shorts<\/span>/);
  assert.match(page, />Add short<\/span>/);
  assert.match(page, /aria-label="Short"/);
  assert.match(page, /title="Short replies"/);
  assert.match(login, /24-hour shorts/);
  assert.match(layout, /24-hour shorts/);
  assert.match(storiesRoute, /Short not found/);
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
  assert.match(operations, /Messaging and Short-reaction smoke test/);
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
  assert.match(page, /FollowSuccessFeedback/);
  assert.match(page, /className="follow-success-mark"/);
  assert.match(page, /import\("lottie-web"\)/);
  assert.match(page, /path: "\/lottie\/follow-success\.json"/);
  assert.match(page, /animation\?\.destroy\(\)/);
  assert.match(layout, /grid-auto-flow: column/);
  assert.match(layout, /\.upload-drop\.story \{[^}]*padding: var\(--vk-space-6\) var\(--vk-space-7\);[^}]*text-align: center;/);
  assert.match(layout, /\.upload-drop\.story h3, \.upload-drop\.story p \{[^}]*width: 100%;[^}]*overflow-wrap: anywhere;/);
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

test("private profiles use approved follow requests and image-led member heroes", async () => {
  const [page, layout, reskin, feedRoute, socialRoute, schema, storage, readme, architecture, operations] = await Promise.all([
    read("app/page.tsx"),
    read("design/system/vipkorner-layout.css"),
    read("design/system/vipkorner-reskin.css"),
    read("app/api/feed/route.ts"),
    read("app/api/social/route.ts"),
    read("db/schema.ts"),
    read("db/storage.ts"),
    read("README.md"),
    read("docs/ARCHITECTURE.md"),
    read("docs/OPERATIONS.md"),
  ]);

  assert.doesNotMatch(page, />Public profile</);
  assert.match(page, /Request to Follow/);
  assert.match(page, /className="member-profile-banner"/);
  assert.match(page, /className="member-location"/);
  assert.match(page, /follow-request-response/);
  assert.match(layout, /\.member-profile-hero-content/);
  assert.match(layout, /\.member-profile-hero \{[^}]*overflow: visible;[^}]*margin-bottom: 72px;/s);
  assert.match(layout, /\.member-profile-photo-button \{[^}]*transform: translateY\(44px\);/s);
  assert.match(layout, /@media \(max-width: 720px\)[\s\S]*\.member-profile-photo-button \{ transform: translateY\(42px\); \}/);
  assert.match(reskin, /\.member-profile-hero \{[^}]*background: transparent;[^}]*border: 0;[^}]*box-shadow: none;/s);
  assert.match(reskin, /linear-gradient\(90deg/);
  assert.match(reskin, /linear-gradient\(180deg/);
  assert.match(feedRoute, /AS requestStatus/);
  assert.match(socialRoute, /INSERT INTO follow_requests/);
  assert.match(socialRoute, /INSERT OR IGNORE INTO follows/);
  assert.match(schema, /followRequests = sqliteTable\("follow_requests"/);
  assert.match(storage, /CREATE TABLE IF NOT EXISTS follow_requests/);
  assert.match(readme, /owner-approved request workflow/i);
  assert.match(architecture, /Pending requests never satisfy media queries/);
  assert.match(operations, /Private-profile request smoke test/);
});

test("member story entry points, branded safety prompts, and custom profile heroes stay wired together", async () => {
  const [page, layout, reskin, socialRoute, uploadRoute, currentUser, schema, storage] = await Promise.all([
    read("app/page.tsx"),
    read("design/system/vipkorner-layout.css"),
    read("design/system/vipkorner-reskin.css"),
    read("app/api/social/route.ts"),
    read("app/api/uploads/route.ts"),
    read("lib/current-user.ts"),
    read("db/schema.ts"),
    read("db/storage.ts"),
  ]);

  assert.match(page, /memberStories\.filter\(\(story\) => !story\.viewed\)/);
  assert.match(page, /member-profile-photo-button \$\{unseenStories\.length \? "has-unseen-story"/);
  assert.match(page, /onOpenStory\(unseenStories\[0\] \|\| memberStories\[0\]\)/);
  assert.match(page, /className={`member-follow-button/);
  assert.match(page, /className="brand-mark" aria-hidden="true">V/);
  assert.doesNotMatch(page, /confirm\(`Block/);
  assert.match(page, /"profile-hero"/);
  assert.match(page, /Profile background/);
  assert.match(layout, /\.profile-hero-row/);
  assert.match(reskin, /\.member-profile-photo-button\.has-unseen-story/);
  assert.match(reskin, /\.profile-modal \.form-fields input/);
  assert.match(reskin, /\.block-confirm-modal/);
  assert.match(socialRoute, /u\.hero_image_key AS heroImageKey/);
  assert.match(uploadRoute, /payload\.contentKind === "profile-hero"/);
  assert.match(currentUser, /hero_image_key AS heroImageKey/);
  assert.match(schema, /heroImageKey: text\("hero_image_key"\)/);
  assert.match(storage, /ADD COLUMN hero_image_key TEXT/);
});

test("feed identity, reactions, saves, follows, reports, and in-app sharing stay wired together", async () => {
  const [page, feedRoute, postsRoute, profileRoute, socialRoute, storage, theme] = await Promise.all([
    read("app/page.tsx"),
    read("app/api/feed/route.ts"),
    read("app/api/posts/route.ts"),
    read("app/api/profile/route.ts"),
    read("app/api/social/route.ts"),
    read("db/storage.ts"),
    read("design/system/vipkorner-reskin.css"),
  ]);

  assert.match(page, /post-author-avatar/);
  assert.match(page, /hasUnseenShorts/);
  assert.match(page, /onPointerUp=\{handleMediaPointerUp\}/);
  assert.match(page, /like-success\.json/);
  assert.match(page, /pendingPostActionsRef/);
  assert.match(page, /postActionEpochRef/);
  assert.match(page, /pendingPostActionsRef\.current\.has\(actionKey\)/);
  assert.match(page, /typeof result\.likes === "number" \? result\.likes : post\.likes/);
  assert.match(page, /function SharePostModal/);
  assert.match(page, /Shared @\$\{post\.author\.username\}'s post/);
  assert.match(page, /post-follow-button/);
  assert.match(page, /Hide post/);
  assert.match(page, /!post\.author\.following/);
  assert.match(page, /<Flag \/> <span>Report post<\/span>/);
  assert.match(page, /function ReportDialog/);
  assert.doesNotMatch(page, /window\.prompt/);
  assert.match(page, /Public saved collection/);
  assert.match(feedRoute, /authorFollowRequestStatus/);
  assert.match(postsRoute, /value === undefined \? !current : value/);
  assert.match(profileRoute, /savedCollectionPublic/);
  assert.match(socialRoute, /savedPostIds/);
  assert.match(storage, /saved_collection_public/);
  assert.match(storage, /CREATE TABLE IF NOT EXISTS hidden_posts/);
  assert.match(feedRoute, /FROM hidden_posts hp WHERE hp\.post_id = p\.id AND hp\.user_id = \?/);
  assert.match(postsRoute, /action === "hide"/);
  assert.match(theme, /post-menu \.post-menu-danger \{ display: flex; align-items: center/);
});

test("feed timestamps and media viewer controls follow the current interaction design", async () => {
  const [page, layout, reskin, operations] = await Promise.all([
    read("app/page.tsx"),
    read("design/system/vipkorner-layout.css"),
    read("design/system/vipkorner-reskin.css"),
    read("docs/OPERATIONS.md"),
  ]);

  const postCard = page.slice(page.indexOf("function PostCard"), page.indexOf("function Composer"));
  const memberProfile = page.slice(page.indexOf("function MemberProfileView"), page.indexOf("function ExploreView"));
  const explore = page.slice(page.indexOf("function ExploreView"), page.indexOf("function MessagesView"));
  const viewer = page.slice(page.indexOf("function MediaViewer"), page.indexOf("function EditProfileModal"));

  assert.match(postCard, /className="post-header-time" dateTime=\{new Date\(post\.createdAt\)\.toISOString\(\)\}/);
  assert.match(reskin, /\.post-header-time \{[^}]*text-transform: lowercase;/s);
  assert.doesNotMatch(postCard, /\{post\.author\.location\}/);
  assert.doesNotMatch(postCard, /<time>\{relativeTime\(post\.createdAt\)\}<\/time>/);
  assert.doesNotMatch(viewer, /viewer-media-controls|fitMode|setFitMode|setZoom/);
  assert.match(layout, /\.image-viewer-card \.media-viewer-stage img \{[^}]*object-fit: contain;/s);
  assert.match(reskin, /\.viewer-stats button:hover \{[^}]*background: var\(--vk-surface-hover\);/s);
  assert.match(reskin, /\.viewer-actions > button\.danger:hover \{[^}]*background: var\(--vk-danger-subtle\);/s);
  assert.match(operations, /## Feed timestamp and media-viewer smoke test/);
  assert.equal((memberProfile.match(/setFollowFeedback\(member!\.username\)/g) || []).length, 1);
  assert.equal((explore.match(/setFollowFeedback\(user\.username\)/g) || []).length, 1);
});

test("owner profile personalization and demo administrator follows remain explicit", async () => {
  const [page, profileRoute, sessionRoute, registration, currentUser, storage, seed, layout, reskin, architecture, operations] = await Promise.all([
    read("app/page.tsx"),
    read("app/api/profile/route.ts"),
    read("app/api/session/route.ts"),
    read("lib/registration.ts"),
    read("lib/current-user.ts"),
    read("db/storage.ts"),
    read("seed/vipkorner-community/seed.sql"),
    read("design/system/vipkorner-layout.css"),
    read("design/system/vipkorner-reskin.css"),
    read("docs/ARCHITECTURE.md"),
    read("docs/OPERATIONS.md"),
  ]);

  assert.match(page, /owner-profile-hero/);
  assert.match(page, /className="member-profile-banner"/);
  assert.match(page, /Show location on profile/);
  assert.match(page, /Location is required/);
  assert.match(page, /className="profile-save-actions"/);
  assert.match(page, /Unfollow @\{member\.username\}\?/);
  assert.match(profileRoute, /show_location = \?/);
  assert.match(profileRoute, /Location is required/);
  assert.match(currentUser, /show_location AS showLocation/);
  assert.match(storage, /admin_autofollow_v1/);
  assert.match(sessionRoute, /role = 'admin' AND status = 'active'/);
  assert.match(registration, /role = 'admin' AND status = 'active'/);
  assert.match(seed, /INSERT OR IGNORE INTO follows/);
  assert.match(layout, /\.member-profile-hero \{[^}]*border-radius: 24px;/s);
  assert.match(layout, /\.profile-stats > button:hover[^}]*text-decoration: none;/s);
  assert.match(reskin, /\.profile-save-button/);
  assert.match(architecture, /users\.show_location/);
  assert.match(operations, /Demo administrator-follow smoke test/);
});
