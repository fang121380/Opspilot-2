import { lessons, type Lesson } from "./curriculum.ts";
import type { LessonProgress } from "./learning.ts";

export type StudyStatus = "unstarted" | "started" | "completed";
export type StudyFilter = "all" | StudyStatus | "review";
export const statusLabels: Record<StudyStatus, string> = {
  unstarted: "未开始",
  started: "学习中",
  completed: "已完成",
};

export function studyStatus(progress?: LessonProgress): StudyStatus {
  if (progress?.completed) return "completed";
  return progress &&
    (progress.lastStep !== undefined ||
      progress.concept ||
      progress.records.length ||
      progress.reflection?.trim())
    ? "started"
    : "unstarted";
}

function searchableParts(lesson: Lesson): string[] {
  return [
    lesson.title,
    lesson.subtitle,
    lesson.outcome,
    lesson.why,
    ...lesson.concepts.map(
      (item) => `${item.term} ${item.plain} ${item.detail}`,
    ),
    ...(lesson.sections ?? []).map(
      (item) => `${item.title} ${item.body} ${item.example ?? ""}`,
    ),
    ...(lesson.challenge
      ? [
          lesson.challenge.task,
          ...lesson.challenge.steps,
          ...lesson.challenge.acceptance,
          lesson.challenge.solution,
        ]
      : []),
    ...lesson.commands.map(
      (item) => `${item.command} ${item.purpose} ${item.expected}`,
    ),
    ...lesson.commonMistakes,
  ];
}

export function matchesStudy(
  lesson: Lesson,
  progress: LessonProgress | undefined,
  query: string,
  filter: StudyFilter,
): boolean {
  if (
    filter === "review"
      ? !progress?.reviewNeeded
      : filter !== "all" && studyStatus(progress) !== filter
  )
    return false;
  const text = searchableParts(lesson).join(" ").toLowerCase();
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .every((term) => text.includes(term));
}

export function searchExcerpt(lesson: Lesson, query: string): string {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return lesson.subtitle;
  const part =
    searchableParts(lesson).find((item) =>
      terms.some((term) => item.toLowerCase().includes(term)),
    ) ?? lesson.subtitle;
  const position = Math.min(
    ...terms
      .map((term) => part.toLowerCase().indexOf(term))
      .filter((index) => index >= 0),
  );
  const start = Number.isFinite(position) ? Math.max(0, position - 18) : 0;
  return `${start ? "…" : ""}${part.slice(start, start + 100)}${part.length > start + 100 ? "…" : ""}`;
}

export function noteCount(progress: Record<string, LessonProgress>): number {
  return lessons.filter((lesson) => progress[lesson.id]?.reflection?.trim())
    .length;
}

export function exportStudyNotes(
  progress: Record<string, LessonProgress>,
): string {
  const output = [
    "# Opspilot 学习笔记",
    "",
    "个人分析与自评，不代表自动评分或实机验收。此文件用于阅读和备份笔记，不能导入或同步课程进度。",
    "",
  ];
  for (const lesson of lessons) {
    const entry = progress[lesson.id];
    if (!entry?.reflection?.trim()) continue;
    output.push(
      `## ${lesson.title}`,
      "",
      `学习状态：${statusLabels[studyStatus(entry)]}${entry.reviewNeeded ? "；待复习" : ""}`,
      "",
    );
    // Preserve arbitrary user Markdown/HTML literally, including embedded fences.
    const fence = "`".repeat(
      Math.max(
        3,
        ...[...entry.reflection.matchAll(/`+/g)].map(
          (match) => match[0].length + 1,
        ),
      ),
    );
    output.push(`${fence}text`, entry.reflection, fence, "");
    if (lesson.challenge) {
      output.push("任务自评：", "");
      lesson.challenge.acceptance.forEach((item, index) =>
        output.push(
          `- [${entry.acceptance?.includes(index) ? "x" : " "}] ${item}`,
        ),
      );
      output.push("");
    }
  }
  return output.join("\n");
}

export function resolveManualHref(href: string): string | undefined {
  if (/^https?:\/\//i.test(href)) {
    try {
      const url = new URL(href);
      return url.username || url.password ? undefined : url.href;
    } catch {
      return undefined;
    }
  }
  if (
    /^(?:\.\.?\/)*[a-zA-Z0-9_-][a-zA-Z0-9_/-]*\.md(?:#[a-zA-Z0-9_%-]+)?$/.test(
      href,
    )
  ) {
    return new URL(
      href,
      "https://github.com/fang121380/Opspilot-2/blob/main/learning-lab/labs/",
    ).href;
  }
  return undefined;
}
