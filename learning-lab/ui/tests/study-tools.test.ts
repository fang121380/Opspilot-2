import assert from "node:assert/strict";
import test from "node:test";
import { lessons } from "../src/curriculum.ts";
import { emptyProgress, parseProgress } from "../src/learning.ts";
import {
  exportStudyNotes,
  matchesStudy,
  noteCount,
  resolveManualHref,
  searchExcerpt,
  studyStatus,
} from "../src/study-tools.ts";

const build = lessons.find((lesson) => lesson.id === "docker-build")!;

test("study filters separate visited lessons, earned completion and review flags", () => {
  assert.equal(studyStatus(), "unstarted");
  assert.equal(studyStatus(emptyProgress), "unstarted");
  assert.equal(studyStatus({ ...emptyProgress, lastStep: 0 }), "started");
  assert.equal(studyStatus({ ...emptyProgress, completed: true }), "completed");
  assert.equal(
    matchesStudy(build, { ...emptyProgress, reviewNeeded: true }, "", "review"),
    true,
  );
  assert.equal(matchesStudy(build, undefined, "", "review"), false);
  assert.equal(
    matchesStudy(build, { ...emptyProgress, lastStep: 1 }, "", "unstarted"),
    false,
  );
  assert.equal(
    matchesStudy(build, { ...emptyProgress, completed: true }, "", "started"),
    false,
  );
});

test("search finds body concepts and commands and combines query terms", () => {
  assert.equal(matchesStudy(build, undefined, "COPY 缓存", "all"), true);
  assert.equal(matchesStudy(build, undefined, "docker HISTORY", "all"), true);
  assert.equal(
    matchesStudy(build, undefined, "COPY nonexistentxyz", "all"),
    false,
  );
  assert.match(searchExcerpt(build, "history"), /history/i);
  assert.equal(searchExcerpt(build, "  "), build.subtitle);
  const multi = lessons.find((lesson) => lesson.id === "docker-multistage")!;
  assert.equal(
    matchesStudy(multi, undefined, "CGO_ENABLED trimpath", "all"),
    true,
  );
  assert.match(searchExcerpt(multi, "CGO_ENABLED"), /CGO_ENABLED/);
});

test("review flags survive storage without granting learning credit", () => {
  for (const reviewNeeded of [true, false]) {
    const entry = parseProgress(
      JSON.stringify({ "00": { ...emptyProgress, reviewNeeded } }),
    )["00"];
    assert.equal(entry.reviewNeeded, reviewNeeded);
    assert.equal(entry.completed, false);
  }
  const entry = parseProgress(
    JSON.stringify({ "00": { reviewNeeded: "true" } }),
  )["00"];
  assert.equal(entry.reviewNeeded, undefined);
});

test("Markdown export preserves notes literally and excludes blank or foreign entries", () => {
  const reflection = "## 我的分析\n```\n<script>alert(1)</script>\n````\n尾行";
  const progress = {
    [build.id]: {
      ...emptyProgress,
      reflection,
      reviewNeeded: true,
      acceptance: [0],
    },
    "00": { ...emptyProgress, reflection: "  " },
    unrelated: { ...emptyProgress, reflection: "DO NOT EXPORT" },
  };
  assert.equal(noteCount(progress), 1);
  const text = exportStudyNotes(progress);
  assert.ok(text.includes("`````text\n" + reflection + "\n`````"));
  assert.match(text, /待复习/);
  assert.ok(text.includes(`- [x] ${build.challenge!.acceptance[0]}`));
  assert.ok(text.includes(`- [ ] ${build.challenge!.acceptance[1]}`));
  assert.doesNotMatch(text, /DO NOT EXPORT/);
  assert.equal(noteCount({}), 0);
});

test("manual links preserve local HTTP and official HTTPS and reject unsupported schemes", () => {
  assert.equal(
    resolveManualHref("http://127.0.0.1:8090"),
    "http://127.0.0.1:8090/",
  );
  assert.equal(
    resolveManualHref("https://docs.docker.com/"),
    "https://docs.docker.com/",
  );
  assert.equal(
    resolveManualHref("06-kind-project.md"),
    "https://github.com/fang121380/Opspilot-2/blob/main/learning-lab/labs/06-kind-project.md",
  );
  for (const unsafe of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///etc/passwd",
    "//evil.example/file.md",
    "https://name:password@example.com/",
  ]) {
    assert.equal(resolveManualHref(unsafe), undefined, unsafe);
  }
});
