export type LabQuery = "resources" | "events" | "logs" | "nodes";
const queryNames = {
  resources: "资源",
  events: "事件",
  logs: "日志",
  nodes: "节点",
};

export async function fetchJson(
  path: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const response = await fetch(path, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      const messages: Record<string, string> = {
        kubectl_missing: "电脑上没有找到 kubectl。安装后重新启动只读服务。",
        context_missing:
          "找不到 kind-k8s-lab 上下文。请先在电脑上创建学习集群。",
        resource_missing:
          "学习资源尚未部署。请检查 learning 命名空间中的 hello-web。",
        access_denied: "学习集群拒绝读取，请检查 kind-k8s-lab 的只读权限。",
        cluster_timeout: "学习集群响应超时，请等待 Docker 就绪后重试。",
        cluster_unavailable:
          "学习集群不可用。请在电脑上启动 Docker 和 k8s-lab 后重试。",
        invalid_output: "kubectl 返回的数据无法解析，请检查客户端版本后重试。",
      };
      const problem: unknown = await response.json().catch(() => null);
      if (
        problem &&
        typeof problem === "object" &&
        "error" in problem &&
        typeof problem.error === "string" &&
        Object.hasOwn(messages, problem.error)
      ) {
        throw new Error(messages[problem.error]);
      }
      if (response.status === 401 || response.status === 403)
        throw new Error("当前服务不允许访问，请检查主服务的只读访问配置。");
      if (response.status === 502 || response.status === 504)
        throw new Error("本机只读服务未响应，请重新打开工作台启动入口。");
      throw new Error(
        `读取失败（HTTP ${response.status}）。请确认 Docker 与学习集群已启动，再重试。`,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new Error("服务返回了无法识别的数据，请检查本机服务是否启动正确。");
    }
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error("请求超时或已取消。请确认 Docker 已就绪后重试。");
    if (error instanceof TypeError)
      throw new Error(
        "无法连接本机服务。手机与电脑需在同一 Wi-Fi，且工作台使用局域网模式启动。",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}

export async function fetchLabQuery(
  query: LabQuery,
  signal?: AbortSignal,
): Promise<string> {
  const payload = await fetchJson(`/lab-api/?query=${query}`, signal);
  if (
    !payload ||
    typeof payload !== "object" ||
    !("ok" in payload) ||
    payload.ok !== true ||
    !("output" in payload) ||
    typeof payload.output !== "string"
  ) {
    throw new Error(`${queryNames[query]}暂时不可用，请检查学习集群后重试。`);
  }
  return payload.output;
}
