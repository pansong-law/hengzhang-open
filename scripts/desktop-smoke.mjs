import { _electron as electron } from "playwright";
import { expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hengzhang-desktop-")),
  dataDir = path.join(workspace, "data"),
  downloads = path.join(workspace, "downloads");
fs.mkdirSync(downloads);
const env = { ...process.env, HZ_DATA_DIR: dataDir };
delete env.ELECTRON_RUN_AS_NODE;
const errors = [],
  external = [];
const APP_VERSION = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url)),
).version;
let application;
const executable = process.env.HZ_APP_EXECUTABLE;
async function launch(expectedMotto = "热爱法律，笃行正义。") {
  application = await electron.launch({
    ...(executable
      ? { executablePath: executable, args: [] }
      : { args: ["."] }),
    cwd: process.cwd(),
    env,
    timeout: 60000,
  });
  const page = await application.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:") &&
      !r.url().startsWith("blob:http://127.0.0.1:")
    )
      external.push(r.url());
  });
  await expect(
    page.getByRole("heading", { name: expectedMotto }),
  ).toBeVisible();
  await application.evaluate(({ BrowserWindow }, dir) => {
    globalThis.testDownloads = [];
    BrowserWindow.getAllWindows()[0].webContents.session.on(
      "will-download",
      (_event, item) => {
        const filename = dir + "/" + item.getFilename().replaceAll("/", "_");
        item.setSavePath(filename);
        item.once("done", (_e, state) =>
          globalThis.testDownloads.push({ filename, state }),
        );
      },
    );
  }, downloads);
  return page;
}
async function closeApplication() {
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    application?.process().kill("SIGTERM");
  }, 15000);
  try {
    await application.close();
    if (timedOut) throw Error("App 退出超时");
  } finally {
    clearTimeout(timer);
  }
}
async function downloadCount() {
  return application.evaluate(() => globalThis.testDownloads.length);
}
async function waitDownload(before) {
  await expect.poll(downloadCount, { timeout: 30000 }).toBeGreaterThan(before);
  const results = await application.evaluate(() => globalThis.testDownloads);
  const result = results.at(-1);
  assert.equal(result.state, "completed");
  return result.filename;
}
async function request(page, route, method = "GET", body) {
  return page.evaluate(
    async ({ route, method, body }) => {
      const r = await fetch("/api/" + route, {
        method,
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, ...(await r.json()) };
    },
    { route, method, body },
  );
}
try {
  let page = await launch();
  assert.equal(
    await application.evaluate(({ app }) => app.getPath("userData")),
    dataDir,
  );
  assert.equal(await page.locator("input[type=password]").count(), 0);
  await expect(page.locator('[data-nav="stats"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "按业务类型" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "按承办律师" })).toHaveCount(
    0,
  );
  await expect(page.locator("body")).not.toContainText("离线使用 · 无须登录");
  await expect(page.locator("body")).not.toContainText("件案件与项目");
  const security = await application.evaluate(({ BrowserWindow }) => {
    const p =
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return {
      nodeIntegration: p.nodeIntegration,
      contextIsolation: p.contextIsolation,
      sandbox: p.sandbox,
    };
  });
  assert.deepEqual(security, {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
  });
  await page.getByRole("button", { name: "＋ 新建案件", exact: true }).click();
  await page.locator("[name=case_no]").fill("MAC-001");
  await page.locator("[name=client]").fill("桌面测试客户");
  await page.locator("[name=plaintiff]").fill("桌面测试客户");
  await page.locator("[name=defendant]").fill("乙公司");
  await page.locator("[name=case_type]").fill("买卖合同纠纷");
  await page.locator("[name=lawyer]").fill("外部律师");
  await page.locator("[name=contract_amount]").fill("10000.50");
  await page.locator("[name=invoice_amount]").fill("5000");
  await page.locator("[name=collected_amount]").fill("1000");
  await page.locator("[name=invoiced_unpaid]").fill("4500.75");
  await page.locator("[name=fee_note]").fill("签约支付，余款结案后支付");
  await page.getByRole("button", { name: "保存案件", exact: true }).click();
  await expect(page.getByRole("heading", { name: "案件详情" })).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "案件台账", exact: true }).click();
  await expect(page.locator("#case-table")).toContainText("MAC-001");
  await expect(page.locator("#case-table")).toContainText("4,500.75");
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(page.locator("[name=invoiced_unpaid]")).toHaveValue("4500.75");
  await page.locator("[name=invoiced_unpaid]").fill("3250.05");
  await page.getByRole("button", { name: "保存案件", exact: true }).click();
  await expect(page.locator("#modal")).not.toBeVisible();
  await expect(page.locator("#case-table")).toContainText("3,250.05");
  await page.getByRole("button", { name: "到账", exact: true }).click();
  await page.locator("[name=amount]").fill("2000.25");
  await page.locator("[name=note]").fill("本次到账");
  await page.getByRole("button", { name: "登记到账", exact: true }).click();
  await expect(page.locator("#modal")).not.toBeVisible();
  await expect(page.locator("#case-table")).toContainText("3,000.25");
  await page.getByRole("button", { name: "进展", exact: true }).click();
  await page.locator("[name=text]").fill("已完成材料整理，等待开庭。");
  await page.getByRole("button", { name: "保存进展", exact: true }).click();
  await expect(page.locator("#modal")).not.toBeVisible();
  const savedProgress = (await request(page, "workspace")).cases.find(
    (c) => c.case_no === "MAC-001",
  );
  assert.equal(
    savedProgress.progress.at(-1).text,
    "已完成材料整理，等待开庭。",
  );
  await page.getByRole("button", { name: "应付", exact: true }).click();
  await page.locator("[name=amount]").fill("5000");
  await page.locator("[name=note]").fill("第二期费用待开票");
  await page.getByRole("button", { name: "标记待开票", exact: true }).click();
  await expect(page.locator("#modal")).not.toBeVisible();
  await page.locator("[data-stage]").selectOption("一审");
  await expect(page.locator("[data-stage]")).toBeEnabled();
  await page.getByRole("button", { name: "＋ 新建案件", exact: true }).click();
  await page.locator("[name=track]").selectOption("advisory");
  await page.locator("[name=case_no]").fill("AD-001");
  await page.locator("[name=client]").fill("顾问测试客户");
  await page.locator("[name=service_start]").fill("2026-01-01");
  await page.locator("[name=service_end]").fill("2026-12-31");
  await page.locator("[name=contract_amount]").fill("12000");
  await page.getByRole("button", { name: "保存案件", exact: true }).click();
  await expect(page.locator("#modal")).not.toBeVisible();
  await page.getByRole("button", { name: "续签", exact: true }).click();
  await expect(page.locator("[name=service_start]")).toHaveValue("2027-01-01");
  await expect(page.locator("[name=service_end]")).toHaveValue("2027-12-31");
  await page.getByRole("button", { name: "创建续签案件", exact: true }).click();
  await expect(page.locator("#modal")).not.toBeVisible();
  await expect(page.locator("#case-table")).toContainText("AD-001-续签");
  // Drive the shipped template, XLSX writer, file chooser, preview and import path.
  await page.getByRole("button", { name: "导入台账", exact: true }).click();
  let before = await downloadCount();
  await page.locator("[data-action=template][data-track=project]").click();
  const template = await waitDownload(before);
  assert(template.endsWith(".xlsx"));
  const readHeaders = async (filename) =>
    page.evaluate(
      (bytes) => {
        const wb = XLSX.read(new Uint8Array(bytes), { type: "array" });
        return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
          header: 1,
        })[0];
      },
      Array.from(fs.readFileSync(filename)),
    );
  assert((await readHeaders(template)).includes("开票未付金额"));
  for (const track of ["advisory", "litigation"]) {
    const count = await downloadCount();
    await page
      .locator("[data-action=template][data-track=" + track + "]")
      .click();
    const filename = await waitDownload(count);
    assert((await readHeaders(filename)).includes("开票未付金额"));
  }
  const importPath = path.join(workspace, "sample.xlsx");
  const binary = await page.evaluate(() => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        [
          "类型",
          "内部案号",
          "项目名称",
          "客户",
          "对方当事人",
          "签约律师费",
          "收款金额",
        ],
        [
          "专项",
          "PROJECT-1",
          "专项测试项目",
          "专项客户",
          "对方公司",
          3000,
          500,
        ],
      ]),
      "专项案件",
    );
    return Array.from(
      new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" })),
    );
  });
  fs.writeFileSync(importPath, Buffer.from(binary));
  // Programmatic file selection exercises the same input used by the native chooser.
  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator("[data-action=choose-import][data-track=project]").click();
  const chooser = await chooserPromise;
  await chooser.setFiles(importPath);
  await expect(
    page.getByRole("button", { name: "确认导入", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "确认导入", exact: true }).click();
  await expect(page.locator("#case-table")).toContainText("PROJECT-1");
  await page.locator("#filter-q").fill("MAC-001");
  before = await downloadCount();
  await page.getByRole("button", { name: "导出当前筛选", exact: true }).click();
  const exportPath = await waitDownload(before);
  const exported = await page.evaluate(
    (bytes) => {
      const wb = XLSX.read(new Uint8Array(bytes), { type: "array" });
      return wb.SheetNames.flatMap((n) =>
        XLSX.utils.sheet_to_json(wb.Sheets[n]),
      );
    },
    Array.from(fs.readFileSync(exportPath)),
  );
  assert.equal(exported.length, 1);
  assert.equal(exported[0]["内部案号"], "MAC-001");
  assert.equal(exported[0]["开票未付金额"], 3250.05);
  assert.equal(exported[0]["开票未付金额计算方式"], "手填");
  const macCase = (await request(page, "workspace")).cases.find((c) => c.case_no === "MAC-001");
  const reimportLedger = async (filename) => {
    // Import intentionally reads only the first sheet. Put the exported data
    // sheet first, preserving its cells and the new calculation-mode columns.
    const reordered = await page.evaluate((bytes) => {
      const wb = XLSX.read(new Uint8Array(bytes), { type: "array" });
      wb.SheetNames.sort((a, b) =>
        XLSX.utils.sheet_to_json(wb.Sheets[b]).length - XLSX.utils.sheet_to_json(wb.Sheets[a]).length);
      return Array.from(new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" })));
    }, Array.from(fs.readFileSync(filename)));
    const inputPath = path.join(workspace, "roundtrip.xlsx");
    fs.writeFileSync(inputPath, Buffer.from(reordered));
    await page.getByRole("button", { name: "导入台账", exact: true }).click();
    const selection = page.waitForEvent("filechooser");
    await page.locator("[data-action=choose-import][data-track=litigation]").click();
    await (await selection).setFiles(inputPath);
    await page.getByRole("button", { name: "确认导入", exact: true }).click();
    await expect(page.locator("#modal")).not.toBeVisible();
    assert.equal((await request(page, "workspace")).cases.length, 4);
    return (await request(page, "cases/" + macCase.id)).case;
  };
  assert.equal((await reimportLedger(exportPath)).invoiced_unpaid, 3250.05);
  assert.equal((await request(page, "cases/" + macCase.id, "PUT", { invoiced_unpaid: "" })).status, 200);
  await page.locator("#filter-q").fill("MAC-001");
  before = await downloadCount();
  await page.getByRole("button", { name: "导出当前筛选", exact: true }).click();
  const automaticExport = await waitDownload(before);
  const automaticCase = await reimportLedger(automaticExport);
  assert.equal(automaticCase.invoiced_unpaid, null);
  assert.equal((await request(page, "cases/" + macCase.id + "/collections", "POST", {
    amount: 50, date: "2026-10-31",
  })).status, 200);
  const afterReceipt = (await request(page, "cases/" + macCase.id)).case;
  assert.equal(afterReceipt.fee_summary.invoiced_unpaid,
    Math.max(0, Math.round((automaticCase.fee_summary.invoiced_unpaid - 50) * 100) / 100));
  assert.equal((await request(page,
    "cases/" + macCase.id + "/collections/" + afterReceipt.collections.at(-1).id, "DELETE", {})).status, 200);
  assert.equal((await request(page, "cases/" + macCase.id, "PUT", { invoiced_unpaid: 3250.05 })).status, 200);
  await page.getByRole("button", { name: "重置", exact: true }).click();
  await page.screenshot({
    path: path.join(workspace, "案件台账.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "工作台", exact: true }).click();
  await expect(page.getByRole("heading", { name: "按业务类型" })).toBeVisible();
  await page.screenshot({
    path: path.join(workspace, "费用统计.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "设置与备份", exact: true }).click();
  await expect(page.locator("#software-updates")).toContainText("每 48 小时自动检查新版本");
  await expect(page.locator("body")).toContainText("每 48 小时自动备份一次");
  await expect(page.locator("body")).toContainText("本机备份合计保留最近 5 份");
  const backupPolicy = await request(page, "backups");
  assert.equal(backupPolicy.retention, 5);
  assert.equal(backupPolicy.automatic_interval_hours, 48);
  assert(backupPolicy.backups.length <= 5);
  await expect(page.getByText("私有版本访问", { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-update=access], [data-update=clear-access]")).toHaveCount(0);
  assert.deepEqual(await page.evaluate(() => ({
    setAccess: typeof window.hengzhang.setUpdateAccess,
    clearAccess: typeof window.hengzhang.clearUpdateAccess,
  })), { setAccess: "undefined", clearAccess: "undefined" });
  await page.locator("[name=dashboard_motto]").fill("以法为业，守护公正。");
  await page.getByRole("button", { name: "保存格言", exact: true }).click();
  await page.getByRole("button", { name: "工作台", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "以法为业，守护公正。", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "设置与备份", exact: true }).click();
  await expect(page.locator("[data-homepage]")).toHaveAttribute(
    "href",
    "https://aifalv.vip/",
  );
  await expect(page.locator("#content")).toContainText(APP_VERSION);
  await application.evaluate(({ shell }) => {
    globalThis.realOpenExternal = shell.openExternal;
    globalThis.homepageCalls = [];
    shell.openExternal = async (url) => {
      globalThis.homepageCalls.push(url);
    };
  });
  await page.getByRole("link", { name: "潘松律师", exact: true }).click();
  await expect
    .poll(() => application.evaluate(() => globalThis.homepageCalls))
    .toEqual(["https://aifalv.vip/"]);
  await application.evaluate(({ shell }) => {
    shell.openExternal = globalThis.realOpenExternal;
  });
  before = await downloadCount();
  await page.getByRole("button", { name: "导出备份", exact: true }).click();
  const backupPath = await waitDownload(before),
    backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  assert.equal(backup.data.cases.length, 4);
  const c = backup.data.cases.find((c) => c.case_no === "MAC-001");
  assert.equal(c.collections.length, 1);
  assert.equal(c.progress.length, 1);
  assert.equal(c.collected_amount, 3000.25);
  assert.equal(c.case_stage, "一审");
  assert.equal(c.invoiced_unpaid, 3250.05);
  await request(page, "cases/" + c.id, "DELETE", {});
  await page.locator("#backup-file").setInputFiles(backupPath);
  await expect(
    page.getByRole("button", { name: "确认恢复并替换当前数据", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "确认恢复并替换当前数据", exact: true })
    .click();
  await expect(page.locator("#modal")).not.toBeVisible();
  const restored = await request(page, "workspace");
  assert.equal(restored.cases.length, 4);
  assert.equal(
    restored.cases.find((x) => x.id === c.id).progress[0].text,
    "已完成材料整理，等待开庭。",
  );
  await page.screenshot({
    path: path.join(workspace, "备份恢复.png"),
    fullPage: true,
  });
  await closeApplication();
  application = null;
  page = await launch("以法为业，守护公正。");
  const restarted = await request(page, "workspace");
  assert.equal(restarted.cases.length, 4);
  assert.equal(
    restarted.cases.find((x) => x.id === c.id).collected_amount,
    3000.25,
  );
  assert.equal(
    restarted.cases.find((x) => x.id === c.id).fee_summary.invoiced_unpaid,
    3250.05,
  );
  await page.getByRole("button", { name: "设置与备份", exact: true }).click();
  await expect(page.locator("[name=dashboard_motto]")).toHaveValue(
    "以法为业，守护公正。",
  );
  await page.getByRole("button", { name: "恢复默认", exact: true }).click();
  await page.getByRole("button", { name: "工作台", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "热爱法律，笃行正义。", exact: true }),
  ).toBeVisible();
  // Exercise native IPC and update rendering without creating a fake GitHub release.
  await page.getByRole("button", { name: "设置与备份", exact: true }).click();
  await application.evaluate(({ net, shell }) => {
    globalThis.updateRealFetch = net.fetch;
    globalThis.updateRealShell = shell.openExternal;
    globalThis.updateDownloadCalls = [];
    globalThis.updateRequests = [];
    shell.openExternal = async (url) => {
      globalThis.updateDownloadCalls.push(url);
    };
    net.fetch = async (url, options) => {
      globalThis.updateRequests.push({
        url,
        credentials: options.credentials,
        hasBody: !!options.body,
      });
      return new Response(
        JSON.stringify({
          tag_name: "v9.9.9",
          draft: false,
          prerelease: false,
          body: "更新提醒测试：<img src=x onerror=alert(1)>",
          published_at: "2026-10-31T03:00:00Z",
          assets: [
            {
              name: "Hengzhang-9.9.9-universal.dmg",
              state: "uploaded",
              size: 100,
              browser_download_url:
                "https://github.com/pansong-law/hengzhang-open/releases/download/v9.9.9/Hengzhang-9.9.9-universal.dmg",
            },
          ],
        }),
        { status: 200 },
      );
    };
  });
  await page.locator("[data-update=check]").click();
  await expect(
    page.getByRole("heading", { name: "发现新版本 9.9.9" }),
  ).toBeVisible();
  await expect(page.locator(".update-notes")).toContainText("<img");
  await expect(page.locator(".update-notes img")).toHaveCount(0);
  await page.locator("[data-update=download]").click();
  await expect
    .poll(() => application.evaluate(() => globalThis.updateDownloadCalls))
    .toEqual([
      "https://github.com/pansong-law/hengzhang-open/releases/tag/v9.9.9",
    ]);
  await page.locator("[data-update=later]").click();
  await expect(page.locator("#update-banner")).toBeVisible();
  await page.locator("[data-update=dismiss]").click();
  await expect(page.locator("#update-banner")).not.toBeVisible();
  await page.locator("#automatic-updates").uncheck();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.hengzhang.updateStatus().then((s) => s.automatic),
      ),
    )
    .toBe(false);
  await page.getByRole("button", { name: "案件台账", exact: true }).click();
  await page.getByRole("button", { name: "＋ 新建案件", exact: true }).click();
  await page.locator("[name=client]").fill("未保存的输入");
  await page.evaluate(() => window.hengzhang.checkUpdates());
  await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send("hengzhang:show-updates"),
  );
  await expect(page.locator("[name=client]")).toHaveValue("未保存的输入");
  await expect(
    page.getByRole("heading", { name: "新建案件", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await application.evaluate(({ net }) => {
    net.fetch = async () => {
      throw Error("offline");
    };
  });
  await page.evaluate(() => window.hengzhang.checkUpdates());
  assert.equal(
    (await page.evaluate(() => window.hengzhang.updateStatus())).status,
    "error",
  );
  assert.equal((await request(page, "workspace")).cases.length, 4);
  await page.getByRole("button", { name: "设置与备份", exact: true }).click();
  await page.screenshot({
    path: path.join(workspace, "软件更新.png"),
    fullPage: true,
  });
  const updateRequests = await application.evaluate(
    () => globalThis.updateRequests,
  );
  assert(updateRequests.length > 0);
  assert(
    updateRequests.every(
      (r) =>
        r.url.startsWith(
          "https://api.github.com/repos/pansong-law/hengzhang-open/",
        ) &&
        r.credentials === "omit" &&
        !r.hasBody,
    ),
  );
  await application.evaluate(({ net, shell }) => {
    net.fetch = globalThis.updateRealFetch;
    shell.openExternal = globalThis.updateRealShell;
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: executable ? "packaged" : "development",
        cases: 4,
        downloads: fs.readdirSync(downloads),
        screenshots: workspace,
        security,
        external_requests: external,
        page_errors: errors,
      },
      null,
      2,
    ),
  );
} finally {
  if (application) await closeApplication();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
