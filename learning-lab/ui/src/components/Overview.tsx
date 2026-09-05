import {
  ArrowRight,
  BookOpen,
  Box,
  Check,
  Layers3,
  Server,
  Terminal,
} from "lucide-react";
import { lessons } from "../curriculum";
import type { LessonProgress } from "../learning";

export function Overview({
  progress,
  onLesson,
  onCluster,
  onCase,
}: {
  progress: Record<string, LessonProgress>;
  onLesson: (id: string) => void;
  onCluster: () => void;
  onCase: () => void;
}) {
  const count = lessons.filter(
    (lesson) => progress[lesson.id]?.completed,
  ).length;
  const next =
    lessons.find((lesson) => !progress[lesson.id]?.completed) ?? lessons[0];
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
              {count === 5
                ? "五课已完成，继续巩固"
                : count
                  ? "继续你的学习"
                  : "从认识三个工具开始"}
            </h2>
            <span className="progress-count">
              {count}
              <small> / 5</small>
            </span>
          </div>
          <progress aria-label="课程完成进度" max={5} value={count} />
          <p>
            {next.title} · {next.duration} · {next.subtitle}
          </p>
        </div>
        <button className="primary-button" onClick={() => onLesson(next.id)}>
          {count === 5 ? "复习课程" : count ? "继续学习" : "开始第一课"}
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
          <h2>五课学习路径</h2>
          <span className="metadata">建议按顺序学习，也可以随时复习</span>
        </div>
        <div className="course-list">
          {lessons.map((lesson, index) => (
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
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <span>
                <strong>{lesson.title}</strong>
                <small>{lesson.outcome}</small>
              </span>
              <span className="course-duration">{lesson.duration}</span>
              <ArrowRight />
            </button>
          ))}
        </div>
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
