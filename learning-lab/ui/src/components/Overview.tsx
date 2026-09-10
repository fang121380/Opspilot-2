import {
  ArrowRight,
  BookOpen,
  Box,
  Check,
  Download,
  Layers3,
  Server,
  Terminal,
} from "lucide-react";
import { useState } from "react";
import { lessons, modules } from "../curriculum";
import type { LessonProgress } from "../learning";
import {
  exportStudyNotes,
  matchesStudy,
  noteCount,
  searchExcerpt,
  statusLabels,
  studyStatus,
  type StudyFilter,
} from "../study-tools";

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
  const [filter, setFilter] = useState<StudyFilter>("all");
  const [exportMessage, setExportMessage] = useState("");
  const notes = noteCount(progress);
  const reviewCount = lessons.filter(
    (lesson) => progress[lesson.id]?.reviewNeeded,
  ).length;
  const exportNotes = () => {
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      const blob = new Blob([exportStudyNotes(progress)], {
        type: "text/markdown;charset=utf-8",
      });
      url = URL.createObjectURL(blob);
      link = document.createElement("a");
      link.href = url;
      link.download = `opspilot-learning-notes-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(link);
      link.click();
      setExportMessage(
        `已请求下载 ${notes} 课笔记，请在浏览器下载记录中查看。`,
      );
    } catch {
      setExportMessage("浏览器未能创建下载，请重试；原有笔记仍保留在页面中。");
    } finally {
      link?.remove();
      if (url) setTimeout(() => URL.revokeObjectURL(url!), 1000);
    }
  };
  const matches = lessons.filter(
    (lesson) =>
      (chapter === "all" || lesson.module === chapter) &&
      matchesStudy(lesson, progress[lesson.id], search, filter),
  );
  const count = lessons.filter(
    (lesson) => progress[lesson.id]?.completed,
  ).length;
  const next =
    lessons.find((lesson) => lesson.id === nextLessonId) ?? lessons[0];
  const hasStarted =
    count > 0 || studyStatus(progress[next.id]) !== "unstarted";
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
                ? "课程练习已完成，继续巩固"
                : hasStarted
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
            : hasStarted
              ? "继续学习"
              : "开始第一课"}
          <ArrowRight />
        </button>
      </section>
      <div className="study-actions">
        <button
          className="secondary-button"
          onClick={() => {
            setFilter("review");
            setChapter("all");
            setSearch("");
          }}
        >
          待复习 · {reviewCount} 课
        </button>
        <button
          className="secondary-button"
          disabled={!notes}
          onClick={exportNotes}
        >
          <Download />
          导出全部笔记（{notes}）
        </button>
        <span className="metadata">
          导出为 Markdown 文件，仅保存到本机；不上传或同步进度。
        </span>
      </div>
      {exportMessage && (
        <p className="inline-feedback" role="status">
          {exportMessage}
        </p>
      )}
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
            学习状态
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as StudyFilter)}
            >
              <option value="all">全部状态</option>
              <option value="unstarted">未开始</option>
              <option value="started">学习中</option>
              <option value="completed">已完成</option>
              <option value="review">待复习</option>
            </select>
          </label>
          <label>
            查找课程
            <input
              type="search"
              placeholder="搜索标题、正文、术语或命令…"
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
                      <small>{searchExcerpt(lesson, search)}</small>
                      <small className="course-study-state">
                        {statusLabels[studyStatus(progress[lesson.id])]}
                        {progress[lesson.id]?.reviewNeeded ? " · 待复习" : ""}
                      </small>
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
            <p>
              {filter === "review" && !reviewCount
                ? "还没有待复习课程。在课程标题旁点击“稍后复习”，就能在这里找到。"
                : "没有匹配的课程。试试其他关键词或清除筛选。"}
            </p>
            <button
              className="secondary-button"
              onClick={() => {
                setSearch("");
                setChapter("all");
                setFilter("all");
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
