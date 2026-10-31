import fs from "node:fs";
import path from "node:path";
const MAX_RESPONSE = 1024 * 1024;
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
  return {
    version,
    tag: release.tag_name,
    releaseUrl:
      "https://github.com/" + repository + "/releases/tag/" + release.tag_name,
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
    fetchImpl = fetch,
    tokenProvider = async () => null,
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
      tokenProvider,
      onChange,
      now,
      timeoutMs,
    });
    this.file = path.join(dataDir, "update-preferences.json");
    this.pending = null;
    this.prefs = {
      automatic: true,
      dismissedVersion: null,
      lastAutomaticAttempt: 0,
      lastCheckedAt: null,
    };
    try {
      const p = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (typeof p.automatic === "boolean") this.prefs.automatic = p.automatic;
      if (typeof p.dismissedVersion === "string")
        this.prefs.dismissedVersion = p.dismissedVersion;
      if (Number.isFinite(p.lastAutomaticAttempt))
        this.prefs.lastAutomaticAttempt = p.lastAutomaticAttempt;
      if (typeof p.lastCheckedAt === "string")
        this.prefs.lastCheckedAt = p.lastCheckedAt;
    } catch {}
    this.lastAutomaticAttempt = null;
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
  async get(url, token, signal) {
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "Hengzhang/" + this.currentVersion,
    };
    if (token) headers.Authorization = "Bearer " + token;
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
    if (
      !manual &&
      (!this.prefs.automatic ||
        (this.lastAutomaticAttempt !== null &&
          this.now() - this.lastAutomaticAttempt < 6 * 60 * 60 * 1000))
    )
      return this.snapshot();
    if (!manual) this.lastAutomaticAttempt = this.now();
    this.pending = this.perform().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
  async perform() {
    this.emit({ status: "checking", message: "正在检查新版本…" });
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const root = "https://api.github.com/repos/" + this.repository;
      let token = null,
        result = await this.get(
          root + "/releases/latest",
          null,
          controller.signal,
        );
      if ([401, 403, 404].includes(result.status)) {
        token = await this.tokenProvider();
        if (token)
          result = await this.get(
            root + "/releases/latest",
            token,
            controller.signal,
          );
        if (result.status === 404) {
          const repo = await this.get(root, token, controller.signal);
          if (repo.status === 200)
            return this.emit({
              status: "not_published",
              message: "尚未发布可下载的新版本",
              available: false,
              lastCheckedAt: new Date(this.now()).toISOString(),
            });
        }
      }
      if ([401, 403, 404].includes(result.status))
        return this.emit({
          status: "authorization_required",
          message:
            "私有测试阶段需要仓库访问权限。请设置授权，或使用已登录的 GitHub CLI。",
        });
      const info = releaseInfo(
        result.value,
        this.repository,
        this.currentVersion,
      );
      this.prefs.lastCheckedAt = new Date(this.now()).toISOString();
      this.save();
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
    }
  }
  downloadPage() {
    if (!this.state.available || !this.state.releaseUrl)
      throw Error("当前没有可下载的新版本");
    const prefix = "https://github.com/" + this.repository + "/releases/tag/";
    if (!this.state.releaseUrl.startsWith(prefix)) throw Error("更新地址无效");
    return this.state.releaseUrl;
  }
}
