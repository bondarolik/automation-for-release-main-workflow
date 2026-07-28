import test from "node:test";
import assert from "node:assert/strict";
import { VersionImpactError, parseVersionImpact } from "./read-version-impact.mjs";

const section = (lines) => `## Version Impact\n\n${lines.join("\n")}`;
const options = (selected, labels = ["patch", "minor", "major", "none"]) =>
  section(labels.map((label) => `- [${selected.includes(label) ? "x" : " "}] **${label}** — description`));

for (const impact of ["patch", "minor", "major", "none"]) {
  test(`${impact} is accepted`, () => {
    assert.deepEqual(parseVersionImpact(options([impact])), {
      impact,
      shouldRelease: impact !== "none",
    });
  });
}

test("rejects no selected option", () => assert.throws(() => parseVersionImpact(options([])), VersionImpactError));
test("rejects two selected options", () => assert.throws(() => parseVersionImpact(options(["patch", "minor"])), VersionImpactError));
test("rejects a missing section", () => assert.throws(() => parseVersionImpact("## Description\ntext"), /Version Impact/));
test("ignores checkbox sections outside Version Impact", () => {
  const body = `${options(["patch"])}\n\n## Ephemeral Provisioning\n- [x] Do a thing`;
  assert.equal(parseVersionImpact(body).impact, "patch");
});
test("accepts uppercase checked boxes", () => assert.equal(parseVersionImpact(options(["minor"]).replace("[x]", "[X]")).impact, "minor"));
test("accepts non-bold labels and descriptions", () => {
  assert.equal(parseVersionImpact(section(["- [x] patch — a description", "- [ ] minor more text"])).impact, "patch");
});
test("rejects a selected unsupported value", () => {
  assert.throws(() => parseVersionImpact(section(["- [x] **breaking** — unsupported"])), /Unsupported/);
});
test("rejects an unsupported option even when it is unchecked", () => {
  assert.throws(() => parseVersionImpact(section(["- [x] patch", "- [ ] experimental"])), /Unsupported/);
});
