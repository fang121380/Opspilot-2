# UI QA REPORT

Target: http://127.0.0.1:5173

## Screenshots

- Desktop: screenshots/learning-lab-light-final-desktop.png
- Mobile: screenshots/learning-lab-light-final-mobile.png

## Desktop Checks

- PASS blank / loading risk: body text 1411, screenshot 187082 bytes
- PASS horizontal scroll: scrollWidth 1425, viewport 1440
- FAIL text overflow candidates: 1
- FAIL small button candidates: 9
- PASS large fixed overlay candidates: 0

## Mobile Checks

- PASS blank / loading risk: body text 1352, screenshot 66773 bytes
- PASS horizontal scroll: scrollWidth 421, viewport 421
- FAIL text overflow candidates: 11
- FAIL small button candidates: 9
- PASS large fixed overlay candidates: 0

## Text Overflow Candidates

### Desktop
- small: "Pod、Deployment、Service" (135/144)

### Mobile
- div: "kind-k8s-lab 连接实机 孔 学习路径 2/5 环境检查 Docker、kubectl、Kind 10 分钟 已完成 Docker 基础 镜像、容器、" (390/420)
- div: "kind-k8s-lab 连接实机 孔 学习路径 2/5 环境检查 Docker、kubectl、Kind 10 分钟 已完成 Docker 基础 镜像、容器、" (390/420)
- code: "kind-k8s-lab" (62/91)
- div: "学习路径 2/5 环境检查 Docker、kubectl、Kind 10 分钟 已完成 Docker 基础 镜像、容器、端口 25 分钟 已完成 02 Kind" (390/420)
- nav: "环境检查 Docker、kubectl、Kind 10 分钟 已完成 Docker 基础 镜像、容器、端口 25 分钟 已完成 02 Kind 集群 节点、上下" (192/570)
- main: "阶段 02 / 05 · KIND CLUSTER Kind 集群 节点、上下文、命名空间 · 这一步先观察集群，再动手操作。 查看本节目标 重试镜像 学习集群" (390/420)
- div: "类型 名称 状态 详情 Deployment hello-web Progressing 0/2 available · image pull timeout " (360/640)
- strong: "hello-web-7f6d9d9c8c-2kq8m" (150/170)
- strong: "hello-web-7f6d9d9c8c-qxj2p" (150/163)
- section: "动手练习 / PRACTICE 确认当前 Context，并找出镜像问题 0 / 3 检查点 1 确认你操作的是学习集群 不要凭记忆操作，先打印当前 conte" (362/406)
- div: "1 确认你操作的是学习集群 不要凭记忆操作，先打印当前 context。 kubectl config current-context 2 执行一条只读检查 从" (362/406)

## Small Button Candidates

### Desktop
- button: "查看本节目标" (118x32)
- button: "重试镜像" (94x32)
- button: "记录状态" (56x28)
- button: "刷新" (53x32)
- button: "查看 YAML" (88x32)
- button: "全部" (69x32)
- button: "执行" (67x32)
- button: "自动自检" (93x32)
- button: "清空终端" (32x32)

### Mobile
- button: "查看本节目标" (177x32)
- button: "重试镜像" (177x32)
- button: "记录状态" (56x28)
- button: "刷新" (53x32)
- button: "查看 YAML" (88x32)
- button: "全部" (69x32)
- button: "执行" (67x32)
- button: "自动自检" (93x32)
- button: "清空终端" (32x32)

## Large Fixed Overlay Candidates

### Desktop
- None

### Mobile
- None

## Human Review

- Confirm screenshots do not contain customer data, secrets, internal URLs, or account information.
- Confirm external links, export, bulk-send, writeback, delete, and permission actions are protected by human review when present.
