import fs from "node:fs";

const VERSION_IMPACTS = ["patch", "minor", "major", "none"];

const eventPath = process.env.GITHUB_EVENT_PATH;

if (!eventPath) {
  fail("GITHUB_EVENT_PATH is not defined.");
}

const event = readJsonFile(eventPath);
const pullRequest = event.pull_request;

if (!pullRequest) {
  fail("This script must run from a pull_request event.");
}

const body = pullRequest.body ?? "";
const versionImpactSection = extractVersionImpactSection(body);
const selectedImpacts = extractSelectedImpacts(versionImpactSection);

if (selectedImpacts.length !== 1) {
  const selected =
    selectedImpacts.length > 0 ? selectedImpacts.join(", ") : "none";

  fail(
    [
      "Exactly one Version Impact option must be selected.",
      `Found ${selectedImpacts.length} checked option(s): ${selected}.`,
      "Select exactly one of: patch, minor, major, none.",
    ].join(" "),
  );
}

const impact = selectedImpacts[0];

writeOutput("impact", impact);
writeOutput("should_release", impact === "none" ? "false" : "true");

console.log(`Version Impact: ${impact}`);

function extractVersionImpactSection(markdown) {
  const headingPattern = /^##[ \t]+Version Impact[ \t]*$/im;
  const headingMatch = headingPattern.exec(markdown);

  if (!headingMatch || headingMatch.index === undefined) {
    fail("The pull request must contain a '## Version Impact' section.");
  }

  const sectionStart = headingMatch.index + headingMatch[0].length;
  const contentAfterHeading = markdown.slice(sectionStart);

  const nextHeadingMatch = /^##[ \t]+.+$/m.exec(contentAfterHeading);

  if (!nextHeadingMatch || nextHeadingMatch.index === undefined) {
    return contentAfterHeading;
  }

  return contentAfterHeading.slice(0, nextHeadingMatch.index);
}

function extractSelectedImpacts(section) {
  const checkboxPattern =
    /^[ \t]*-[ \t]*\[([ xX])\][ \t]+\*\*(patch|minor|major|none)\*\*/gm;

  const selected = [];

  for (const match of section.matchAll(checkboxPattern)) {
    const checkedValue = match[1];
    const impact = match[2];

    if (checkedValue.toLowerCase() === "x") {
      selected.push(impact);
    }
  }

  return selected;
}

function readJsonFile(path) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (error) {
    fail(`Could not read GitHub event payload: ${error.message}`);
  }
}

function writeOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;

  if (!outputPath) {
    fail("GITHUB_OUTPUT is not defined.");
  }

  fs.appendFileSync(outputPath, `${name}=${value}\n`);
}

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}
