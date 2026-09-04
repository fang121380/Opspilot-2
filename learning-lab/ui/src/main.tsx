import { createRoot } from "react-dom/client";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  Container,
  ExternalLink,
  Gauge,
  GitBranch,
  Layers3,
  Moon,
  Play,
  PlugZap,
  RotateCcw,
  Server,
  ShieldCheck,
  Sun,
  Terminal,
  X,
} from "lucide-react";
import "./styles.css";

type Lab = { id: string; title: string; subtitle: string; duration: string; state: "done" | "active" | "locked" };
type Resource = { kind: string; name: string; status: string; detail: string; tone: "good" | "warn" | "muted" };
type ConnectionState = "mock" | "connecting" | "live" | "error";
type LabApiResponse = { query: string; ok: boolean; output?: string; error?: string };

const labs: Lab[] = [
  { id: "00", title: "环境检查", subtitle: "Docker、kubectl、Kind", duration: "10 分钟", state: "done" },
  { id: "01", title: "Docker 基础", subtitle: "镜像、容器、端口", duration: "25 分钟", state: "done" },
  { id: "02", title: "Kind 集群", subtitle: "节点、上下文、命名空间", duration: "30 分钟", state: "active" },
  { id: "03", title: "部署一个应用", subtitle: "Pod、Deployment、Service", duration: "35 分钟", state: "locked" },
  { id: "04", title: "故障排查", subtitle: "日志、探针、滚动更新", duration: "45 分钟", state: "locked" },
];

const baseResources: Resource[] = [
  { kind: "Deployment", name: "hello-web", status: "Progressing", detail: "0/2 available · image pull timeout", tone: "warn" },
  { kind: "Service", name: "hello-web", status: "Created", detail: "ClusterIP · port 80", tone: "good" },
  { kind: "Pod", name: "hello-web-7f6d9d9c8c-2kq8m", status: "Pending", detail: "ContainerCreating", tone: "warn" },
  { kind: "Pod", name: "hello-web-7f6d9d9c8c-qxj2p", status: "Pending", detail: "ContainerCreating", tone: "warn" },
];

const commands = [
  "kubectl config current-context",
  "kubectl get nodes",
  "kubectl -n learning get deploy,pods,svc",
  "kubectl -n learning describe pod -l app=hello-web",
];

const docs = [
  { name: "Kubernetes 官方文档", desc: "概念、教程与任务", url: "https://kubernetes.io/zh-cn/docs/home/" },
  { name: "Docker 官方文档", desc: "镜像、容器与 Compose", url: "https://docs.docker.com/" },
  { name: "Kind 官方 Quick Start", desc: "本地集群与多节点配置", url: "https://kind.sigs.k8s.io/docs/user/quick-start/" },
  { name: "kubectl 命令参考", desc: "每条命令的参数与示例", url: "https://kubernetes.io/zh-cn/docs/reference/kubectl/" },
  { name: "项目故障演练", desc: "Opspilot-2 的真实闭环", url: "../../docs/kind-demo-zh.md" },
];

function statusLabel(lab: Lab) {
  if (lab.state === "done") return "已完成";
  if (lab.state === "active") return "进行中";
  return "未解锁";
}

function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [selectedLab, setSelectedLab] = useState("02");
  const [resources, setResources] = useState(baseResources);
  const [showGuide, setShowGuide] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("mock");
  const [command, setCommand] = useState(commands[0]);
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "$ kubectl config current-context",
    "kind-k8s-lab",
    "$ kubectl get nodes",
    "k8s-lab-control-plane   Ready   control-plane   3m",
  ]);
  const [notice, setNotice] = useState("学习集群正在等待镜像就绪");
  const selected = labs.find((lab) => lab.id === selectedLab) ?? labs[2];
  const readyCount = useMemo(() => resources.filter((item) => item.tone === "good").length, [resources]);

  const connectLive = async () => {
    setConnection("connecting");
    try {
      const response = await fetch(`${import.meta.env.VITE_LAB_API_URL ?? "http://127.0.0.1:8787"}/?query=resources`);
      const payload = (await response.json()) as LabApiResponse;
      if (!response.ok || !payload.ok || !payload.output) throw new Error(payload.error ?? "lab-api unavailable");
      const ready = /deployment\.apps\/hello-web\s+2\/2\s+2\s+2/.test(payload.output);
      setResources((items) => items.map((item) => {
        if (item.kind === "Service") return { ...item, status: "ClusterIP", detail: "read from k8s-lab · port 80", tone: "good" };
        if (ready) return { ...item, status: item.kind === "Deployment" ? "Available" : "Running", detail: item.kind === "Deployment" ? "2/2 available · read from k8s-lab" : "Running · read from k8s-lab", tone: "good" };
        return item;
      }));
      setConnection("live");
      setNotice("已连接 k8s-lab，只读状态已更新");
    } catch {
      setConnection("error");
      setNotice("无法连接只读 API：保持模拟数据，可运行 make -C learning-lab api 后重试");
    }
  };

  const connectionLabel = connection === "connecting" ? "连接中" : connection === "live" ? "实机只读" : connection === "error" ? "连接失败" : "本地模拟";

  const runCommand = () => {
    const output = command === commands[0]
      ? "kind-k8s-lab"
      : command === commands[1]
        ? "k8s-lab-control-plane   Ready   control-plane   3m"
        : command === commands[2]
          ? "hello-web   0/2   2   0   4m   Pending"
          : "Events: Failed to pull image nginx:1.27-alpine";
    setTerminalLines((lines) => [...lines, `$ ${command}`, output]);
    setNotice("命令已执行，输出已追加到终端");
  };

  const selfCheck = () => {
    const hasContext = terminalLines.some((line) => line.includes("kind-k8s-lab"));
    const hasEvidence = terminalLines.some((line) => line.includes("Failed to pull image"));
    setNotice(hasContext && hasEvidence ? "自检通过：context 正确，已找到镜像拉取证据" : "自检提示：先执行 context 和 describe 命令，再提交判断");
  };

  const retryImage = () => {
    setResources((items) => items.map((item) => item.kind === "Deployment" || item.kind === "Pod" ? { ...item, status: "Ready", detail: item.kind === "Deployment" ? "2/2 available · nginx:1.27-alpine" : "Running", tone: "good" } : item));
    setNotice("已模拟重新拉取镜像，hello-web 现在可用");
  };

  return (
    <div className={`app-shell ${theme}`}>
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><Layers3 size={17} /></div><div><strong>Opspilot</strong><span>学习工作台</span></div></div>
        <div className="context-pill"><span className="pulse" /> <span>学习集群</span><code>kind-k8s-lab</code><ChevronRight size={14} /></div>
        <div className="top-actions"><span className={`sync-status ${connection}`}><Activity size={14} /> {connectionLabel}</span><button className="connect-btn" onClick={connectLive} disabled={connection === "connecting"}><PlugZap size={14} /> {connection === "live" ? "刷新实机" : "连接实机"}</button><button className="icon-button" aria-label={theme === "light" ? "切换深色模式" : "切换浅色模式"} onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}>{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button><button className="icon-button" aria-label="打开官方文档" onClick={() => setShowDocs(true)}><BookOpen size={18} /></button><button className="icon-button" aria-label="帮助" onClick={() => setShowGuide(true)}><CircleHelp size={18} /></button><div className="avatar">孔</div></div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="side-heading"><span>学习路径</span><span className="progress">2/5</span></div>
          <div className="path-track" />
          <nav className="lab-list" aria-label="学习阶段">
            {labs.map((lab) => <button key={lab.id} className={`lab-item ${selectedLab === lab.id ? "selected" : ""} ${lab.state}`} onClick={() => lab.state !== "locked" && setSelectedLab(lab.id)} disabled={lab.state === "locked"}>
              <span className="lab-index">{lab.state === "done" ? <Check size={14} /> : lab.id}</span><span className="lab-copy"><strong>{lab.title}</strong><small>{lab.subtitle}</small><small className="lab-meta"><Clock3 size={12} /> {lab.duration}</small></span><span className={`lab-state ${lab.state}`}>{statusLabel(lab)}</span>
            </button>)}
          </nav>
          <div className="sidebar-foot"><ShieldCheck size={15} /><span>安全边界</span><p>只操作 <code>k8s-lab</code>，不会修改 Opspilot-2。</p></div>
        </aside>

        <main className="main-content">
          <div className="page-head"><div><div className="eyebrow">阶段 {selected.id} / 05 · KIND CLUSTER</div><h1>{selected.title}</h1><p>{selected.subtitle} · 这一步先观察集群，再动手操作。</p></div><div className="head-actions"><button className="secondary-btn" onClick={() => setShowGuide(true)}><CircleHelp size={15} /> 查看本节目标</button><button className="primary-btn" onClick={retryImage}><RotateCcw size={15} /> 重试镜像</button></div></div>
          <div className="notice" role="status" aria-live="polite"><AlertTriangle size={16} /><span>{notice}</span><button onClick={() => setNotice("已记录当前状态")}>记录状态</button></div>

          <section className="overview-grid"><div className="overview-cell"><span>集群状态</span><strong className="good-text"><span className="status-dot good" /> Ready</strong><small>control-plane · 1 node</small></div><div className="overview-cell"><span>命名空间</span><strong><Layers3 size={15} /> learning</strong><small>4 个资源 / 4 resources</small></div><div className="overview-cell"><span>工作负载</span><strong>{readyCount === 4 ? "2/2" : "0/2"} <span className="muted-text">副本可用</span></strong><small>{readyCount === 4 ? "所有 Pod 正常" : "等待镜像拉取"}</small></div><div className="overview-cell"><span>运行时</span><strong><Container size={15} /> Docker</strong><small>Docker Engine 29.7.2</small></div></section>

          <div className="content-grid"><section className="panel resource-panel"><div className="panel-head"><div><h2>资源清单</h2><p>Namespace / learning</p></div><button className="text-btn" onClick={retryImage}><RotateCcw size={14} /> 刷新</button></div><div className="resource-table"><div className="table-row table-header"><span>类型</span><span>名称</span><span>状态</span><span>详情</span></div>{resources.map((resource) => <div className="table-row" key={resource.name}><span className="resource-kind"><span className="kind-icon"><Server size={14} /></span>{resource.kind}</span><strong>{resource.name}</strong><span className={`state-tag ${resource.tone}`}><span className="status-dot" />{resource.status}</span><span className="resource-detail">{resource.detail}</span></div>)}</div><div className="panel-foot"><span>最近同步：刚刚 · read-only</span><button className="text-btn"><ExternalLink size={13} /> 查看 YAML</button></div></section>

          <section className="panel timeline-panel"><div className="panel-head"><div><h2>集群事件</h2><p>按时间排序 · evidence</p></div><button className="filter-btn">全部 <ChevronRight size={14} /></button></div><div className="timeline"><div className="event"><span className="event-line" /><span className="event-icon warn"><AlertTriangle size={13} /></span><div><strong>Failed to pull image</strong><p>nginx:1.27-alpine · hello-web</p><time>2 分钟前</time></div></div><div className="event"><span className="event-line" /><span className="event-icon good"><Check size={13} /></span><div><strong>Service created</strong><p>hello-web · ClusterIP 10.96.42.19</p><time>4 分钟前</time></div></div><div className="event"><span className="event-icon muted"><GitBranch size={13} /></span><div><strong>Deployment applied</strong><p>hello-web · replicas 2</p><time>4 分钟前</time></div></div></div></section></div>

          <section className="exercise-section"><div className="section-title"><div><div className="eyebrow">动手练习 / PRACTICE</div><h2>确认当前 Context，并找出镜像问题</h2></div><span className="exercise-score"><Gauge size={15} /> 0 / 3 检查点</span></div><div className="exercise-grid"><div className="exercise-step"><span className="step-number">1</span><div><strong>确认你操作的是学习集群</strong><p>不要凭记忆操作，先打印当前 context。</p><div className="command-chip"><Command size={13} /> kubectl config current-context <Check size={14} /></div></div></div><div className="exercise-step"><span className="step-number">2</span><div><strong>执行一条只读检查</strong><p>从下拉列表选择命令，观察终端输出。</p><div className="command-controls"><select value={command} onChange={(e) => setCommand(e.target.value)} aria-label="选择 kubectl 命令">{commands.map((item) => <option key={item}>{item}</option>)}</select><button className="run-btn" onClick={runCommand}><Play size={14} /> 执行</button></div></div></div><div className="exercise-step"><span className="step-number muted-step">3</span><div><strong>解释 Pending 的原因</strong><p>查看事件和 Pod 描述，写下你的判断。</p><button className="outline-btn" onClick={selfCheck}><ShieldCheck size={14} /> 自动自检</button></div></div></div></section>

          <section className="terminal-panel"><div className="terminal-head"><span><Terminal size={15} /> 实验终端</span><span className="terminal-readonly">本地模拟 · 只读命令</span><button className="terminal-clear" onClick={() => setTerminalLines([])} aria-label="清空终端"><X size={14} /></button></div><div className="terminal-body">{terminalLines.map((line, index) => <div key={`${line}-${index}`} className={line.startsWith("$") ? "terminal-command" : "terminal-output"}>{line}</div>)}<span className="cursor" /></div></section>
        </main>
      </div>
      {showGuide && <div className="modal-backdrop" onClick={() => setShowGuide(false)}><div className="guide-modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">阶段 {selected.id} / 学习目标</span><h2>{selected.title}</h2></div><button className="icon-button" onClick={() => setShowGuide(false)} aria-label="关闭"><X size={18} /></button></div><p>先完成观察，再执行变更。请在终端中记录证据，遇到异常优先看状态、事件和日志。</p><div className="guide-list"><div><Check size={15} /> 能确认当前 context 是 <code>kind-k8s-lab</code></div><div><Check size={15} /> 能解释 Deployment、Pod、Service 的关系</div><div><Check size={15} /> 能根据事件定位镜像拉取问题</div></div><button className="primary-btn full" onClick={() => setShowGuide(false)}>开始练习 <ChevronRight size={15} /></button></div></div>}
      {showDocs && <div className="modal-backdrop" onClick={() => setShowDocs(false)}><div className="guide-modal docs-modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">官方资料 / REFERENCES</span><h2>随时查文档</h2></div><button className="icon-button" onClick={() => setShowDocs(false)} aria-label="关闭"><X size={18} /></button></div><p>遇到不会的命令先查权威资料。外部页面只读打开，不会把 Token 或内部地址带出工作台。</p><div className="docs-list">{docs.map((doc) => <a key={doc.url} className="doc-link" href={doc.url} target="_blank" rel="noreferrer"><BookOpen size={15} /><span><strong>{doc.name}</strong><small>{doc.desc}</small></span><ExternalLink size={14} /></a>)}</div></div></div>}
    </div>
  );
}

export default App;

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root mount point");
createRoot(root).render(<App />);
