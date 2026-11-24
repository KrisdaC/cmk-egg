import { test } from "node:test";
import assert from "node:assert/strict";
import { addDaysISO, diffDaysISO, firstOfMonthISO, todayBkk } from "./date";

// "now" instants chosen around the Bangkok/UTC midnight gap (Bangkok = UTC+7).
test("todayBkk: Bangkok date, not the UTC date", () => {
  // 2026-11-23 18:30 UTC is already 24 Nov 01:30 in Bangkok
  assert.equal(todayBkk(new Date("2026-11-23T18:30:00Z")), "2026-11-24");
  // 2026-11-24 16:59 UTC is still 24 Nov 23:59 in Bangkok
  assert.equal(todayBkk(new Date("2026-11-24T16:59:00Z")), "2026-11-24");
  // 2026-11-24 17:00 UTC is 25 Nov 00:00 in Bangkok
  assert.equal(todayBkk(new Date("2026-11-24T17:00:00Z")), "2026-11-25");
});

test("addDaysISO: the quick buttons on 24 Nov 2026", () => {
  assert.equal(addDaysISO("2026-11-24", -1), "2026-11-23"); // เมื่อวาน (was 22 Nov)
  assert.equal(addDaysISO("2026-11-24", 0), "2026-11-24");
  assert.equal(addDaysISO("2026-11-24", 1), "2026-11-25"); // พรุ่งนี้ (was 24 Nov)
});

test("addDaysISO: month, year and leap-year boundaries", () => {
  assert.equal(addDaysISO("2026-11-30", 1), "2026-12-01");
  assert.equal(addDaysISO("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysISO("2027-01-01", -1), "2026-12-31");
  assert.equal(addDaysISO("2028-02-28", 1), "2028-02-29");
  assert.equal(addDaysISO("2027-02-28", 1), "2027-03-01");
  assert.equal(addDaysISO("2026-11-24", 6), "2026-11-30");
});

test("addDaysISO: accepts a timestamp-ish string (date part only)", () => {
  assert.equal(addDaysISO("2026-11-24T00:00:00.000Z", -2), "2026-11-22");
});

test("firstOfMonthISO / diffDaysISO", () => {
  assert.equal(firstOfMonthISO("2026-11-24"), "2026-11-01");
  assert.equal(diffDaysISO("2026-11-24", "2026-11-26"), 2);
  assert.equal(diffDaysISO("2026-12-31", "2027-01-01"), 1);
});
