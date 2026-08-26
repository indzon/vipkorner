import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

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
