export type CommandResult = {
  ok: boolean;
  output: string;
};

const RESPONSES: Record<string, string> = {
  "docker --version": "Docker version 29.0.0 (example)",
  "kind version": "kind v0.29.0 (example)",
  "kubectl version --client": "Client Version: v1.34.0 (example)",
  "docker image ls":
    "REPOSITORY   TAG       IMAGE ID   CREATED   SIZE\nhello-world  latest    54c9d81    2 weeks   10.3kB",
  "docker run --rm hello-world":
    "Hello from Docker!\n[模拟] 示例容器输出后退出；--rm 移除容器，镜像保留。本机未执行安装或运行检查。",
  "docker ps":
    "CONTAINER ID   IMAGE   STATUS\n(没有正在运行的容器，这是正常的)",
  "kubectl config current-context": "kind-k8s-lab",
  "kubectl --context kind-k8s-lab get nodes":
    "NAME                    STATUS   ROLES           AGE\nk8s-lab-control-plane   Ready    control-plane   18h",
  "kubectl --context kind-k8s-lab get namespaces":
    "NAME       STATUS\ndefault    Active\nlearning   Active",
  "kubectl --context kind-k8s-lab -n learning get deployment":
    "NAME        READY   UP-TO-DATE   AVAILABLE   AGE\nhello-web   2/2     2            2           18h",
  "kubectl --context kind-k8s-lab -n learning get pods":
    "NAME                         READY   STATUS    RESTARTS   AGE\nhello-web-547fffd4fc-b4mnv   1/1     Running   0          18h\nhello-web-547fffd4fc-j4qrt   1/1     Running   0          18h",
  "kubectl --context kind-k8s-lab -n learning get service":
    "NAME        TYPE        CLUSTER-IP      PORT(S)\nhello-web   ClusterIP   10.96.254.242   80/TCP",
  "kubectl --context kind-k8s-lab -n learning get events --sort-by=.lastTimestamp":
    "No resources found in learning namespace.",
  "kubectl --context kind-k8s-lab -n learning logs deployment/hello-web":
    "Found 2 pods, using pod/hello-web-547fffd4fc-b4mnv\n2026-09-05T16:42:01Z nginx starting worker process\n2026-09-05T16:42:06Z GET / 200",
  "kubectl --context kind-k8s-lab -n learning describe pod -l app=hello-web":
    "Name: hello-web-547fffd4fc-b4mnv\nStatus: Running\nContainers:\n  nginx:\n    State: Running\n    Ready: True\nEvents: <none>\n\nName: hello-web-547fffd4fc-j4qrt\nStatus: Running\nContainers:\n  nginx:\n    State: Running\n    Ready: True\nEvents: <none>",
};

export const helpText = [
  "输入 help 查看帮助，输入 clear 清空终端。",
  "这里仅返回课程命令的固定模拟输出，不连接本机 Shell、Docker 或集群。",
  "包括 docker run 在内的课程命令均不会真实执行；只接受课程中列出的命令。",
  "可输入的课程命令：",
  ...Object.keys(RESPONSES).map((command) => `  ${command}`),
  "输错时会给出建议，请自己核对并重新输入；建议不会自动执行。",
].join("\n");

export function normalizeCommand(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function editDistance(left: string, right: string): number {
  let row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 0; i < left.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < right.length; j++) {
      next.push(
        Math.min(
          next[j] + 1,
          row[j + 1] + 1,
          row[j] + (left[i] === right[j] ? 0 : 1),
        ),
      );
    }
    row = next;
  }
  return row[right.length];
}

function withoutLearningScope(command: string): string {
  return command
    .replace(" --context kind-k8s-lab", "")
    .replace(" -n learning", "");
}

function commandSuggestion(command: string): string | undefined {
  // Candidate corrections are only displayed; acceptance still uses the exact allowlist.
  const [tool, ...args] = command.split(" ");
  const knownTool = ["docker", "kind", "kubectl"].find(
    (name) => editDistance(tool, name) <= 2,
  );
  const candidate = knownTool ? [knownTool, ...args].join(" ") : command;
  if (Object.hasOwn(RESPONSES, candidate)) return candidate;
  const scoped = Object.keys(RESPONSES).find(
    (allowed) =>
      allowed.startsWith("kubectl --context ") &&
      withoutLearningScope(allowed) === withoutLearningScope(candidate),
  );
  if (scoped) return scoped;
  return Object.keys(RESPONSES)
    .filter((allowed) => allowed.split(" ")[0] === knownTool)
    .map((allowed) => ({ allowed, distance: editDistance(candidate, allowed) }))
    .filter(({ distance }) => distance <= 2)
    .sort((left, right) => left.distance - right.distance)[0]?.allowed;
}

export function runSimulatedCommand(input: string): CommandResult {
  const command = normalizeCommand(input);
  if (!command)
    return { ok: false, output: "请输入命令。输入 help 可以查看帮助。" };
  if (/[;&|<>`$\r\n]/.test(input.trim()))
    return {
      ok: false,
      output:
        "已拦截：一次只输入一条课程命令，不支持 Shell 组合、管道、重定向或变量替换。本机没有执行任何操作。输入 help 查看支持的命令。",
    };
  if (command === "help") return { ok: true, output: helpText };
  if (command === "clear") return { ok: true, output: "__CLEAR__" };
  if (Object.hasOwn(RESPONSES, command))
    return { ok: true, output: `[模拟输出 / example]\n${RESPONSES[command]}` };
  if (
    /(^| )(rm|delete|exec|apply|patch|prune|shutdown|reboot)( |$)/.test(command)
  )
    return {
      ok: false,
      output:
        "已拦截：这条命令可能删除资源、修改配置或执行其他程序，不属于当前模拟课程。本机和集群没有执行任何操作。输入 help 查看可练习的命令。",
    };
  const suggestion = commandSuggestion(command);
  if (suggestion)
    return {
      ok: false,
      output: [
        "这条输入尚未执行：可能有拼写错误，或缺少本课程要求的查询范围。",
        `请核对后重新输入：\n${suggestion}`,
        ...(suggestion.includes("--context")
          ? [
              "--context kind-k8s-lab 指定学习集群；-n learning（如果命令中有）指定学习命名空间。",
            ]
          : []),
        "以上只是建议，不会自动纠正或执行。输入 help 可查看全部支持的命令。",
      ].join("\n"),
    };
  return {
    ok: false,
    output:
      "当前模拟器还不支持这条命令，这不代表它在真实终端中一定有错。本机没有执行任何操作。输入 help 查看完整命令列表，或对照本课示例检查拼写和参数。",
  };
}
