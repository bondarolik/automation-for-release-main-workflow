import fs from "node:fs";

const SUPPORTED_IMPACTS = new Set([
  "patch",
  "minor",
  "major",
  "none",
]);

const eventPath = process.env.GITHUB_EVENT_PATH;

if (!eventPath) {
  fail("GITHUB_EVENT_PATH is not defined.");
}

const event = readJsonFile(eventPath);
const pullRequest = event.pull_request;

if (!pullRequest) {
  fail("This script must run from a GitHub pull_request event.");
}

const body = pullRequest.body ?? "";
const versionImpactSection = extractVersionImpactSection(body);
const selectedImpacts = extractSelectedImpacts(versionImpactSection);

if (selectedImpacts.length !== 1) {
  const selectedDescription =
    selectedImpacts.length === 0
      ? "none"
      : selectedImpacts.join(", ");

  fail(
    [
      "Exactly one Version Impact option must be selected.",
      `Found ${selectedImpacts.length} selected option(s): ${selectedDescription}.`,
      "Select exactly one of: patch, minor, major, none.",
    ].join(" "),
  );
}

const impact = selectedImpacts[0];

if (!SUPPORTED_IMPACTS.has(impact)) {
  fail(`Unsupported Version Impact: ${impact}`);
}

writeOutput("impact", impact);
writeOutput("should_release", impact === "none" ? "false" : "true");

console.log(`Version Impact: ${impact}`);
console.log(
  `Should create release tag and next version: ${
    impact === "none" ? "false" : "true"
  }`,
);

function extractVersionImpactSection(markdown) {
  const headingPattern = /^##[ \t]+Version Impact[ \t]*$/im;
  const headingMatch = headingPattern.exec(markdown);

  if (!headingMatch || headingMatch.index === undefined) {
    fail("The pull request must contain a '## Version Impact' section.");
  }

  const sectionStart =
    headingMatch.index + headingMatch[0].length;

  const contentAfterHeading = markdown.slice(sectionStart);

  // Stop parsing at the next H2 section.
  const nextHeadingMatch = /^##[ \t]+.+$/m.exec(
    contentAfterHeading,
  );

  if (
    !nextHeadingMatch ||
    nextHeadingMatch.index === undefined
  ) {
    return contentAfterHeading;
  }

  return contentAfterHeading.slice(
    0,
    nextHeadingMatch.index,
  );
}

function extractSelectedImpacts(section) {
  /*
   * Supported examples:
   *
   * - [x] **patch**
   * - [X] patch
   * - [ ] **minor** — description
   */
  const checkboxPattern =
    /^[ \t]*-[ \t]*\[([ xX])\][ \t]+(?:\*\*)?(patch|minor|major|none)(?:\*\*)?(?:[ \t]|$)/gim;

  const selected = [];

  for (const match of section.matchAll(checkboxPattern)) {
    const checkedValue = match[1];
    const impact = match[2].toLowerCase();

    if (checkedValue.toLowerCase() === "x") {
      selected.push(impact);
    }
  }

  return selected;
}

function readJsonFile(path) {
  try {
    const contents = fs.readFileSync(path, "utf8");
    return JSON.parse(contents);
  } catch (error) {
    fail(
      `Could not read the GitHub event payload: ${error.message}`,
    );
  }
}

function writeOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;

  if (!outputPath) {
    fail("GITHUB_OUTPUT is not defined.");
  }

  fs.appendFileSync(
    outputPath,
    `${name}=${value}\n`,
    "utf8",
  );
}

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}
