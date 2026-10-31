import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createLocalApp } from "../server.js";
import { LocalStore, backupDocument, readBackup, BACKUP_INTERVAL, BACKUP_RETENTION } from "../lib/store.js";
import { prepareCase, caseFinance } from "../lib/case-model.js";
import { advisoryRenewalDraft } from "../lib/advisory-renewal.js";
import { CASE_LEDGER_FIELDS } from "../lib/case-ledger-fields.js";

for (const operation of ["receipt", "restore"])
  for (const failure of ["open", "fsync", "close"])
    test("post-rename directory " + failure + " failure during " + operation + " pauses writes", async (t) => {
      const s = await fixture();
      try {
        const c = (await s.request("cases", "POST", {
          case_no: "IO-1", collected_amount: 0,
        })).case;
        const restored = structuredClone(s.app.store.db);
        restored.meta.dashboard_motto = "恢复后的格言";
        const document = backupDocument(restored);
        const preview = operation === "restore"
          ? await s.request("backups/preview", "POST", { backup: document })
          : null;
        const original = { open: fs.openSync, fsync: fs.fsyncSync, close: fs.closeSync };
        const directoryInode = fs.statSync(s.dir).ino;
        let injected = false;
        const isDirectory = (fd) => {
          const stat = fs.fstatSync(fd);
          return stat.isDirectory() && stat.ino === directoryInode;
        };
        const ioError = () => Object.assign(new Error("injected I/O failure"), { code: "EIO" });
        if (failure === "open") t.mock.method(fs, "openSync", (file, ...args) => {
          if (!injected && file === s.dir) { injected = true; throw ioError(); }
          return original.open(file, ...args);
        });
        if (failure === "fsync") t.mock.method(fs, "fsyncSync", (fd) => {
          if (!injected && isDirectory(fd)) { injected = true; throw ioError(); }
          return original.fsync(fd);
        });
        if (failure === "close") t.mock.method(fs, "closeSync", (fd) => {
          if (!injected && isDirectory(fd)) {
            injected = true;
            original.close(fd);
            throw ioError();
          }
          return original.close(fd);
        });
        let result;
        try {
          result = operation === "receipt"
            ? await s.request("cases/" + c.id + "/collections", "POST", {
                amount: 100, date: "2026-10-31",
              })
            : await s.request("backups/restore", "POST", {
                backup: document, confirm: preview.checksum,
                current_checksum: preview.current_checksum,
              });
        } finally { t.mock.reset(); }
        assert(injected);
        assert.equal(result.status, 503);
        assert.match(result.error, /已写入文件.*持久性未能确认.*暂停/);
        const disk = JSON.parse(fs.readFileSync(s.app.store.file, "utf8"));
        assert.deepEqual(s.app.store.db, disk);
        if (operation === "receipt") {
          assert.equal(disk.cases[0].collected_amount, 100);
          assert.equal(disk.cases[0].collections.length, 1);
          assert.equal((await s.request("cases/" + c.id)).case.collected_amount, 100);
        } else assert.equal(disk.meta.dashboard_motto, "恢复后的格言");
        assert.equal((await s.request("preferences", "PUT", { dashboard_motto: "不得覆盖" })).status, 503);
        assert.equal((await s.request("cases/" + c.id + "/collections", "POST", {
          amount: 100, date: "2026-10-31",
        })).status, 503);
        assert.throws(() => s.app.store.restore(document), /暂停后续写入/);
        assert.throws(() => s.app.store.snapshot("manual"), /暂停后续写入/);
        assert.deepEqual(JSON.parse(fs.readFileSync(s.app.store.file, "utf8")), disk);
        await s.restart();
        assert.deepEqual(s.app.store.db, disk);
        assert.equal((await s.request("cases/" + c.id + "/collections", "POST", {
          amount: 50, date: "2026-10-31",
        })).status, 200);
        assert.equal((await s.request("cases/" + c.id)).case.collected_amount,
          operation === "receipt" ? 150 : 50);
      } finally { t.mock.reset(); await s.close(); }
    });

test("rename failure preserves old database and permits a later successful save", async (t) => {
  const s = await fixture();
  try {
    const c = (await s.request("cases", "POST", { collected_amount: 0 })).case;
    const before = structuredClone(s.app.store.db);
    const rename = fs.renameSync;
    t.mock.method(fs, "renameSync", (from, to) => {
      if (to === s.app.store.file) throw Object.assign(new Error("I/O failure"), { code: "EIO" });
      return rename(from, to);
    });
    const result = await s.request("cases/" + c.id + "/collections", "POST", {
      amount: 100, date: "2026-10-31",
    });
    t.mock.reset();
    assert.equal(result.status, 500);
    assert.deepEqual(s.app.store.db, before);
    assert.deepEqual(JSON.parse(fs.readFileSync(s.app.store.file, "utf8")), before);
    assert(!fs.readdirSync(s.dir).some((n) => n.endsWith(".tmp")));
    assert.equal((await s.request("cases/" + c.id + "/collections", "POST", {
      amount: 100, date: "2026-10-31",
    })).status, 200);
    assert.equal((await s.request("cases/" + c.id)).case.collections.length, 1);
  } finally { t.mock.reset(); await s.close(); }
});

test("real XLSX round trips preserve automatic and manual amount modes for every case type", async () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(new URL("../public/vendor/xlsx.full.min.js", import.meta.url), "utf8"), context);
  const XLSX = context.XLSX;
  const s = await fixture();
  try {
    for (const track of ["litigation", "advisory", "project"]) {
      const ids = [];
      for (const mode of ["auto", "manual", "zero"]) {
        const c = (await s.request("cases", "POST", {
          track, case_no: track + "-" + mode,
          contract_amount: 1200, invoice_amount: 1000, collected_amount: 100,
          ...(mode === "manual" ? { unpaid: 750, invoiced_unpaid: 650 } : {}),
          ...(mode === "zero" ? { unpaid: 0, invoiced_unpaid: 0 } : {}),
        })).case;
        ids.push(c.id);
      }
      const exported = await s.request("cases/export-ledger", "POST", { ids });
      const sheet = exported.sheets.find((sheet) => sheet.track === track);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]), sheet.name);
      const binary = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      const read = XLSX.read(binary, { type: "base64" });
      const entries = XLSX.utils.sheet_to_json(read.Sheets[read.SheetNames[0]], { defval: "" });
      const aliases = Object.fromEntries(CASE_LEDGER_FIELDS[track].fields.map((f) => [f.label, f.key]));
      const rows = Array.from(entries, (entry) => Object.fromEntries(
        Object.entries(entry).map(([key, value]) => [aliases[key], value]),
      ));
      // Explicit auto mode also clears an existing manual override on merge.
      await s.request("cases/" + ids[0], "PUT", { unpaid: 10, invoiced_unpaid: 10 });
      const preview = await s.request("cases/import-preview", "POST", { rows });
      assert.equal(preview.status, 200);
      assert.equal((await s.request("cases/import", "POST", { rows, preview_id: preview.preview_id })).status, 200);
      for (const [index, id] of ids.entries()) {
        let c = (await s.request("cases/" + id)).case;
        assert.equal(c.unpaid, [null, 750, 0][index]);
        assert.equal(c.invoiced_unpaid, [null, 650, 0][index]);
        assert.equal((await s.request("cases/" + id + "/collections", "POST", {
          amount: 50, date: "2026-10-31",
        })).status, 200);
        c = (await s.request("cases/" + id)).case;
        assert.equal(c.fee_summary.invoiced_unpaid, [850, 650, 0][index]);
        // Receipt registration intentionally recalculates general unpaid.
        assert.equal(c.fee_summary.unpaid, 1050);
      }
      const newRows = rows.map((row) => ({ ...row, internal_no: row.internal_no + "-new" }));
      const p = await s.request("cases/import-preview", "POST", { rows: newRows });
      assert.equal(p.added, 3);
      assert.equal((await s.request("cases/import", "POST", { rows: newRows, preview_id: p.preview_id })).status, 200);
      for (const [index, row] of newRows.entries()) {
        const c = s.app.store.db.cases.find((c) => c.case_no === row.internal_no);
        assert.equal(c.invoiced_unpaid, [null, 650, 0][index]);
        assert.equal(c.unpaid, [null, 750, 0][index]);
      }
    }
    for (const row of [
      { invoiced_unpaid_mode: "错误", invoiced_unpaid: 100 },
      { invoiced_unpaid_mode: "手填", invoiced_unpaid: "" },
      { unpaid_mode: "手填", unpaid: "" },
    ]) assert.equal((await s.request("cases/import-preview", "POST", {
      rows: [{ track: "专项", internal_no: "INVALID", ...row }],
    })).status, 400);
    const legacy = [{ track: "专项", internal_no: "LEGACY", invoiced_unpaid: 123 }];
    const p = await s.request("cases/import-preview", "POST", { rows: legacy });
    assert.equal((await s.request("cases/import", "POST", { rows: legacy, preview_id: p.preview_id })).status, 200);
    assert.equal(s.app.store.db.cases.find((c) => c.case_no === "LEGACY").invoiced_unpaid, 123);
    await s.restart();
    assert.equal(s.app.store.db.cases.find((c) => c.case_no === "project-auto").invoiced_unpaid, null);
  } finally { await s.close(); }
});
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
test("automatic backups respect 48 hours across restart and manual backups retain five copies", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hz-backup-interval-"));
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: Date.UTC(2026, 9, 31) });
  try {
    assert.equal(BACKUP_INTERVAL, 48 * 60 * 60 * 1000);
    assert.equal(BACKUP_RETENTION, 5);
    let store = new LocalStore(dir);
    assert.equal(store.backups().length, 1);
    const first = store.backups()[0].id;
    store.update((db) => { db.meta.dashboard_motto = "最新数据"; });
    t.mock.timers.tick(BACKUP_INTERVAL - 1);
    store = new LocalStore(dir);
    assert.equal(store.backups()[0].id, first);
    assert.equal(store.snapshot("auto", false), null);
    assert.equal(store.backupDelay(), 1);
    t.mock.timers.tick(1);
    assert(store.snapshot("auto", false));
    assert.equal(store.backups().length, 2);
    assert.equal(store.getBackup(store.backups()[0].id).data.meta.dashboard_motto, "最新数据");
    t.mock.timers.tick(1000);
    const manual = store.snapshot("manual");
    assert(manual);
    assert.equal(new LocalStore(dir).backups()[0].id, manual);
    assert.equal(new LocalStore(dir).backupDelay(), BACKUP_INTERVAL);
    for (let i = 0; i < 10; i++) store.snapshot("manual");
    assert.equal(store.backups().length, 5);
    assert.equal(fs.readdirSync(store.backupDir).filter((n) => n.endsWith(".json")).length, 5);
    for (let i = 1; i <= 30; i++)
      fs.writeFileSync(path.join(store.backupDir, (Date.now() - i * 1000) + "-legacy.json"),
        JSON.stringify(backupDocument(store.db, "auto")));
    assert.equal(fs.readdirSync(store.backupDir).length, 35);
    const newest = store.backups()[0].id;
    store = new LocalStore(dir);
    assert.equal(store.backups().length, 5);
    assert.equal(store.backups()[0].id, newest);
  } finally {
    t.mock.timers.reset();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("running app backs up current data after 48 hours even without another save", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hz-backup-timer-"));
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: Date.UTC(2026, 9, 31) });
  let app;
  try {
    app = createLocalApp({ dataDir: dir });
    await app.start();
    app.store.update((db) => { db.meta.dashboard_motto = "定时备份的数据"; });
    assert.equal(app.store.backups().length, 1);
    t.mock.timers.tick(BACKUP_INTERVAL - 1);
    assert.equal(app.store.backups().length, 1);
    t.mock.timers.tick(1);
    assert.equal(app.store.backups().length, 2);
    assert.equal(app.store.getBackup(app.store.backups()[0].id).data.meta.dashboard_motto, "定时备份的数据");
    let attempts = 0;
    const snapshotMock = t.mock.method(app.store, "snapshot", () => { attempts++; throw Error("disk unavailable"); });
    t.mock.timers.tick(BACKUP_INTERVAL);
    assert.equal(attempts, 1);
    assert.match(app.store.backupError, /自动备份未能完成/);
    t.mock.timers.tick(1000);
    assert.equal(attempts, 1);
    snapshotMock.mock.restore();
    await app.close();
    app = null;
    t.mock.timers.tick(BACKUP_INTERVAL);
  } finally {
    if (app) await app.close();
    t.mock.timers.reset();
    t.mock.reset();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("import and deletion stay within backup interval while manual exports always work", async () => {
  const s = await fixture();
  try {
    const initial = (await s.request("backups")).backups.map((b) => b.id);
    const rows = [{ track: "专项", internal_no: "BACKUP-1", client: "备份测试" }];
    const preview = await s.request("cases/import-preview", "POST", { rows });
    assert.equal((await s.request("cases/import", "POST", { rows, preview_id: preview.preview_id })).status, 200);
    const c = (await s.request("workspace")).cases[0];
    await s.request("cases/" + c.id + "/collections", "POST", { amount: 100, date: "2026-10-31" });
    const receipt = (await s.request("cases/" + c.id)).case.collections[0];
    assert.equal((await s.request("cases/" + c.id + "/collections/" + receipt.id, "DELETE", {})).status, 200);
    assert.equal((await s.request("cases/" + c.id, "DELETE", {})).status, 200);
    assert.deepEqual((await s.request("backups")).backups.map((b) => b.id), initial);
    await s.restart();
    assert.deepEqual((await s.request("backups")).backups.map((b) => b.id), initial);
    for (let i = 0; i < 7; i++) {
      const exported = await s.request("backups/export");
      assert.equal(exported.status, 200);
      delete exported.status;
      assert.equal(readBackup(exported).cases.length, 0);
    }
    const info = await s.request("backups");
    assert.equal(info.backups.length, 5);
    assert.equal(info.retention, 5);
    assert.equal(info.automatic_interval_hours, 48);
    assert.equal(info.automatic_error, null);
    assert(info.backups.every((b) => b.reason === "manual"));
  } finally { await s.close(); }
});

test("backup retention, structural validation and damaged startup preserve originals", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hz-backup-test-"));
  try {
    const store = new LocalStore(dir);
    for (let i = 0; i < 35; i++) store.snapshot("manual");
    assert.equal(store.backups().length, 5);
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
