import fs from "node:fs";
import path from "node:path";
import { extractFile, listPackage } from "@electron/asar";

export const SOURCE_PATHS = [
  ".gitignore",
  "package.json",
  "package-lock.json",
  "README.md",
  "LICENSE",
  "LICENSE.md",
  "衡账开源介绍.md",
  "docs/screenshots",
  "启动衡账.command",
  "server.js",
  "desktop",
  "lib",
  "public",
  "scripts",
];
const optional = new Set(["LICENSE", "LICENSE.md", "衡账开源介绍.md"]);
function filesIn(root, name) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) throw Error("发布源码缺少：" + name);
  if (!fs.statSync(file).isDirectory()) return [name];
  return fs.readdirSync(file)
    .filter((entry) => entry !== ".DS_Store")
    .flatMap((entry) => filesIn(root, path.join(name, entry)));
}
export function verifySourceSnapshot(root, snapshot, archive) {
  for (const name of SOURCE_PATHS) {
    if (optional.has(name) && !fs.existsSync(path.join(root, name))) continue;
    for (const relative of filesIn(root, name)) {
      const file = path.join(snapshot, relative);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile())
        throw Error("发布快照缺少：" + relative);
      if (!fs.readFileSync(file).equals(fs.readFileSync(path.join(root, relative))))
        throw Error("发布快照与源码不一致：" + relative);
    }
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(snapshot, "package.json")));
  if (!fs.existsSync(path.join(snapshot, pkg.main)))
    throw Error("发布快照缺少应用入口：" + pkg.main);
  if (!archive) return;
  const packedFiles = new Set(listPackage(archive).map((name) => name.slice(1)));
  for (const name of ["server.js", "desktop", "lib", "public"])
    for (const relative of filesIn(snapshot, name)) {
      if (!packedFiles.has(relative)) throw Error("安装包缺少源码文件：" + relative);
      if (!extractFile(archive, relative).equals(fs.readFileSync(path.join(snapshot, relative))))
        throw Error("请重新打包：" + relative);
    }
  // Also reject archived runtime files removed from the current source.
  for (const relative of packedFiles) {
    if (relative === "package.json") continue;
    const file = path.join(snapshot, relative);
    if (!fs.existsSync(file)) throw Error("发布快照缺少安装包文件：" + relative);
    if (fs.statSync(file).isFile() &&
        !extractFile(archive, relative).equals(fs.readFileSync(file)))
      throw Error("请重新打包：" + relative);
  }
  if (JSON.parse(extractFile(archive, "package.json")).version !== pkg.version)
    throw Error("安装包版本与源码不一致");
}
export function copySourceSnapshot(root, snapshot, archive) {
  for (const name of SOURCE_PATHS) {
    const from = path.join(root, name);
    if (optional.has(name) && !fs.existsSync(from)) continue;
    fs.cpSync(from, path.join(snapshot, name), {
      recursive: true,
      filter: (file) => path.basename(file) !== ".DS_Store",
    });
  }
  verifySourceSnapshot(root, snapshot, archive);
}
