# 集成边界与协议 / Integration Contract

## 当前架构 / Current Architecture

```text
Desktop / Android browser
  -> Vite UI (loopback by default; LAN only when requested)
     /lab-api      -> 127.0.0.1:8787 -> fixed kubectl queries, kind-k8s-lab
     /opspilot-api -> 127.0.0.1:8000 -> optional Opspilot main API
```

浏览器只使用同源相对路径。Vite 开发和预览服务器均配置代理与 GET 白名单。8787 和 8000 保持 loopback。可用 `LAB_API_TARGET` 和 `OPSPILOT_API_TARGET` 覆盖上游端口，但目标必须为 `http://127.0.0.1:<port>`，不能包含凭据、路径或查询参数。

The browser uses same-origin relative paths. Vite development and preview apply the proxy and GET allowlist. Keep 8787 and 8000 on loopback. `LAB_API_TARGET` and `OPSPILOT_API_TARGET` can override upstream ports, but must be plain `http://127.0.0.1:<port>` URLs without credentials, paths, or query options.

## 学习桥接 / Learning Bridge

| 浏览器请求 / Browser request | 响应 / Response |
| --- | --- |
| `GET /lab-api/health` | `{ "ok": true, "service": "learning-lab-bridge" }`，只证明桥接存活 / Bridge liveness only |
| `GET /lab-api/?query=context` | 固定目标 `kind-k8s-lab`，不证明集群可达 / Fixed target, not connectivity |
| `GET /lab-api/?query=resources` | `learning` 的 Deployment、Pod、Service / Workloads in `learning` |
| `GET /lab-api/?query=events` | `learning` 事件列表 / Namespace events |
| `GET /lab-api/?query=nodes` | 学习集群节点 / Lab nodes |
| `GET /lab-api/?query=logs` | `deployment/hello-web` 选中一个 Pod 的最近 20 行 / Last 20 log lines from one selected Pod |

成功响应保留 `{ "ok": true, "query": "resources", "output": "..." }`。资源、事件、节点的 `output` 是 JSON 字符串，解码后为含 `items` 数组的 Kubernetes List；日志和 context 是文本。前端按结构解析并验证必要字段，不解析人类可读表格。

Successful queries retain `{ "ok": true, "query": "resources", "output": "..." }`. For resources, events, and nodes, `output` is a JSON string containing a Kubernetes List with `items`. Logs and context are text. The frontend validates structured data instead of parsing display tables.

失败返回非成功 HTTP 状态和 `{ "ok": false, "error": "context_missing", "message": "..." }`。错误码还包括 `kubectl_missing`、`cluster_timeout`、`access_denied`、`resource_missing`、`cluster_unavailable` 和 `invalid_output`。桥接不返回原始异常或任意命令输出。未知路由、查询选项和写请求会被拒绝。

Failures use non-success HTTP status codes and `{ "ok": false, "error": "context_missing", "message": "..." }`. Other codes include `kubectl_missing`, `cluster_timeout`, `access_denied`, `resource_missing`, `cluster_unavailable`, and `invalid_output`. Raw exceptions and arbitrary command output are not returned. Unknown routes, query options, and writes are rejected.

## 可选主服务 / Optional Main API

代理允许 `GET /opspilot-api/health`、`GET /opspilot-api/incidents` 和 `GET /opspilot-api/incidents/<UUID>/audit`。当前 UI 的“真实事故”使用事故列表；允许审计读取不代表 UI 已实现审计时间线。调查、提案、审批、回滚、故障注入和任意 Shell 均未接入工作台。

The proxy allows health, the incident list, and `/incidents/<UUID>/audit` GET routes under `/opspilot-api`. The current live-incidents UI uses the list. An allowed audit route does not imply an implemented audit view. Investigation, proposals, approvals, rollback, fault injection, and arbitrary shell execution are not integrated.

主服务须按[仓库说明](../README.md)单独配置并监听 `127.0.0.1:8000`。桥接无需主服务的数据库或令牌；课程和模拟案例不依赖任一 API。LAN 模式下，能够访问 UI 的设备也能访问允许的只读代理路由，因此只用于可信本地网络。

Configure the main service separately using the [repository instructions](../README.md), binding it to `127.0.0.1:8000`. The bridge does not need the main service database or tokens. Lessons and the simulated case need neither API. Devices that can reach the LAN UI can reach allowed read-only routes, so use trusted local networks.

## 状态契约 / State Contract

资源、节点、事件、日志并发读取，各自记录 `output`、`updatedAt`、`loading`、`error`。一次失败保留该通道之前的真实快照和原时间，并标为可能过期；其他通道继续更新。首次失败不填入模拟数据。事故列表也保留上次成功结果。桥接存活、空事件、Running 或单条 HTTP 200 均不是整个系统健康的证明。

Resources, nodes, events, and logs load concurrently with separate `output`, `updatedAt`, `loading`, and `error` state. Failure retains that channel's previous live snapshot and timestamp, marked as potentially stale; other channels can succeed. Initial failure does not insert mock data. Live incidents retain their last successful result too. Bridge liveness, no events, Running, or one HTTP 200 alone cannot establish overall system health.

## 后续范围 / Future Scope

当前交付保持只读集成。未来写操作需要独立设计、服务端授权和可验证作用域；不能把模拟案例的“修复”直接接成真实写操作，也不能扩大到其他 Kubernetes context。

This delivery keeps integration read-only. Future writes require a separate design, server authorization, and validated scope. Simulated repair choices must not become real writes implicitly, and integration must not expand to other Kubernetes contexts.
