# UI QA REPORT

Target: http://127.0.0.1:5173

## Screenshots

- Desktop: screenshots/beginner-full-final-desktop.png
- Mobile: screenshots/beginner-full-final-mobile.png

## Desktop Checks

- PASS blank / loading risk: body text 861, screenshot 194435 bytes
- PASS horizontal scroll: scrollWidth 1425, viewport 1440
- PASS text overflow candidates: 0
- PASS small button candidates: 0
- PASS large fixed overlay candidates: 0

## Mobile Checks

- PASS blank / loading risk: body text 567, screenshot 64167 bytes
- PASS horizontal scroll: scrollWidth 406, viewport 406
- FAIL text overflow candidates: 3
- PASS small button candidates: 0
- PASS large fixed overlay candidates: 0

## Text Overflow Candidates

### Desktop
- None

### Mobile
- div: "kind-k8s-lab 连接实机 零基础学习模式 先别碰集群，从三个工具开始。 每一课都会先解释概念，再让你执行命令、检查结果和完成小测。看不懂的词可以随时打" (390/406)
- div: "kind-k8s-lab 连接实机 零基础学习模式 先别碰集群，从三个工具开始。 每一课都会先解释概念，再让你执行命令、检查结果和完成小测。看不懂的词可以随时打" (390/406)
- header: "kind-k8s-lab 连接实机" (390/406)

## Small Button Candidates

### Desktop
- None

### Mobile
- None

## Large Fixed Overlay Candidates

### Desktop
- None

### Mobile
- None

## Human Review

- Confirm screenshots do not contain customer data, secrets, internal URLs, or account information.
- Confirm external links, export, bulk-send, writeback, delete, and permission actions are protected by human review when present.
