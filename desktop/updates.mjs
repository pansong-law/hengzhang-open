import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
const MAX_RESPONSE = 1024 * 1024;
export const AUTOMATIC_CHECK_INTERVAL = 48 * 60 * 60 * 1000;
const SAFE_DOWNLOAD_ERRORS = new Set([
  "下载服务暂时不可用",
  "下载地址校验失败",
  "安装包大小与发布信息不一致",
  "下载文件超过发布大小",
  "安装包未完整下载",
  "安装包校验失败，请重新下载",
]);
export function versionParts(version) {
  const m = String(version).match(
    /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
  );
  if (!m || m.slice(1).some((v) => v.length > 9)) throw Error("版本号无效");
  return m.slice(1).map(Number);
}
export function compareVersions(a, b) {
  const aa = versionParts(a),
    bb = versionParts(b);
  for (let i = 0; i < 3; i++)
    if (aa[i] !== bb[i]) return aa[i] > bb[i] ? 1 : -1;
  return 0;
}
export function validRepository(repo) {
  return (
    typeof repo === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(
      repo,
    )
  );
}
export function releaseInfo(release, repository, currentVersion) {
  if (!release || release.draft || release.prerelease)
    throw Error("发布版本尚未就绪");
  versionParts(release.tag_name);
  const version = release.tag_name.replace(/^v/, "");
  const name = "Hengzhang-" + version + "-universal.dmg";
  const expected =
    "https://github.com/" +
    repository +
    "/releases/download/" +
    release.tag_name +
    "/" +
    name;
  const asset = release.assets?.find(
    (a) =>
      a.name === name &&
      a.state === "uploaded" &&
      Number.isSafeInteger(a.size) &&
      a.size > 0 &&
      a.browser_download_url === expected,
  );
  if (!asset) throw Error("新版安装包尚未就绪，请稍后重试");
  if (typeof asset.digest !== "string" || !/^sha256:[a-f0-9]{64}$/i.test(asset.digest))
    throw Error("新版安装包校验信息尚未就绪，请稍后重试");
  return {
    version,
    tag: release.tag_name,
    releaseUrl:
      "https://github.com/" + repository + "/releases/tag/" + release.tag_name,
    downloadUrl: expected,
    downloadSize: asset.size,
    downloadDigest: asset.digest.slice("sha256:".length).toLowerCase(),
    notes: String(release.body || "本次发布未填写更新说明。").slice(0, 16000),
    publishedAt: release.published_at || null,
    available: compareVersions(version, currentVersion) > 0,
  };
}
export class ReleaseUpdates {
  constructor({
    currentVersion,
    repository,
    dataDir,
    downloadDir = dataDir,
    fetchImpl = fetch,
    onChange = () => {},
    now = () => Date.now(),
    timeoutMs = 12000,
  }) {
    versionParts(currentVersion);
    if (!validRepository(repository)) throw Error("更新仓库配置无效");
    Object.assign(this, {
      currentVersion,
      repository,
      fetchImpl,
      downloadDir,
      onChange,
      now,
      timeoutMs,
    });
    this.file = path.join(dataDir, "update-preferences.json");
    this.pending = null;
    this.downloadPending = null;
    this.downloadController = null;
    this.installerPath = null;
    this.artifact = null;
    this.download = {
      status: "idle",
      bytes: 0,
      totalBytes: 0,
      percent: 0,
      bytesPerSecond: 0,
      remainingSeconds: null,
      message: "",
    };
    this.prefs = {
      automatic: true,
      dismissedVersion: null,
      lastAutomaticAttempt: null,
      lastCheckedAt: null,
    };
    try {
      const p = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (typeof p.automatic === "boolean") this.prefs.automatic = p.automatic;
      if (typeof p.dismissedVersion === "string")
        this.prefs.dismissedVersion = p.dismissedVersion;
      if (Number.isFinite(p.lastAutomaticAttempt) && p.lastAutomaticAttempt >= 0)
        this.prefs.lastAutomaticAttempt = p.lastAutomaticAttempt;
      if (typeof p.lastCheckedAt === "string")
        this.prefs.lastCheckedAt = p.lastCheckedAt;
    } catch {}
    this.state = {
      status: "idle",
      currentVersion,
      repository,
      latestVersion: null,
      available: false,
      releaseUrl: null,
      notes: "",
      publishedAt: null,
      lastCheckedAt: this.prefs.lastCheckedAt,
      message: "尚未检查更新",
      automatic: this.prefs.automatic,
    };
  }
  save() {
    const temp = this.file + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(this.prefs), { mode: 0o600 });
    fs.renameSync(temp, this.file);
  }
  snapshot() {
    return {
      ...this.state,
      download: { ...this.download },
      automatic: this.prefs.automatic,
      dismissed: this.prefs.dismissedVersion === this.state.latestVersion,
    };
  }
  emit(patch) {
    Object.assign(this.state, patch);
    this.onChange(this.snapshot());
    return this.snapshot();
  }
  setAutomatic(value) {
    if (typeof value !== "boolean") throw Error("更新设置无效");
    this.prefs.automatic = value;
    this.save();
    return this.emit({ automatic: value });
  }
  dismiss() {
    if (this.state.available)
      this.prefs.dismissedVersion = this.state.latestVersion;
    this.save();
    return this.emit({});
  }
  async get(url, signal) {
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "Hengzhang/" + this.currentVersion,
    };
    const r = await this.fetchImpl(url, {
      headers,
      signal,
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
    });
    if (
      (r.status === 403 && r.headers.get("x-ratelimit-remaining") === "0") ||
      r.status === 429
    )
      throw Error("检查次数较多，请稍后再试");
    if (r.status === 401 || r.status === 403)
      return { status: r.status, value: null };
    if (r.status === 404) return { status: 404, value: null };
    if (!r.ok) throw Error("暂时无法读取发布信息，请稍后重试");
    if (Number(r.headers.get("content-length") || 0) > MAX_RESPONSE)
      throw Error("发布信息过大");
    const reader = r.body?.getReader();
    let text = "";
    if (reader) {
      const chunks = [];
      let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > MAX_RESPONSE) throw Error("发布信息过大");
          chunks.push(value);
        }
        text = Buffer.concat(chunks).toString("utf8");
      } finally {
        await reader.cancel().catch(() => {});
      }
    } else {
      text = await r.text();
      if (Buffer.byteLength(text) > MAX_RESPONSE) throw Error("发布信息过大");
    }
    try {
      return { status: r.status, value: JSON.parse(text) };
    } catch {
      throw Error("发布信息格式无效，请稍后重试");
    }
  }
  async check({ manual = false } = {}) {
    if (this.pending) return this.pending;
    if (!manual && (!this.prefs.automatic || this.automaticDelay() > 0))
      return this.snapshot();
    if (!manual) {
      this.prefs.lastAutomaticAttempt = this.now();
      try {
        this.save();
      } catch {
        return this.emit({
          status: "error",
          message: "未能保存自动检查时间，请稍后手动检查更新。",
        });
      }
    }
    this.pending = this.perform().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
  automaticDelay() {
    if (!this.prefs.automatic) return null;
    if (this.prefs.lastAutomaticAttempt === null) return 0;
    return Math.max(0, Math.min(
      AUTOMATIC_CHECK_INTERVAL,
      this.prefs.lastAutomaticAttempt + AUTOMATIC_CHECK_INTERVAL - this.now(),
    ));
  }
  async perform() {
    this.emit({ status: "checking", message: "正在检查新版本…" });
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), this.timeoutMs);
    this.controller = controller;
    try {
      const root = "https://api.github.com/repos/" + this.repository;
      const result = await this.get(root + "/releases/latest", controller.signal);
      if (result.status === 404) {
        const repo = await this.get(root, controller.signal);
        if (repo.status === 200) {
          this.prefs.lastCheckedAt = new Date(this.now()).toISOString();
          this.save();
          return this.emit({
            status: "not_published",
            message: "尚未发布可下载的新版本",
            available: false,
            lastCheckedAt: this.prefs.lastCheckedAt,
          });
        }
      }
      if ([401, 403, 404].includes(result.status))
        return this.emit({
          status: "error",
          message: "暂时无法读取公开的版本信息，请稍后重试。",
        });
      const info = releaseInfo(
        result.value,
        this.repository,
        this.currentVersion,
      );
      this.prefs.lastCheckedAt = new Date(this.now()).toISOString();
      this.save();
      const sameVersion =
        info.available &&
        this.artifact?.version === info.version &&
        this.artifact?.digest === info.downloadDigest;
      this.artifact = info.available
        ? {
            url: info.downloadUrl,
            version: info.version,
            size: info.downloadSize,
            digest: info.downloadDigest,
          }
        : null;
      const keepDownload =
        sameVersion &&
        (this.download.status === "downloading" ||
          (this.download.status === "downloaded" &&
            this.installerPath &&
            fs.existsSync(this.installerPath)));
      if (!keepDownload) {
        if (this.download.status === "downloading")
          this.downloadController?.abort();
        this.installerPath = null;
        this.download = {
          status: "idle",
          bytes: 0,
          totalBytes: info.available ? info.downloadSize || 0 : 0,
          percent: 0,
          bytesPerSecond: 0,
          remainingSeconds: null,
          message: "",
        };
      }
      return this.emit({
        status: info.available ? "available" : "up_to_date",
        latestVersion: info.version,
        available: info.available,
        releaseUrl: info.releaseUrl,
        notes: info.notes,
        publishedAt: info.publishedAt,
        lastCheckedAt: this.prefs.lastCheckedAt,
        message: info.available
          ? "发现新版本 " + info.version
          : "当前已是最新版本 " + this.currentVersion,
      });
    } catch (error) {
      return this.emit({
        status: "error",
        message: controller.signal.aborted
          ? "检查更新超时，请联网后重试。"
          : error.message === "检查次数较多，请稍后再试"
            ? error.message
            : "暂时无法检查更新，请联网后重试。",
      });
    } finally {
      clearTimeout(timer);
      if (this.controller === controller) this.controller = null;
    }
  }
  stop() {
    this.controller?.abort();
    this.downloadController?.abort();
  }
  downloadPage() {
    if (!this.state.available || !this.state.releaseUrl)
      throw Error("当前没有可下载的新版本");
    const prefix = "https://github.com/" + this.repository + "/releases/tag/";
    if (!this.state.releaseUrl.startsWith(prefix)) throw Error("更新地址无效");
    return this.state.releaseUrl;
  }
  async downloadInstaller() {
    if (!this.state.available || !this.artifact)
      throw Error("当前没有可下载的新版本");
    if (this.downloadPending) return this.downloadPending;
    if (
      this.download.status === "downloaded" &&
      this.installerPath &&
      fs.existsSync(this.installerPath)
    )
      return this.snapshot();
    this.downloadPending = this.performDownload().finally(() => {
      this.downloadPending = null;
      this.downloadController = null;
    });
    return this.downloadPending;
  }
  async performDownload() {
    const artifact = this.artifact,
      controller = new AbortController(),
      fileName = "Hengzhang-" + artifact.version + "-universal.dmg",
      target = path.join(this.downloadDir, fileName),
      partial = path.join(
        this.downloadDir,
        "." + fileName + "." + randomUUID() + ".partial",
      );
    this.downloadController = controller;
    const startedAt = this.now();
    this.installerPath = null;
    this.download = {
      status: "downloading",
      bytes: 0,
      totalBytes: artifact.size,
      percent: 0,
      bytesPerSecond: 0,
      remainingSeconds: null,
      message: "正在下载更新…",
    };
    this.emit({});
    let handle;
    try {
      await fs.promises.mkdir(this.downloadDir, { recursive: true });
      const response = await this.fetchImpl(artifact.url, {
        headers: {
          Accept: "application/octet-stream",
          "User-Agent": "Hengzhang/" + this.currentVersion,
        },
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
        redirect: "follow",
      });
      if (!response.ok || !response.body)
        throw Error("下载服务暂时不可用");
      const finalUrl = response.url ? new URL(response.url) : null;
      if (
        finalUrl &&
        (finalUrl.protocol !== "https:" ||
          ![
            "github.com",
            "objects.githubusercontent.com",
            "release-assets.githubusercontent.com",
          ].includes(finalUrl.hostname))
      )
        throw Error("下载地址校验失败");
      const length = Number(response.headers.get("content-length") || 0);
      if (length && length !== artifact.size)
        throw Error("安装包大小与发布信息不一致");
      handle = await fs.promises.open(partial, "wx", 0o600);
      const reader = response.body.getReader(),
        hash = createHash("sha256");
      let bytes = 0,
        lastEmit = startedAt;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = Buffer.from(value);
          bytes += chunk.length;
          if (bytes > artifact.size) throw Error("下载文件超过发布大小");
          hash.update(chunk);
          await handle.writeFile(chunk);
          const now = this.now();
          if (now - lastEmit >= 150 || bytes === artifact.size) {
            const elapsed = Math.max(1, now - startedAt),
              bytesPerSecond = Math.round((bytes * 1000) / elapsed);
            this.download = {
              status: "downloading",
              bytes,
              totalBytes: artifact.size,
              percent: Math.floor((bytes / artifact.size) * 100),
              bytesPerSecond,
              remainingSeconds: bytesPerSecond
                ? Math.ceil((artifact.size - bytes) / bytesPerSecond)
                : null,
              message: "正在下载更新…",
            };
            this.emit({});
            lastEmit = now;
          }
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      if (bytes !== artifact.size) throw Error("安装包未完整下载");
      if (hash.digest("hex") !== artifact.digest)
        throw Error("安装包校验失败，请重新下载");
      await handle.sync();
      await handle.close();
      handle = null;
      await fs.promises.rename(partial, target);
      this.installerPath = target;
      this.download = {
        status: "downloaded",
        bytes,
        totalBytes: artifact.size,
        percent: 100,
        bytesPerSecond: 0,
        remainingSeconds: 0,
        message: "下载完成，可打开安装包。",
      };
      return this.emit({});
    } catch (error) {
      await handle?.close().catch(() => {});
      await fs.promises.rm(partial, { force: true }).catch(() => {});
      this.installerPath = null;
      this.download = {
        status: "error",
        bytes: 0,
        totalBytes: artifact.size,
        percent: 0,
        bytesPerSecond: 0,
        remainingSeconds: null,
        message: controller.signal.aborted
          ? "下载已停止。"
          : SAFE_DOWNLOAD_ERRORS.has(error?.message)
            ? error.message
            : "下载失败，请检查网络后重试。",
      };
      return this.emit({});
    }
  }
  getInstallerPath() {
    if (
      this.download.status !== "downloaded" ||
      !this.installerPath ||
      !this.artifact ||
      path.dirname(this.installerPath) !== this.downloadDir ||
      path.basename(this.installerPath) !==
        "Hengzhang-" + this.artifact.version + "-universal.dmg" ||
      !fs.existsSync(this.installerPath)
    )
      throw Error("请先完整下载更新安装包");
    return this.installerPath;
  }
}
