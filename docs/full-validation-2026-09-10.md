# Opspilot 2 全量自动化验证（2026-09-10）

受测实现提交：`1daea64424b7bf5d063da74375f045770b801901`（26 课桌面学习链）。本次没有发现需要修复的源码问题；后续提交只补充验证文档。

## 结果

| 检查 | 本机结果 |
| --- | --- |
| 后端全套 pytest + 分支覆盖率 | 173 passed、34 skipped，26.31 秒；覆盖率 91.05%，超过 85% 门槛 |
| Ruff | 全部通过 |
| 离线评测 | 4/4 通过 |
| 本地闭环 demo | 告警、调查、演示审批/执行与审计通过；不执行真实 Kubernetes 回滚 |
| 前端逻辑测试 | 38/38 通过 |
| TypeScript + Vite 生产构建 | 通过 |
| Vite/Playwright 配置独立类型检查 | 通过 |
| Google Chrome Playwright | 15/15 通过，17.8 秒；包含全部 26 课、进度恢复、笔记隔离、先修/目录/手册和自动可访问性 |
| 桌面截图复核 | 浅色课程与深色手册未见裁切、重叠或不可读文字 |
| Docker 当前源码构建 | 通过，Docker Engine 29.7.2 |
| 独立 Compose 启动 | API、PostgreSQL 健康，Prometheus 就绪 |
| HTTP 健康检查 | `127.0.0.1:18080/health` HTTP 200，服务为 opspilot-2 |
| 数据库迁移 | 新数据库完成 5 级迁移，`0005_unique_proposals (head)`；数据库版本查询一致 |
| 任务恢复 dry-run | 成功，无活跃遗留任务，无真实调查/回滚 |
| 临时资源清理 | 仅移除本次 Compose 项目的 3 容器、网络和数据库卷，复核无遗留 |
| Git 差异格式 | 通过 |

本机 34 项跳过来自 PowerShell 相关测试，本机未安装 PowerShell。不能把 skip 算作通过。当前受测提交的 [GitHub CI](https://github.com/fang121380/Opspilot-2/actions/runs/34429085954) 四个 job 均成功：

- [Windows 更新脚本](https://github.com/fang121380/Opspilot-2/actions/runs/34429085954/job/102720525481)：Windows runner 实际执行测试通过。
- [Python 质量与镜像构建](https://github.com/fang121380/Opspilot-2/actions/runs/34429085954/job/102720525706)：通过。
- [前端与 Chromium](https://github.com/fang121380/Opspilot-2/actions/runs/34429085954/job/102720525709)：通过。
- [Compose runtime](https://github.com/fang121380/Opspilot-2/actions/runs/34429085954/job/102720863429)：启动、健康检查和任务恢复 dry-run 通过。

## 本机复验环境

新 Python 3.12 虚拟环境的依赖下载遇到 `files.pythonhosted.org` 证书域名不匹配，未绕过 TLS 验证。后端测试使用同一 Opspilot-2 项目已有的 Python 3.12.14 环境依赖；执行工作目录为当前受测仓库，并确认 `app.__file__` 指向当前仓库的 `app/__init__.py`。没有改动旧检出源码或依赖。

本次后端命令（`PYTHON` 覆盖为上述已有解释器）：

```bash
make PYTHON=/Users/andrew/Documents/Codex/2026-08-27/fen/.venv/bin/python coverage
make PYTHON=/Users/andrew/Documents/Codex/2026-08-27/fen/.venv/bin/python lint eval demo
```

`coverage` 已执行完整 pytest 集合，未再重复同一套 `make test`。当前目录中新建的 `.venv` 只有解释器与 pip，尚未成功装入项目依赖，不能据此声称 `make setup` 已成功；网络证书问题解决后可重新安装，或继续显式指定已有解释器。

前端在 `learning-lab/ui` 运行：

```bash
npm test
npm run build
npx tsc --noEmit --skipLibCheck --module ESNext --moduleResolution Bundler --target ES2022 vite.config.ts playwright.config.ts
WORKBENCH_BROWSER_CHANNEL=chrome WORKBENCH_E2E_PORT=5186 npm run test:e2e -- --workers=2
```

Docker 采用独立 project `opspilot2-qa-20260910`，设置 `OPSPILOT_HOST_PORT=127.0.0.1:18080`，沿用现有 Compose 文件而不修改配置。构建和启动设置有界超时。用户现有容器、学习集群和 5174 工作台未中断。

本地原始日志位于忽略目录 `work/backend-coverage.log`、`work/backend-gates.log`、`work/frontend-validation.log`、`work/docker-validation.log`，不提交包含运行环境细节的临时日志。

## 未覆盖范围

全量自动化通过并不代表不存在缺陷。新课程四份实机手册此前已静态检查，本轮没有在真实 Kind 中逐项运行这些教学实验；没有故障注入、真实回滚、生产写操作或物理手机联网验收。Windows CI 证明更新器自动测试成功，不等于在用户 Windows 设备完成整套安装/启动验收。
