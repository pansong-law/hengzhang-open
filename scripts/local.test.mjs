import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLocalApp } from "../server.js";
import { LocalStore, backupDocument, readBackup } from "../lib/store.js";
import { prepareCase, caseFinance } from "../lib/case-model.js";
import { advisoryRenewalDraft } from "../lib/advisory-renewal.js";
async function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hengzhang-test-"));
  let app = createLocalApp({ dataDir: dir }),
    origin = await app.start();
  let cookie = (await fetch(origin + "/")).headers
    .get("set-cookie")
    .split(";")[0];
  const request = async (p, method = "GET", body, extra = {}) => {
    const r = await fetch(origin + "/api/" + p, {
      method,
      headers: {
        cookie,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...extra,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, ...(await r.json()) };
  };
  return {
    dir,
    request,
    get app() {
      return app;
    },
    get origin() {
      return origin;
    },
    async restart() {
      await app.close();
      app = createLocalApp({ dataDir: dir });
      origin = await app.start();
      cookie = (await fetch(origin + "/")).headers
        .get("set-cookie")
        .split(";")[0];
    },
    async close() {
      await app.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
test("empty offline workspace has no account, bill or allocation routes", async () => {
  const s = await fixture();
  try {
    const w = await s.request("workspace");
    assert.equal(w.status, 200);
    assert.deepEqual(w.cases, []);
    assert.equal(w.summary.count, 0);
    assert.equal(w.user, undefined);
    for (const route of [
      "users",
      "login",
      "register",
      "bills",
      "standards",
      "fee-allocations",
    ])
      assert.equal((await s.request(route)).status, 404);
    assert.equal(
      (await s.request("cases", "POST", { track: "jd" })).status,
      400,
    );
    const noCookie = await fetch(s.origin + "/api/workspace");
    assert.equal(noCookie.status, 403);
    assert.equal(
      (
        await s.request("workspace", "GET", null, {
          Origin: "https://untrusted.example",
        })
      ).status,
      403,
    );
    const cross = await fetch(s.origin + "/", {
      headers: { "Sec-Fetch-Site": "cross-site" },
    });
    assert.equal(cross.status, 403);
    const db = JSON.parse(fs.readFileSync(path.join(s.dir, "db.json")));
    assert.deepEqual(Object.keys(db), ["schema_version", "cases", "meta"]);
  } finally {
    await s.close();
  }
});
test("all three case types allow arbitrary lawyer names and persist across restart", async () => {
  const s = await fixture();
  try {
    for (const track of ["litigation", "advisory", "project"]) {
      const r = await s.request("cases", "POST", {
        track,
        case_no: track,
        client: "甲公司，乙公司",
        lawyer: "任意承办",
        co_lawyers: ["任意协办"],
        contract_amount: "1000.10",
        invoice_amount: 600,
        collected_amount: 200,
        fee_note: "分两期支付",
      });
      assert.equal(r.status, 200);
      assert.equal(r.case.client, "甲公司,乙公司");
      assert.equal(r.case.fee_summary.unpaid, 800.1);
      assert.deepEqual(r.case.co_lawyers, ["任意协办"]);
    }
    await s.restart();
    const w = await s.request("workspace");
    assert.equal(w.cases.length, 3);
    assert.equal(w.summary.signed, 3000.3);
    assert.equal(w.summary.received, 600);
    assert.equal(w.summary.unpaid, 2400.3);
    assert.equal(w.summary.invoiced_unpaid, 1200);
  } finally {
    await s.close();
  }
});
test("receipt arithmetic, cumulative edits and deletion do not double count", async () => {
  const s = await fixture();
  try {
    const c = (
      await s.request("cases", "POST", {
        track: "project",
        contract_amount: 1,
        invoice_amount: 1,
        collected_amount: 0.1,
      })
    ).case;
    for (const value of [0.2, 0.3])
      assert.equal(
        (
          await s.request("cases/" + c.id + "/collections", "POST", {
            amount: value,
            date: "2026-10-31",
            note: "到账",
          })
        ).status,
        200,
      );
    let current = (await s.request("cases/" + c.id)).case;
    assert.equal(current.collected_amount, 0.6);
    assert.equal(current.opening_received, 0.1);
    assert.equal(current.fee_summary.unpaid, 0.4);
    assert.equal(
      (await s.request("cases/" + c.id, "PUT", { collected_amount: 0.4 }))
        .status,
      400,
    );
    assert.equal(
      (await s.request("cases/" + c.id, "PUT", { collected_amount: 0.8 }))
        .status,
      200,
    );
    current = (await s.request("cases/" + c.id)).case;
    assert.equal(current.opening_received, 0.3);
    assert.equal(
      (
        await s.request(
          "cases/" + c.id + "/collections/" + current.collections[0].id,
          "DELETE",
          {},
        )
      ).status,
      200,
    );
    current = (await s.request("cases/" + c.id)).case;
    assert.equal(current.collected_amount, 0.6);
    assert.equal(current.collections.length, 1);
    for (const value of [-1, 0, "bad", 0.001, "1e3"])
      assert.equal(
        (
          await s.request("cases/" + c.id + "/collections", "POST", {
            amount: value,
            date: "2026-10-31",
          })
        ).status,
        400,
      );
    assert.equal(
      (
        await s.request("cases/" + c.id + "/collections", "POST", {
          amount: 1,
          date: "2026-02-30",
        })
      ).status,
      400,
    );
  } finally {
    await s.close();
  }
});
test("stale case changes are rejected and duplicate numbers never overwrite", async () => {
  const s = await fixture();
  try {
    const c = (
      await s.request("cases", "POST", { case_no: "UNIQUE", client: "甲" })
    ).case;
    assert.equal(
      (await s.request("cases", "POST", { case_no: "UNIQUE", client: "乙" }))
        .status,
      400,
    );
    assert.equal(
      (
        await s.request("cases/" + c.id, "PUT", {
          revision: c.revision,
          notes: "第一次",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await s.request("cases/" + c.id, "PUT", {
          revision: c.revision,
          notes: "过期内容",
        })
      ).status,
      409,
    );
    assert.equal((await s.request("cases/" + c.id)).case.notes, "第一次");
  } finally {
    await s.close();
  }
});
test("Excel import stages the entire batch, protects receipts and exports only selected cases", async () => {
  const s = await fixture();
  try {
    const rows = [
      {
        track: "诉讼",
        internal_no: "IMPORT-1",
        client: "甲",
        lawyer: "外部律师",
        co_lawyers: "乙、丙",
        contract_amount: "1,000.25（分两期）",
        collected_amount: 100,
      },
      { track: "顾问", internal_no: "IMPORT-2", client: "顾问客户" },
    ];
    let p = await s.request("cases/import-preview", "POST", { rows });
    assert.equal(p.status, 200);
    assert.equal(p.added, 2);
    assert.equal((await s.request("workspace")).cases.length, 0);
    assert.equal(
      (
        await s.request("cases/import", "POST", {
          rows,
          preview_id: p.preview_id,
        })
      ).status,
      200,
    );
    let w = await s.request("workspace");
    const c = w.cases.find((c) => c.case_no === "IMPORT-1");
    assert.equal(c.contract_amount, 1000.25);
    assert.equal(c.fee_note, "分两期");
    assert.deepEqual(c.co_lawyers, ["乙", "丙"]);
    const update = [
      { track: "诉讼", internal_no: "IMPORT-1", client: "", notes: "新增备注" },
    ];
    p = await s.request("cases/import-preview", "POST", { rows: update });
    assert.equal(p.merged, 1);
    await s.request("cases/import", "POST", {
      rows: update,
      preview_id: p.preview_id,
    });
    assert.equal((await s.request("cases/" + c.id)).case.client, "甲");
    const bad = [
      { track: "诉讼", internal_no: "IMPORT-NEW", client: "不应落库" },
      { track: "诉讼", contract_amount: "非法金额" },
    ];
    assert.equal(
      (await s.request("cases/import-preview", "POST", { rows: bad })).status,
      400,
    );
    assert.equal((await s.request("workspace")).cases.length, 2);
    const exported = await s.request("cases/export-ledger", "POST", {
      ids: [c.id],
    });
    assert.equal(exported.total, 1);
    assert.equal(exported.sheets.flatMap((s) => s.rows).length, 1);
    const stale = await s.request("cases/import-preview", "POST", {
      rows: update,
    });
    await s.request("cases", "POST", { client: "后来新增" });
    assert.equal(
      (
        await s.request("cases/import", "POST", {
          rows: update,
          preview_id: stale.preview_id,
        })
      ).status,
      409,
    );
  } finally {
    await s.close();
  }
});
test("renewal creates a separate clean receivable and handles leap-year expiry", async () => {
  assert.equal(
    advisoryRenewalDraft(
      { case_no: "顾问", service_period: "2023-03-01 至 2024-02-29" },
      [],
    ).service_period,
    "2024-03-01 至 2025-02-28",
  );
  const s = await fixture();
  try {
    const c = (
      await s.request("cases", "POST", {
        track: "advisory",
        case_no: "A-1",
        client: "顾问客户",
        lawyer: "甲",
        contract_amount: 1000,
        collected_amount: 600,
        invoice_amount: 800,
        fee_note: "年度费用",
        service_period: "2026-01-01 至 2026-12-31",
      })
    ).case;
    await s.request("cases/" + c.id + "/progress", "POST", { text: "原进展" });
    const renewal = (await s.request("cases", "POST", { renew_from: c.id }))
      .case;
    assert.notEqual(renewal.id, c.id);
    assert.equal(renewal.case_no, "A-1-续签");
    assert.equal(renewal.service_period, "2027-01-01 至 2027-12-31");
    assert.equal(renewal.collected_amount, 0);
    assert.equal(renewal.invoice_amount, 0);
    assert.deepEqual(renewal.progress, []);
    assert.equal(renewal.fee_note, "年度费用");
    assert.equal(renewal.fee_summary.unpaid, 1000);
    assert.equal((await s.request("cases/" + c.id)).case.collected_amount, 600);
    assert.equal(
      (
        await s.request("cases", "POST", {
          renew_from: c.id,
          service_period: "2027-12-31 至 2027-01-01",
        })
      ).status,
      400,
    );
  } finally {
    await s.close();
  }
});
test("payable cycles are idempotent and never change financial records", async () => {
  const s = await fixture();
  try {
    const c = (
      await s.request("cases", "POST", {
        client: "付款客户",
        contract_amount: 1000,
      })
    ).case;
    const calls = await Promise.all(
      ["payable-first", "payable-second"].map((request_id) =>
        s.request("cases/" + c.id + "/payable", "POST", {
          request_id,
          amount: 100,
          note: "一期费用",
        }),
      ),
    );
    assert.equal(calls.filter((r) => r.status === 200).length, 1);
    assert.equal(calls.filter((r) => r.status === 409).length, 1);
    const info = await s.request("cases/" + c.id + "/payable");
    assert.equal(info.cycles.length, 1);
    await s.request(
      "cases/" + c.id + "/payable/" + info.current.id + "/complete",
      "POST",
      {},
    );
    assert.equal(
      (
        await s.request(
          "cases/" + c.id + "/payable/" + info.current.id + "/complete",
          "POST",
          {},
        )
      ).already_completed,
      true,
    );
    const after = (await s.request("cases/" + c.id)).case;
    assert.equal(after.invoice_amount, c.invoice_amount);
    assert.equal(after.collected_amount, c.collected_amount);
    assert.deepEqual(after.fee_summary, c.fee_summary);
  } finally {
    await s.close();
  }
});
test("complete backup restores every record and preserves pre-restore state", async () => {
  const s = await fixture();
  try {
    const c = (
      await s.request("cases", "POST", {
        client: "恢复客户",
        contract_amount: 1000,
        collected_amount: 100,
      })
    ).case;
    await s.request("cases/" + c.id + "/collections", "POST", {
      date: "2026-10-31",
      amount: 200,
      note: "银行到账",
    });
    await s.request("cases/" + c.id + "/progress", "POST", {
      text: "测试进展",
    });
    await s.request("cases/" + c.id + "/payable", "POST", {
      request_id: "payable-restore",
      amount: 500,
      note: "待开票",
    });
    const original = structuredClone(s.app.store.db),
      backup = await s.request("backups/export");
    delete backup.status;
    const tampered = structuredClone(backup);
    tampered.data.cases[0].client = "被修改";
    assert.equal(
      (await s.request("backups/preview", "POST", { backup: tampered })).status,
      400,
    );
    await s.request("cases/" + c.id, "DELETE", {});
    assert.equal((await s.request("workspace")).cases.length, 0);
    const preview = await s.request("backups/preview", "POST", { backup });
    assert.equal(preview.collections, 1);
    assert.equal(preview.progress, 1);
    assert.equal(preview.reminders, 1);
    assert.equal(preview.current_cases, 0);
    const result = await s.request("backups/restore", "POST", {
      backup,
      confirm: preview.checksum,
      current_checksum: preview.current_checksum,
    });
    assert.equal(result.status, 200);
    assert.deepEqual(s.app.store.db, original);
    assert.equal(
      s.app.store.getBackup(result.safety_backup).data.cases.length,
      0,
    );
    await s.restart();
    assert.deepEqual(s.app.store.db, original);
  } finally {
    await s.close();
  }
});
test("restoring a stale preview is refused", async () => {
  const s = await fixture();
  try {
    const backup = backupDocument(s.app.store.db),
      p = await s.request("backups/preview", "POST", { backup });
    await s.request("cases", "POST", { client: "新增" });
    assert.equal(
      (
        await s.request("backups/restore", "POST", {
          backup,
          confirm: p.checksum,
          current_checksum: p.current_checksum,
        })
      ).status,
      409,
    );
    assert.equal(s.app.store.db.cases.length, 1);
  } finally {
    await s.close();
  }
});
test("backup retention, structural validation and damaged startup preserve originals", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hz-backup-test-"));
  try {
    const store = new LocalStore(dir);
    for (let i = 0; i < 35; i++) store.snapshot("manual");
    assert.equal(store.backups().length, 30);
    const original = fs.readFileSync(store.file, "utf8");
    assert.throws(() => store.restore({ format: "unknown" }));
    assert.equal(fs.readFileSync(store.file, "utf8"), original);
    const malformed = structuredClone(store.db);
    malformed.users = [];
    assert.throws(() => readBackup(backupDocument(malformed)));
    const c = prepareCase({ contract_amount: 100, collected_amount: 50 });
    assert.equal(caseFinance(c).unpaid, 50);
    fs.writeFileSync(store.file, "damaged");
    assert.throws(() => new LocalStore(dir), /原文件已保留/);
    assert.equal(fs.readFileSync(store.file, "utf8"), "damaged");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("editable invoiced unpaid survives editing, import, export and old-version backups", async () => {
  const s = await fixture();
  try {
    const c = (
      await s.request("cases", "POST", {
        track: "project",
        case_no: "MANUAL-1",
        invoice_amount: 1000,
        collected_amount: 100,
        invoiced_unpaid: 700.25,
      })
    ).case;
    assert.equal(c.fee_summary.invoiced_unpaid, 700.25);
    await s.request("cases/" + c.id, "PUT", { notes: "只更新备注" });
    await s.request("cases/" + c.id + "/collections", "POST", {
      amount: 50,
      date: "2026-10-31",
    });
    assert.equal(
      (await s.request("cases/" + c.id)).case.fee_summary.invoiced_unpaid,
      700.25,
    );
    assert.equal(
      (await s.request("workspace")).summary.invoiced_unpaid,
      700.25,
    );
    const exported = await s.request("cases/export-ledger", "POST", {
        ids: [c.id],
      }),
      sheet = exported.sheets.find((s) => s.track === "project");
    assert.equal(sheet.headers.filter((h) => h === "开票未付金额").length, 1);
    assert.equal(sheet.rows[0][sheet.headers.indexOf("开票未付金额")], 700.25);
    for (const spec of Object.values((await s.request("templates")).templates))
      assert(
        spec.fields.some(
          (f) => f.key === "invoiced_unpaid" && f.label === "开票未付金额",
        ),
      );
    const rows = [
        { track: "专项", internal_no: "MANUAL-1", invoiced_unpaid: 123.45 },
      ],
      p = await s.request("cases/import-preview", "POST", { rows });
    assert.equal(p.status, 200);
    await s.request("cases/import", "POST", { rows, preview_id: p.preview_id });
    assert.equal(
      (await s.request("cases/" + c.id)).case.fee_summary.invoiced_unpaid,
      123.45,
    );
    await s.request("cases/" + c.id, "PUT", { invoiced_unpaid: "" });
    assert.equal(
      (await s.request("cases/" + c.id)).case.fee_summary.invoiced_unpaid,
      850,
    );
    await s.request("cases/" + c.id, "PUT", { invoiced_unpaid: 0 });
    assert.equal(
      (await s.request("cases/" + c.id)).case.fee_summary.invoiced_unpaid,
      0,
    );
    for (const value of [-1, 0.001, "bad"])
      assert.equal(
        (await s.request("cases/" + c.id, "PUT", { invoiced_unpaid: value }))
          .status,
        400,
      );
    await s.restart();
    assert.equal(
      (await s.request("cases/" + c.id)).case.fee_summary.invoiced_unpaid,
      0,
    );
    const old = structuredClone(s.app.store.db);
    delete old.cases[0].invoiced_unpaid;
    s.app.store.restore(backupDocument(old));
    await s.restart();
    assert.equal(
      (await s.request("cases/" + c.id)).case.fee_summary.invoiced_unpaid,
      850,
    );
  } finally {
    await s.close();
  }
});
