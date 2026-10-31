// Publish a clean standalone snapshot without the original multi-user Git history.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { SOURCE_PATHS, copySourceSnapshot } from "./release-snapshot.mjs";
import { validRepository, versionParts } from "../desktop/updates.mjs";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const { repository } = JSON.parse(
  fs.readFileSync(path.join(root, "desktop/update-source.json"), "utf8"),
);
versionParts(pkg.version);
if (!validRepository(repository)) throw Error("更新仓库无效");
const args = process.argv.slice(2),
  publish = args.includes("--publish"),
  notesIndex = args.indexOf("--notes");
const notes = notesIndex < 0 ? null : path.resolve(args[notesIndex + 1] || "");
const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
const tag = "v" + pkg.version,
  dmg = path.join(root, "dist", "Hengzhang-" + pkg.version + "-universal.dmg");
const app = path.join(root, "dist", "mac-universal", "衡账.app"),
  archive = path.join(app, "Contents/Resources/app.asar");
if (!fs.existsSync(dmg) || !fs.existsSync(archive))
  throw Error("请先构建 Mac 通用版");
const preview = fs.mkdtempSync(path.join(os.tmpdir(), "hengzhang-source-preview-"));
try {
  copySourceSnapshot(root, preview, archive);
} finally {
  fs.rmSync(preview, { recursive: true, force: true });
}
run("codesign", ["--verify", "--deep", "--strict", app]);
const remote = JSON.parse(
  run("gh", ["repo", "view", repository, "--json", "visibility,nameWithOwner"]),
);
if (remote.visibility !== "PRIVATE" && !args.includes("--allow-public"))
  throw Error("仓库不是私有状态，停止发布；公开后需显式指定 --allow-public");
console.log(
  JSON.stringify(
    {
      repository,
      visibility: remote.visibility,
      version: pkg.version,
      installer: path.basename(dmg),
      source_paths: SOURCE_PATHS,
      publish,
    },
    null,
    2,
  ),
);
if (!publish) process.exit(0);
if (!notes || !fs.existsSync(notes) || !fs.readFileSync(notes, "utf8").trim())
  throw Error("请使用 --notes 指定本次更新说明文件");
let existing = false;
try {
  run("gh", [
    "release",
    "view",
    tag,
    "--repo",
    repository,
    "--json",
    "tagName",
  ]);
  existing = true;
} catch {}
if (existing) throw Error("这个版本已经发布，请先提升版本号");
const staging = fs.mkdtempSync(path.join(os.tmpdir(), "hengzhang-release-")),
  checkout = path.join(staging, "repo");
try {
  run("gh", ["repo", "clone", repository, checkout]);
  const remoteTags = run(
    "git",
    ["ls-remote", "--tags", "origin", "refs/tags/" + tag],
    { cwd: checkout },
  );
  if (remoteTags) throw Error("这个版本标签已存在，请使用新的版本号");
  run("git", ["checkout", "-B", "main"], { cwd: checkout });
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: checkout })
    .toString()
    .split(String.fromCharCode(0))
    .filter(Boolean);
  for (const name of tracked) {
    const file = path.resolve(checkout, name);
    if (!file.startsWith(checkout + path.sep)) throw Error("仓库路径异常");
    fs.rmSync(file, { force: true, recursive: true });
  }
  copySourceSnapshot(root, checkout, archive);
  run("git", ["add", "-A"], { cwd: checkout });
  let changed = true;
  try {
    execFileSync("git", ["diff", "--cached", "--quiet"], {
      cwd: checkout,
      stdio: "ignore",
    });
    changed = false;
  } catch {}
  const localConfig = (key) => {
    try {
      return run("git", ["config", key]);
    } catch {
      return "";
    }
  };
  run(
    "git",
    ["config", "user.name", localConfig("user.name") || pkg.author.name],
    { cwd: checkout },
  );
  run(
    "git",
    [
      "config",
      "user.email",
      localConfig("user.email") || "pansong-law@users.noreply.github.com",
    ],
    { cwd: checkout },
  );
  if (changed)
    run("git", ["commit", "-m", "Release " + tag], { cwd: checkout });
  run("git", ["tag", tag], { cwd: checkout });
  run("git", ["push", "--atomic", "origin", "main", "refs/tags/" + tag], {
    cwd: checkout,
  });
  const digest = createHash("sha256")
    .update(fs.readFileSync(dmg))
    .digest("hex");
  const checksums = path.join(
    staging,
    "Hengzhang-" + pkg.version + "-SHA256SUMS.txt",
  );
  fs.writeFileSync(
    checksums,
    digest + "  " + path.basename(dmg) + String.fromCharCode(10),
  );
  const url = run("gh", [
    "release",
    "create",
    tag,
    dmg,
    checksums,
    "--repo",
    repository,
    "--verify-tag",
    "--latest",
    "--title",
    "衡账 Mac 本地版 " + pkg.version,
    "--notes-file",
    notes,
  ]);
  const release = JSON.parse(
    run("gh", ["api", "repos/" + repository + "/releases/tags/" + tag]),
  );
  if (release.draft || release.prerelease)
    throw Error("安装包已上传，但尚未成为正式发布版本");
  const asset = release.assets.find((a) => a.name === path.basename(dmg));
  if (
    !asset ||
    asset.size !== fs.statSync(dmg).size ||
    (asset.digest && asset.digest !== "sha256:" + digest)
  )
    throw Error("远端安装包校验未通过");
  console.log(
    JSON.stringify(
      {
        published: true,
        url,
        tag,
        size: asset.size,
        sha256: digest,
        source_commit: run("git", ["rev-parse", "HEAD"], { cwd: checkout }),
      },
      null,
      2,
    ),
  );
} finally {
  fs.rmSync(staging, { recursive: true, force: true });
}
