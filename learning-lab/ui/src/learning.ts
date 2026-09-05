import { lessons, type Lesson } from "./curriculum.ts";
import { normalizeCommand } from "./terminal.ts";

export const CURRENT_CURRICULUM_VERSION = 4;

export type CommandRecord = { command: string; output: string; ok: boolean };
export type LessonProgress = {
  curriculumVersion?: number;
  concept: boolean;
  commands: string[];
  records: CommandRecord[];
  verified: boolean;
  quiz: boolean;
  completed: boolean;
};

export const emptyProgress: LessonProgress = {
  curriculumVersion: CURRENT_CURRICULUM_VERSION,
  concept: false, commands: [], records: [], verified: false, quiz: false, completed: false,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseProgress(raw: string | null): Record<string, LessonProgress> {
  let saved: unknown;
  try {
    saved = JSON.parse(raw ?? "{}");
  } catch {
    return {};
  }
  if (!isObject(saved)) return {};

  const restored: Record<string, LessonProgress> = {};
  for (const lesson of lessons) {
    const entry = saved[lesson.id];
    if (!isObject(entry)) continue;
    const allowed = new Set(lesson.commands.map(({ command }) => command));
    const legacyCommands = new Map(lesson.commands.map(({ command }) => [command.replace(" --context kind-k8s-lab", ""), command]));
    const commands = Array.isArray(entry.commands)
      ? entry.commands.filter((command): command is string => typeof command === "string")
        .map(normalizeCommand).map((command) => legacyCommands.get(command) ?? command)
        .filter((command) => allowed.has(command))
      : [];
    const records: CommandRecord[] = [];
    if (Array.isArray(entry.records)) {
      for (const record of entry.records) {
        if (!isObject(record) || typeof record.command !== "string" || typeof record.output !== "string" || typeof record.ok !== "boolean") continue;
        const command = normalizeCommand(record.command);
        if (allowed.has(command)) records.push({ command, output: record.output, ok: record.ok });
      }
    }
    const latest = new Map(records.map((record) => [record.command, record]));
    const successfulCommands = records.filter((record) => latest.get(record.command)?.ok).map((record) => record.command);
    const progress: LessonProgress = {
      curriculumVersion: CURRENT_CURRICULUM_VERSION,
      concept: entry.concept === true,
      commands: [...new Set([...commands, ...successfulCommands])].filter((command) => latest.get(command)?.ok !== false),
      records,
      verified: false,
      quiz: entry.curriculumVersion === CURRENT_CURRICULUM_VERSION && entry.quiz === true,
      completed: false,
    };
    progress.verified = entry.verified === true && verifyLesson(lesson, progress).passed;
    progress.completed = entry.completed === true && canCompleteLesson(lesson, progress);
    restored[lesson.id] = progress;
  }
  return restored;
}

export function verifyLesson(lesson: Lesson, progress: LessonProgress): { passed: boolean; missingCommands: string[]; missingEvidence: string[] } {
  const latest = new Map<string, CommandRecord>();
  for (const record of progress.records) latest.set(normalizeCommand(record.command), record);
  const missingCommands = lesson.commands
    .filter(({ command }) => latest.get(command)?.ok !== true)
    .map(({ command }) => command);
  // Each evidence entry belongs to the command at the same index, never a global transcript.
  const missingEvidence = lesson.evidence.filter((evidence, index) => {
    const record = latest.get(lesson.commands[index]?.command);
    if (!record?.ok) return true;
    return evidence.includes(" ")
      ? !record.output.includes(evidence)
      : !record.output.split(/\s+/).includes(evidence);
  });
  return { passed: missingCommands.length === 0 && missingEvidence.length === 0, missingCommands, missingEvidence };
}

export function canCompleteLesson(lesson: Lesson, progress: LessonProgress): boolean {
  return progress.concept && progress.quiz && progress.verified && verifyLesson(lesson, progress).passed;
}
