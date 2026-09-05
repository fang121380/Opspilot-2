export type Resource = {
  kind: string;
  name: string;
  status: string;
  detail: string;
  tone: "good" | "warn" | "muted";
};
export type ClusterEvent = {
  name: string;
  reason: string;
  message: string;
  time: string;
  count: number;
  warning: boolean;
};
export type ClusterNode = { name: string; ready: boolean; version: string };
type Item = {
  kind?: string;
  metadata?: { name?: string; creationTimestamp?: string; generation?: number };
  spec?: { replicas?: number; type?: string; ports?: { port?: number }[] };
  status?: {
    readyReplicas?: number;
    availableReplicas?: number;
    updatedReplicas?: number;
    observedGeneration?: number;
    phase?: string;
    nodeInfo?: { kubeletVersion?: string };
    conditions?: { type?: string; status?: string }[];
    containerStatuses?: {
      ready?: boolean;
      restartCount?: number;
      state?: { waiting?: { reason?: string } };
    }[];
  };
  type?: string;
  reason?: string;
  message?: string;
  lastTimestamp?: string;
  eventTime?: string;
  series?: { lastObservedTime?: string; count?: number };
  count?: number;
};

function items(output: string): Item[] {
  const payload: unknown = JSON.parse(output);
  if (
    !payload ||
    typeof payload !== "object" ||
    !("items" in payload) ||
    !Array.isArray(payload.items) ||
    payload.items.some((item) => !item || typeof item !== "object")
  ) {
    throw new Error("服务返回的数据格式不完整，请重试。");
  }
  return payload.items as Item[];
}

export function parseResources(output: string): Resource[] {
  return items(output).map((item) => {
    const name = item.metadata?.name ?? "未命名资源";
    if (item.kind === "Deployment") {
      const desired = item.spec?.replicas ?? 1;
      const ready = item.status?.readyReplicas ?? 0;
      const available = item.status?.availableReplicas ?? 0;
      const observed =
        item.metadata?.generation === undefined ||
        (item.status?.observedGeneration ?? 0) >= item.metadata.generation;
      const availability = item.status?.conditions?.find(
        (condition) => condition.type === "Available",
      );
      const availableNow =
        observed && available >= desired && availability?.status === "True";
      return {
        kind: item.kind,
        name,
        status:
          desired === 0
            ? "ScaledDown"
            : availableNow
              ? "Available"
              : "Progressing",
        detail: `${ready}/${desired} 副本就绪`,
        tone: desired === 0 ? "muted" : availableNow ? "good" : "warn",
      };
    }
    if (item.kind === "Pod") {
      const containers = Array.isArray(item.status?.containerStatuses)
        ? item.status.containerStatuses
        : [];
      const ready = containers.filter((container) => container.ready).length;
      const waiting = containers.find(
        (container) => container.state?.waiting?.reason,
      )?.state?.waiting?.reason;
      const status = waiting ?? item.status?.phase ?? "Unknown";
      const podReady =
        item.status?.conditions?.some(
          (condition) =>
            condition.type === "Ready" && condition.status === "True",
        ) ?? false;
      const restarts = containers.reduce(
        (sum, container) => sum + (container.restartCount ?? 0),
        0,
      );
      return {
        kind: item.kind,
        name,
        status,
        detail: `${ready}/${containers.length || "?"} 容器就绪 · 重启 ${restarts} 次${status === "Running" && !podReady ? " · Pod 未就绪" : ""}`,
        tone:
          !waiting &&
          status === "Running" &&
          containers.length > 0 &&
          podReady &&
          ready === containers.length
            ? "good"
            : status === "Succeeded"
              ? "muted"
              : "warn",
      };
    }
    return {
      kind: item.kind ?? "Unknown",
      name,
      status: item.spec?.type ?? "Unknown",
      detail:
        item.spec?.ports
          ?.map((port) => `端口 ${port.port ?? "?"}`)
          .join(" · ") || "暂无端口信息",
      tone: "muted",
    };
  });
}

export function parseEvents(output: string): ClusterEvent[] {
  return items(output)
    .map((item) => ({
      name: item.metadata?.name ?? "",
      reason: item.reason ?? "Event",
      message: item.message ?? "",
      time:
        item.series?.lastObservedTime ??
        item.lastTimestamp ??
        item.eventTime ??
        item.metadata?.creationTimestamp ??
        "",
      count: item.series?.count ?? item.count ?? 1,
      warning: item.type === "Warning",
    }))
    .sort((a, b) => (Date.parse(b.time) || 0) - (Date.parse(a.time) || 0));
}

export function parseNodes(output: string): ClusterNode[] {
  return items(output).map((item) => ({
    name: item.metadata?.name ?? "未知节点",
    version: item.status?.nodeInfo?.kubeletVersion ?? "未知版本",
    ready:
      item.status?.conditions?.some(
        (condition) =>
          condition.type === "Ready" && condition.status === "True",
      ) ?? false,
  }));
}

export function timeLabel(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "尚未同步";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}
