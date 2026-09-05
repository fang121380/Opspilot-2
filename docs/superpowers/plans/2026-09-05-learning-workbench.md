# Desktop and Android Learning Workbench

## Accepted Direction

The user approved the preceding workbench review and requested clearer beginner learning, accurate professional content, comfortable UI, Android support, global checks, bug fixes, documentation, and GitHub commits. Preserve React/Vite and the local read-only Kubernetes boundary. Deliver a responsive browser application; no native APK is implied. Keep the deployed checkout unchanged until verification passes.

## Implementation

- [x] Learning correctness: retain five lessons, scope outcomes to simulation, use explicit Kubernetes context, replace simplistic quizzes with evidence-based questions, persist per-lesson command records, validate saved progress, and verify only the current lesson's successful outputs. Add Node tests before implementation.
- [x] Runtime: use Vite same-origin read-only proxies `/lab-api` (localhost:8787) and `/opspilot-api` (localhost:8000); keep backend bound to loopback. Return resources/events/nodes as Kubernetes JSON inside the existing `output` string envelope, logs as text, and safe actionable errors. Repair Windows native exit checks/encoding and explicit context; maintain macOS launch support. Add Python regression tests.
- [x] Interface: reorganize into focused React views and a shared modal; desktop sidebar and Android bottom navigation; three navigable lesson steps; persistent explicit simulation label; independent resource/event/log refresh results, timestamps and stale snapshots; searchable glossary; an evidence-driven simulated readiness-probe case; accurately labeled optional live incident list. Preserve existing learning progress where valid.
- [x] Quality and documentation: add frontend unit/browser checks to CI, update current product/design and bilingual runtime documentation, document Android same-Wi-Fi access and main-API prerequisites. Run backend coverage/lint/evals/demo, frontend tests/build, desktop/mobile browser flows, keyboard/dialog checks, real read-only cluster integration and failure cases.
- [x] Delivery: commit reviewed patches, push branch and update main by fast-forward when checks pass; refresh local deployment and launcher; verify both local and LAN origins. Never rewrite remote history or change unrelated clusters.

## File Ownership and Interfaces

Learning task owns `ui/src/curriculum.ts`, `terminal.ts`, new `learning.ts`, and `ui/tests/learning.test.ts`. `LessonProgress` adds `records: CommandRecord[]` to existing booleans and commands. `CommandRecord = { command: string; output: string; ok: boolean }`. Exports: `emptyProgress`, `parseProgress(raw: string | null)`, `verifyLesson(lesson, progress)` returning `{passed, missingCommands, missingEvidence}`, and `canCompleteLesson(lesson, progress)`. Quiz gains optional `evidence: string`. Keep lesson IDs 00..04 and original existing property names.

Runtime task owns `scripts/lab-api.py`, `ui/vite.config.ts`, Windows/macOS launch scripts, `tests/test_learning_lab_api.py`, and `tests/test_learning_lab_launchers.py`. Bridge contract: `GET /health` reports bridge liveness; `GET /?query=resources|events|nodes|logs|context` yields `{ok,query,output}` or `{ok:false,error,message}`. No user-controlled commands, paths, namespaces, or writes. Proxies reject non-GET requests and unlisted Opspilot endpoints.

Primary task owns other UI files, styles, dependency/test configuration, CI, integration, docs, and git operations. Shared files are only edited by their owner. Tests use Node >=22.18 native TypeScript support and Playwright for actual browser behavior; Python remains >=3.12.

## Validation Cases

1. Uninstalled tooling is never claimed installed by simulated output. Mock and live labels remain separate on every viewport.
2. Old, malformed, inconsistent, or disabled localStorage cannot crash the app or falsely complete learning.
3. A failed log refresh does not discard fresh resources; failed refresh retains its original live provenance and timestamp.
4. 320/390/768/1440px layouts fit their viewport. All controls are accessible and modal focus is contained/restored.
5. Full curriculum and scenario flows work with clearly simulated commands, correct evidence, and restartable state.
6. Android uses same-origin proxy, never its own loopback for host APIs. Only read-only routes are reachable through proxy.
7. Windows scripts parse in PowerShell 5.1 and propagate native failures; macOS shell scripts pass syntax checks.

## Progress

Initial base: abef2f9. Learning patch fe45b79, runtime patch e83ad29, UI patch d5886ed, and documentation patch 087584e were pushed and fast-forwarded to main. Independent reviews found and verified fixes for obsolete quiz credit, already-current WinGet packages, readiness gates, Deployment availability, terminal display clearing, and keyboard dialog behavior. Local quality results and limitations are recorded in ../../workbench-validation-2026-09-05.md. The deployed main checkout and desktop launcher now use the new UI; local and LAN HTTP plus same-origin cluster reads succeeded. GitHub CI run 33969059232 passed quality, workbench, and compose-runtime jobs.
