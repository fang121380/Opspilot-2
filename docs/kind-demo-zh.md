# Opspilot 2 Kind 故障演练

这套资产用于重现项目的主面试场景：`checkout` 服务从正常版本切换到持续返回 500 的错误版本。

## 前置条件

- Docker Desktop 已启动。
- `kind`、`kubectl` 和 Docker CLI 在当前终端可执行。
- 本地 Opspilot 2 API 已启动，例如：

```bash
make run
```

## 启动环境

```bash
./scripts/kind-demo.sh up
```

脚本会创建两节点 Kind 集群、构建 API 与演示服务镜像、加载镜像、部署 checkout、Prometheus、Alertmanager 和 Opspilot 2 API，并等待 Deployment 就绪。Alertmanager 只转发 firing 告警到集群内 API；事件关闭仍由 Opspilot 的验证工作流负责。

启动时脚本会在 `.secrets/` 分别生成操作员令牌和 Alertmanager 令牌，文件权限为 `0600`，并创建两个相互隔离的集群内 Secret。API 同时持有两份凭据；Alertmanager 只挂载监控令牌文件，不能取得操作员写权限。该目录已被 Git 忽略，令牌不会写入镜像、清单或提交历史。

`infra/kind/opspilot-rbac.yaml` 创建了专用 `opspilot-2` ServiceAccount。它只可读取 demo 命名空间中的 Deployment、ReplicaSet、Pod 和 Pod 日志，并且仅能 patch Deployment 用于审批后的回滚；不能读取 Secret、修改 RBAC、执行 Shell 或访问其他命名空间。

## 注入故障

```bash
./scripts/kind-demo.sh inject-failure
```

错误版本通过环境变量让 `/checkout` 持续返回 HTTP 500。脚本会在 Pod 内每秒生成一次、共 20 次请求，以便 Prometheus 在多个抓取周期中观察到错误速率；规则在条件持续 15 秒后触发 `HighErrorRate`。

## 验证告警

在另一个终端中转发 Prometheus 服务，等待约 35 秒后查询告警状态：

```bash
kubectl -n demo port-forward service/prometheus 19090:9090
curl -s http://127.0.0.1:19090/api/v1/alerts
```

结果中应有标签 `alertname=HighErrorRate` 且状态为 `firing`。也可查询错误速率：

```bash
curl -s 'http://127.0.0.1:19090/api/v1/query?query=sum(rate(http_requests_total%7Bservice%3D%22checkout%22%2Ccode%3D~%225..%22%7D%5B1m%5D))'
```

再转发 Opspilot 2 API，确认 Alertmanager 已创建事故：

```bash
kubectl -n demo port-forward service/opspilot-2 18000:8000
curl -s http://127.0.0.1:18000/incidents
```

## 调查与人工审批门

使用事故 ID 调用真实 Kubernetes 与 Prometheus 调查。只有返回
`recommended_actions` 后才创建修复建议：

```bash
curl -s -X POST http://127.0.0.1:18000/incidents/<incident-id>/investigate
curl -s -X POST http://127.0.0.1:18000/remediation/proposals \
  -H 'Content-Type: application/json' \
  -d '{"incident_id":"<incident-id>","action":"rollback_deployment","namespace":"demo","deployment":"checkout"}'
```

也可以用异步任务接口执行相同调查。它先返回 Job ID；有修复建议时会把事故状态推进到 `awaiting_approval`，没有建议或调查失败时安全回到 `received`：

```bash
curl -s -X POST http://127.0.0.1:18000/incidents/<incident-id>/investigate/jobs
curl -s http://127.0.0.1:18000/investigation/jobs/<job-id>
```

没有匹配审批时执行接口固定返回 HTTP 403，Deployment 不会被修改：

```bash
curl -i -X POST http://127.0.0.1:18000/remediation/execute \
  -H 'Content-Type: application/json' \
  -d '{"proposal_id":"<proposal-id>"}'
```

下面两个请求是人工审批与实际写操作的边界，不能放进自动故障注入脚本。操作员确认证据、命名空间、Deployment 和审批有效期后，读取本地令牌并手动执行：

```bash
OPSPILOT_KIND_TOKEN=$(<.secrets/opspilot-kind-token)

curl -s -X POST http://127.0.0.1:18000/remediation/proposals/<proposal-id>/approval \
  -H "Authorization: Bearer $OPSPILOT_KIND_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"expires_in_minutes":15}'

curl -s -X POST http://127.0.0.1:18000/remediation/execute \
  -H "Authorization: Bearer $OPSPILOT_KIND_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"proposal_id":"<proposal-id>","approval_id":"<approval-id>"}'
```

`approved_by` 不再接受客户端输入，而是固定取自该令牌在服务端映射的 `kind-operator` 身份。缺失或错误令牌返回 401，未配置认证返回 503，使用其他操作员令牌执行已有审批返回 403。

修复建议必须引用已存在的事故；不存在的 `incident_id` 会返回 HTTP 404。

实际写操作成功后事故进入 `verifying`。等待至少一个 Prometheus 抓取周期，再调用只读验证接口；只有 1 分钟 HTTP 5xx 速率不高于 `0.01` 时才转为 `resolved`。Prometheus 没有返回样本时保持 `verifying`，不会把“没有数据”误判成恢复：

```bash
curl -s -X POST http://127.0.0.1:18000/incidents/<incident-id>/verify
```

提案端点允许 `received` 或 `awaiting_approval` 事故创建第一份动作；重复提案返回 HTTP 409。执行端点只接受处于 `awaiting_approval` 的事故，并用数据库条件更新原子抢占 `executing` 状态。第一次写操作成功后进入 `verifying`；重复提交同一 proposal/approval 或尝试为执行中、验证中、终态事故重新创建提案都会返回 HTTP 409，不能触发第二次回滚。Kind 演练使用内存存储和一个 API 副本；共享 PostgreSQL 的多副本部署使用相同的比较并交换契约保证只有一个副本取得执行权。

## 最新实机验收

2026-08-31 使用当前 API 镜像完成了一次不含写操作的真实闭环：checkout 故障注入后，Prometheus 报告 `HighErrorRate=firing`，Alertmanager 以独立 Bearer 凭据获得 Webhook `202`，Opspilot 创建事故并完成真实 Kubernetes/Prometheus 调查。分析记录了 `2/2` 可用 Pod、非零 5xx 速率和错误日志，给出 0.85 置信度的回滚建议；事故准确停在 `awaiting_approval`。本次没有创建审批、没有调用执行端点，也没有回滚 Deployment；故障保留以便按本文件的人工审批流程复现。

## 恢复和清理

```bash
./scripts/kind-demo.sh recover
./scripts/kind-demo.sh down
```

当前清单包含 Prometheus 的 Kubernetes 服务发现、仅限 `demo` 命名空间 Pod 的最小 RBAC，以及带独立 Bearer 凭据的 Alertmanager 到集群内 Opspilot 2 Service 的 Webhook 转发。
