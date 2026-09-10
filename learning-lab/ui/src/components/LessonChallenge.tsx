import type { Lesson } from "../curriculum";
import { challengeComplete, type LessonProgress } from "../learning";

export function LessonChallenge({
  lesson,
  progress,
  onUpdate,
}: {
  lesson: Lesson;
  progress: LessonProgress;
  onUpdate: (patch: Partial<LessonProgress>) => void;
}) {
  const challenge = lesson.challenge;
  if (!challenge) return null;
  return (
    <section className="lesson-challenge" aria-label="应用任务">
      <div className="section-title">
        <h2>把知识用起来</h2>
        <span className="badge muted">
          {challengeComplete(lesson, progress)
            ? "任务自评已记录"
            : "任务待自评"}
        </span>
      </div>
      <p>{challenge.task}</p>
      <ol>
        {challenge.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <label className="reflection-field">
        我的分析与证据
        <textarea
          rows={5}
          maxLength={8000}
          value={progress.reflection ?? ""}
          placeholder="写下你的判断、支持它的输出、还需验证什么。可以先根据课程样例分析；实机结果请注明来源。"
          onChange={(event) => onUpdate({ reflection: event.target.value })}
        />
      </label>
      <p className="metadata">
        随课程进度保存在当前浏览器。这里是个人学习笔记，不会自动判分，也不会执行命令。
      </p>
      <fieldset className="acceptance-list">
        <legend>逐项核对后记录自评</legend>
        {challenge.acceptance.map((item, index) => (
          <label key={item}>
            <input
              type="checkbox"
              checked={progress.acceptance?.includes(index) ?? false}
              onChange={(event) =>
                onUpdate({
                  acceptance: event.target.checked
                    ? [...(progress.acceptance ?? []), index]
                    : (progress.acceptance ?? []).filter(
                        (entry) => entry !== index,
                      ),
                })
              }
            />
            <span>{item}</span>
          </label>
        ))}
      </fieldset>
      <details className="reading-note">
        <summary>完成自己的分析后，再看参考思路</summary>
        <p>{challenge.solution}</p>
      </details>
      <p className="metadata">
        课程完成 =
        概念阅读、模拟证据、小测和任务自评。自评不代表实机验收；本章手册提供独立实机步骤。
      </p>
    </section>
  );
}
