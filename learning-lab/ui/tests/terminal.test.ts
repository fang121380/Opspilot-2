import assert from "node:assert/strict";
import test from "node:test";
import { lessons } from "../src/curriculum.ts";
import { helpText, runSimulatedCommand } from "../src/terminal.ts";

test("help lists every course command and exact commands retain simulation output", () => {
  for (const course of lessons) {
    for (const { command } of course.commands) {
      assert.ok(helpText.includes(command), command);
      const result = runSimulatedCommand(command);
      assert.equal(result.ok, true, command);
      assert.match(result.output, /模拟输出/);
    }
  }
});

test("typos suggest supported commands without accepting or executing them", () => {
  for (const [input, expected] of [
    ["dokcer --version", "docker --version"],
    ["kubctl version --client", "kubectl version --client"],
    ["docker image l", "docker image ls"],
    ["kind versio", "kind version"],
  ]) {
    const result = runSimulatedCommand(input);
    assert.equal(result.ok, false, input);
    assert.ok(result.output.includes(expected), result.output);
    assert.match(result.output, /不会自动纠正或执行/);
    assert.doesNotMatch(result.output, /模拟输出/);
  }
});

test("missing learning scope receives an explicit query without silently selecting a cluster", () => {
  for (const input of [
    "kubectl get pods",
    "kubctl get pods",
    "kubectl -n learning get pods",
    "kubectl --context kind-k8s-lab get pods",
  ]) {
    const result = runSimulatedCommand(input);
    assert.equal(result.ok, false, input);
    assert.ok(
      result.output.includes(
        "kubectl --context kind-k8s-lab -n learning get pods",
      ),
    );
    assert.match(result.output, /指定学习集群/);
  }
});

test("writes, shell operators, and multiline input never produce simulated success", () => {
  for (const input of [
    "kubectl delete pods --all",
    "kubectl --context kind-k8s-lab -n learning apply -f hello-web.yaml",
    "docker rm hello-web",
    "docker system prune",
    "docker --version; whoami",
    "docker ps | head",
    "docker ps > output.txt",
    "docker $(whoami)",
    "docker `whoami`",
    "docker\n--version",
    "help\nclear",
  ]) {
    const result = runSimulatedCommand(input);
    assert.equal(result.ok, false, input);
    assert.match(result.output, /已拦截/);
    assert.doesNotMatch(result.output, /模拟输出|请核对后重新输入/);
  }
});

test("unknown syntax and other contexts stay unsupported", () => {
  for (const input of [
    "whoami",
    "toString",
    "kubectl --context production -n learning get pods",
    "kubectl --context kind-k8s-lab -n payments get pods",
  ]) {
    const result = runSimulatedCommand(input);
    assert.equal(result.ok, false, input);
    assert.match(result.output, /不支持这条命令/);
    assert.doesNotMatch(result.output, /模拟输出/);
  }
});

test("empty, help, clear and harmless surrounding whitespace keep their contracts", () => {
  assert.equal(runSimulatedCommand("  ").ok, false);
  assert.equal(runSimulatedCommand("help").output, helpText);
  assert.deepEqual(runSimulatedCommand("clear"), {
    ok: true,
    output: "__CLEAR__",
  });
  assert.equal(runSimulatedCommand("  docker   --version\n").ok, true);
});
