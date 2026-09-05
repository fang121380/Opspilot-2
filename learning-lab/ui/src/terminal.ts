export type CommandResult = {
  ok: boolean;
  output: string;
};

const RESPONSES: Record<string, string> = {
  "docker --version": "Docker version 29.7.2",
  "kind version": "kind v0.29.0 go1.24.4 darwin/arm64",
  "kubectl version --client": "Client Version: v1.34.1",
  "docker image ls": "REPOSITORY   TAG       IMAGE ID   CREATED   SIZE\nhello-world  latest    54c9d81    2 weeks   10.3kB",
  "docker run --rm hello-world": "Hello from Docker!\nYour installation appears to be working correctly.",
  "docker ps": "CONTAINER ID   IMAGE   STATUS\n(没有正在运行的容器，这是正常的)",
  "kubectl config current-context": "kind-k8s-lab",
  "kubectl get nodes": "NAME                    STATUS   ROLES           AGE\nk8s-lab-control-plane   Ready    control-plane   18h",
  "kubectl get namespaces": "NAME       STATUS\ndefault    Active\nlearning   Active",
  "kubectl get pods": "NAME                         READY   STATUS    RESTARTS   AGE\nhello-web-547fffd4fc-b4mnv   1/1     Running   0          18h\nhello-web-547fffd4fc-j4qrt   1/1     Running   0          18h",
  "kubectl -n learning get deployment": "NAME        READY   UP-TO-DATE   AVAILABLE   AGE\nhello-web   2/2     2            2           18h",
  "kubectl -n learning get pods": "NAME                         READY   STATUS    RESTARTS   AGE\nhello-web-547fffd4fc-b4mnv   1/1     Running   0          18h\nhello-web-547fffd4fc-j4qrt   1/1     Running   0          18h",
  "kubectl -n learning get service": "NAME        TYPE        CLUSTER-IP      PORT(S)\nhello-web   ClusterIP   10.96.254.242   80/TCP",
  "kubectl -n learning get events --sort-by=.lastTimestamp": "No resources found in learning namespace.",
  "kubectl -n learning logs deployment/hello-web": "2026-09-05T16:42:01Z nginx starting worker process\n2026-09-05T16:42:06Z GET / 200",
  "kubectl -n learning describe pod -l app=hello-web": "Name: hello-web-547fffd4fc-b4mnv\nStatus: Running\nContainers: nginx (Ready)\nEvents: <none>",
};

export const helpText = [
  "输入 help 查看帮助，输入 clear 清空终端。",
  "支持课程中的 Docker、Kind、kubectl 安全查询。",
  "写操作、管道、重定向和未知命令都会被拦截。",
].join("\n");

export function normalizeCommand(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

export function runSimulatedCommand(input: string): CommandResult {
  const command = normalizeCommand(input);
  if (!command) return { ok: false, output: "请输入命令。输入 help 可以查看帮助。" };
  if (command === "help") return { ok: true, output: helpText };
  if (command === "clear") return { ok: true, output: "__CLEAR__" };
  if (RESPONSES[command]) return { ok: true, output: RESPONSES[command] };
  return {
    ok: false,
    output: "已拦截：这条命令不在学习白名单中，不会在本机执行。输入 help 查看可用方式。",
  };
}
