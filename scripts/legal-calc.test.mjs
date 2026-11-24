import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLocalApp } from "../server.js";
import { BUILTIN_IDS } from "../lib/legal-calc.js";

async function fixture(options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hz-open-lc-"));
  const app = createLocalApp({ dataDir: dir, ...options });
  const origin = await app.start(0);
  const home = await fetch(origin + "/");
  const cookie = home.headers.get("set-cookie").split(";")[0];
  const request = async (route, method = "GET", body) => {
    const res = await fetch(origin + "/api/" + route, {
      method,
      headers: {
        cookie,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed = {};
    try {
      parsed = JSON.parse(text);
    } catch {}
    return { status: res.status, headers: res.headers, text, body: parsed };
  };
  return {
    origin,
    cookie,
    request,
    async close() {
      await app.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("standalone combined ledger import template, 3-track import, guards, and web 23-col compatibility", async () => {
  const s = await fixture();
  try {
    // 1. /api/templates returns combined 26-column spec & static xlsx downloads cleanly
    const tplRes = await s.request("templates");
    assert.equal(tplRes.status, 200);
    assert.equal(tplRes.body.combined.file, "all-cases-template.xlsx");
    assert.equal(tplRes.body.combined.fields.length, 26);

    const xlsxRes = await fetch(s.origin + "/templates/all-cases-template.xlsx");
    assert.equal(xlsxRes.status, 200);
    assert.match(
      xlsxRes.headers.get("content-type") || "",
      /spreadsheetml\.sheet/,
    );
    const bytes = new Uint8Array(await xlsxRes.arrayBuffer());
    assert.equal(bytes[0], 0x50); // 'P'
    assert.equal(bytes[1], 0x4b); // 'K'

    // 2. Mixed 3-track combined import (including standalone unpaid_mode + web 23-col row without mode columns)
    const rows = [
      {
        require_track: true,
        track: "顾问",
        internal_no: "COMB-ADV-1",
        client: "综合顾问客户",
        service_period: "2026-01-01 至 2026-12-31",
        contract_amount: 60000,
        invoice_amount: 30000,
        collected_amount: 10000,
        invoiced_unpaid: 18000,
        invoiced_unpaid_mode: "手填",
      },
      {
        require_track: true,
        track: "专项",
        internal_no: "COMB-PRJ-1",
        name: "股权并购尽调",
        client: "甲投资",
        opponent: "乙标的公司",
        contract_amount: 80000,
      },
      {
        require_track: true,
        track: "诉讼",
        internal_no: "COMB-LIT-1",
        plaintiff: "丙公司",
        defendant: "丁公司",
        client: "丙公司",
        case_type: "买卖合同纠纷",
        case_stage: "一审",
        service_stages: "一审,二审",
        contract_amount: 50000,
      },
    ];
    const p1 = await s.request("cases/import-preview", "POST", { rows });
    assert.equal(p1.status, 200);
    assert.equal(p1.body.added, 3);
    const r1 = await s.request("cases/import", "POST", {
      rows,
      preview_id: p1.body.preview_id,
    });
    assert.equal(r1.status, 200);

    const ws = (await s.request("workspace")).body;
    const adv = ws.cases.find((c) => c.case_no === "COMB-ADV-1");
    const prj = ws.cases.find((c) => c.case_no === "COMB-PRJ-1");
    const lit = ws.cases.find((c) => c.case_no === "COMB-LIT-1");
    assert.equal(adv.track, "advisory");
    assert.equal(adv.service_period, "2026-01-01 至 2026-12-31");
    assert.equal(adv.invoiced_unpaid, 18000);
    assert.equal(prj.track, "project");
    assert.equal(prj.name, "股权并购尽调");
    assert.equal(prj.opponent, "乙标的公司");
    assert.equal(lit.track, "litigation");
    assert.equal(lit.case_stage, "一审");
    assert.equal(lit.service_period, "一审,二审");

    // 3. Blank type on existing case merges and preserves original track
    const mergeRows = [
      { require_track: true, internal_no: "COMB-ADV-1", notes: "空白类型合并更新" },
    ];
    const p2 = await s.request("cases/import-preview", "POST", { rows: mergeRows });
    assert.equal(p2.status, 200);
    assert.equal(p2.body.merged, 1);
    assert.equal(
      (
        await s.request("cases/import", "POST", {
          rows: mergeRows,
          preview_id: p2.body.preview_id,
        })
      ).status,
      200,
    );
    assert.equal(
      (await s.request("cases/" + adv.id)).body.case.notes,
      "空白类型合并更新",
    );

    // 4. Guards: blank type on new row, cross-track exclusive field, and JD row are all rejected
    assert.equal(
      (
        await s.request("cases/import-preview", "POST", {
          rows: [{ require_track: true, internal_no: "NEW-NO-TRACK", client: "无类型" }],
        })
      ).status,
      400,
    );
    const crossErr = await s.request("cases/import-preview", "POST", {
      rows: [
        {
          require_track: true,
          track: "顾问",
          internal_no: "CROSS-1",
          client: "甲",
          plaintiff: "误填原告",
        },
      ],
    });
    assert.equal(crossErr.status, 400);
    assert.match(crossErr.body.error, /原告（仅诉讼）/);

    const jdErr = await s.request("cases/import-preview", "POST", {
      rows: [{ require_track: true, track: "京东框架", internal_no: "JD-1", client: "京东" }],
    });
    assert.equal(jdErr.status, 400);
    assert.match(jdErr.body.error, /京东框架/);
  } finally {
    await s.close();
  }
});

test("standalone legal calc CRUD, VAT protection, sandbox CSP, and platform AI mini-tool generator", async () => {
  const secretKey = "synthetic-local-lc-key-never-leak";
  const baseUrl = "https://api.siliconflow.cn/v1";
  const aiResp = (obj) =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content:
                typeof obj === "string"
                  ? obj
                  : "```json\n" + JSON.stringify(obj) + "\n```",
            },
          },
        ],
      }),
    );

  const formulaTool = {
    title: "股权转让个税测算",
    desc: "自然人股权转让 20% 个人所得税测算",
    scope_note: "个人所得税法",
    icon: "tax",
    accent: "emerald",
    mode: "formula",
    schema: {
      fields: [
        { key: "income", label: "转让收入", type: "number", unit: "元", default: "1000000" },
        { key: "cost", label: "股权原值", type: "number", unit: "元", default: "400000" },
      ],
      outputs: [
        { key: "tax", label: "应纳个税", expr: "max(0, income - cost) * 0.2", format: "money", headline: true, strong: true },
      ],
      notes: ["财产转让所得 20%"],
    },
  };
  const sandboxTool = {
    title: "分期还款计划表",
    desc: "逐期本息明细测算",
    icon: "abacus",
    accent: "cobalt",
    mode: "sandbox",
    code: '<div class="card"><div id="out">ok</div></div><script>1+1</script>',
  };

  let nextReply = () => aiResp(formulaTool);
  const seenPrompts = [];
  const s = await fixture({
    aiFetch: async (_url, options) => {
      seenPrompts.push(JSON.parse(options.body));
      return nextReply();
    },
  });

  try {
    // 1. Initial GET reports single_user and ai_ready=false
    const init = await s.request("legal-calc");
    assert.equal(init.status, 200);
    assert.equal(init.body.single_user, true);
    assert.equal(init.body.ai_ready, false);

    // 2. Unconfigured AI returns 400
    assert.equal(
      (await s.request("legal-calc/ai-generate", "POST", { prompt: "写一个违约金计算器" })).status,
      400,
    );

    // 3. Built-in IDs (10 built-ins ordered with lawyer & vat first) cannot be overwritten or deleted, and external sandbox scripts are blocked
    assert.deepEqual(BUILTIN_IDS, [
      "lawyer",
      "vat",
      "court",
      "liquidated",
      "interest",
      "limitation",
      "labor",
      "traffic",
      "days",
      "rmb",
    ]);
    assert.equal(
      (
        await s.request("legal-calc", "POST", {
          action: "save_tool",
          tool: { id: "vat", title: "覆盖增值税", mode: "sandbox", code: "<p>x</p>" },
        })
      ).status,
      400,
    );
    assert.equal(
      (await s.request("legal-calc", "POST", { action: "delete_tool", id: "vat" })).status,
      400,
    );
    assert.equal(
      (
        await s.request("legal-calc", "POST", {
          action: "save_tool",
          tool: { title: "外链", mode: "sandbox", code: '<script src="https://evil.invalid/a.js"></script><p>x</p>' },
        })
      ).status,
      400,
    );

    // 4. Configure local AI -> generate formula tool -> refine into sandbox -> save -> reorder -> delete
    assert.equal(
      (
        await s.request("ai/config", "PUT", {
          provider: "siliconflow",
          base_url: baseUrl,
          model: "Qwen/Qwen3-8B",
          api_key: secretKey,
        })
      ).status,
      200,
    );
    assert.equal((await s.request("legal-calc")).body.ai_ready, true);

    const g1 = await s.request("legal-calc/ai-generate", "POST", {
      prompt: "写一个股权转让个税计算器",
      preferred_mode: "formula",
    });
    assert.equal(g1.status, 200);
    assert.equal(g1.body.tool.mode, "formula");
    assert.equal(g1.body.tool.title, "股权转让个税测算");

    nextReply = () => aiResp(sandboxTool);
    const g2 = await s.request("legal-calc/ai-generate", "POST", {
      prompt: "改成分期还款计划表沙盒网页",
      preferred_mode: "sandbox",
      current_tool: g1.body.tool,
    });
    assert.equal(g2.status, 200);
    assert.equal(g2.body.tool.mode, "sandbox");
    assert.match(seenPrompts.at(-1).messages[1].content, /股权转让个税测算/);

    // External CDN script from AI is rejected
    nextReply = () =>
      aiResp({
        ...sandboxTool,
        code: '<script src="https://cdn.invalid/x.js"></script><p>bad</p>',
      });
    assert.equal(
      (await s.request("legal-calc/ai-generate", "POST", { prompt: "生成一个沙盒计算器" })).status,
      400,
    );

    // Upstream errors redact API key
    nextReply = () =>
      new Response(
        JSON.stringify({ error: { message: `failed with ${secretKey}` } }),
        { status: 502 },
      );
    const errRes = await s.request("legal-calc/ai-generate", "POST", {
      prompt: "生成一个违约金计算器",
    });
    assert.ok(errRes.status >= 400);
    assert.ok(!JSON.stringify(errRes.body).includes(secretKey));

    // Save, reorder, and delete tool
    const saved = await s.request("legal-calc", "POST", {
      action: "save_tool",
      tool: g1.body.tool,
    });
    assert.equal(saved.status, 200);
    const tid = saved.body.saved_id;
    assert.match(tid, /^ctool_/);

    const reordered = await s.request("legal-calc", "POST", {
      action: "reorder",
      order_ids: [tid, "vat", "rmb"],
      pinned_ids: [tid, "vat"],
    });
    assert.equal(reordered.status, 200);
    assert.deepEqual(reordered.body.pinned_ids, [tid, "vat"]);

    const deleted = await s.request("legal-calc", "POST", {
      action: "delete_tool",
      id: tid,
    });
    assert.equal(deleted.status, 200);
    assert.deepEqual(deleted.body.custom_tools, []);

    // 5. Sandbox runner returns SAMEORIGIN + strict isolated CSP
    const runner = await s.request("legal-calc/sandbox-runner");
    assert.equal(runner.status, 200);
    assert.equal(runner.headers.get("x-frame-options"), "SAMEORIGIN");
    const csp = runner.headers.get("content-security-policy") || "";
    assert.match(csp, /sandbox allow-scripts/);
    assert.doesNotMatch(csp, /allow-same-origin/);
    assert.match(csp, /connect-src 'none'/);
    assert.match(runner.text, /hz-calc-load/);
  } finally {
    await s.close();
  }
});
