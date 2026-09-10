import {
  ArrowRight,
  BookOpen,
  Box,
  Check,
  Layers3,
  Server,
  Terminal,
} from "lucide-react";
import { useState } from "react";
import { lessons, modules } from "../curriculum";
import type { LessonProgress } from "../learning";

export function Overview({
  progress,
  nextLessonId,
  onLesson,
  onCluster,
  onCase,
}: {
  progress: Record<string, LessonProgress>;
  nextLessonId: string;
  onLesson: (id: string) => void;
  onCluster: () => void;
  onCase: () => void;
}) {
  const [search, setSearch] = useState("");
  const [chapter, setChapter] = useState("all");
  const matches = lessons.filter(
    (lesson) =>
      (chapter === "all" || lesson.module === chapter) &&
      `${lesson.title} ${lesson.subtitle} ${lesson.outcome}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const count = lessons.filter(
    (lesson) => progress[lesson.id]?.completed,
  ).length;
  const next =
    lessons.find((lesson) => lesson.id === nextLessonId) ?? lessons[0];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>学习工作台</h1>
          <p>理解容器与集群，练习读取状态，再用证据判断故障。</p>
        </div>
        <span className="badge muted">Docker · Kind · Kubernetes</span>
      </div>
      <section className="continue-section">
        <div>
          <div className="section-title">
            <h2>
              {count === lessons.length
                ? "课程练习已完成，继续实机验收"
                : count
                  ? "继续你的学习"
                  : "从认识三个工具开始"}
            </h2>
            <span className="progress-count">
              {count}
              <small> / {lessons.length}</small>
            </span>
          </div>
          <progress
            aria-label="课程完成进度"
            max={lessons.length}
            value={count}
          />
          <p>
            {next.title} · {next.duration} · {next.subtitle}
          </p>
          {progress[next.id]?.lastStep !== undefined &&
            count !== lessons.length && (
              <p className="metadata">
                上次停在：
                {
                  ["理解概念", "练习命令", "判断证据"][
                    progress[next.id].lastStep!
                  ]
                }
              </p>
            )}
        </div>
        <button className="primary-button" onClick={() => onLesson(next.id)}>
          {count === lessons.length
            ? "复习课程"
            : count
              ? "继续学习"
              : "开始第一课"}
          <ArrowRight />
        </button>
      </section>
      <section className="overview-path" aria-label="工具之间的关系">
        {[
          { icon: Box, name: "Docker", detail: "运行容器" },
          { icon: Layers3, name: "Kind", detail: "用容器创建练习集群" },
          { icon: Server, name: "Kubernetes", detail: "管理应用的期望状态" },
        ].map((item, index) => (
          <div key={item.name}>
            <item.icon />
            <span>
              <strong>{item.name}</strong>
              <small>{item.detail}</small>
            </span>
            {index < 2 && <ArrowRight className="path-arrow" />}
          </div>
        ))}
      </section>
      <section className="course-section">
        <div className="section-title">
          <h2>完整学习路径</h2>
          <span className="metadata">建议按顺序学习，也可以随时复习</span>
        </div>
        <div className="course-filters">
          <label>
            按章节学习
            <select
              value={chapter}
              onChange={(event) => setChapter(event.target.value)}
            >
              <option value="all">全部章节</option>
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            查找课程
            <input
              type="search"
              placeholder="如：网络、存储、探针…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        {modules.map((module) => {
          const chapterLessons = lessons.filter(
            (lesson) => lesson.module === module.id,
          );
          const visible = matches.filter(
            (lesson) => lesson.module === module.id,
          );
          if (!visible.length) return null;
          return (
            <section
              className="course-chapter"
              key={module.id}
              aria-label={module.title}
            >
              <div className="section-title">
                <h3>{module.title}</h3>
                <span className="metadata">
                  {
                    chapterLessons.filter(
                      (lesson) => progress[lesson.id]?.completed,
                    ).length
                  }{" "}
                  / {chapterLessons.length} 课完成
                </span>
              </div>
              <p>{module.outcome}</p>
              <p className="metadata">本章验收：{module.milestone}</p>
              <div className="course-list">
                {visible.map((lesson) => (
                  <button
                    key={lesson.id}
                    className={lesson.id === next.id ? "current" : ""}
                    onClick={() => onLesson(lesson.id)}
                  >
                    <span
                      className={`course-index ${progress[lesson.id]?.completed ? "complete" : ""}`}
                    >
                      {progress[lesson.id]?.completed ? (
                        <Check />
                      ) : (
                        String(lessons.indexOf(lesson) + 1).padStart(2, "0")
                      )}
                    </span>
                    <span>
                      <strong>{lesson.title}</strong>
                      <small>{lesson.subtitle}</small>
                    </span>
                    <span className="course-duration">{lesson.duration}</span>
                    <ArrowRight />
                  </button>
                ))}
              </div>
            </section>
          );
        })}
        {!matches.length && (
          <div className="reading-note" role="status">
            <p>没有匹配的课程。试试“网络”或清除筛选。</p>
            <button
              className="secondary-button"
              onClick={() => {
                setSearch("");
                setChapter("all");
              }}
            >
              显示全部课程
            </button>
          </div>
        )}
      </section>
      <section className="practice-options">
        <button onClick={onCluster}>
          <Server />
          <span>
            <strong>观察真实学习集群</strong>
            <small>只读查看 Pod、事件和日志</small>
          </span>
          <ArrowRight />
        </button>
        <button onClick={onCase}>
          <BookOpen />
          <span>
            <strong>完成一个故障案例</strong>
            <small>练习定位、选择修复与验证</small>
          </span>
          <ArrowRight />
        </button>
      </section>
      <div className="learning-boundary">
        <Terminal />
        <p>
          课程命令与教学案例使用模拟数据。实机区域读取电脑上的学习集群；两种数据分别标注，学习完成不等于生产操作认证。
        </p>
      </div>
    </>
  );
}
