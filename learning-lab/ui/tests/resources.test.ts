import assert from "node:assert/strict";
import { test } from "node:test";
import { parseResources, parseEvents, parseNodes } from "../src/resources.ts";

test("Running phase does not hide CrashLoopBackOff or readiness failure", () => {
  const rows = parseResources(
    JSON.stringify({
      items: [
        {
          kind: "Pod",
          metadata: { name: "app" },
          status: {
            phase: "Running",
            containerStatuses: [
              {
                ready: false,
                restartCount: 4,
                state: { waiting: { reason: "CrashLoopBackOff" } },
              },
            ],
          },
        },
      ],
    }),
  );
  assert.equal(rows[0].status, "CrashLoopBackOff");
  assert.equal(rows[0].tone, "warn");
});

test("a zero replica deployment is scaled down, not healthy", () => {
  const [row] = parseResources(
    JSON.stringify({
      items: [
        {
          kind: "Deployment",
          metadata: { name: "app" },
          spec: { replicas: 0 },
          status: {},
        },
      ],
    }),
  );
  assert.equal(row.status, "ScaledDown");
  assert.notEqual(row.tone, "good");
});

test("no container status is not evidence of readiness", () => {
  const [row] = parseResources(
    JSON.stringify({
      items: [
        {
          kind: "Pod",
          metadata: { name: "app" },
          status: { phase: "Running" },
        },
      ],
    }),
  );
  assert.equal(row.tone, "warn");
});

test("invalid payload fails explicitly while an empty list remains valid", () => {
  assert.throws(() => parseResources("{}"));
  assert.deepEqual(parseResources('{"items":[]}'), []);
});

test("event timestamps and reasons are preserved from structured Kubernetes data", () => {
  const [event] = parseEvents(
    JSON.stringify({
      items: [
        {
          metadata: { name: "probe" },
          type: "Warning",
          reason: "Unhealthy",
          message: "probe failed",
          lastTimestamp: "2026-09-05T00:00:00Z",
          count: 3,
        },
      ],
    }),
  );
  assert.equal(event.reason, "Unhealthy");
  assert.equal(event.time, "2026-09-05T00:00:00Z");
  assert.equal(event.count, 3);
});

test("node readiness uses the Ready condition", () => {
  const [node] = parseNodes(
    JSON.stringify({
      items: [
        {
          metadata: { name: "node" },
          status: {
            conditions: [{ type: "Ready", status: "False" }],
            nodeInfo: { kubeletVersion: "v1.37.0" },
          },
        },
      ],
    }),
  );
  assert.equal(node.ready, false);
});

test("Pod readiness gates can prevent Ready even with ready containers", () => {
  const [row] = parseResources(
    JSON.stringify({
      items: [
        {
          kind: "Pod",
          metadata: { name: "app" },
          status: {
            phase: "Running",
            containerStatuses: [{ ready: true }],
            conditions: [{ type: "Ready", status: "False" }],
          },
        },
      ],
    }),
  );
  assert.equal(row.tone, "warn");
});

test("minimum ready seconds prevents premature Deployment availability", () => {
  const [row] = parseResources(
    JSON.stringify({
      items: [
        {
          kind: "Deployment",
          metadata: { name: "app" },
          spec: { replicas: 2 },
          status: {
            readyReplicas: 2,
            availableReplicas: 0,
            conditions: [{ type: "Available", status: "False" }],
          },
        },
      ],
    }),
  );
  assert.notEqual(row.status, "Available");
  assert.notEqual(row.tone, "good");
});

test("unobserved Deployment generation is not presented as completed rollout", () => {
  const [row] = parseResources(
    JSON.stringify({
      items: [
        {
          kind: "Deployment",
          metadata: { name: "app", generation: 3 },
          spec: { replicas: 2 },
          status: {
            observedGeneration: 2,
            readyReplicas: 2,
            availableReplicas: 2,
            updatedReplicas: 2,
            conditions: [{ type: "Available", status: "True" }],
          },
        },
      ],
    }),
  );
  assert.equal(row.status, "Progressing");
});
