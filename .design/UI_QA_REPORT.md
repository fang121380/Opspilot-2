# UI QA REPORT

Target: http://127.0.0.1:5174

## Screenshots

- Desktop: screenshots/learning-lab-desktop.png
- Mobile: screenshots/learning-lab-mobile.png

## Desktop Checks

- PASS blank / loading risk: body text 1408, screenshot 225399 bytes
- PASS horizontal scroll: scrollWidth 1425, viewport 1440
- FAIL text overflow candidates: 1
- FAIL small button candidates: 11
- PASS large fixed overlay candidates: 0

## Mobile Checks

- PASS blank / loading risk: body text 1347, screenshot 82010 bytes
- PASS horizontal scroll: scrollWidth 421, viewport 421
- FAIL text overflow candidates: 12
- FAIL small button candidates: 11
- PASS large fixed overlay candidates: 0

## Text Overflow Candidates

### Desktop
- small: "Pod、Deployment、Service" (135/144)

### Mobile
- div: "kind-k8s-lab 孔 学习路径 2/5 环境检查 Docker、kubectl、Kind 10 分钟 已完成 Docker 基础 镜像、容器、端口 25" (390/420)
- div: "kind-k8s-lab 孔 学习路径 2/5 环境检查 Docker、kubectl、Kind 10 分钟 已完成 Docker 基础 镜像、容器、端口 25" (390/420)
- div: "学习路径 2/5 环境检查 Docker、kubectl、Kind 10 分钟 已完成 Docker 基础 镜像、容器、端口 25 分钟 已完成 02 Kind" (390/420)
- nav: "环境检查 Docker、kubectl、Kind 10 分钟 已完成 Docker 基础 镜像、容器、端口 25 分钟 已完成 02 Kind 集群 节点、上下" (192/570)
- small: "Docker、kubectl、Kind" (90/122)
- small: "节点、上下文、命名空间" (90/121)
- small: "Pod、Deployment、Service" (90/144)
- small: "日志、探针、滚动更新" (90/110)
- main: "阶段 02 / 05 · KIND CLUSTER Kind 集群 节点、上下文、命名空间 · 这一步先观察集群，再动手操作。 查看本节目标 重试镜像 学习集群" (390/420)
- div: "类型 名称 状态 详情 Deployment hello-web Progressing 0/2 available · image pull timeout " (360/640)
- strong: "hello-web-7f6d9d9c8c-2kq8m" (150/170)
- strong: "hello-web-7f6d9d9c8c-qxj2p" (150/163)

## Small Button Candidates

### Desktop
- button: "打开官方文档" (32x32)
- button: "帮助" (32x32)
- button: "查看本节目标" (118x32)
- button: "重试镜像" (94x32)
- button: "记录状态" (56x18)
- button: "刷新" (53x32)
- button: "查看 YAML" (88x32)
- button: "全部" (69x32)
- button: "执行" (67x32)
- button: "自动自检" (93x32)
- button: "清空终端" (26x16)

### Mobile
- button: "打开官方文档" (32x32)
- button: "帮助" (32x32)
- button: "查看本节目标" (177x32)
- button: "重试镜像" (177x32)
- button: "记录状态" (56x18)
- button: "刷新" (53x32)
- button: "查看 YAML" (88x32)
- button: "全部" (69x32)
- button: "执行" (67x32)
- button: "自动自检" (93x32)
- button: "清空终端" (26x16)

## Large Fixed Overlay Candidates

### Desktop
- None

### Mobile
- None

## Human Review

- Confirm screenshots do not contain customer data, secrets, internal URLs, or account information.
- Confirm external links, export, bulk-send, writeback, delete, and permission actions are protected by human review when present.
