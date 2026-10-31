import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes, createHash } from "node:crypto";
import {
  LocalStore, backupDocument, readBackup, BACKUP_INTERVAL, BACKUP_RETENTION,
} from "./lib/store.js";
import {
  prepareCase,
  viewCase,
  caseFinance,
  checkRevision,
  dateValue,
  makeId,
  timestamp,
  TRACKS,
} from "./lib/case-model.js";
import { invalid, amount, cents, yuan } from "./lib/money.js";
import {
  compareLedgerCases,
  payableView,
  startPayable,
  completePayable,
} from "./lib/ledger.js";
import {
  CASE_LEDGER_FIELDS,
  businessLedgerSheets,
} from "./lib/case-ledger-fields.js";
import { LITIGATION_STAGES } from "./lib/litigation-stage.js";
import { planCaseImport } from "./lib/case-import.js";
import { advisoryRenewalDraft, renewalPeriod } from "./lib/advisory-renewal.js";
const ROOT = path.dirname(fileURLToPath(import.meta.url)),
  PUBLIC = path.join(ROOT, "public");
const APP_VERSION = JSON.parse(
  fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
).version;
const DEFAULT_MOTTO = "热爱法律，笃行正义。";
const preferencesFor = (db) => ({
  dashboard_motto: db.meta.dashboard_motto || DEFAULT_MOTTO,
  default_motto: DEFAULT_MOTTO,
});
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};
const hash = (data) =>
  createHash("sha256").update(JSON.stringify(data)).digest("hex");
function json(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}
async function body(req) {
  if (!String(req.headers["content-type"] || "").startsWith("application/json"))
    throw invalid("请求须为 JSON");
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65 * 1024 * 1024) throw invalid("文件过大", 413);
    chunks.push(chunk);
  }
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!v || typeof v !== "object" || Array.isArray(v)) throw Error();
    return v;
  } catch {
    throw invalid("文件或请求格式无效");
  }
}
const findCase = (db, id) => {
  const c = db.cases.find((x) => x.id === id);
  if (!c) throw invalid("案件不存在", 404);
  return c;
};
function uniqueNumber(db, c) {
  if (
    c.case_no &&
    db.cases.some((x) => x.id !== c.id && x.case_no === c.case_no)
  )
    throw invalid("内部案号已存在：" + c.case_no);
}
function summary(cases) {
  const totals = {
    count: cases.length,
    active: cases.filter((c) => c.status === "在办").length,
    signed: 0,
    received: 0,
    invoice: 0,
    unpaid: 0,
    invoiced_unpaid: 0,
  };
  for (const c of cases) {
    const f = caseFinance(c);
    for (const k of [
      "signed",
      "received",
      "invoice",
      "unpaid",
      "invoiced_unpaid",
    ])
      totals[k] += cents(f[k]);
  }
  for (const k of [
    "signed",
    "received",
    "invoice",
    "unpaid",
    "invoiced_unpaid",
  ]) {
    if (!Number.isSafeInteger(totals[k]))
      throw invalid("合计金额超出可精确处理的范围");
    totals[k] = yuan(totals[k]);
  }
  return totals;
}
export function createLocalApp({
  dataDir = process.env.HZ_DATA_DIR ||
    path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Hengzhang Local",
    ),
} = {}) {
  const store = new LocalStore(dataDir),
    token = randomBytes(32).toString("hex");
  let origin, backupTimer;
  function scheduleBackup(delay = store.backupDelay()) {
    clearTimeout(backupTimer);
    backupTimer = setTimeout(() => {
      try {
        store.snapshot("auto", false);
      } catch {
        store.backupError = "自动备份未能完成，请检查数据目录或磁盘空间，并手动导出备份。";
        scheduleBackup(BACKUP_INTERVAL);
        return;
      }
      scheduleBackup();
    }, delay);
    backupTimer.unref();
  }
  const server = http.createServer(async (req, res) => {
    try {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      );
      const host = new URL(origin).host;
      if (
        req.headers.host !== host ||
        (req.headers.origin && req.headers.origin !== origin) ||
        req.headers["sec-fetch-site"] === "cross-site"
      )
        throw invalid("仅允许衡账本机窗口访问", 403);
      const url = new URL(req.url, origin),
        p = url.pathname,
        method = req.method;
      if (p.startsWith("/api/")) {
        if (
          !(req.headers.cookie || "")
            .split(";")
            .some((v) => v.trim() === "hz_local=" + token)
        )
          throw invalid("请从衡账窗口重新打开", 403);
        const db = store.db;
        if (p === "/api/workspace" && method === "GET") {
          const cases = db.cases
            .map((c) => viewCase(c, db.meta))
            .sort(compareLedgerCases);
          return json(res, 200, {
            version: APP_VERSION,
            preferences: preferencesFor(db),
            cases,
            summary: summary(cases),
            tracks: TRACKS,
            stages: LITIGATION_STAGES,
            updated_at: timestamp(),
          });
        }
        if (p === "/api/preferences" && method === "PUT") {
          const input = await body(req);
          if (
            typeof input.dashboard_motto !== "string" ||
            input.dashboard_motto.trim().length > 60
          )
            throw invalid("工作台格言最多 60 字");
          const motto = input.dashboard_motto.trim();
          store.update((d) => {
            if (motto) d.meta.dashboard_motto = motto;
            else delete d.meta.dashboard_motto;
          });
          return json(res, 200, {
            ok: true,
            preferences: preferencesFor(store.db),
          });
        }
        if (p === "/api/cases" && method === "POST") {
          const b = await body(req);
          let payload = b;
          if (b.renew_from) {
            const source = findCase(store.db, b.renew_from);
            if (source.track !== "advisory")
              throw invalid("仅顾问案件支持续签");
            payload = {
              ...advisoryRenewalDraft(source, store.db.cases),
              ...b,
              track: "advisory",
              invoice_amount: 0,
              collected_amount: 0,
              unpaid: null,
              invoiced_unpaid: null,
              status: "在办",
              close_date: "",
              close_method: "",
            };
            const { start, end } = renewalPeriod(payload.service_period);
            if (!start || !end || start > end)
              throw invalid("续签须填写有效的服务起止日期");
          }
          const c = prepareCase(payload);
          uniqueNumber(store.db, c);
          store.update((d) => {
            d.cases.push(c);
          });
          return json(res, 200, { ok: true, case: viewCase(c, store.db.meta) });
        }
        if (
          ["/api/cases/import-preview", "/api/cases/import"].includes(p) &&
          method === "POST"
        ) {
          const b = await body(req),
            plan = planCaseImport({ cases: store.db.cases, rows: b.rows }),
            preview_id = hash([store.db, b.rows]);
          if (p.endsWith("import-preview"))
            return json(res, 200, { ...plan, preview_id });
          if (b.preview_id !== preview_id)
            throw invalid("台账或文件已发生变化，请重新预览导入", 409);
          store.update(
            (d) => {
              for (const c of plan.records) {
                const i = d.cases.findIndex((x) => x.id === c.id);
                if (i < 0) d.cases.push(c);
                else d.cases[i] = c;
              }
            },
          );
          return json(res, 200, {
            ok: true,
            added: plan.added,
            merged: plan.merged,
            incomplete: plan.incomplete,
          });
        }
        if (
          p === "/api/cases/export-ledger" &&
          ["GET", "POST"].includes(method)
        ) {
          const track = url.searchParams.get("track") || "";
          if (track && !Object.hasOwn(TRACKS, track))
            throw invalid("案件类型无效");
          const request = method === "POST" ? await body(req) : null;
          if (request && !Array.isArray(request.ids))
            throw invalid("请选择要导出的案件");
          const ids = request ? new Set(request.ids) : null;
          const cases = store.db.cases
            .filter(
              (c) => (!track || c.track === track) && (!ids || ids.has(c.id)),
            )
            .sort(compareLedgerCases);
          return json(res, 200, {
            sheets: businessLedgerSheets(cases, caseFinance, track),
            total: cases.length,
          });
        }
        if (p === "/api/templates" && method === "GET")
          return json(res, 200, { templates: CASE_LEDGER_FIELDS });
        if (p === "/api/backups" && method === "GET")
          return json(res, 200, {
            backups: store.backups(),
            data_dir: dataDir,
            retention: BACKUP_RETENTION,
            automatic_interval_hours: BACKUP_INTERVAL / 3600000,
            automatic_error: store.backupError || null,
          });
        if (p === "/api/backups/export" && method === "GET") {
          const document = backupDocument(store.db);
          store.snapshot("manual");
          res.setHeader(
            "Content-Disposition",
            'attachment; filename="hengzhang-backup-' +
              new Date().toISOString().replace(/[:.]/g, "-") +
              '.json"',
          );
          return json(res, 200, document);
        }
        if (
          ["/api/backups/preview", "/api/backups/restore"].includes(p) &&
          method === "POST"
        ) {
          const b = await body(req),
            document = b.id ? store.getBackup(String(b.id)) : b.backup,
            data = readBackup(document);
          if (p.endsWith("preview"))
            return json(res, 200, {
              checksum: document.checksum,
              current_checksum: hash(store.db),
              created_at: document.created_at,
              cases: data.cases.length,
              collections: data.cases.reduce(
                (n, c) => n + c.collections.length,
                0,
              ),
              progress: data.cases.reduce((n, c) => n + c.progress.length, 0),
              reminders: Object.values(data.meta.case_payable_reminders).reduce(
                (n, v) => n + v.cycles.length,
                0,
              ),
              current_cases: store.db.cases.length,
            });
          if (b.confirm !== document.checksum)
            throw invalid("请先预览并确认要恢复的备份");
          if (b.current_checksum !== hash(store.db))
            throw invalid("当前数据已变化，请重新预览恢复", 409);
          return json(res, 200, store.restore(document));
        }
        if (p === "/api/data-fingerprint" && method === "GET")
          return json(res, 200, { checksum: hash(store.db) });
        const match = p.match(/^\/api\/cases\/([\w-]+)(?:\/(.*))?$/);
        if (match) {
          const id = match[1],
            action = match[2] || "",
            c = findCase(store.db, id);
          if (!action && method === "GET")
            return json(res, 200, { case: viewCase(c, store.db.meta) });
          if (!action && method === "PUT") {
            const b = await body(req),
              latest = findCase(store.db, id);
            checkRevision(latest, b);
            const updated = prepareCase(b, latest);
            uniqueNumber(store.db, updated);
            store.update((d) => {
              d.cases[d.cases.findIndex((x) => x.id === id)] = updated;
            });
            return json(res, 200, {
              ok: true,
              case: viewCase(updated, store.db.meta),
            });
          }
          if (!action && method === "DELETE") {
            const b = await body(req);
            checkRevision(findCase(store.db, id), b);
            store.update(
              (d) => {
                d.cases = d.cases.filter((x) => x.id !== id);
                delete d.meta.case_payable_reminders[id];
              },
            );
            return json(res, 200, { ok: true });
          }
          if (action === "renewal-draft" && method === "GET") {
            if (c.track !== "advisory") throw invalid("仅顾问案件支持续签");
            return json(res, 200, { draft: advisoryRenewalDraft(c, db.cases) });
          }
          if (action === "progress" && method === "POST") {
            const b = await body(req),
              text = String(b.text || "").trim();
            if (!text || text.length > 20000)
              throw invalid("请填写 1 至 20000 字的进展");
            store.update((d) => {
              const item = findCase(d, id);
              item.progress.push({ id: makeId(), text, at: timestamp() });
              item.updated_at = timestamp();
              item.revision++;
            });
            return json(res, 200, { ok: true });
          }
          if (action === "collections" && method === "POST") {
            const b = await body(req),
              value = amount(b.amount, "收款金额", false);
            if (value <= 0) throw invalid("收款金额须大于零");
            const date = dateValue(b.date, "到账日期");
            if (!date) throw invalid("请填写到账日期");
            store.update((d) => {
              const item = findCase(d, id),
                received = yuan(cents(item.collected_amount) + cents(value));
              amount(received, "累计已收款", false);
              item.collections.push({
                id: makeId(),
                amount: value,
                date,
                note: String(b.note || "").trim(),
                at: timestamp(),
              });
              item.collected_amount = received;
              item.unpaid = null;
              item.updated_at = timestamp();
              item.revision++;
            });
            return json(res, 200, { ok: true });
          }
          if (action.startsWith("collections/") && method === "DELETE") {
            const receiptId = action.split("/")[1];
            store.update(
              (d) => {
                const item = findCase(d, id),
                  r = item.collections.find((x) => x.id === receiptId);
                if (!r) throw invalid("收款流水不存在", 404);
                item.collections = item.collections.filter(
                  (x) => x.id !== receiptId,
                );
                item.collected_amount = yuan(
                  cents(item.collected_amount) - cents(r.amount),
                );
                item.unpaid = null;
                item.updated_at = timestamp();
                item.revision++;
              },
            );
            return json(res, 200, { ok: true });
          }
          const payable = action.match(/^payable(?:\/([\w-]+)\/complete)?$/);
          if (payable) {
            if (method === "GET" && !payable[1])
              return json(res, 200, {
                ...payableView(db.meta.case_payable_reminders, id),
                cycles: db.meta.case_payable_reminders[id]?.cycles || [],
              });
            if (method === "POST") {
              const b = await body(req),
                at = timestamp();
              const result = store.update((d) =>
                payable[1]
                  ? completePayable(
                      d.meta.case_payable_reminders,
                      id,
                      payable[1],
                      "本机",
                      at,
                    )
                  : startPayable(
                      d.meta.case_payable_reminders,
                      id,
                      {
                        id: b.request_id || makeId(),
                        amount: b.amount,
                        note: b.note,
                      },
                      "本机",
                      at,
                    ),
              );
              return json(res, 200, result);
            }
          }
        }
        throw invalid("功能不存在", 404);
      }
      if (method !== "GET" && method !== "HEAD")
        throw invalid("不支持此操作", 405);
      const name = p === "/" ? "index.html" : decodeURIComponent(p).slice(1),
        file = path.resolve(PUBLIC, name);
      if (
        !file.startsWith(PUBLIC + path.sep) ||
        !fs.existsSync(file) ||
        !fs.statSync(file).isFile() ||
        !MIME[path.extname(file)]
      )
        throw invalid("文件不存在", 404);
      if (name === "index.html")
        res.setHeader(
          "Set-Cookie",
          "hz_local=" + token + "; HttpOnly; SameSite=Strict; Path=/",
        );
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(file)],
        "Cache-Control": "no-store",
      });
      if (method === "HEAD") res.end();
      else fs.createReadStream(file).pipe(res);
    } catch (e) {
      if (!res.headersSent)
        json(res, e.status || 500, {
          error: e.status ? e.message : "保存或读取失败，请重试；原数据会保留",
        });
      else res.destroy();
    }
  });
  return {
    store,
    server,
    async start(port = 0) {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", resolve);
      });
      origin = "http://127.0.0.1:" + server.address().port;
      scheduleBackup();
      return origin;
    },
    async close() {
      clearTimeout(backupTimer);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => server.closeAllConnections(), 2000);
        timer.unref();
        server.close((error) => {
          clearTimeout(timer);
          error ? reject(error) : resolve();
        });
        server.closeIdleConnections();
      });
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const app = createLocalApp();
  console.log(
    "衡账单机版 " + (await app.start(Number(process.env.PORT || 8818))),
  );
  for (const signal of ["SIGTERM", "SIGINT"])
    process.once(signal, async () => {
      await app.close();
      process.exit(0);
    });
}
