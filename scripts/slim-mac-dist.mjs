import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const packOnly = process.argv.includes("--pack-only");

const armAppDir = path.join(root, "dist", "mac-arm64");
const universalAppDir = path.join(root, "dist", "mac-universal");
const appName = "衡账.app";
const armApp = path.join(armAppDir, appName);

if (!fs.existsSync(armApp)) {
  throw new Error("未找到构建产物：" + armApp);
}

const KEEP_LPROJ = new Set([
  "zh_CN.lproj",
  "zh-Hans.lproj",
  "en.lproj",
  "en_GB.lproj",
  "Base.lproj",
]);

function slimAppBundle(appPath) {
  let removedBytes = 0;

  // 1. Remove 5.3 MB Chromium HTML license dump inside Contents/Resources
  const chromiumLicenses = path.join(
    appPath,
    "Contents",
    "Resources",
    "LICENSES.chromium.html",
  );
  if (fs.existsSync(chromiumLicenses)) {
    removedBytes += fs.statSync(chromiumLicenses).size;
    fs.rmSync(chromiumLicenses, { force: true });
  }

  // 2. Remove unused foreign language .lproj folders in Electron Framework
  const fwResources = path.join(
    appPath,
    "Contents",
    "Frameworks",
    "Electron Framework.framework",
    "Versions",
    "A",
    "Resources",
  );
  if (fs.existsSync(fwResources)) {
    for (const entry of fs.readdirSync(fwResources)) {
      if (!entry.endsWith(".lproj") || KEEP_LPROJ.has(entry)) continue;
      const full = path.join(fwResources, entry);
      try {
        for (const f of fs.readdirSync(full)) {
          removedBytes += fs.statSync(path.join(full, f)).size;
        }
      } catch {}
      fs.rmSync(full, { recursive: true, force: true });
    }
  }

  // 3. Re-sign with ad-hoc signature and verify strict integrity
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
    stdio: "inherit",
  });
  execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], {
    stdio: "inherit",
  });

  return removedBytes;
}

const removedBytes = slimAppBundle(armApp);

// Keep dist/mac-universal/衡账.app synced for scripts or tests referencing that path
fs.rmSync(universalAppDir, { recursive: true, force: true });
fs.mkdirSync(universalAppDir, { recursive: true });
execFileSync("cp", ["-R", armApp, path.join(universalAppDir, appName)]);

if (!packOnly) {
  const dmgPath = path.join(
    root,
    "dist",
    "Hengzhang-" + pkg.version + "-universal.dmg",
  );
  const blockmapPath = dmgPath + ".blockmap";
  const beforeSize = fs.existsSync(dmgPath) ? fs.statSync(dmgPath).size : 0;

  // Rebuild DMG from the slimmed app bundle using ULMO (LZMA high compression)
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), "hz-dmg-stage-"));
  const tempUlmo = path.join(
    os.tmpdir(),
    "Hengzhang-" + pkg.version + "-ulmo-" + Date.now() + ".dmg",
  );
  try {
    execFileSync("cp", ["-R", armApp, path.join(stageDir, appName)]);
    fs.symlinkSync("/Applications", path.join(stageDir, "Applications"));
    execFileSync(
      "hdiutil",
      [
        "create",
        "-volname",
        "衡账",
        "-srcfolder",
        stageDir,
        "-ov",
        "-format",
        "ULMO",
        tempUlmo,
      ],
      { stdio: "inherit" },
    );
    fs.copyFileSync(tempUlmo, dmgPath);
    if (fs.existsSync(blockmapPath)) {
      fs.rmSync(blockmapPath, { force: true });
    }
  } finally {
    fs.rmSync(stageDir, { recursive: true, force: true });
    fs.rmSync(tempUlmo, { force: true });
  }

  const afterSize = fs.statSync(dmgPath).size;
  console.log(
    JSON.stringify(
      {
        arch: "arm64",
        format: "ULMO (LZMA)",
        dmg: path.basename(dmgPath),
        stripped_app_mb: Number((removedBytes / (1024 * 1024)).toFixed(2)),
        before_dmg_mb: Number((beforeSize / (1024 * 1024)).toFixed(2)),
        after_dmg_mb: Number((afterSize / (1024 * 1024)).toFixed(2)),
      },
      null,
      2,
    ),
  );
}
