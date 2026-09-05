import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  ExternalLink,
  FileCode2,
  Gauge,
  Layers3,
  ListChecks,
  Menu,
  Moon,
  Play,
  PlugZap,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sun,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { glossary, lessons, type Lesson } from "./curriculum";
import { runSimulatedCommand } from "./terminal";
import "./styles.css";

type ConnectionState = "mock" | "connecting" | "live" | "error";
type View = "overview" | "learn" | "cluster" | "incidents";
type Resource = {
  kind: string;
  name: string;
  status: string;
  detail: string;
  tone: "good" | "warn" | "muted";
};
type LabApiResponse = { query: string; ok: boolean; output?: string; error?: string };
type Incident = {
  id: string;
  status: string;
  severity: string;
  alert_name?: string;
  summary?: string;
  service?: string;
  created_at?: string;
};
type KubernetesItem = {
  kind: string;
  metadata?: { name?: string };
  spec?: { replicas?: number; type?: string; clusterIP?: string; ports?: { port?: number }[]; nodeName?: string };
  status?: { availableReplicas?: number; readyReplicas?: number; phase?: string; containerStatuses?: { ready?: boolean; restartCount?: number }[] };
};
type LessonProgress = {
  concept: boolean;
  commands: string[];
  verified: boolean;
  quiz: boolean;
  completed: boolean;
};

const progressKey = "opspilot-learning-progress-v3";
const emptyProgress: LessonProgress = {
  concept: false,
  commands: [],
  verified: false,
  quiz: false,
  completed: false,
};
const baseResources: Resource[] = [
  { kind: "Deployment", name: "hello-web", status: "等待同步", detail: "点击连接实机读取状态", tone: "muted" },
  { kind: "Service", name: "hello-web", status: "模拟数据", detail: "ClusterIP · port 80", tone: "good" },
  { kind: "Pod", name: "hello-web-example-a", status: "Pending", detail: "示例：等待容器启动", tone: "warn" },
  { kind: "Pod", name: "hello-web-example-b", status: "Pending", detail: "示例：等待容器启动", tone: "warn" },
];
const mockEvents = [
  { tone: "warn", title: "镜像拉取示例", detail: "Failed to pull image · 这是教学模拟数据", time: "模拟" },
  { tone: "good", title: "Service 创建示例", detail: "hello-web · ClusterIP", time: "模拟" },
];
const mockLogs = [
  "[模拟日志] nginx starting worker process",
  "[模拟日志] readiness probe pending",
  "[提示] 点击“连接实机”读取 k8s-lab 的真实日志",
];
const docs = [
  { name: "Kubernetes 中文文档", desc: "概念、教程与任务", url: "https://kubernetes.io/zh-cn/docs/home/" },
  { name: "Docker 官方文档", desc: "镜像、容器和网络", url: "https://docs.docker.com/" },
  { name: "Kind Quick Start", desc: "本地 Kubernetes 集群", url: "https://kind.sigs.k8s.io/docs/user/quick-start/" },
  { name: "kubectl 命令参考", desc: "命令参数和示例", url: "https://kubernetes.io/zh-cn/docs/reference/kubectl/" },
];

function loadProgress(): Record<string, LessonProgress> {
  try {
    const saved = JSON.parse(localStorage.getItem(progressKey) ?? "{}");
    return typeof saved === "object" && saved ? saved : {};
  } catch {
    return {};
  }
}

function parseKubernetesResources(output: string): Resource[] {
  const payload = JSON.parse(output) as { items?: KubernetesItem[] };
  return (payload.items ?? []).map((item) => {
    const name = item.metadata?.name ?? "未命名资源";
    if (item.kind === "Deployment") {
      const desired = item.spec?.replicas ?? 0;
      const ready = item.status?.readyReplicas ?? item.status?.availableReplicas ?? 0;
      return { kind: "Deployment", name, status: ready === desired ? "Available" : "Progressing", detail: `${ready}/${desired} 副本可用`, tone: ready === desired ? "good" : "warn" };
    }
    if (item.kind === "Pod") {
      const containers = item.status?.containerStatuses ?? [];
      const ready = containers.filter((container) => container.ready).length;
      const restarts = containers.reduce((total, container) => total + (container.restartCount ?? 0), 0);
      const phase = item.status?.phase ?? "Unknown";
      return { kind: "Pod", name, status: phase, detail: `${ready}/${containers.length || 1} 容器就绪 · 重启 ${restarts} 次`, tone: phase === "Running" && ready === containers.length ? "good" : "warn" };
    }
    const port = item.spec?.ports?.[0]?.port;
    return { kind: item.kind || "Service", name, status: item.spec?.type ?? "Unknown", detail: `${item.spec?.clusterIP ?? "无 ClusterIP"}${port ? ` · 端口 ${port}` : ""}`, tone: "good" };
  });
}

function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [view, setView] = useState<View>("overview");
  const [selectedId, setSelectedId] = useState("00");
  const [progress, setProgress] = useState<Record<string, LessonProgress>>(loadProgress);
  const [resources, setResources] = useState(baseResources);
  const [events, setEvents] = useState(mockEvents);
  const [logs, setLogs] = useState(mockLogs);
  const [connection, setConnection] = useState<ConnectionState>("mock");
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "欢迎来到安全练习终端。",
    "输入 help 查看可用方式；这里不会执行真实写操作。",
  ]);
  const [terminalInput, setTerminalInput] = useState("");
  const [notice, setNotice] = useState("从第 1 课开始：先读概念，再执行三条命令。无需提前了解 Kubernetes。");
  const [showDocs, setShowDocs] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  const selected = lessons.find((lesson) => lesson.id === selectedId) ?? lessons[0];
  const currentProgress = progress[selected.id] ?? emptyProgress;
  const selectedIndex = lessons.findIndex((lesson) => lesson.id === selected.id);
  const doneCount = lessons.filter((lesson) => progress[lesson.id]?.completed).length;

  useEffect(() => {
    localStorage.setItem(progressKey, JSON.stringify(progress));
  }, [progress]);

  const updateCurrent = (patch: Partial<LessonProgress>) => {
    setProgress((current) => ({
      ...current,
      [selected.id]: { ...(current[selected.id] ?? emptyProgress), ...patch },
    }));
  };

  const lessonUnlocked = (index: number) => index === 0 || Boolean(progress[lessons[index - 1].id]?.completed);

  const selectLesson = (lesson: Lesson, index: number) => {
    if (!lessonUnlocked(index)) {
      setNotice(`第 ${index + 1} 课还没有解锁，请先完成第 ${index} 课。`);
      return;
    }
    setSelectedId(lesson.id);
    setView("learn");
    setMobileNav(false);
    setNotice(`当前是第 ${index + 1} 课：${lesson.title}。先阅读“为什么要学”，再按顺序操作。`);
  };

  const appendCommand = (command: string, output: string) => {
    setTerminalLines((lines) => [...lines, `$ ${command}`, output]);
  };

  const runCourseCommand = (command: string) => {
    const result = runSimulatedCommand(command);
    appendCommand(command, result.output);
    if (result.ok) {
      const executed = Array.from(new Set([...currentProgress.commands, command]));
      updateCurrent({ commands: executed, verified: false });
      setNotice(
        executed.length === selected.commands.length
          ? "三条命令都已执行。下一步：点击“运行自检”。"
          : `已完成 ${executed.length}/${selected.commands.length} 条命令，请继续执行下一条。`,
      );
    }
  };

  const runTerminalInput = () => {
    const command = terminalInput.trim();
    if (!command) return;
    const result = runSimulatedCommand(command);
    setTerminalInput("");
    if (result.output === "__CLEAR__") {
      setTerminalLines([]);
      setNotice("终端已清空。课程进度不会被清除。 ");
      return;
    }
    appendCommand(command, result.output);
    const courseCommand = selected.commands.some((item) => item.command === command);
    if (result.ok && courseCommand) {
      const executed = Array.from(new Set([...currentProgress.commands, command]));
      updateCurrent({ commands: executed, verified: false });
    }
    setNotice(result.ok ? "命令已运行。请对照课程里的“预期看到”理解输出。" : "命令已安全拦截，没有在本机执行。输入 help 查看说明。");
  };

  const runSelfCheck = () => {
    const transcript = terminalLines.join("\n");
    const missing = selected.evidence.filter((needle) => !transcript.includes(needle));
    if (missing.length) {
      updateCurrent({ verified: false });
      setNotice(`自检还没通过：缺少 ${missing.join("、")}。请把本节三条命令全部执行一次。`);
      return;
    }
    updateCurrent({ verified: true });
    setNotice("自检通过。下一步：完成下方的一道小测。答错也可以重新选择。");
  };

  const nextAction = useMemo(() => {
    if (!currentProgress.concept) return "先阅读本节概念，然后点击“我看懂了”";
    if (currentProgress.commands.length < selected.commands.length) return "按顺序执行本节的三条命令";
    if (!currentProgress.verified) return "点击“运行自检”，确认输出包含关键证据";
    if (!currentProgress.quiz) return "完成本节小测，确认概念已经理解";
    if (!currentProgress.completed) return "点击“完成本节”，解锁下一课";
    return selectedIndex === lessons.length - 1 ? "全部课程完成，可以进入集群资源和事故中心练习" : "选择下一课继续学习";
  }, [currentProgress, selected, selectedIndex]);

  const completeLesson = () => {
    if (!currentProgress.concept || currentProgress.commands.length < selected.commands.length || !currentProgress.verified || !currentProgress.quiz) {
      setNotice(`还不能完成本节。当前需要：${nextAction}。`);
      return;
    }
    updateCurrent({ completed: true });
    const next = lessons[selectedIndex + 1];
    if (next) {
      setSelectedId(next.id);
      setNotice(`第 ${selectedIndex + 1} 课已完成。已进入第 ${selectedIndex + 2} 课：${next.title}。`);
    } else {
      setNotice("五课全部完成。现在可以进入“集群资源”观察真实状态，再到“事故中心”理解 Opspilot。");
    }
  };

  const fetchLabQuery = async (query: string) => {
    const response = await fetch(`${import.meta.env.VITE_LAB_API_URL ?? "http://127.0.0.1:8787"}/?query=${query}`);
    const payload = (await response.json()) as LabApiResponse;
    if (!response.ok || !payload.ok || payload.output === undefined) throw new Error(payload.error ?? `${query} unavailable`);
    return payload.output;
  };

  const connectLive = async () => {
    setConnection("connecting");
    try {
      const [resourceOutput, eventOutput, logOutput] = await Promise.all([
        fetchLabQuery("resources"),
        fetchLabQuery("events"),
        fetchLabQuery("logs"),
      ]);
      const parsedResources = parseKubernetesResources(resourceOutput);
      if (!parsedResources.length) throw new Error("no resources returned");
      setResources(parsedResources);
      const eventRows = eventOutput.split("\n").filter((line) => line.trim() && !line.startsWith("LAST SEEN"));
      setEvents(eventOutput.startsWith("No resources found") ? [] : eventRows.slice(-8).reverse().map((line) => ({
        tone: line.includes("Warning") || line.includes("Failed") ? "warn" : "muted",
        title: line.includes("Failed") ? "集群警告" : "集群事件",
        detail: line,
        time: "实机",
      })));
      setLogs(logOutput.trim() ? logOutput.split("\n").filter(Boolean) : ["当前容器没有日志输出。"]);
      setConnection("live");
      setNotice("已连接学习集群。当前页面只读取状态、事件和日志，不执行修改。 ");
    } catch {
      setConnection("error");
      setNotice("连接失败。请用桌面图标重新打开工作台；启动器会同时启动只读桥接服务。 ");
    }
  };

  const resetProgress = () => {
    localStorage.removeItem(progressKey);
    setProgress({});
    setSelectedId("00");
    setTerminalLines(["学习进度已重置。输入 help 查看终端说明。"]);
    setView("learn");
    setShowReset(false);
    setNotice("已从零开始。第一步：阅读 Docker、Kind、kubectl 的通俗解释。 ");
  };

  const selectView = (next: View) => {
    setView(next);
    setMobileNav(false);
  };

  const connectionLabel = connection === "connecting" ? "正在连接" : connection === "live" ? "实机只读" : connection === "error" ? "连接失败" : "教学模拟";

  return (
    <div className={`app-shell ${theme}`}>
      <header className="topbar">
        <button className="mobile-menu icon-button" aria-label="打开导航" onClick={() => setMobileNav((open) => !open)}><Menu /></button>
        <div className="brand"><span className="brand-mark"><Layers3 /></span><div><strong>Opspilot</strong><small>云原生学习工作台</small></div></div>
        <div className="context-pill"><span className="pulse" /><span>学习集群</span><code>kind-k8s-lab</code></div>
        <div className="top-actions">
          <span className={`connection-label ${connection}`} title="教学模拟不会读取集群；实机只读会同步 k8s-lab 状态"><Activity />{connectionLabel}</span>
          <button className="connect-btn" onClick={connectLive} disabled={connection === "connecting"}><PlugZap />{connection === "live" ? "刷新实机" : "连接实机"}</button>
          <button className="icon-button" aria-label={theme === "light" ? "切换深色模式" : "切换明亮模式"} onClick={() => setTheme((value) => value === "light" ? "dark" : "light")}>{theme === "light" ? <Moon /> : <Sun />}</button>
          <button className="icon-button" aria-label="打开术语和学习资料" onClick={() => setShowDocs(true)}><BookOpen /></button>
        </div>
      </header>

      <div className="layout">
        <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
          <div className="side-heading"><span>工作台</span><button className="sidebar-close icon-button" aria-label="关闭导航" onClick={() => setMobileNav(false)}><X /></button></div>
          <nav className="primary-nav" aria-label="工作台模块">
            <NavButton active={view === "overview"} icon={<Gauge />} label="学习首页" meta="从这里开始" onClick={() => selectView("overview")} />
            <NavButton active={view === "learn"} icon={<ListChecks />} label="课程练习" meta={`${doneCount}/5`} onClick={() => selectView("learn")} />
            <NavButton active={view === "cluster"} icon={<Server />} label="集群资源" meta="进阶" onClick={() => selectView("cluster")} />
            <NavButton active={view === "incidents"} icon={<AlertCircle />} label="事故中心" meta="进阶" onClick={() => selectView("incidents")} />
          </nav>
          <div className="side-divider" />
          <div className="side-heading"><span>五课学习路径</span><span>{doneCount}/5</span></div>
          <nav className="lesson-nav" aria-label="课程列表">
            {lessons.map((lesson, index) => {
              const itemProgress = progress[lesson.id] ?? emptyProgress;
              const unlocked = lessonUnlocked(index);
              return (
                <button key={lesson.id} className={`lesson-nav-item ${selected.id === lesson.id ? "selected" : ""} ${itemProgress.completed ? "done" : ""}`} disabled={!unlocked} onClick={() => selectLesson(lesson, index)}>
                  <span className="lesson-index">{itemProgress.completed ? <Check /> : index + 1}</span>
                  <span><strong>{lesson.title}</strong><small>{lesson.subtitle}</small><small><Clock3 />{lesson.duration}</small></span>
                  <em>{itemProgress.completed ? "完成" : unlocked ? "可学习" : "未解锁"}</em>
                </button>
              );
            })}
          </nav>
          <div className="sidebar-foot"><ShieldCheck /><span><strong>安全学习环境</strong><small>终端不会执行真实写操作</small></span><button onClick={() => setShowReset(true)}><Trash2 />重置学习进度</button></div>
        </aside>

        <main className="main-content">
          {view === "overview" && <Overview doneCount={doneCount} nextLesson={lessons[Math.min(doneCount, lessons.length - 1)]} connection={connection} onStart={() => doneCount === lessons.length ? selectView("cluster") : selectLesson(lessons[doneCount], doneCount)} onDocs={() => setShowDocs(true)} />}
          {view === "learn" && <LessonView lesson={selected} index={selectedIndex} progress={currentProgress} notice={notice} nextAction={nextAction} terminalLines={terminalLines} terminalInput={terminalInput} onTerminalInput={setTerminalInput} onRunTerminal={runTerminalInput} onClearTerminal={() => setTerminalLines([])} onConceptRead={() => { updateCurrent({ concept: true }); setNotice("概念阅读完成。现在从上到下执行三条命令，并对照预期输出。 "); }} onRunCommand={runCourseCommand} onSelfCheck={runSelfCheck} onQuizPass={() => { updateCurrent({ quiz: true }); setNotice("小测回答正确。现在可以点击“完成本节”。 "); }} onComplete={completeLesson} onDocs={() => setShowDocs(true)} />}
          {view === "cluster" && <ClusterView resources={resources} events={events} logs={logs} connection={connection} onConnect={connectLive} />}
          {view === "incidents" && <IncidentView onDocs={() => setShowDocs(true)} />}
        </main>
      </div>

      {showReset && <ConfirmModal onClose={() => setShowReset(false)} onConfirm={resetProgress} />}
      {showDocs && <ReferenceModal onClose={() => setShowDocs(false)} />}
    </div>
  );
}

function NavButton({ active, icon, label, meta, onClick }: { active: boolean; icon: React.ReactNode; label: string; meta: string; onClick: () => void }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span><small>{meta}</small></button>;
}

function Overview({ doneCount, nextLesson, connection, onStart, onDocs }: { doneCount: number; nextLesson: Lesson; connection: ConnectionState; onStart: () => void; onDocs: () => void }) {
  const allDone = doneCount === lessons.length;
  return (
    <>
      <section className="start-panel">
        <div className="start-copy"><span className="start-label">零基础学习模式</span><h1>{doneCount === 0 ? "先别碰集群，从三个工具开始。" : allDone ? "五课已完成，开始观察真实集群。" : `继续第 ${doneCount + 1} 课：${nextLesson.title}`}</h1><p>每一课都会先解释概念，再让你执行命令、检查结果和完成小测。看不懂的词可以随时打开右上角的术语表。</p><div className="start-actions"><button className="primary-btn large" onClick={onStart}><Play />{doneCount === 0 ? "开始第 1 课" : allDone ? "查看集群资源" : "继续学习"}</button><button className="secondary-btn large" onClick={onDocs}><BookOpen />先看术语表</button></div></div>
        <div className="today-task"><span>你现在只需要做一件事</span><strong>{doneCount === 0 ? "认识 Docker、Kind 和 kubectl" : allDone ? "连接 k8s-lab，比较资源、事件和日志" : nextLesson.outcome}</strong><small>{allDone ? "进入进阶实战 · 仍然保持只读" : `预计 ${nextLesson.duration} · 不会操作真实生产环境`}</small></div>
      </section>

      <section className="how-it-works" aria-labelledby="how-title"><div className="section-heading"><span>先建立整体认识</span><h2 id="how-title">这些东西是怎么连在一起的？</h2></div><div className="system-flow"><div><span>1</span><strong>你的应用</strong><small>代码和依赖</small></div><ChevronRight /><div><span>2</span><strong>Docker</strong><small>装进容器</small></div><ChevronRight /><div><span>3</span><strong>Kind</strong><small>创建本地集群</small></div><ChevronRight /><div><span>4</span><strong>Kubernetes</strong><small>管理应用运行</small></div><ChevronRight /><div><span>5</span><strong>Opspilot</strong><small>观察和处理故障</small></div></div></section>

      <section className="course-outline"><div className="section-heading"><span>完整路线</span><h2>五节课，从不会到能排障</h2><p>不要跳课。每节课只引入下一步真正需要的概念。</p></div><div className="course-list">{lessons.map((lesson, index) => <div key={lesson.id} className={index < doneCount ? "complete" : index === doneCount ? "current" : "future"}><span>{index < doneCount ? <Check /> : index + 1}</span><div><strong>{lesson.title}</strong><small>{lesson.outcome}</small></div><em>{lesson.duration}</em></div>)}</div></section>

      <section className="status-strip"><div><span>学习进度</span><strong>{doneCount}/5 课完成</strong></div><div><span>当前数据</span><strong>{connection === "live" ? "学习集群实机只读" : "安全教学模拟"}</strong></div><div><span>操作边界</span><strong>写操作必须人工审批</strong></div></section>
    </>
  );
}

function LessonView({ lesson, index, progress, notice, nextAction, terminalLines, terminalInput, onTerminalInput, onRunTerminal, onClearTerminal, onConceptRead, onRunCommand, onSelfCheck, onQuizPass, onComplete, onDocs }: { lesson: Lesson; index: number; progress: LessonProgress; notice: string; nextAction: string; terminalLines: string[]; terminalInput: string; onTerminalInput: (value: string) => void; onRunTerminal: () => void; onClearTerminal: () => void; onConceptRead: () => void; onRunCommand: (command: string) => void; onSelfCheck: () => void; onQuizPass: () => void; onComplete: () => void; onDocs: () => void }) {
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  useEffect(() => setQuizAnswer(null), [lesson.id]);
  const quizWrong = quizAnswer !== null && quizAnswer !== lesson.quiz.correct;
  const allCommands = progress.commands.length === lesson.commands.length;
  return (
    <>
      <header className="lesson-header"><div><span>第 {index + 1} 课，共 5 课</span><h1>{lesson.title}</h1><p>{lesson.outcome}</p></div><button className="secondary-btn" onClick={onDocs}><BookOpen />查术语</button></header>
      <div className="next-action" role="status"><span>现在做什么</span><strong>{nextAction}</strong><em>{notice}</em></div>
      <div className="lesson-stepper"><span className={progress.concept ? "done" : "active"}>1 看懂概念</span><span className={progress.commands.length ? allCommands ? "done" : "active" : ""}>2 执行命令</span><span className={progress.verified ? "done" : allCommands ? "active" : ""}>3 检查结果</span><span className={progress.quiz ? "done" : progress.verified ? "active" : ""}>4 完成小测</span></div>

      <section className="lesson-section"><div className="step-number">1</div><div className="lesson-section-body"><div className="section-heading"><span>先看懂</span><h2>为什么要学这一课？</h2><p>{lesson.why}</p></div><div className="concept-grid">{lesson.concepts.map((concept) => <article key={concept.term}><strong>{concept.term}</strong><span>{concept.plain}</span><p>{concept.detail}</p></article>)}</div><button className={progress.concept ? "done-btn" : "primary-btn"} onClick={onConceptRead}><Check />{progress.concept ? "概念已读懂" : "我看懂了，继续操作"}</button></div></section>

      <section className="lesson-section"><div className="step-number">2</div><div className="lesson-section-body"><div className="section-heading"><span>跟着做</span><h2>按顺序执行三条命令</h2><p>点击“运行”，然后看下方终端。重点不是背命令，而是理解每条命令在问什么。</p></div><div className="command-list">{lesson.commands.map((item, commandIndex) => { const executed = progress.commands.includes(item.command); return <div key={item.command} className={executed ? "executed" : ""}><span className="command-index">{executed ? <Check /> : commandIndex + 1}</span><div><code>{item.command}</code><strong>{item.purpose}</strong><small>预期看到：{item.expected}</small></div><button onClick={() => onRunCommand(item.command)}><Play />{executed ? "再运行" : "运行"}</button></div>; })}</div></div></section>

      <TerminalPanel lines={terminalLines} input={terminalInput} onInput={onTerminalInput} onRun={onRunTerminal} onClear={onClearTerminal} />

      <section className="lesson-section"><div className="step-number">3</div><div className="lesson-section-body"><div className="section-heading"><span>检查结果</span><h2>确认你真的得到了关键证据</h2><p>自检会在终端输出中查找：{lesson.evidence.join("、")}。</p></div><button className={progress.verified ? "done-btn" : "primary-btn"} onClick={onSelfCheck}><ShieldCheck />{progress.verified ? "自检已通过" : "运行自检"}</button><details className="mistakes"><summary>遇到问题时先看这里</summary>{lesson.commonMistakes.map((item) => <p key={item}><AlertTriangle />{item}</p>)}</details></div></section>

      <section className="lesson-section"><div className="step-number">4</div><div className="lesson-section-body"><div className="section-heading"><span>确认理解</span><h2>{lesson.quiz.question}</h2><p>答错不会扣分，可以重新选择。</p></div><div className="quiz-options">{lesson.quiz.options.map((option, optionIndex) => <button key={option} className={quizAnswer === optionIndex ? optionIndex === lesson.quiz.correct ? "correct" : "wrong" : ""} onClick={() => { setQuizAnswer(optionIndex); if (optionIndex === lesson.quiz.correct) onQuizPass(); }} disabled={progress.quiz}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div>{(quizWrong || progress.quiz) && <div className={quizWrong ? "quiz-feedback wrong" : "quiz-feedback correct"}>{quizWrong ? "还不对。" : "回答正确。"}{lesson.quiz.explanation}</div>}</div></section>

      <section className="lesson-finish"><div><strong>{progress.concept && allCommands && progress.verified && progress.quiz ? "本节要求已全部完成" : "本节还没有完成"}</strong><p>{progress.concept && allCommands && progress.verified && progress.quiz ? "可以完成本节并解锁下一课。" : `下一步：${nextAction}`}</p></div><button className="primary-btn large" onClick={onComplete}><Check />完成本节</button></section>
    </>
  );
}

function TerminalPanel({ lines, input, onInput, onRun, onClear }: { lines: string[]; input: string; onInput: (value: string) => void; onRun: () => void; onClear: () => void }) {
  return <section className="terminal-panel"><div className="terminal-head"><span><Terminal />安全练习终端</span><small>可以自己输入 · 不执行真实写操作</small><button onClick={onClear} aria-label="清空终端"><Trash2 /></button></div><div className="terminal-body" aria-live="polite">{lines.length ? lines.map((line, index) => <div key={`${index}-${line}`} className={line.startsWith("$") ? "terminal-command" : line.startsWith("已拦截") ? "terminal-blocked" : "terminal-output"}>{line}</div>) : <div className="terminal-empty">终端是空的。输入 help 或运行上方课程命令。</div>}</div><div className="terminal-input-row"><span>$</span><input value={input} onChange={(event) => onInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onRun(); }} aria-label="输入安全查询命令" placeholder="例如：kubectl get pods；输入 help 查看说明" autoCapitalize="none" autoCorrect="off" spellCheck={false} /><button onClick={onRun} aria-label="执行输入的命令"><Play /></button></div></section>;
}

function ClusterView({ resources, events, logs, connection, onConnect }: { resources: Resource[]; events: typeof mockEvents; logs: string[]; connection: ConnectionState; onConnect: () => void }) {
  const [tab, setTab] = useState<"resources" | "events" | "logs">("resources");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const visibleResources = onlyIssues ? resources.filter((resource) => resource.tone === "warn") : resources;
  return <><PageHeader eyebrow="进阶区域" title="集群资源" description="这页用于观察学习集群。第一次使用请先完成左侧五课，不需要现在就理解所有字段。" actions={<button className="primary-btn" onClick={onConnect} disabled={connection === "connecting"}><PlugZap />{connection === "live" ? "刷新实机" : "连接实机"}</button>} /><div className="explain-band"><CircleHelp /><div><strong>这页是干什么的？</strong><p>资源看“现在怎么样”，事件看“Kubernetes 发生了什么”，日志看“应用内部说了什么”。连接实机仍然只读。</p></div></div><div className="tab-bar" role="tablist"><button role="tab" aria-selected={tab === "resources"} className={tab === "resources" ? "active" : ""} onClick={() => setTab("resources")}><Server />资源</button><button role="tab" aria-selected={tab === "events"} className={tab === "events" ? "active" : ""} onClick={() => setTab("events")}><AlertTriangle />事件</button><button role="tab" aria-selected={tab === "logs"} className={tab === "logs" ? "active" : ""} onClick={() => setTab("logs")}><FileCode2 />日志</button></div>{tab === "resources" && <section className="data-panel"><div className="data-toolbar"><div><strong>learning 命名空间</strong><small>{connection === "live" ? "实机只读数据" : "教学模拟数据"}</small></div><button className={onlyIssues ? "selected" : ""} onClick={() => setOnlyIssues((value) => !value)}><Search />{onlyIssues ? "显示全部" : "只看异常"}</button></div>{visibleResources.length ? <div className="resource-table"><div className="table-row table-head"><span>资源类型</span><span>名称</span><span>状态</span><span>它说明什么</span></div>{visibleResources.map((resource) => <div className="table-row" key={`${resource.kind}-${resource.name}`}><span>{resource.kind}</span><strong>{resource.name}</strong><em className={resource.tone}>{resource.status}</em><small>{resource.detail}</small></div>)}</div> : <EmptyState title="没有异常资源" description="当前筛选条件下没有警告项。点击“显示全部”查看所有资源。" />}</section>}{tab === "events" && <section className="data-panel">{events.length ? <div className="event-list">{events.map((event, index) => <div key={`${event.title}-${index}`}><AlertTriangle /><div><strong>{event.title}</strong><p>{event.detail}</p><small>{event.time}</small></div></div>)}</div> : <EmptyState title="当前没有 Kubernetes 事件" description="这通常是好事：学习命名空间最近没有需要记录的异常事件。" />}</section>}{tab === "logs" && <section className="data-panel"><div className="log-output">{logs.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)}</div></section>}</>;
}

function IncidentView({ onDocs }: { onDocs: () => void }) {
  const [state, setState] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const load = async () => {
    setState("loading");
    try {
      const base = import.meta.env.VITE_OPSPILOT_API_URL ?? "http://127.0.0.1:8000";
      const [health, response] = await Promise.all([fetch(`${base}/health`), fetch(`${base}/incidents`)]);
      if (!health.ok || !response.ok) throw new Error("unavailable");
      const payload = await response.json();
      setIncidents(Array.isArray(payload) ? payload : []);
      setState("live");
    } catch {
      setIncidents([]);
      setState("error");
    }
  };
  return <><PageHeader eyebrow="进阶区域" title="Opspilot 事故中心" description="完成故障排查课后，再来理解告警如何变成可调查、可审批的事故。" actions={<><button className="secondary-btn" onClick={onDocs}><BookOpen />查看流程</button><button className="primary-btn" onClick={load} disabled={state === "loading"}><RefreshCw />{state === "loading" ? "连接中" : state === "live" ? "刷新事故" : "连接 Opspilot"}</button></>} /><div className="explain-band"><CircleHelp /><div><strong>事故中心不是自动重启按钮</strong><p>流程是：Alertmanager 发告警 → Opspilot 创建事故 → 调查证据 → 提出修复方案 → 人工审批 → 执行和验证。</p></div></div>{state === "error" && <ErrorState onRetry={load} />}{state !== "error" && incidents.length === 0 && <EmptyState title={state === "live" ? "当前没有事故" : "还没有连接 Opspilot"} description={state === "live" ? "服务正常且暂时没有收到告警。" : "点击右上角“连接 Opspilot”读取本机 API；不会执行修复或回滚。"} />}{incidents.length > 0 && <section className="incident-list">{incidents.map((incident) => <article key={incident.id}><span className="severity">{incident.severity}</span><div><strong>{incident.alert_name ?? "未命名告警"}</strong><p>{incident.summary ?? "暂无摘要"}</p><small>{incident.service ?? "未知服务"} · {incident.created_at ?? "时间未知"}</small></div><em>{incident.status}</em></article>)}</section>}<div className="approval-boundary"><ShieldCheck /><div><strong>人工审批边界</strong><p>本工作台只读显示事故。回滚和其他写操作必须经过服务端身份验证与人工审批。</p></div></div></>;
}

function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return <header className="page-header"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-actions">{actions}</div>}</header>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><Check /><strong>{title}</strong><p>{description}</p></div>;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="error-state"><AlertCircle /><div><strong>无法连接本机 Opspilot API</strong><p>API 可能还没有启动。工作台其他课程仍可正常使用。</p></div><button className="secondary-btn" onClick={onRetry}><RefreshCw />重试</button></div>;
}

function ConfirmModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop" onClick={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span>学习进度</span><h2 id="reset-title">确定从头开始吗？</h2></div><button className="icon-button" aria-label="关闭" onClick={onClose}><X /></button></div><p>只会清除当前浏览器里的课程进度和终端记录，不会删除集群、代码或事故数据。</p><div className="modal-actions"><button className="secondary-btn" onClick={onClose}>取消</button><button className="danger-btn" onClick={onConfirm}><Trash2 />确认重置</button></div></div></div>;
}

function ReferenceModal({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" onClick={onClose}><div className="modal reference-modal" role="dialog" aria-modal="true" aria-labelledby="reference-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span>随时可以查</span><h2 id="reference-title">术语表和官方资料</h2></div><button className="icon-button" aria-label="关闭" onClick={onClose}><X /></button></div><h3>通俗术语表</h3><div className="glossary-list">{glossary.map((item) => <div key={item.term}><strong>{item.term}</strong><span>{item.plain}</span><p>{item.detail}</p></div>)}</div><h3>官方学习资料</h3><div className="docs-list">{docs.map((doc) => <a href={doc.url} target="_blank" rel="noreferrer" key={doc.url}><BookOpen /><span><strong>{doc.name}</strong><small>{doc.desc}</small></span><ExternalLink /></a>)}</div></div></div>;
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root mount point");
createRoot(root).render(<App />);
