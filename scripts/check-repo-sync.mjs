import { execFileSync } from "node:child_process";

function git(...args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exitCode = 1;
}

let branch;
try {
  branch = git("rev-parse", "--abbrev-ref", "HEAD");
} catch {
  console.error("✖ Not inside a Git repository.");
  process.exit(1);
}

const head = git("rev-parse", "HEAD");
const status = git("status", "--porcelain");

let upstream;
try {
  upstream = git("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}");
} catch {
  console.log(`Branch:   ${branch}`);
  console.log(`HEAD:     ${head}`);
  fail("This branch has no upstream yet.");
  process.exit(process.exitCode ?? 1);
}

const upstreamHead = git("rev-parse", "@{u}");
const [aheadRaw, behindRaw] = git("rev-list", "--left-right", "--count", "HEAD...@{u}").split(/\s+/);
const ahead = Number(aheadRaw);
const behind = Number(behindRaw);

console.log(`Branch:   ${branch}`);
console.log(`Upstream: ${upstream}`);
console.log(`HEAD:     ${head}`);
console.log(`Remote:   ${upstreamHead}`);
console.log(`Ahead:    ${ahead}`);
console.log(`Behind:   ${behind}`);
console.log(`Dirty:    ${status ? "yes" : "no"}`);

if (status) fail("Working tree has uncommitted changes.");
if (ahead > 0) fail(`Local branch has ${ahead} commit(s) not pushed to GitHub.`);
if (behind > 0) fail(`Local branch is ${behind} commit(s) behind GitHub.`);

if (!status && ahead === 0 && behind === 0 && head === upstreamHead) {
  console.log("\n✔ Local branch is clean and synchronized with GitHub.");
}

process.exit(process.exitCode ?? 0);
