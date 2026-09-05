import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { lessons } from "../src/curriculum";

test("beginner landing and explicit simulation survive narrow Android screens", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "学习工作台", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.goto("/#learn/00/1");
    await expect(page.getByText("教学模拟终端", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    for (const [route, heading] of [
      ["/#learn/00/0", "环境检查"],
      ["/#learn/00/2", "环境检查"],
      ["/#cluster", "学习集群"],
      ["/#incidents", "故障案例"],
    ]) {
      await page.goto(route);
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

test("malformed persisted learning data cannot complete or crash the course", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "opspilot-learning-progress-v3",
      JSON.stringify({ "00": { completed: true, commands: "bad" } }),
    ),
  );
  await page.goto("/#learn/00/2");
  await expect(page.getByRole("button", { name: "完成本课" })).toBeDisabled();
});

test("glossary dialog supports keyboard close and returns focus", async ({
  page,
}) => {
  await page.goto("/");
  const opener = page.getByRole("button", { name: "术语与资料", exact: true });
  await opener.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("searchbox", { name: "检索术语" }).fill("Pod");
  await expect(
    page.getByRole("dialog").getByText("Pod", { exact: true }),
  ).toBeVisible();
  for (let index = 0; index < 10; index++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest("dialog")),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test("all five lessons require their own command evidence and preserve completed work", async ({
  page,
}) => {
  await page.goto("/");
  for (const lesson of lessons) {
    await page.goto(`/#learn/${lesson.id}/0`);
    await page.getByRole("button", { name: "理解了，开始练习" }).click();
    for (const item of lesson.commands) {
      await page
        .getByRole("button", { name: `模拟运行：${item.command}`, exact: true })
        .click();
    }
    await page.getByRole("button", { name: "检查本课记录" }).click();
    await page.reload();
    await expect(
      page.getByText("模拟记录已验证", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("radio", {
        name: lesson.quiz.options[lesson.quiz.correct],
        exact: true,
      })
      .check();
    await page.getByRole("button", { name: "检查答案" }).click();
    await page.getByRole("button", { name: "完成本课", exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: "故障案例", exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "5");
});

test("partial refresh retains live provenance and last known logs", async ({
  page,
}) => {
  let failLogs = false;
  await page.route("**/lab-api/**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("query");
    if (query === "logs" && failLogs)
      return route.fulfill({
        status: 503,
        json: { ok: false, error: "cluster_timeout" },
      });
    const output =
      query === "logs"
        ? "nginx: real log snapshot"
        : JSON.stringify({
            items:
              query === "resources"
                ? [
                    {
                      kind: "Deployment",
                      metadata: { name: "hello-web" },
                      spec: { replicas: 2 },
                      status: { readyReplicas: 2 },
                    },
                  ]
                : [],
          });
    return route.fulfill({ json: { ok: true, query, output } });
  });
  await page.goto("/#cluster");
  await page.getByRole("button", { name: "连接实机", exact: true }).click();
  await expect(page.getByText("2/2 副本就绪", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "日志", exact: true }).click();
  await expect(
    page.getByText("nginx: real log snapshot", { exact: true }),
  ).toBeVisible();
  failLogs = true;
  await page.getByRole("button", { name: "刷新实机", exact: true }).click();
  await expect(
    page.getByText("本次刷新失败，保留上次实机快照", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("来源：学习集群实机", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("nginx: real log snapshot", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "资源", exact: true }).click();
  await expect(page.getByText("2/2 副本就绪", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("readiness-probe case requires correct judgments and never calls an API", async ({
  page,
}) => {
  const apiCalls: string[] = [];
  page.on("request", (request) => {
    if (/\/(lab-api|opspilot-api)\//.test(request.url()))
      apiCalls.push(request.url());
  });
  await page.goto("/#incidents");
  await page.getByRole("radio").nth(0).check();
  await page.getByRole("button", { name: "提交判断" }).click();
  await expect(page.getByText("这个判断还缺少依据")).toBeVisible();
  for (const [step, correct] of [1, 2, 0].entries()) {
    await page.getByRole("radio").nth(correct).check();
    await page.getByRole("button", { name: "提交判断" }).click();
    await page
      .getByRole("button", {
        name: step === 2 ? "完成案例" : "下一步",
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "你完成了一次有证据的故障判断" }),
  ).toBeVisible();
  expect(apiCalls).toEqual([]);
});

test("theme persists and small screens retain reachable navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "切换深色模式", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "切换浅色模式", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "手机导航" })
    .getByRole("button", { name: "实机", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "学习集群", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("clear hides terminal output without losing lesson evidence", async ({
  page,
}) => {
  await page.goto("/#learn/00/1");
  for (const command of lessons[0].commands) {
    await page
      .getByRole("button", {
        name: `模拟运行：${command.command}`,
        exact: true,
      })
      .click();
  }
  await page.getByRole("textbox", { name: "输入本课模拟命令" }).fill("clear");
  await page.getByRole("button", { name: "运行输入的模拟命令" }).click();
  await expect(
    page.getByLabel("本课命令输出", { exact: true }),
  ).not.toContainText("Docker version");
  await page.getByRole("button", { name: "检查本课记录" }).click();
  await expect(page.getByText("模拟记录已验证", { exact: true })).toBeVisible();
});

test("home and course meet automated accessibility checks", async ({
  page,
}) => {
  for (const route of ["/", "/#learn/00/0", "/#incidents"]) {
    await page.goto(route);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
});

test("storage failure preserves a usable learning session", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage unavailable", "QuotaExceededError");
    };
  });
  await page.goto("/#learn/00/0");
  await expect(
    page.getByText(
      "浏览器未允许保存进度。本次仍可学习，但关闭页面后进度可能丢失。",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "理解了，开始练习" }).click();
  await expect(page.getByText("教学模拟终端", { exact: true })).toBeVisible();
});
