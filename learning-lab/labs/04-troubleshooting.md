# 04 故障排查 / Troubleshooting

## 目标 / Goal

练习从现象到证据：状态 -> 事件 -> 日志 -> 修复，并观察滚动更新。

Practice moving from symptoms to evidence: status -> events -> logs -> fix, then observe a rolling update.

## 操作 / Do

```bash
kubectl -n learning get pods
kubectl -n learning describe pod -l app=hello-web
kubectl -n learning get events --sort-by=.lastTimestamp
kubectl -n learning logs deployment/hello-web --tail=20
kubectl -n learning set image deployment/hello-web nginx=nginx:1.27
kubectl -n learning rollout status deployment/hello-web
kubectl -n learning rollout history deployment/hello-web
```

然后观察一个失败探针（只在学习集群中）：

Then observe a failed probe (only in the lab cluster):

```bash
kubectl -n learning patch deployment hello-web --type=strategic \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"nginx","readinessProbe":{"httpGet":{"path":"/missing","port":"http"}}}]}}}}'
kubectl -n learning get pods
kubectl -n learning describe pod -l app=hello-web
kubectl -n learning rollout undo deployment/hello-web
kubectl -n learning rollout status deployment/hello-web
```

## 验收 / Acceptance

- [ ] 能用 `describe` 找到探针失败原因 / find the probe failure with `describe`.
- [ ] 能用 `rollout undo` 恢复 / recover with `rollout undo`.
- [ ] 修复前后都保留一段命令输出记录 / keep command output before and after the fix.

