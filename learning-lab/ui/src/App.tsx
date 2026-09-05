import { useEffect, useState } from "react";
import {
  BookOpen,
  Check,
  ExternalLink,
  FileSearch,
  GraduationCap,
  House,
  Layers3,
  Moon,
  Search,
  Server,
  Smartphone,
  Sun,
  Trash2,
} from "lucide-react";
import { glossary, lessons } from "./curriculum";
import { emptyProgress, parseProgress, type LessonProgress } from "./learning";
import { useLabData } from "./useLabData";
import { Overview } from "./components/Overview";
import { LessonView } from "./components/LessonView";
import { ClusterView } from "./components/ClusterView";
import { IncidentView } from "./components/IncidentView";
import { Modal } from "./components/Modal";
import "./styles.css";

type View = "overview" | "learn" | "cluster" | "incidents";
type Route = { view: View; lesson: string; step: number };
const progressKey = "opspilot-learning-progress-v3";
function stored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function readRoute(): Route {
  const [view, lesson, step] = location.hash.replace(/^#\/?/, "").split("/");
  return {
    view: ["learn", "cluster", "incidents"].includes(view)
      ? (view as View)
      : "overview",
    lesson: lessons.some((item) => item.id === lesson) ? lesson : "00",
    step: Math.min(2, Math.max(0, Math.floor(Number(step)) || 0)),
  };
}
const nav = [
  { id: "overview", label: "学习首页", short: "首页", icon: House },
  { id: "learn", label: "课程练习", short: "课程", icon: GraduationCap },
  { id: "cluster", label: "学习集群", short: "实机", icon: Server },
  { id: "incidents", label: "故障案例", short: "案例", icon: FileSearch },
] as const;

export function App() {
  const [route, setRoute] = useState(readRoute);
  const [progress, setProgress] = useState(() =>
    parseProgress(stored(progressKey)),
  );
  const [theme, setTheme] = useState(() =>
    stored("opspilot-theme") === "dark" ? "dark" : "light",
  );
  const [modal, setModal] = useState<"glossary" | "reset" | "phone" | null>(
    null,
  );
  const [storageError, setStorageError] = useState(false);
  const lab = useLabData();
  const selected =
    lessons.find((lesson) => lesson.id === route.lesson) ?? lessons[0];
  const index = lessons.indexOf(selected);
  const current = progress[selected.id] ?? emptyProgress;
  const done = lessons.filter(
    (lesson) => progress[lesson.id]?.completed,
  ).length;
  const navigate = (view: View, lesson = route.lesson, step = 0) => {
    location.hash = view === "learn" ? `learn/${lesson}/${step}` : view;
  };
  useEffect(() => {
    const update = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(progressKey, JSON.stringify(progress));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [progress]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("opspilot-theme", theme);
    } catch {
      /* Theme remains available for the current session. */
    }
  }, [theme]);
  const update = (patch: Partial<LessonProgress>) =>
    setProgress((value) => ({
      ...value,
      [selected.id]: { ...(value[selected.id] ?? emptyProgress), ...patch },
    }));
  const complete = () => {
    update({ completed: true });
    const next = lessons[index + 1];
    navigate(next ? "learn" : "incidents", next?.id ?? route.lesson);
  };
  const nextLesson =
    lessons.find((lesson) => !progress[lesson.id]?.completed) ?? lessons[0];
  return (
    <div className={`app-shell ${theme}`}>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        跳到主要内容
      </a>
      <header className="topbar">
        <a className="brand" href="#overview" aria-label="Opspilot 学习首页">
          <span className="brand-mark">
            <Layers3 />
          </span>
          <span>
            <strong>Opspilot</strong>
            <small>云原生学习工作台</small>
          </span>
        </a>
        <span className="top-context">
          <span className="neutral-dot" />
          本地学习环境
        </span>
        <div className="top-actions">
          <button
            className="icon-button phone-button"
            aria-label="手机访问"
            title="手机访问"
            onClick={() => setModal("phone")}
          >
            <Smartphone />
          </button>
          <button
            className="icon-button"
            aria-label={theme === "light" ? "切换深色模式" : "切换浅色模式"}
            title={theme === "light" ? "切换深色模式" : "切换浅色模式"}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon /> : <Sun />}
          </button>
          <button
            className="icon-button"
            aria-label="术语与资料"
            title="术语与资料"
            onClick={() => setModal("glossary")}
          >
            <BookOpen />
          </button>
        </div>
      </header>
      <div className="layout">
        <aside className="sidebar">
          <nav aria-label="工作台导航">
            {nav.map((item) => (
              <button
                className={`nav-item ${route.view === item.id ? "active" : ""}`}
                aria-current={route.view === item.id ? "page" : undefined}
                key={item.id}
                onClick={() =>
                  navigate(
                    item.id,
                    item.id === "learn" ? nextLesson.id : route.lesson,
                  )
                }
              >
                <item.icon />
                {item.label}
                {item.id === "learn" && (
                  <span className="nav-count">{done}/5</span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-section">
            <span>课程目录</span>
            <div className="lesson-nav">
              {lessons.map((lesson, position) => (
                <button
                  className={
                    route.view === "learn" && lesson.id === route.lesson
                      ? "selected"
                      : ""
                  }
                  key={lesson.id}
                  onClick={() => navigate("learn", lesson.id)}
                >
                  <span>
                    {progress[lesson.id]?.completed ? <Check /> : position + 1}
                  </span>
                  <span>{lesson.title}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="sidebar-footer">
            <span className="metadata">课程进度保存在当前浏览器</span>
            <button className="text-button" onClick={() => setModal("reset")}>
              <Trash2 />
              重置学习进度
            </button>
          </div>
        </aside>
        <main className="main-content" id="main-content" tabIndex={-1}>
          {storageError && (
            <div className="error-banner" role="status">
              浏览器未允许保存进度。本次仍可学习，但关闭页面后进度可能丢失。
            </div>
          )}
          {route.view === "overview" && (
            <Overview
              progress={progress}
              onLesson={(id) => navigate("learn", id)}
              onCluster={() => navigate("cluster")}
              onCase={() => navigate("incidents")}
            />
          )}
          {route.view === "learn" && (
            <LessonView
              lesson={selected}
              index={index}
              step={route.step}
              progress={current}
              onStep={(step) => navigate("learn", selected.id, step)}
              onUpdate={update}
              onComplete={complete}
              onGlossary={() => setModal("glossary")}
            />
          )}
          {route.view === "cluster" && <ClusterView {...lab} />}
          {route.view === "incidents" && <IncidentView />}
          <footer className="page-footer">
            <span>Opspilot Learning Lab</span>
            <button className="text-button" onClick={() => setModal("phone")}>
              <Smartphone />
              手机访问
            </button>
            <button
              className="text-button mobile-reset"
              onClick={() => setModal("reset")}
            >
              <Trash2 />
              重置进度
            </button>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="手机导航">
        {nav.map((item) => (
          <button
            key={item.id}
            aria-current={route.view === item.id ? "page" : undefined}
            onClick={() =>
              navigate(
                item.id,
                item.id === "learn" ? nextLesson.id : route.lesson,
              )
            }
          >
            <item.icon />
            <span>{item.short}</span>
          </button>
        ))}
      </nav>
      {modal === "glossary" && <Glossary onClose={() => setModal(null)} />}
      {modal === "reset" && (
        <Modal title="重置学习进度" onClose={() => setModal(null)}>
          <p>清除当前浏览器中的课程进度和模拟记录。集群与真实事故不受影响。</p>
          <div className="dialog-actions">
            <button className="secondary-button" onClick={() => setModal(null)}>
              保留进度
            </button>
            <button
              className="danger-button"
              onClick={() => {
                setProgress({});
                setModal(null);
                navigate("overview");
              }}
            >
              确认重置
            </button>
          </div>
        </Modal>
      )}
      {modal === "phone" && (
        <Modal title="在安卓手机上学习" onClose={() => setModal(null)}>
          <ol className="instructions">
            <li>手机和电脑连接同一 Wi-Fi。</li>
            <li>
              在电脑的 <code>learning-lab/ui</code> 目录运行{" "}
              <code>npm run dev:lan</code>。Windows 也可用启动脚本的{" "}
              <code>-Lan</code> 选项。
            </li>
            <li>
              在安卓 Chrome 中打开终端显示的 Network 地址。手机上的{" "}
              <code>127.0.0.1</code> 指向手机自身。
            </li>
            <li>
              Chrome 菜单中可添加桌面快捷方式。电脑需保持开机，实机读取还需
              Docker 和只读服务运行。
            </li>
          </ol>
          <p className="metadata">
            手机端使用相同课程。进度按浏览器保存，不会自动与电脑同步；当前提供浏览器版，未提供
            APK 或离线安装包。
          </p>
          <p className="current-address">
            当前地址 <code>{location.origin}</code>
          </p>
        </Modal>
      )}
    </div>
  );
}

function Glossary({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState("");
  const filtered = glossary.filter((item) =>
    `${item.term} ${item.plain} ${item.detail}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const links = [
    {
      name: "Kubernetes 中文文档",
      url: "https://kubernetes.io/zh-cn/docs/home/",
    },
    { name: "Docker 官方文档", url: "https://docs.docker.com/" },
    {
      name: "Kind 快速入门",
      url: "https://kind.sigs.k8s.io/docs/user/quick-start/",
    },
  ];
  return (
    <Modal title="术语与资料" onClose={onClose}>
      <label className="search-field">
        <Search />
        <input
          type="search"
          aria-label="检索术语"
          placeholder="搜索 Pod、镜像、探针…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <dl className="glossary">
        {filtered.map((item) => (
          <div key={item.term}>
            <dt>
              <strong>{item.term}</strong>
              <span>{item.plain}</span>
            </dt>
            <dd>{item.detail}</dd>
          </div>
        ))}
      </dl>
      {!filtered.length && (
        <p role="status">没有匹配的术语，试试中文名称或英文关键词。</p>
      )}
      <h3>官方资料</h3>
      <div className="reference-links">
        {links.map((link) => (
          <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
            {link.name}
            <ExternalLink />
          </a>
        ))}
      </div>
    </Modal>
  );
}
