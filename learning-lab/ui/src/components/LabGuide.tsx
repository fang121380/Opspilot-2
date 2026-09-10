import { Fragment, useEffect, useState, type ReactNode } from "react";
import { resolveManualHref } from "../study-tools";
import type { LabGuideId } from "../curriculum";
import { Modal } from "./Modal";
const guides = {
  docker: {
    title: "Docker 实机综合实验",
    load: () => import("../manuals/05-docker-project"),
  },
  "image-delivery": {
    title: "镜像构建与分发专题",
    load: () => import("../manuals/09-image-delivery"),
  },
  kind: {
    title: "Kind 实机综合实验",
    load: () => import("../manuals/06-kind-project"),
  },
  kubernetes: {
    title: "Kubernetes 实机综合实验",
    load: () => import("../manuals/07-kubernetes-project"),
  },
  "workload-patterns": {
    title: "批处理与有状态应用专题",
    load: () => import("../manuals/10-workload-patterns"),
  },
  troubleshooting: {
    title: "排障实机综合实验",
    load: () => import("../manuals/08-troubleshooting-project"),
  },
};

// Render the small Markdown subset used by the bundled manuals as React nodes.
// No raw HTML, script execution or external content fetches.
function inline(text: string): ReactNode[] {
  return text
    .split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
    .map((part, index) => {
      if (part.startsWith("`"))
        return <code key={index}>{part.slice(1, -1)}</code>;
      if (part.startsWith("**"))
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const href = resolveManualHref(link[2]);
        if (!href) return <Fragment key={index}>{link[1]}</Fragment>;
        return (
          <a key={index} href={href} target="_blank" rel="noreferrer">
            {link[1]}
          </a>
        );
      }
      return <Fragment key={index}>{part}</Fragment>;
    });
}

function Manual({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  const headings: { key: number; title: string }[] = [];
  let i = 0;
  while (i < lines.length) {
    const key = i;
    const line = lines[i++];
    if (!line.trim() || /^---+$/.test(line)) continue;
    if (line.startsWith("```")) {
      const code: string[] = [];
      while (i < lines.length && !lines[i].startsWith("```"))
        code.push(lines[i++]);
      i++;
      blocks.push(
        <div className="manual-code" key={key}>
          <span className="metadata">{line.slice(3) || "示例"}</span>
          <pre tabIndex={0}>{code.join("\n")}</pre>
        </div>,
      );
    } else if (/^#{1,6} /.test(line)) {
      const title = inline(line.replace(/^#+ /, ""));
      if (!line.startsWith("# "))
        headings.push({ key, title: line.replace(/^#+ /, "") });
      blocks.push(
        line.startsWith("# ") || line.startsWith("## ") ? (
          <h3 id={`manual-section-${key}`} key={key}>
            {title}
          </h3>
        ) : (
          <h4 id={`manual-section-${key}`} key={key}>
            {title}
          </h4>
        ),
      );
    } else if (/^(?:[-*] |\d+\. )/.test(line)) {
      const items = [line];
      while (i < lines.length && /^(?:[-*] |\d+\. )/.test(lines[i]))
        items.push(lines[i++]);
      const children = items.map((item, index) => (
        <li key={index}>{inline(item.replace(/^(?:[-*] |\d+\. )/, ""))}</li>
      ));
      blocks.push(
        /^\d/.test(line) ? (
          <ol key={key}>{children}</ol>
        ) : (
          <ul key={key}>{children}</ul>
        ),
      );
    } else if (line.startsWith("|")) {
      const rows = [line];
      while (i < lines.length && lines[i].startsWith("|"))
        rows.push(lines[i++]);
      const cells = (row: string) =>
        row
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((cell) => cell.trim());
      blocks.push(
        <div className="manual-table" key={key}>
          <table>
            <thead>
              <tr>
                {cells(rows[0]).map((cell, index) => (
                  <th key={index}>{inline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(2).map((row, index) => (
                <tr key={index}>
                  {cells(row).map((cell, column) => (
                    <td key={column}>{inline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else {
      blocks.push(<p key={key}>{inline(line.replace(/^>\s?/, ""))}</p>);
    }
  }
  return (
    <article className="lab-manual">
      <label className="manual-jump">
        跳到手册章节
        <select
          defaultValue=""
          onChange={(event) => {
            document
              .getElementById(`manual-section-${event.target.value}`)
              ?.scrollIntoView({ block: "start" });
            event.target.value = "";
          }}
        >
          <option value="" disabled>
            选择要阅读的步骤或专题
          </option>
          {headings.map((heading) => (
            <option key={heading.key} value={heading.key}>
              {heading.title}
            </option>
          ))}
        </select>
      </label>
      {blocks}
    </article>
  );
}

export function LabGuide({
  guideId,
  onClose,
}: {
  guideId: LabGuideId;
  onClose: () => void;
}) {
  const [selectedGuide, setSelectedGuide] = useState<LabGuideId>(
    guideId === "foundation" ? "docker" : guideId,
  );
  const guide =
    guides[selectedGuide === "foundation" ? "docker" : selectedGuide];
  const [content, setContent] = useState<{
    guide: typeof guide;
    text?: string;
    failed?: boolean;
  }>();
  useEffect(() => {
    let active = true;
    setContent(undefined);
    guide.load().then(
      (module) => {
        if (active) setContent({ guide, text: module.default });
      },
      () => {
        if (active) setContent({ guide, failed: true });
      },
    );
    return () => {
      active = false;
    };
  }, [guide]);
  return (
    <Modal title={guide.title} onClose={onClose} wide>
      <div className="mode-note">
        <span className="badge sample">手工实机实验</span>
        <span>仅供阅读。在系统终端执行才会改变本机；网页不会代你执行。</span>
      </div>
      <label className="manual-jump">
        选择实机手册
        <select
          value={selectedGuide}
          onChange={(event) =>
            setSelectedGuide(event.target.value as LabGuideId)
          }
        >
          {Object.entries(guides).map(([id, item]) => (
            <option key={id} value={id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      {content?.guide === guide && content.text !== undefined ? (
        <Manual key={selectedGuide} text={content.text} />
      ) : content?.guide === guide && content.failed ? (
        <div role="alert">
          <p>手册加载失败。请检查工作台连接，刷新页面后重新打开手册。</p>
          <button
            className="secondary-button"
            onClick={() => window.location.reload()}
          >
            刷新工作台
          </button>
        </div>
      ) : (
        <p role="status">正在加载实机手册…</p>
      )}
    </Modal>
  );
}
