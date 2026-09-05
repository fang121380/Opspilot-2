# UI QA REPORT

Target: http://127.0.0.1:5173

## Screenshots

- Desktop: screenshots/terminal-responsive-desktop.png
- Mobile: screenshots/terminal-responsive-mobile.png

## Desktop Checks

- PASS blank / loading risk: body text 924, screenshot 239205 bytes
- PASS horizontal scroll: scrollWidth 1440, viewport 1440
- FAIL text overflow candidates: 1
- FAIL small button candidates: 6
- PASS large fixed overlay candidates: 0

## Mobile Checks

- PASS blank / loading risk: body text 625, screenshot 106938 bytes
- PASS horizontal scroll: scrollWidth 390, viewport 390
- FAIL text overflow candidates: 2
- FAIL small button candidates: 5
- PASS large fixed overlay candidates: 0

## Text Overflow Candidates

### Desktop
- small: "Pod、Deployment、Service" (135/144)

### Mobile
- code: "kind-k8s-lab" (86/91)
- small: "Deployment · Pod · Service · Event" (155/181)

## Small Button Candidates

### Desktop
- button: "重置进度" (62x22)
- button: "查看集群" (94x32)
- button: "继续学习" (94x32)
- button: "查看路径" (77x32)
- button: "开始" (69x32)
- button: "连接学习集群" (376x32)

### Mobile
- button: "查看集群" (177x32)
- button: "继续学习" (177x32)
- button: "查看路径" (74x32)
- button: "开始" (68x32)
- button: "连接学习集群" (96x32)

## Large Fixed Overlay Candidates

### Desktop
- None

### Mobile
- None

## Human Review

- Confirm screenshots do not contain customer data, secrets, internal URLs, or account information.
- Confirm external links, export, bulk-send, writeback, delete, and permission actions are protected by human review when present.
