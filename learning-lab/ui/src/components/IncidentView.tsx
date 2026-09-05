import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  FileSearch,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { fetchJson } from "../api";
import { timeLabel } from "../resources";

type Incident = {
  id: string;
  alert_name: string;
  status: string;
  summary?: string;
  service?: string;
  severity?: string;
};
const phases = [
  {
    title: "定位故障",
    evidence:
      "Pod: Running    READY: 0/1\nEvent: Warning Unhealthy\nReadiness probe failed: HTTP probe failed with statuscode: 404\nApp log: GET /missing 404; GET / 200",
    question: "哪一个判断有证据支持？",
    options: [
      "容器没有运行，需要重新拉取镜像",
      "应用能响应，但就绪探针请求了不存在的路径",
      "集群中所有服务都已中断",
    ],
    correct: 1,
    explanation:
      "Running 只说明 Pod 的阶段。0/1 和探针 404 表明就绪检查失败；GET / 200 说明应用仍能处理该请求。",
  },
  {
    title: "选择修复",
    evidence:
      "当前探针: readinessProbe.httpGet.path = /missing\n应用响应: GET / -> 200\n目标: 让就绪探针检查真实存在的健康路径",
    question: "对这个教学案例，哪项修改最有针对性？",
    options: [
      "删除整个学习集群",
      "关闭全部探针并忽略错误",
      "确认 / 是合适的就绪检查路径后，将探针改回 /",
    ],
    correct: 2,
    explanation:
      "修复应针对已确认的路径配置。生产应用应使用能反映就绪状态的健康端点，而不是无条件关闭检查。",
  },
  {
    title: "验证恢复",
    evidence:
      "Deployment: 2/2 Ready\nPod A: Running 1/1; Pod B: Running 1/1\n观察窗口: 没有新增 Unhealthy 事件\n实际请求: GET / -> 200",
    question: "哪些证据共同支持本次修复有效？",
    options: [
      "副本就绪、无新增探针失败，且实际请求成功",
      "只要 Pod 显示 Running 就够了",
      "只要旧事件列表被清空就够了",
    ],
    correct: 0,
    explanation:
      "同时检查资源就绪、观察窗口内的变化和业务请求。历史 Warning 可以保留，它不等于新的故障。",
  },
];

export function IncidentView() {
  const [tab, setTab] = useState<"case" | "live">("case");
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>故障案例</h1>
          <p>从一条异常开始，用证据解释原因，再判断修复是否有效。</p>
        </div>
      </div>
      <div className="segmented" aria-label="案例数据来源">
        {(
          [
            { id: "case", label: "教学案例" },
            { id: "live", label: "真实事故" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "case" ? <PracticeCase /> : <LiveIncidents />}
    </>
  );
}

function PracticeCase() {
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [finished, setFinished] = useState(false);
  const phase = phases[step];
  const correct = checked && answer === phase.correct;
  return (
    <section className="case-content">
      <div className="mode-note">
        <span className="badge sample">模拟案例</span>
        <span>所有证据与修复均为教学样例，不修改真实集群。</span>
      </div>
      <div className="case-heading">
        <FileSearch />
        <div>
          <h2>Pod 在运行，为什么仍然不就绪？</h2>
          <p>hello-web · 就绪探针路径配置错误</p>
        </div>
      </div>
      <ol className="case-timeline">
        {phases.map((item, index) => (
          <li
            key={item.title}
            className={
              index === step && !finished
                ? "current"
                : index < step || finished
                  ? "done"
                  : ""
            }
          >
            <span>{index < step || finished ? <Check /> : index + 1}</span>
            {item.title}
          </li>
        ))}
      </ol>
      {finished ? (
        <div className="case-result" role="status">
          <ShieldCheck />
          <h2>你完成了一次有证据的故障判断</h2>
          <p>
            症状：Running，但 0/1 就绪。原因：探针路径返回
            404。修复：恢复正确路径。验证：副本就绪、无新增失败事件且请求成功。
          </p>
          <button
            className="secondary-button"
            onClick={() => {
              setStep(0);
              setAnswer(null);
              setChecked(false);
              setFinished(false);
            }}
          >
            <RotateCcw />
            重新练习
          </button>
        </div>
      ) : (
        <>
          <h3>{phase.title}</h3>
          <pre className="evidence-output" aria-label="案例证据">
            {phase.evidence}
          </pre>
          <fieldset className="quiz">
            <legend>{phase.question}</legend>
            {phase.options.map((option, index) => (
              <label
                className={answer === index ? "selected" : ""}
                key={option}
              >
                <input
                  type="radio"
                  name="case-answer"
                  checked={answer === index}
                  disabled={correct}
                  onChange={() => {
                    setAnswer(index);
                    setChecked(false);
                  }}
                />
                <span>{option}</span>
              </label>
            ))}
          </fieldset>
          {checked && (
            <div
              className={`answer-feedback ${correct ? "correct" : ""}`}
              role="status"
            >
              <strong>
                {correct ? "证据支持这个判断" : "这个判断还缺少依据"}
              </strong>
              <p>{phase.explanation}</p>
            </div>
          )}
          <div className="step-footer">
            <span className="metadata">步骤 {step + 1} / 3</span>
            {correct ? (
              <button
                className="primary-button"
                onClick={() => {
                  if (step === 2) setFinished(true);
                  else {
                    setStep(step + 1);
                    setAnswer(null);
                    setChecked(false);
                  }
                }}
              >
                {step === 2 ? "完成案例" : "下一步"}
                <ArrowRight />
              </button>
            ) : (
              <button
                className="primary-button"
                disabled={answer === null}
                onClick={() => setChecked(true)}
              >
                提交判断
                <Check />
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function LiveIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const load = async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError("");
    try {
      const result = await fetchJson(
        "/opspilot-api/incidents",
        controller.signal,
      );
      if (
        !Array.isArray(result) ||
        result.some(
          (item) =>
            !item ||
            typeof item.id !== "string" ||
            typeof item.status !== "string",
        )
      )
        throw new Error("事故数据格式不完整，请检查 Opspilot 主服务。");
      if (controller.signal.aborted) return;
      setIncidents(result);
      setUpdatedAt(new Date().toISOString());
    } catch (problem) {
      if (!controller.signal.aborted)
        setError(problem instanceof Error ? problem.message : "无法读取事故。");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  return (
    <section>
      <div className="mode-note">
        <span className="badge good">主服务只读</span>
        <span>
          此区域需要另外运行 Opspilot 主 API。学习课程和教学案例可独立使用。
        </span>
      </div>
      <div className="section-title">
        <h2>事故记录</h2>
        <button className="secondary-button" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? "spin" : ""} />
          {loading ? "正在读取" : updatedAt ? "刷新事故" : "连接主服务"}
        </button>
      </div>
      {updatedAt && (
        <p className="metadata">
          来源：Opspilot 主服务 · 上次成功 {timeLabel(updatedAt)}
          {error ? " · 快照可能已过期" : ""}
        </p>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <AlertCircle />
          <div>
            <strong>暂时无法更新事故</strong>
            <p>{error}</p>
            <p>确认电脑上的 Opspilot 主 API 正在运行，默认端口为 8000。</p>
          </div>
        </div>
      )}
      {incidents.length ? (
        <div className="incident-list">
          {incidents.map((incident) => (
            <article key={incident.id}>
              <div className="section-title">
                <h3>{incident.alert_name || "未命名告警"}</h3>
                <span className="badge muted">{incident.status}</span>
              </div>
              <p>{incident.summary || "暂无摘要"}</p>
              <p className="metadata">
                {incident.service || "未知服务"} ·{" "}
                {incident.severity || "未指定等级"}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FileSearch />
          <h2>
            {loading
              ? "正在读取事故"
              : updatedAt
                ? "当前没有事故记录"
                : "主服务尚未连接"}
          </h2>
          <p>
            {updatedAt
              ? "没有事故记录不代表已经验证所有业务健康。"
              : "教学案例不依赖主服务，可以先练习证据判断。"}
          </p>
        </div>
      )}
    </section>
  );
}
