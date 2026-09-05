import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertCircle, AlertTriangle, BookOpen, Check, ChevronRight, CircleHelp,
  Clock3, Command, Container, ExternalLink, FileCode2, Gauge, Layers3, ListChecks,
  Menu, Moon, Play, PlugZap, RefreshCw, RotateCcw, Search, Server, ShieldCheck,
  Sun, Terminal, Trash2, X,
} from "lucide-react";
import "./styles.css";

type LabState = "todo" | "active" | "done";
type Lab = { id: string; title: string; subtitle: string; duration: string };
type Resource = { kind: string; name: string; status: string; detail: string; tone: "good" | "warn" | "muted" };
type ConnectionState = "mock" | "connecting" | "live" | "error";
type View = "overview" | "learn" | "cluster" | "incidents";
type LabApiResponse = { query: string; ok: boolean; output?: string; error?: string };
type Incident = { id: string; title: string; status: string; severity: string; created_at?: string };

const labs: Lab[] = [
  { id: "00", title: "环境检查", subtitle: "Docker、kubectl、Kind", duration: "10 分钟" },
  { id: "01", title: "Docker 基础", subtitle: "镜像、容器、端口", duration: "25 分钟" },
  { id: "02", title: "Kind 集群", subtitle: "节点、上下文、命名空间", duration: "30 分钟" },
  { id: "03", title: "部署一个应用", subtitle: "Pod、Deployment、Service", duration: "35 分钟" },
  { id: "04", title: "故障排查", subtitle: "日志、探针、滚动更新", duration: "45 分钟" },
];
const baseResources: Resource[] = [
  { kind: "Deployment", name: "hello-web", status: "Progressing", detail: "0/2 available · image pull timeout", tone: "warn" },
  { kind: "Service", name: "hello-web", status: "Created", detail: "ClusterIP · port 80", tone: "good" },
  { kind: "Pod", name: "hello-web-7f6d9d9c8c-2kq8m", status: "Pending", detail: "ContainerCreating", tone: "warn" },
  { kind: "Pod", name: "hello-web-7f6d9d9c8c-qxj2p", status: "Pending", detail: "ContainerCreating", tone: "warn" },
];
const commands = [
  "kubectl config current-context", "kubectl get nodes",
  "kubectl -n learning get deploy,pods,svc", "kubectl -n learning describe pod -l app=hello-web",
];
const docs = [
  { name: "Kubernetes 官方文档", desc: "概念、教程与任务", url: "https://kubernetes.io/zh-cn/docs/home/" },
  { name: "Docker 官方文档", desc: "镜像、容器与 Compose", url: "https://docs.docker.com/" },
  { name: "Kind 官方 Quick Start", desc: "本地集群与多节点配置", url: "https://kind.sigs.k8s.io/docs/user/quick-start/" },
  { name: "kubectl 命令参考", desc: "每条命令的参数与示例", url: "https://kubernetes.io/zh-cn/docs/reference/kubectl/" },
  { name: "Opspilot-2 故障演练", desc: "Prometheus 到人工审批", url: "../../docs/kind-demo-zh.md" },
];
const mockEvents = [
  { tone: "warn", title: "Failed to pull image", detail: "nginx:1.27-alpine · hello-web", time: "2 分钟前" },
  { tone: "good", title: "Service created", detail: "hello-web · ClusterIP 10.96.42.19", time: "4 分钟前" },
  { tone: "muted", title: "Deployment applied", detail: "hello-web · replicas 2", time: "4 分钟前" },
];
const mockLogs = [
  "2026-09-05T16:42:01Z  nginx  starting worker process",
  "2026-09-05T16:42:02Z  kubelet  readiness probe pending",
  "2026-09-05T16:42:33Z  kubelet  Failed to pull image nginx:1.27-alpine",
];

function loadProgress(): Record<string, LabState> {
  try {
    const value = JSON.parse(localStorage.getItem("opspilot-learning-progress") ?? "{}");
    return typeof value === "object" && value ? value : {};
  } catch { return {}; }
}

function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [view, setView] = useState<View>("overview");
  const [selectedLab, setSelectedLab] = useState("00");
  const [progress, setProgress] = useState<Record<string, LabState>>(loadProgress);
  const [resources, setResources] = useState(baseResources);
  const [events, setEvents] = useState(mockEvents);
  const [logs, setLogs] = useState(mockLogs);
  const [connection, setConnection] = useState<ConnectionState>("mock");
  const [showDocs, setShowDocs] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [command, setCommand] = useState(commands[0]);
  const [terminalLines, setTerminalLines] = useState<string[]>(["$ kubectl config current-context", "kind-k8s-lab", "$ kubectl get nodes", "k8s-lab-control-plane   Ready   control-plane   3m"]);
  const [notice, setNotice] = useState("从环境检查开始，完成每一关后再解锁下一关");
  const selected = labs.find((lab) => lab.id === selectedLab) ?? labs[0];
  const doneCount = labs.filter((lab) => progress[lab.id] === "done").length;
  const readyCount = resources.filter((item) => item.tone === "good").length;
  const stateOf = (id: string): LabState => progress[id] ?? (id === selectedLab ? "active" : "todo");
  useEffect(() => { localStorage.setItem("opspilot-learning-progress", JSON.stringify(progress)); }, [progress]);

  const fetchLabQuery = async (query: string) => {
    const response = await fetch(`${import.meta.env.VITE_LAB_API_URL ?? "http://127.0.0.1:8787"}/?query=${query}`);
    const payload = (await response.json()) as LabApiResponse;
    if (!response.ok || !payload.ok || !payload.output) throw new Error(payload.error ?? `${query} unavailable`);
    return payload.output;
  };
  const connectLive = async () => {
    setConnection("connecting");
    try {
      const [resourceOutput, eventOutput, logOutput] = await Promise.all([fetchLabQuery("resources"), fetchLabQuery("events"), fetchLabQuery("logs")]);
      const ready = /hello-web\s+2\/2\s+2\s+2/.test(resourceOutput);
      setResources((items) => items.map((item) => {
        if (item.kind === "Service") return { ...item, status: "ClusterIP", detail: "read from k8s-lab · port 80", tone: "good" };
        if (ready) return { ...item, status: item.kind === "Deployment" ? "Available" : "Running", detail: item.kind === "Deployment" ? "2/2 available · read from k8s-lab" : "Running · read from k8s-lab", tone: "good" };
        return item;
      }));
      const eventRows = eventOutput.split("\n").filter((line) => line.trim() && !line.startsWith("LAST SEEN"));
      if (eventRows.length) setEvents(eventRows.slice(-5).reverse().map((line, index) => ({ tone: line.includes("Failed") ? "warn" : "muted", title: line.includes("Failed") ? "Failed to pull image" : "集群事件", detail: line.trim(), time: `${index + 1} 分钟前` })));
      if (logOutput.trim()) setLogs(logOutput.split("\n").filter(Boolean));
      setConnection("live"); setNotice("已连接 k8s-lab，只读状态已更新");
    } catch { setConnection("error"); setNotice("无法连接只读 API，当前保留模拟数据；启动 lab-api 后可重试"); }
  };
  const runCommand = () => {
    const output = command === commands[0] ? "kind-k8s-lab" : command === commands[1] ? "k8s-lab-control-plane   Ready   control-plane   3m" : command === commands[2] ? "hello-web   0/2   2   0   4m   Pending" : "Events: Failed to pull image nginx:1.27-alpine";
    setTerminalLines((lines) => [...lines, `$ ${command}`, output]); setNotice("命令已执行，输出已追加到终端");
  };
  const completeLab = () => {
    setProgress((current) => ({ ...current, [selectedLab]: "done" }));
    const next = labs.find((lab) => Number(lab.id) > Number(selectedLab) && stateOf(lab.id) !== "done");
    if (next) { setSelectedLab(next.id); setNotice(`阶段 ${selectedLab} 已完成，已解锁阶段 ${next.id}`); } else setNotice("全部学习阶段已完成");
  };
  const resetProgress = () => { localStorage.removeItem("opspilot-learning-progress"); setProgress({}); setSelectedLab("00"); setView("learn"); setShowReset(false); setNotice("学习进度已重置，从阶段 00 开始"); };
  const selfCheck = () => { const context = terminalLines.some((line) => line.includes("kind-k8s-lab")); const evidence = terminalLines.some((line) => line.includes("Failed to pull image")); setNotice(context && evidence ? "自检通过：context 正确，已找到镜像拉取证据" : "自检提示：先执行 context 和 describe 命令，再提交判断"); };
  const connectionLabel = connection === "connecting" ? "连接中" : connection === "live" ? "实机只读" : connection === "error" ? "连接失败" : "本地模拟";
  const selectView = (next: View) => { setView(next); setMobileNav(false); };

  return <div className={`app-shell ${theme}`}>
    <header className="topbar"><button className="mobile-menu icon-button" aria-label="打开导航" onClick={() => setMobileNav((open) => !open)}><Menu size={19} /></button><div className="brand"><div className="brand-mark"><Layers3 size={17} /></div><div><strong>Opspilot</strong><span>学习工作台</span></div></div><div className="context-pill"><span className="pulse" /><span>学习集群</span><code>kind-k8s-lab</code><ChevronRight size={14} /></div><div className="top-actions"><span className={`sync-status ${connection}`}><Activity size={14} /> {connectionLabel}</span><button className="connect-btn" onClick={connectLive} disabled={connection === "connecting"}><PlugZap size={14} /><span>{connection === "live" ? "刷新实机" : "连接实机"}</span></button><button className="icon-button" aria-label={theme === "light" ? "切换深色模式" : "切换浅色模式"} onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}>{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button><button className="icon-button" aria-label="打开官方文档" onClick={() => setShowDocs(true)}><BookOpen size={18} /></button><div className="avatar">孔</div></div></header>
    <div className="layout"><aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}><div className="side-heading"><span>工作台</span><button className="sidebar-close icon-button" aria-label="关闭导航" onClick={() => setMobileNav(false)}><X size={16} /></button></div><nav className="primary-nav" aria-label="工作台模块"><button className={view === "overview" ? "nav-item active" : "nav-item"} onClick={() => selectView("overview")}><Gauge size={15} />概览<span>Overview</span></button><button className={view === "learn" ? "nav-item active" : "nav-item"} onClick={() => selectView("learn")}><ListChecks size={15} />学习路径<span>{doneCount}/{labs.length}</span></button><button className={view === "cluster" ? "nav-item active" : "nav-item"} onClick={() => selectView("cluster")}><Server size={15} />集群资源<span>Cluster</span></button><button className={view === "incidents" ? "nav-item active" : "nav-item"} onClick={() => selectView("incidents")}><AlertCircle size={15} />事故中心<span>Opspilot</span></button></nav><div className="side-divider" /><div className="side-heading path-heading"><span>学习阶段</span><span className="progress">{doneCount}/{labs.length}</span></div><div className="path-track" /><nav className="lab-list" aria-label="学习阶段">{labs.map((lab) => { const state = stateOf(lab.id); const locked = state === "todo" && Number(lab.id) > doneCount; return <button key={lab.id} className={`lab-item ${selectedLab === lab.id ? "selected" : ""} ${state}`} onClick={() => { if (!locked) { setSelectedLab(lab.id); setView("learn"); setMobileNav(false); } }} disabled={locked}><span className="lab-index">{state === "done" ? <Check size={14} /> : lab.id}</span><span className="lab-copy"><strong>{lab.title}</strong><small>{lab.subtitle}</small><small className="lab-meta"><Clock3 size={12} /> {lab.duration}</small></span><span className={`lab-state ${state}`}>{state === "done" ? "已完成" : state === "active" ? "进行中" : "未解锁"}</span></button>; })}</nav><div className="sidebar-foot"><ShieldCheck size={15} /><span>安全边界</span><p>只读 <code>k8s-lab</code>，不会修改 Opspilot-2。</p><button className="reset-link" onClick={() => setShowReset(true)}><Trash2 size={12} /> 重置进度</button></div></aside>
      <main className="main-content">{view === "overview" && <OverviewView doneCount={doneCount} readyCount={readyCount} connection={connection} onLearn={() => selectView("learn")} onCluster={() => selectView("cluster")} onConnect={connectLive} />}{view === "learn" && <LearnView selected={selected} selectedLab={selectedLab} labs={labs} progress={progress} command={command} setCommand={setCommand} runCommand={runCommand} terminalLines={terminalLines} setTerminalLines={setTerminalLines} selfCheck={selfCheck} completeLab={completeLab} notice={notice} onGuide={() => setShowDocs(true)} onRecord={() => setNotice("当前阶段状态已记录到本地练习日志")} />}{view === "cluster" && <ClusterView resources={resources} events={events} logs={logs} connection={connection} onConnect={connectLive} onRefresh={connectLive} />}{view === "incidents" && <IncidentView onDocs={() => setShowDocs(true)} />}</main></div>
    {showReset && <div className="modal-backdrop" onClick={() => setShowReset(false)}><div className="guide-modal confirm-modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">学习进度 / PROGRESS</span><h2>重置学习进度？</h2></div><button className="icon-button" onClick={() => setShowReset(false)} aria-label="关闭"><X size={18} /></button></div><p>这会清除本浏览器保存的 5 个阶段进度，集群资源和代码不会受到影响。</p><div className="modal-actions"><button className="secondary-btn" onClick={() => setShowReset(false)}>取消</button><button className="danger-btn" onClick={resetProgress}><Trash2 size={14} />确认重置</button></div></div></div>}
    {showDocs && <div className="modal-backdrop" onClick={() => setShowDocs(false)}><div className="guide-modal docs-modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">官方资料 / REFERENCES</span><h2>随时查文档</h2></div><button className="icon-button" onClick={() => setShowDocs(false)} aria-label="关闭"><X size={18} /></button></div><p>遇到不会的命令先查权威资料。外部页面只读打开，不会把 Token 或内部地址带出工作台。</p><div className="docs-list">{docs.map((doc) => <a key={doc.url} className="doc-link" href={doc.url} target="_blank" rel="noreferrer"><BookOpen size={15} /><span><strong>{doc.name}</strong><small>{doc.desc}</small></span><ExternalLink size={14} /></a>)}</div></div></div>}
  </div>;
}

function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) { return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="head-actions">{actions}</div>}</div>; }

function OverviewView({ doneCount, readyCount, connection, onLearn, onCluster, onConnect }: { doneCount: number; readyCount: number; connection: ConnectionState; onLearn: () => void; onCluster: () => void; onConnect: () => void }) { return <><PageHeader eyebrow="工作台 / OVERVIEW" title="学习控制台" description="从概念、命令到真实集群证据，按阶段完成 Kubernetes 实操。" actions={<><button className="secondary-btn" onClick={onCluster}><Server size={15} />查看集群</button><button className="primary-btn" onClick={onLearn}><Play size={15} />继续学习</button></>} /><section className="hero-strip"><div><span className="hero-kicker">BEGINNER → OPERATOR</span><h2>把每一次故障都变成可验证的知识。</h2><p>先在隔离的 k8s-lab 里练习，再通过只读连接观察 Opspilot 的真实证据链。</p></div><div className="hero-progress"><div className="progress-ring"><strong>{doneCount}</strong><span>/ 5</span></div><div><strong>学习进度</strong><small>{doneCount === 0 ? "从环境检查开始" : `已完成 ${doneCount} 个阶段`}</small></div></div></section><section className="overview-grid"><div className="overview-cell"><span>学习进度</span><strong>{doneCount}/5 <span className="muted-text">阶段完成</span></strong><small>完成当前关卡后自动解锁下一关</small></div><div className="overview-cell"><span>集群连接</span><strong className={connection === "live" ? "good-text" : ""}><span className={`status-dot ${connection === "live" ? "good" : "warn"}`} />{connection === "live" ? "实机只读" : "本地模拟"}</strong><small>{connection === "live" ? "k8s-lab · 已同步" : "点击右上角连接实机"}</small></div><div className="overview-cell"><span>学习资源</span><strong><Layers3 size={15} />4 类资源</strong><small>Deployment · Pod · Service · Event</small></div><div className="overview-cell"><span>工作负载</span><strong>{readyCount === 4 ? "2/2" : "0/2"} <span className="muted-text">副本可用</span></strong><small>{readyCount === 4 ? "hello-web 正常" : "等待镜像拉取"}</small></div></section><div className="overview-columns"><section className="panel next-panel"><div className="panel-head"><div><h2>接下来做什么</h2><p>按顺序完成，别跳过证据</p></div><button className="text-btn" onClick={onLearn}>查看路径 <ChevronRight size={14} /></button></div><div className="next-step"><span className="next-index">{String(Math.min(doneCount, 4)).padStart(2, "0")}</span><div><strong>{doneCount === 0 ? "先完成环境检查" : "继续当前学习阶段"}</strong><p>{doneCount === 0 ? "确认 Docker、Kind 和 kubectl 都能工作。" : "执行只读命令，记录状态、事件和日志。"}</p></div><button className="primary-btn" onClick={onLearn}>开始 <ChevronRight size={14} /></button></div></section><section className="panel safety-panel"><div className="panel-head"><div><h2>运行边界</h2><p>当前工作台的安全默认值</p></div><ShieldCheck size={17} className="panel-icon" /></div><div className="safety-list"><div><Check size={14} />默认只读，不执行任意 Shell</div><div><Check size={14} />只连接 <code>kind-k8s-lab</code></div><div><Check size={14} />回滚必须经过 Opspilot 人工审批</div></div><button className="outline-btn full" onClick={onConnect}><PlugZap size={14} />{connection === "live" ? "刷新只读状态" : "连接学习集群"}</button></section></div></>; }

function LearnView({ selected, selectedLab, labs: allLabs, progress, command, setCommand, runCommand, terminalLines, setTerminalLines, selfCheck, completeLab, notice, onGuide, onRecord }: { selected: Lab; selectedLab: string; labs: Lab[]; progress: Record<string, LabState>; command: string; setCommand: (value: string) => void; runCommand: () => void; terminalLines: string[]; setTerminalLines: (value: string[] | ((current: string[]) => string[])) => void; selfCheck: () => void; completeLab: () => void; notice: string; onGuide: () => void; onRecord: () => void }) { const isDone = progress[selectedLab] === "done"; return <><PageHeader eyebrow={`学习阶段 ${selectedLab} / ${allLabs.length}`} title={selected.title} description={`${selected.subtitle} · 先观察，再操作，最后完成验收。`} actions={<><button className="secondary-btn" onClick={onGuide}><BookOpen size={15} />本节资料</button><button className="primary-btn" onClick={completeLab} disabled={isDone}><Check size={15} />{isDone ? "已完成" : "完成本节"}</button></>} /><div className="notice" role="status" aria-live="polite"><AlertTriangle size={16} /><span>{notice}</span><button onClick={onRecord}>记录状态</button></div><div className="learn-layout"><section className="panel lesson-panel"><div className="panel-head"><div><h2>本节任务</h2><p>阶段 {selectedLab} · {selected.duration}</p></div><span className={`state-tag ${isDone ? "good" : "warn"}`}><span className="status-dot" />{isDone ? "已完成" : "进行中"}</span></div><div className="lesson-body"><div className="lesson-goal"><span className="goal-icon"><ListChecks size={18} /></span><div><strong>你要掌握什么</strong><p>{selectedLab === "00" ? "确认本机工具可用，并理解 Docker、Kind、kubectl 的分工。" : selectedLab === "01" ? "理解镜像、容器和端口的关系。" : selectedLab === "02" ? "理解 Kind 节点、kubectl context 和 Namespace 的关系。" : selectedLab === "03" ? "理解 Deployment、Pod、Service 的职责和期望状态。" : "学会从状态、事件、日志找到故障证据并恢复。"}</p></div></div><div className="checkpoint-list"><div><span>1</span><div><strong>执行预置只读命令</strong><small>命令输出会保留在下方终端</small></div></div><div><span>2</span><div><strong>对照资源状态和事件</strong><small>不要只看 Pod 是否 Running</small></div></div><div><span>3</span><div><strong>完成自检并标记本节</strong><small>完成后解锁下一阶段</small></div></div></div><button className="outline-btn" onClick={selfCheck}><ShieldCheck size={14} />运行自检</button></div></section><section className="panel command-panel"><div className="panel-head"><div><h2>练习命令</h2><p>只允许预置的 kubectl 查询</p></div><Command size={17} className="panel-icon" /></div><div className="command-body"><label htmlFor="command-select">选择一条命令</label><select id="command-select" value={command} onChange={(event) => setCommand(event.target.value)}>{commands.map((item) => <option key={item}>{item}</option>)}</select><button className="primary-btn full" onClick={runCommand}><Play size={14} />执行命令</button><div className="command-tip"><CircleHelp size={14} /><span>不会修改集群，只展示可复现的查询结果。</span></div></div></section></div><section className="terminal-panel"><div className="terminal-head"><span><Terminal size={15} /> 实验终端</span><span className="terminal-readonly">本地模拟 · 只读命令</span><button className="terminal-clear" onClick={() => setTerminalLines([])} aria-label="清空终端"><Trash2 size={14} /></button></div><div className="terminal-body">{terminalLines.map((line, index) => <div key={`${line}-${index}`} className={line.startsWith("$") ? "terminal-command" : "terminal-output"}>{line}</div>)}<span className="cursor" /></div></section></>;
}

function ClusterView({ resources, events, logs, connection, onConnect, onRefresh }: { resources: Resource[]; events: { tone: string; title: string; detail: string; time: string }[]; logs: string[]; connection: ConnectionState; onConnect: () => void; onRefresh: () => void }) { const [tab, setTab] = useState<"resources" | "events" | "logs">("resources"); return <><PageHeader eyebrow="集群 / CLUSTER" title="集群资源" description="观察 k8s-lab 的工作负载、事件和日志，所有查询都是只读。" actions={<><button className="secondary-btn" onClick={onRefresh}><RefreshCw size={15} />刷新</button><button className="primary-btn" onClick={onConnect}><PlugZap size={15} />{connection === "live" ? "实机已连接" : "连接实机"}</button></>} /><div className="cluster-banner"><div><span className="status-dot good" />{connection === "live" ? "k8s-lab 实机状态" : "k8s-lab 模拟状态"}<small>kind-k8s-lab · namespace learning</small></div><div className="cluster-meta"><span>Docker Engine</span><strong>29.7.2</strong><span>节点</span><strong>1 Ready</strong></div></div><div className="tab-bar" role="tablist">{(["resources", "events", "logs"] as const).map((item) => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? "tab active" : "tab"} onClick={() => setTab(item)}>{item === "resources" ? <><Server size={14} />资源清单</> : item === "events" ? <><AlertTriangle size={14} />集群事件</> : <><FileCode2 size={14} />容器日志</>}</button>)}</div>{tab === "resources" && <ResourceTable resources={resources} />}{tab === "events" && <EventList events={events} />}{tab === "logs" && <LogPanel logs={logs} />}</>; }
function ResourceTable({ resources }: { resources: Resource[] }) { const [onlyIssues, setOnlyIssues] = useState(false); const visible = onlyIssues ? resources.filter((resource) => resource.tone === "warn") : resources; return <section className="panel resource-panel"><div className="panel-head"><div><h2>资源清单</h2><p>Namespace / learning · read-only</p></div><button className="filter-btn" onClick={() => setOnlyIssues((current) => !current)}><Search size={14} />{onlyIssues ? "显示全部" : "只看异常"} <ChevronRight size={14} /></button></div><div className="resource-table"><div className="table-row table-header"><span>类型</span><span>名称</span><span>状态</span><span>详情</span></div>{visible.map((resource) => <div className="table-row" key={resource.name}><span className="resource-kind"><span className="kind-icon"><Server size={14} /></span>{resource.kind}</span><strong>{resource.name}</strong><span className={`state-tag ${resource.tone}`}><span className="status-dot" />{resource.status}</span><span className="resource-detail">{resource.detail}</span></div>)}</div><div className="panel-foot"><span>数据来源：k8s-lab · 只读快照</span><span className="snapshot-label"><ExternalLink size={13} />YAML 只读快照</span></div></section>; }
function EventList({ events }: { events: { tone: string; title: string; detail: string; time: string }[] }) { return <section className="panel event-panel"><div className="panel-head"><div><h2>集群事件</h2><p>按时间排序 · evidence</p></div><span className="filter-note">最近 {events.length} 条</span></div><div className="timeline">{events.map((event, index) => <div className="event" key={`${event.title}-${index}`}><span className="event-line" /><span className={`event-icon ${event.tone}`}><AlertTriangle size={13} /></span><div><strong>{event.title}</strong><p>{event.detail}</p><time>{event.time}</time></div></div>)}</div></section>; }
function LogPanel({ logs }: { logs: string[] }) { return <section className="panel logs-panel"><div className="panel-head"><div><h2>容器日志</h2><p>hello-web · 最近 20 行</p></div><Terminal size={17} className="panel-icon" /></div><div className="log-output">{logs.map((line) => <div key={line}>{line}</div>)}</div><div className="panel-foot"><span>日志已脱敏 · 只读</span></div></section>; }
function IncidentView({ onDocs }: { onDocs: () => void }) { const [state, setState] = useState<"idle" | "loading" | "live" | "error">("idle"); const [incidents, setIncidents] = useState<Incident[]>([]); const [message, setMessage] = useState(""); const loadIncidents = async () => { setState("loading"); setMessage(""); try { const base = import.meta.env.VITE_OPSPILOT_API_URL ?? "http://127.0.0.1:8000"; const health = await fetch(`${base}/health`); if (!health.ok) throw new Error("health check failed"); const response = await fetch(`${base}/incidents`); if (!response.ok) throw new Error("incident list failed"); const payload = await response.json(); setIncidents(Array.isArray(payload) ? payload : payload.incidents ?? []); setState("live"); } catch { setState("error"); setMessage("无法连接 Opspilot API。请先运行 make run，或继续使用本地学习集群练习。"); } }; return <><PageHeader eyebrow="事故中心 / OPSPILOT" title="事故响应" description="把告警、调查证据和人工审批放在同一条可追溯流程里。" actions={<><button className="secondary-btn" onClick={onDocs}><BookOpen size={15} />查看流程文档</button><button className="primary-btn" onClick={loadIncidents} disabled={state === "loading"}><RefreshCw size={14} />{state === "loading" ? "连接中" : state === "live" ? "刷新事故" : "连接 Opspilot"}</button></>} />{state === "error" && <div className="notice error" role="alert"><AlertCircle size={16} /><span>{message}</span></div>}{incidents.length === 0 ? <section className="incident-empty"><div className="incident-icon"><ShieldCheck size={22} /></div><h2>{state === "live" ? "当前没有事故" : "连接后查看事故"}</h2><p>连接本机 Opspilot API 后，这里会显示 Alertmanager 告警、调查 Job、修复提案和审计时间线。工作台只读取状态，不替你执行变更。</p><div className="incident-flow"><span><AlertCircle size={15} />告警</span><ChevronRight size={14} /><span><Activity size={15} />调查</span><ChevronRight size={14} /><span><ShieldCheck size={15} />审批</span><ChevronRight size={14} /><span><Check size={15} />验证</span></div><button className="outline-btn" onClick={onDocs}><BookOpen size={14} />先看 Opspilot 流程</button></section> : <section className="panel incident-list"><div className="panel-head"><div><h2>事故列表</h2><p>只读同步 · {incidents.length} 条记录</p></div><span className="live-tag"><span className="status-dot good" />API 已连接</span></div>{incidents.map((incident) => <div className="incident-row" key={incident.id}><span className="incident-severity">{incident.severity || "告警"}</span><div><strong>{incident.title || incident.id}</strong><small>{incident.id} · {incident.created_at || "时间未知"}</small></div><span className="state-tag warn">{incident.status || "received"}</span></div>)}</section>}<section className="ops-boundary"><div><ShieldCheck size={17} /><div><strong>人工审批门</strong><p>工作台不会替你执行回滚。真实 Opspilot 提案必须经过服务端身份验证、作用域匹配和人工批准。</p></div></div><code>proposal → approval → execute</code></section></>; }

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root mount point");
createRoot(root).render(<App />);
