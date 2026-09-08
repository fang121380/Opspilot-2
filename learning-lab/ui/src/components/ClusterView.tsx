import { useState } from "react";
import {
  AlertCircle,
  Box,
  Check,
  FileText,
  List,
  RefreshCw,
  Search,
  Server,
} from "lucide-react";
import {
  parseEvents,
  parseNodes,
  parseResources,
  timeLabel,
} from "../resources";
import type { Channel, LabData } from "../useLabData";

export function ClusterView({
  data,
  loading,
  refresh,
}: {
  data: LabData;
  loading: boolean;
  refresh: () => void;
}) {
  const [tab, setTab] = useState<"resources" | "events" | "logs">("resources");
  const [search, setSearch] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const channel = data[tab];
  const resources =
    data.resources.output !== null ? parseResources(data.resources.output) : [];
  const nodes = data.nodes.output !== null ? parseNodes(data.nodes.output) : [];
  const events =
    data.events.output !== null ? parseEvents(data.events.output) : [];
  const visible = resources.filter(
    (resource) =>
      (!onlyIssues || resource.tone === "warn") &&
      `${resource.name} ${resource.kind} ${resource.status}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>学习集群</h1>
          <p>
            查看 <code>kind-k8s-lab</code> 的实际状态、事件与日志。
          </p>
        </div>
        <button className="primary-button" onClick={refresh} disabled={loading}>
          <RefreshCw className={loading ? "spin" : ""} />
          {loading
            ? "正在读取"
            : data.resources.updatedAt
              ? "刷新实机"
              : "连接实机"}
        </button>
      </div>
      <div className="mode-note">
        <span className="badge good">实机只读</span>
        <span>只读取学习集群，不运行课程命令或修改资源。</span>
      </div>
      <details className="live-guide">
        <summary>第一次做实机练习：从准备环境到读懂结果</summary>
        <ol className="instructions">
          <li>
            <strong>准备环境</strong>
            <p>在运行工作台的电脑上打开 Docker Desktop，等待引擎就绪。浏览器中的模拟版本号不能证明工具已经安装。</p>
            <p>没有学习集群时，在仓库根目录的系统终端运行下列对应命令。它会创建学习集群并部署 hello-web；已有实操现场时不要反复初始化。</p>
            <p>macOS：<code>bash learning-lab/scripts/lab.sh up</code></p>
            <p>Windows：<code>.\learning-lab\windows\Start-LearningLab.ps1 -StartUi -StartApi</code></p>
            <p>目标是看到 hello-web 两个副本就绪。Docker 未启动、镜像下载失败时，先解决终端报错，再读取状态。</p>
          </li>
          <li>
            <strong>读取真实状态</strong>
            <p>连接后核对 kind-k8s-lab 的节点为 Ready，learning 中 hello-web 的 Deployment 可用且 Pod 就绪。Running 只说明阶段，还要看容器就绪数。</p>
            <button className="secondary-button" onClick={refresh} disabled={loading}>
              <RefreshCw />{loading ? "正在读取" : "读取练习环境"}
            </button>
            <p role="status">
              {data.resources.error || data.nodes.error
                ? "本次读取失败，上次结果不能用于本次验收。请查看页面中的具体原因。"
                : data.resources.output === null || data.nodes.output === null
                  ? "尚未读取实机数据。"
                  : nodes.length > 0 && nodes.every((node) => node.ready)
                    && resources.some((resource) => resource.kind === "Deployment" && resource.name === "hello-web" && resource.tone === "good")
                    && resources.some((resource) => resource.kind === "Pod")
                    && resources.filter((resource) => resource.kind === "Pod").every((resource) => resource.tone === "good")
                    ? "本次快照：节点与示例应用就绪。继续检查事件和日志，业务访问仍需单独验证。"
                    : "当前快照还未满足就绪条件。查看需关注的资源，再结合事件定位原因。"}
            </p>
          </li>
          <li>
            <strong>对照证据</strong>
            <p>依次查看“资源、事件、日志”。记录资源名、状态和同步时间；空事件列表不代表应用健康。日志读取失败时，资源查询结果仍可用于判断。</p>
            <p>在电脑系统终端独立核对：<code>kubectl --context kind-k8s-lab -n learning get pods</code>。名称和就绪数应与最近一次页面快照对应。</p>
          </li>
        </ol>
      </details>
      <div className="cluster-summary">
        <div>
          <Server />
          <span>
            节点
            <strong>
              {nodes.length
                ? `${nodes.filter((node) => node.ready).length}/${nodes.length} Ready`
                : "尚未读取"}
            </strong>
          </span>
        </div>
        <div>
          <Box />
          <span>
            命名空间<strong>learning</strong>
          </span>
        </div>
        <div>
          <Check />
          <span>
            工作负载
            <strong>
              {data.resources.output !== null
                ? `${resources.filter((resource) => resource.kind === "Pod" && resource.tone === "good").length}/${resources.filter((resource) => resource.kind === "Pod").length} Pod 就绪`
                : "尚未读取"}
            </strong>
          </span>
        </div>
      </div>
      {data.nodes.error && (
        <div className="error-banner" role="status">
          <AlertCircle />
          <div>
            <strong>
              节点信息更新失败{data.nodes.updatedAt ? "，保留上次快照" : ""}
            </strong>
            <p>{data.nodes.error}</p>
            {data.nodes.updatedAt && (
              <small>上次成功：{timeLabel(data.nodes.updatedAt)}</small>
            )}
          </div>
        </div>
      )}
      <div className="view-tabs" role="tablist" aria-label="集群信息">
        {(
          [
            { id: "resources", label: "资源", icon: Box },
            { id: "events", label: "事件", icon: List },
            { id: "logs", label: "日志", icon: FileText },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            role="tab"
            id={`tab-${item.id}`}
            aria-controls={`panel-${item.id}`}
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                event.preventDefault();
                const tabs = ["resources", "events", "logs"] as const;
                const next =
                  tabs[
                    (tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : 2)) %
                      3
                  ];
                setTab(next);
                document.getElementById(`tab-${next}`)?.focus();
              }
            }}
            onClick={() => setTab(item.id)}
          >
            <item.icon />
            {item.label}
            {data[item.id].error && (
              <span className="tab-error" aria-label="更新失败">
                !
              </span>
            )}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        <ChannelStatus channel={channel} />
        {channel.output === null ? (
          <div className="empty-state">
            <Server />
            <h2>
              {channel.loading
                ? "正在读取学习集群"
                : channel.error
                  ? "暂时无法读取"
                  : "还没有连接实机"}
            </h2>
            <p>
              {channel.loading
                ? "等待只读服务返回数据。"
                : "电脑上启动 Docker Desktop 和学习工作台后，即可读取实际状态。"}
            </p>
            {!loading && (
              <button className="secondary-button" onClick={refresh}>
                <RefreshCw />
                {channel.error ? "重新连接" : "读取集群"}
              </button>
            )}
          </div>
        ) : tab === "resources" ? (
          <>
            <div className="data-toolbar">
              <label className="search-field">
                <Search />
                <input
                  type="search"
                  aria-label="筛选集群资源"
                  placeholder="名称、类型或状态"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={onlyIssues}
                  onChange={(event) => setOnlyIssues(event.target.checked)}
                />
                只看需关注
              </label>
            </div>
            <div className="resource-list">
              <div className="resource-heading" aria-hidden="true">
                <span>资源</span>
                <span>名称</span>
                <span>状态</span>
                <span>就绪与运行信息</span>
              </div>
              {visible.map((resource) => (
                <article
                  className="resource-row"
                  key={`${resource.kind}-${resource.name}`}
                >
                  <span className="resource-kind">{resource.kind}</span>
                  <strong>{resource.name}</strong>
                  <span className={`badge ${resource.tone}`}>
                    {resource.status}
                  </span>
                  <span className="resource-detail">{resource.detail}</span>
                </article>
              ))}
            </div>
            {!visible.length && (
              <div className="empty-state compact">
                <h2>
                  {resources.length
                    ? "没有符合筛选条件的资源"
                    : "learning 命名空间中没有资源"}
                </h2>
                <p>
                  {resources.length
                    ? "调整关键词或取消筛选后再查看。"
                    : "先在电脑上完成 hello-web 示例部署。"}
                </p>
              </div>
            )}
          </>
        ) : tab === "events" ? (
          <div className="event-list">
            {events.length ? (
              events.map((event, index) => (
                <article key={`${event.name}-${index}`}>
                  <span className={`badge ${event.warning ? "warn" : "muted"}`}>
                    {event.warning ? "Warning" : "Normal"}
                  </span>
                  <div>
                    <strong>{event.reason}</strong>
                    <p>{event.message}</p>
                    <small>
                      {timeLabel(event.time)} · 累计 {event.count} 次
                    </small>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state compact">
                <Check />
                <h2>当前没有保留的事件</h2>
                <p>事件可能已过期；没有事件本身不能证明应用健康。</p>
              </div>
            )}
          </div>
        ) : (
          <pre className="live-logs" tabIndex={0} aria-label="真实容器日志">
            {channel.output.trim() || "当前容器没有日志输出。"}
          </pre>
        )}
      </section>
    </>
  );
}

function ChannelStatus({ channel }: { channel: Channel }) {
  return (
    <>
      <div className="data-provenance">
        <span>{channel.updatedAt ? "来源：学习集群实机" : "尚无实机数据"}</span>
        <span>
          {channel.updatedAt
            ? `上次成功同步 ${timeLabel(channel.updatedAt)}`
            : "尚未同步"}
          {channel.loading
            ? " · 更新中"
            : channel.error && channel.updatedAt
              ? " · 快照可能已过期"
              : ""}
        </span>
      </div>
      {channel.error && (
        <div className="error-banner" role="alert">
          <AlertCircle />
          <div>
            <strong>
              {channel.updatedAt
                ? "本次刷新失败，保留上次实机快照"
                : "读取失败"}
            </strong>
            <p>{channel.error}</p>
          </div>
        </div>
      )}
    </>
  );
}
