import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { validateDatabase, timestamp } from "./case-model.js";
import { invalid } from "./money.js";
export const BACKUP_INTERVAL = 48 * 60 * 60 * 1000;
export const BACKUP_RETENTION = 5;
const checksum = (data) =>
  createHash("sha256").update(JSON.stringify(data)).digest("hex");
export function backupDocument(db, reason = "manual") {
  return {
    format: "hengzhang-local-backup",
    version: 1,
    created_at: timestamp(),
    reason,
    checksum: checksum(db),
    data: structuredClone(db),
  };
}
export function readBackup(document) {
  if (
    !document ||
    document.format !== "hengzhang-local-backup" ||
    document.version !== 1 ||
    typeof document.created_at !== "string"
  )
    throw invalid("请选择衡账单机版导出的完整备份文件");
  if (Buffer.byteLength(JSON.stringify(document)) > 64 * 1024 * 1024)
    throw invalid("备份文件过大");
  if (document.checksum !== checksum(document.data))
    throw invalid("备份校验失败，文件可能已损坏或被修改");
  return validateDatabase(structuredClone(document.data));
}
function writeAtomic(file, data) {
  const temporary = file + "." + randomUUID() + ".tmp";
  let fd, committed = false;
  try {
    fd = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(fd, JSON.stringify(data));
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temporary, file);
    committed = true;
    const dir = fs.openSync(path.dirname(file), "r");
    try {
      fs.fsyncSync(dir);
    } finally {
      fs.closeSync(dir);
    }
  } catch (cause) {
    if (committed)
      throw Object.assign(new Error("文件已替换，但持久性确认失败", { cause }), {
        committed: true,
      });
    throw cause;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
export class LocalStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.backupDir = path.join(dataDir, "backups");
    this.file = path.join(dataDir, "db.json");
    fs.mkdirSync(this.backupDir, { recursive: true, mode: 0o700 });
    this.lastFileTime = Math.max(
      0,
      ...fs
        .readdirSync(this.backupDir)
        .filter((n) => /^\d+-[\w-]+\.json$/.test(n))
        .map((n) => Number(n.split("-")[0])),
    );
    this.lastBackup = this.lastFileTime || null;
    if (fs.existsSync(this.file)) {
      try {
        this.db = validateDatabase(
          JSON.parse(fs.readFileSync(this.file, "utf8")),
        );
      } catch (e) {
        throw Error(
          "本地数据未能读取，原文件已保留。请从备份恢复，或检查数据目录。原因：" +
            e.message,
        );
      }
    } else {
      this.db = {
        schema_version: 1,
        cases: [],
        meta: { created_at: timestamp(), case_payable_reminders: {} },
      };
      writeAtomic(this.file, this.db);
    }
    this.pruneBackups();
    this.snapshot("startup", false);
  }
  backupDelay() {
    if (this.lastBackup === null) return 0;
    return Math.max(0, Math.min(
      BACKUP_INTERVAL,
      this.lastBackup + BACKUP_INTERVAL - Date.now(),
    ));
  }
  pruneBackups() {
    for (const old of this.backups().slice(BACKUP_RETENTION))
      fs.unlinkSync(path.join(this.backupDir, old.id));
  }
  snapshot(reason, force = true) {
    this.ensureWritable();
    if (!force && this.backupDelay() > 0) return null;
    this.lastFileTime = Math.max(Date.now(), this.lastFileTime + 1);
    const name = this.lastFileTime + "-" + randomUUID().slice(0, 8) + ".json";
    writeAtomic(
      path.join(this.backupDir, name),
      backupDocument(this.db, reason),
    );
    this.lastBackup = Date.now();
    this.backupError = null;
    this.pruneBackups();
    return name;
  }
  update(fn) {
    this.ensureWritable();
    const draft = structuredClone(this.db),
      result = fn(draft);
    validateDatabase(draft);
    this.snapshot("auto", false);
    this.commit(draft);
    return result;
  }
  ensureWritable() {
    if (this.writeError) throw this.writeError;
  }
  commit(data) {
    this.ensureWritable();
    try {
      writeAtomic(this.file, data);
    } catch (e) {
      if (!e.committed) throw e;
      // rename already installed these exact contents. Keep reads consistent,
      // but never report success or allow a retry to overwrite/duplicate them.
      this.db = data;
      this.writeError = invalid(
        "本次更改已写入文件，但磁盘持久性未能确认，已暂停后续写入。请退出并重新打开衡账，核对本次更改后再操作，勿重复登记。",
        503,
      );
      throw this.writeError;
    }
    this.db = data;
  }
  backups() {
    return fs
      .readdirSync(this.backupDir)
      .filter((n) => /^\d+-[\w-]+\.json$/.test(n))
      .sort()
      .reverse()
      .map((id) => {
        try {
          const b = JSON.parse(
            fs.readFileSync(path.join(this.backupDir, id), "utf8"),
          );
          return {
            id,
            created_at: b.created_at,
            reason: b.reason,
            cases: b.data?.cases?.length || 0,
          };
        } catch {
          return { id, created_at: null, reason: "unreadable", cases: 0 };
        }
      });
  }
  getBackup(id) {
    if (
      !/^\d+-[\w-]+\.json$/.test(id) ||
      !fs.existsSync(path.join(this.backupDir, id))
    )
      throw invalid("备份文件不存在", 404);
    try {
      return JSON.parse(fs.readFileSync(path.join(this.backupDir, id), "utf8"));
    } catch {
      throw invalid("备份文件无法读取");
    }
  }
  restore(document) {
    this.ensureWritable();
    const restored = readBackup(document),
      safety = this.snapshot("before-restore");
    this.commit(restored);
    return { ok: true, cases: restored.cases.length, safety_backup: safety };
  }
}
