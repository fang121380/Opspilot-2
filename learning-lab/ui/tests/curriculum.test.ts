import assert from "node:assert/strict";
import test from "node:test";
import { lessons, modules } from "../src/curriculum.ts";
import {
  canCompleteLesson,
  emptyProgress,
  parseProgress,
  verifyLesson,
} from "../src/learning.ts";
import { runSimulatedCommand } from "../src/terminal.ts";

test("learning chain has unique IDs, ordered prerequisites and substantive chapter coverage", () => {
  const seen = new Set<string>();
  for (const lesson of lessons) {
    assert.ok(!seen.has(lesson.id), lesson.id);
    assert.ok(modules.some((module) => module.id === lesson.module));
    for (const prerequisite of lesson.prerequisites ?? [])
      assert.ok(
        seen.has(prerequisite),
        `${lesson.id} depends on earlier ${prerequisite}`,
      );
    seen.add(lesson.id);
    assert.equal(lesson.commands.length, lesson.evidence.length, lesson.id);
    if (/^0[0-4]$/.test(lesson.id)) continue;
    assert.ok((lesson.sections?.length ?? 0) >= 3, lesson.id);
    assert.ok(
      lesson.sections!.every((section) => section.body.length > 80),
      lesson.id,
    );
    assert.ok(lesson.challenge?.acceptance.length, lesson.id);
    assert.ok(lesson.challenge?.solution, lesson.id);
    assert.ok(
      lesson.references?.every((ref) =>
        /^https:\/\/(docs\.docker\.com|kind\.sigs\.k8s\.io|kubernetes\.io)\//.test(
          ref.url,
        ),
      ),
      lesson.id,
    );
  }
  for (const [module, minimum] of [
    ["docker", 7],
    ["kind", 5],
    ["kubernetes", 9],
    ["troubleshooting", 4],
  ] as const) {
    assert.ok(
      lessons.filter((lesson) => lesson.module === module).length >= minimum,
      module,
    );
  }
});

test("new course completion requires evidence, reflection and every self-assessment item", () => {
  for (const lesson of lessons.filter((lesson) => lesson.challenge)) {
    const base = {
      ...emptyProgress,
      concept: true,
      quiz: true,
      verified: true,
      completed: true,
      records: lesson.commands.map(({ command }) => ({
        command,
        ...runSimulatedCommand(command),
      })),
    };
    assert.equal(verifyLesson(lesson, base).passed, true, lesson.id);
    assert.equal(canCompleteLesson(lesson, base), false, lesson.id);
    const progress = {
      ...base,
      reflection: "原因与证据已记录；样例不代表实机。",
      acceptance: lesson.challenge!.acceptance.map((_, index) => index),
    };
    assert.equal(canCompleteLesson(lesson, progress), true);
    assert.equal(
      parseProgress(JSON.stringify({ [lesson.id]: progress }))[lesson.id]
        .completed,
      true,
    );
    assert.equal(
      canCompleteLesson(lesson, { ...progress, reflection: "  " }),
      false,
    );
    assert.equal(
      canCompleteLesson(lesson, {
        ...progress,
        acceptance: progress.acceptance.slice(1),
      }),
      false,
    );
    const damaged = parseProgress(
      JSON.stringify({
        [lesson.id]: {
          ...progress,
          reflection: {},
          acceptance: [-1, 900, "0", null],
        },
      }),
    )[lesson.id];
    assert.equal(damaged.completed, false);
    assert.deepEqual(damaged.acceptance, []);
  }
});

test("old five lesson completions survive expansion without granting new lesson credit", () => {
  const entries = lessons
    .filter((lesson) => /^0[0-4]$/.test(lesson.id))
    .map((lesson) => [
      lesson.id,
      {
        ...emptyProgress,
        concept: true,
        quiz: true,
        verified: true,
        completed: true,
        records: lesson.commands.map(({ command }) => ({
          command,
          ...runSimulatedCommand(command),
        })),
      },
    ]);
  const restored = parseProgress(JSON.stringify(Object.fromEntries(entries)));
  assert.equal(
    Object.values(restored).filter((entry) => entry.completed).length,
    5,
  );
  assert.equal(restored["docker-build"], undefined);
});
