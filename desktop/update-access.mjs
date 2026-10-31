import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
const valid = (token) =>
  typeof token === "string" && /^[A-Za-z0-9_]{20,512}$/.test(token);
// Credentials never enter the renderer status, logs, backups or published code.
export class UpdateAccess {
  constructor(dataDir, safeStorage) {
    this.file = path.join(dataDir, ".update-access");
    this.safeStorage = safeStorage;
  }
  hasStored() {
    return fs.existsSync(this.file);
  }
  save(token) {
    if (!valid(token)) throw Error("请输入有效的 GitHub 访问令牌");
    if (!this.safeStorage.isEncryptionAvailable())
      throw Error("本机安全存储不可用，无法保存授权");
    const temporary = this.file + ".tmp";
    fs.writeFileSync(temporary, this.safeStorage.encryptString(token), {
      mode: 0o600,
    });
    fs.chmodSync(temporary, 0o600);
    fs.renameSync(temporary, this.file);
  }
  clear() {
    fs.rmSync(this.file, { force: true });
  }
  async token() {
    if (this.hasStored() && this.safeStorage.isEncryptionAvailable()) {
      try {
        const t = this.safeStorage.decryptString(fs.readFileSync(this.file));
        if (valid(t)) return t;
      } catch {}
    }
    // During private testing the publisher can reuse their existing local login.
    // Only the token command runs; its output stays in memory and is never logged.
    for (const binary of ["/opt/homebrew/bin/gh", "/usr/local/bin/gh"]) {
      if (!fs.existsSync(binary)) continue;
      try {
        const { stdout } = await exec(
          binary,
          ["auth", "token", "--hostname", "github.com"],
          {
            timeout: 3000,
            maxBuffer: 4096,
            env: { ...process.env, GH_PROMPT_DISABLED: "1" },
          },
        );
        const token = stdout.trim();
        if (valid(token)) return token;
      } catch {}
    }
    return null;
  }
}
