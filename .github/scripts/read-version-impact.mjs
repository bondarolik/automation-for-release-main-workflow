import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const SUPPORTED_IMPACTS = new Set(["patch", "minor", "major", "none"]);

export class VersionImpactError extends Error {}

/**
 * Parse only the Version Impact H2 section of a pull request body.
 * Keeping this independent from GitHub Actions makes the release contract testable.
 */
export function parseVersionImpact(markdown) {
  const section = extractVersionImpactSection(markdown ?? "");
  const impacts = extractImpacts(section);
  const unsupported = impacts.find(({ impact }) => !SUPPORTED_IMPACTS.has(impact));
  if (unsupported) {
    throw new VersionImpactError(`Unsupported Version Impact: ${unsupported.impact}`);
  }
  const selectedImpacts = impacts.filter(({ selected }) => selected).map(({ impact }) => impact);

  if (selectedImpacts.length !== 1) {
    const description = selectedImpacts.length === 0 ? "none" : selectedImpacts.join(", ");
    throw new VersionImpactError(
      `Exactly one Version Impact option must be selected. Found ${selectedImpacts.length} selected option(s): ${description}. Select exactly one of: patch, minor, major, none.`,
    );
  }

  const impact = selectedImpacts[0];

  return { impact, shouldRelease: impact !== "none" };
}

export function extractVersionImpactSection(markdown) {
  const heading = /^##[ \t]+Version Impact[ \t]*$/im.exec(markdown);
  if (!heading || heading.index === undefined) {
    throw new VersionImpactError("The pull request must contain a '## Version Impact' section.");
  }

  const afterHeading = markdown.slice(heading.index + heading[0].length);
  const nextHeading = /^##[ \t]+.+$/m.exec(afterHeading);
  return nextHeading && nextHeading.index !== undefined
    ? afterHeading.slice(0, nextHeading.index)
    : afterHeading;
}

export function extractSelectedImpacts(section) {
  // The first label token after every checkbox is deliberately parsed, including
  // unsupported values, so a changed template cannot silently pass validation.
  return extractImpacts(section)
    .filter(({ selected }) => selected)
    .map(({ impact }) => impact);
}

export function extractImpacts(section) {
  const checkboxes = /^[ \t]*[-*+][ \t]*\[([ xX])\][ \t]+(?:\*\*)?([A-Za-z0-9_-]+)(?:\*\*)?(?:[ \t]|$)/gim;
  const impacts = [];

  for (const match of section.matchAll(checkboxes)) {
    impacts.push({
      impact: match[2].toLowerCase(),
      selected: match[1].toLowerCase() === "x",
    });
  }
  return impacts;
}

function fail(message) {
  console.error(`::error::${message}`);
  process.exitCode = 1;
}

function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!eventPath) return fail("GITHUB_EVENT_PATH is not defined.");
  if (!outputPath) return fail("GITHUB_OUTPUT is not defined.");

  try {
    const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    if (!event.pull_request) throw new VersionImpactError("This script must run from a GitHub pull_request event.");

    const { impact, shouldRelease } = parseVersionImpact(event.pull_request.body);
    fs.appendFileSync(outputPath, `impact=${impact}\nshould_release=${shouldRelease}\n`, "utf8");
    console.log(`Version Impact: ${impact}`);
    console.log(`Should create release tag and next version: ${shouldRelease}`);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
