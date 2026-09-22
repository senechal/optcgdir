import { test } from "node:test";
import assert from "node:assert/strict";
import { rawCardImageId } from "./migrate-to-hash-ids.js";

test("returns the value unchanged when it was never suffixed", () => {
  assert.equal(rawCardImageId("OP01-001"), "OP01-001");
});

test("strips the '__<slug>' suffix added by the old collision-avoidance scheme", () => {
  assert.equal(rawCardImageId("OP17-006__kingdew"), "OP17-006");
});

test("only strips at the first '__', even if the slug itself contains more", () => {
  assert.equal(rawCardImageId("OP14-033__perona-extra-grand-battle-for-stores-2026"), "OP14-033");
});
