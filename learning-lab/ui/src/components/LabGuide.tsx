import { Fragment, type ReactNode } from "react";
import type { ModuleId } from "../curriculum";
import { Modal } from "./Modal";
import dockerGuide from "../../../labs/05-docker-project.md?raw";
import kindGuide from "../../../labs/06-kind-project.md?raw";
import kubernetesGuide from "../../../labs/07-kubernetes-project.md?raw";
import troubleshootingGuide from "../../../labs/08-troubleshooting-project.md?raw";

const guides = {
  foundation: { title: "实机练习准备", text: dockerGuide },
  docker: { title: "Docker 实机综合实验", text: dockerGuide },
  kind: { title: "Kind 实机综合实验", text: kindGuide },
  kubernetes: { title: "Kubernetes 实机综合实验", text: kubernetesGuide },
  troubleshooting: { title: "排障实机综合实验", text: troubleshootingGuide },
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
        const href = link[2].startsWith("https://")
          ? link[2]
          : `https://github.com/fang121380/Opspilot-2/blob/main/learning-lab/labs/${link[2]}`;
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
  module,
  onClose,
}: {
  module: ModuleId;
  onClose: () => void;
}) {
  const guide = guides[module];
  return (
    <Modal title={guide.title} onClose={onClose} wide>
      <div className="mode-note">
        <span className="badge sample">手工实机实验</span>
        <span>仅供阅读。在系统终端执行才会改变本机；网页不会代你执行。</span>
      </div>
      <Manual text={guide.text} />
    </Modal>
  );
}
