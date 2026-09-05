import assert from "node:assert/strict";
import test from "node:test";
import { lessons } from "../src/curriculum.ts";
import { normalizeCommand, runSimulatedCommand } from "../src/terminal.ts";
import { canCompleteLesson, emptyProgress, parseProgress, verifyLesson, type LessonProgress } from "../src/learning.ts";

test("simulation returns example outputs without claiming local installation", () => {
  for (const command of ["docker --version", "kind version", "kubectl version --client", "docker run --rm hello-world"]) {
    const result = runSimulatedCommand(command);
    assert.equal(result.ok, true);
    assert.match(result.output, /example|模拟/i);
    assert.doesNotMatch(result.output, /darwin\/arm64|Your installation appears/);
  }
});

function completedExample(): LessonProgress {
  return {
    ...emptyProgress,
    concept: true, quiz: true, verified: true, completed: true,
    commands: ["docker --version", "kind version", "kubectl version --client"],
    records: [
      { command: "docker --version", ok: true, output: "Docker version 29.0.0 (example)" },
      { command: "kind version", ok: true, output: "kind v0.29.0 (example)" },
      { command: "kubectl version --client", ok: true, output: "Client Version: v1.34.0 (example)" },
    ],
  };
}

test("self-check identifies missing execution and cannot use command history alone", () => {
  const result = verifyLesson(lessons[0], { ...emptyProgress, commands: completedExample().commands });
  assert.equal(result.passed, false);
  assert.deepEqual(result.missingCommands, ["docker --version", "kind version", "kubectl version --client"]);
  assert.deepEqual(result.missingEvidence, ["Docker version", "kind v", "Client Version"]);
});

test("self-check uses current lesson records and rejects failed or misplaced evidence", () => {
  const progress = completedExample();
  assert.equal(verifyLesson(lessons[0], progress).passed, true);
  assert.equal(verifyLesson(lessons[1], progress).passed, false);
  progress.records[1].ok = false;
  assert.deepEqual(verifyLesson(lessons[0], progress).missingCommands, ["kind version"]);
  assert.deepEqual(verifyLesson(lessons[0], progress).missingEvidence, ["kind v"]);
  progress.records[1].ok = true;
  progress.records[1].output = "Client Version: v1.34.0";
  progress.records[2].output = "kind v0.29.0";
  assert.equal(verifyLesson(lessons[0], progress).passed, false);
});

test("latest command attempt replaces stale success and normalizes whitespace", () => {
  const progress = completedExample();
  progress.records[0].command = "  docker\t --version  ";
  assert.equal(verifyLesson(lessons[0], progress).passed, true);
  progress.records.push({ command: "docker --version", ok: false, output: "Docker version unavailable" });
  assert.equal(verifyLesson(lessons[0], progress).passed, false);
  assert.deepEqual(verifyLesson(lessons[0], progress).missingCommands, ["docker --version"]);
});

test("completion requires every learning gate and fresh command evidence", () => {
  assert.equal(canCompleteLesson(lessons[0], completedExample()), true);
  for (const gate of ["concept", "quiz", "verified"] as const) {
    assert.equal(canCompleteLesson(lessons[0], { ...completedExample(), [gate]: false }), false, gate);
  }
  assert.equal(canCompleteLesson(lessons[0], { ...completedExample(), records: [] }), false);
  assert.equal(canCompleteLesson(lessons[0], { ...completedExample(), completed: false }), true);
});

test("malformed saved JSON and invalid root shapes do not crash progress loading", () => {
  for (const raw of [null, "", "{", "null", "true", "9", "[]", '"text"', '{"00":null,"01":[],"02":"done"}']) {
    assert.deepEqual(parseProgress(raw), {}, String(raw));
  }
});

test("old v3 progress preserves valid study work but cannot assert unrecorded completion", () => {
  const progress = parseProgress(JSON.stringify({
    "00": { concept: true, quiz: true, verified: true, completed: true, commands: ["docker --version", "docker --version", "unknown"] },
    "01": { concept: "true", quiz: 1, verified: true, completed: true, commands: "docker ps" },
    "unknown": completedExample(),
  }));
  assert.equal(progress["00"].concept, true);
  assert.equal(progress["00"].quiz, false);
  assert.deepEqual(progress["00"].commands, ["docker --version"]);
  assert.deepEqual(progress["00"].records, []);
  assert.equal(progress["00"].verified, false);
  assert.equal(progress["00"].completed, false);
  assert.deepEqual(progress["01"], emptyProgress);
  assert.equal(progress.unknown, undefined);
});

test("valid saved completion survives recovery and missing gates invalidate completion", () => {
  assert.deepEqual(parseProgress(JSON.stringify({ "00": completedExample() }))["00"], completedExample());
  for (const change of [{ concept: false }, { quiz: false }, { verified: false }, { records: [] }]) {
    assert.equal(parseProgress(JSON.stringify({ "00": { ...completedExample(), ...change } }))["00"].completed, false);
  }
});

test("obsolete quiz credit cannot complete the new curriculum after commands are rerun", () => {
  for (const curriculumVersion of [undefined, 0, 3, 5, "4", null]) {
    const migrated = parseProgress(JSON.stringify({ "00": {
      ...completedExample(), curriculumVersion,
    } }))["00"];
    assert.equal(migrated.concept, true);
    assert.equal(migrated.quiz, false, String(curriculumVersion));
    assert.equal(migrated.completed, false, String(curriculumVersion));
    migrated.records = completedExample().records;
    migrated.verified = verifyLesson(lessons[0], migrated).passed;
    assert.equal(canCompleteLesson(lessons[0], migrated), false);
    migrated.quiz = true;
    assert.equal(canCompleteLesson(lessons[0], migrated), true);
    assert.equal(parseProgress(JSON.stringify({ "00": migrated }))["00"].quiz, true);
  }
});

test("saved records filter foreign commands and malformed entries without losing valid work", () => {
  const progress = completedExample();
  const saved = parseProgress(JSON.stringify({ "00": {
    ...progress,
    commands: ["unknown", null, ...progress.commands],
    records: [null, {}, { command: "docker --version", output: 123, ok: true }, ...progress.records,
      { command: "docker ps", output: "CONTAINER ID", ok: true },
      { command: "docker --version", output: "bad", ok: "true" }],
  } }))["00"];
  assert.deepEqual(saved, progress);
});

test("every simulated lesson can be verified from its own records", () => {
  for (const lesson of lessons) {
    const progress = {
      ...emptyProgress,
      records: lesson.commands.map(({ command }) => ({ command, ...runSimulatedCommand(command) })),
    };
    assert.equal(verifyLesson(lesson, progress).passed, true, lesson.id);
  }
});

test("NotReady cannot satisfy the node Ready evidence", () => {
  const lesson = lessons[2];
  const progress = {
    ...emptyProgress,
    records: lesson.commands.map(({ command }) => ({ command, ...runSimulatedCommand(command) })),
  };
  progress.records[1].output = "NAME STATUS\nk8s-lab-control-plane NotReady";
  assert.deepEqual(verifyLesson(lesson, progress).missingEvidence, ["Ready"]);
});

test("record recovery reconciles command badges with the latest successful attempts", () => {
  const progress = completedExample();
  progress.commands = [];
  assert.deepEqual(parseProgress(JSON.stringify({ "00": progress }))["00"].commands,
    ["docker --version", "kind version", "kubectl version --client"]);
  progress.commands = ["docker --version", "kind version", "kubectl version --client"];
  progress.records.push({ command: "kind version", output: "unavailable", ok: false });
  const saved = parseProgress(JSON.stringify({ "00": progress }))["00"];
  assert.deepEqual(saved.commands, ["docker --version", "kubectl version --client"]);
  assert.equal(saved.verified, false);
  assert.equal(saved.completed, false);
});

test("old context-free query history migrates without claiming verification", () => {
  const saved = parseProgress(JSON.stringify({ "02": {
    concept: true, quiz: true, commands: ["kubectl get nodes", "kubectl get namespaces"], verified: true, completed: true,
  } }))["02"];
  assert.deepEqual(saved.commands, ["kubectl --context kind-k8s-lab get nodes", "kubectl --context kind-k8s-lab get namespaces"]);
  assert.equal(saved.verified, false);
  assert.equal(saved.completed, false);
});

test("explicit cluster context is supported and unsafe input is rejected", () => {
  const result = runSimulatedCommand("  kubectl   --context kind-k8s-lab\tget nodes  ");
  assert.equal(result.ok, true);
  assert.match(result.output, /Ready/);
  for (const command of ["kubectl --context production get nodes", "docker ps; whoami", "docker ps | more", "docker ps > out", "kubectl delete pod app", "__proto__", "constructor", "toString"]) {
    assert.equal(runSimulatedCommand(command).ok, false, command);
  }
  assert.equal(normalizeCommand("  docker\t ps \n"), "docker ps");
});

test("each lesson command runs and every quiz includes evidence to interpret", () => {
  for (const lesson of lessons) {
    assert.ok(lesson.quiz.evidence?.trim(), lesson.id);
    for (const { command } of lesson.commands) {
      assert.equal(runSimulatedCommand(command).ok, true, command);
      if (command.startsWith("kubectl") && !command.includes("version --client") && !command.includes("config current-context")) {
        assert.match(command, /--context kind-k8s-lab/, command);
      }
    }
  }
});
