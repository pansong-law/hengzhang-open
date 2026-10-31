import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { finished } from "node:stream/promises";
import { createPackage } from "@electron/asar";
import { copySourceSnapshot, verifySourceSnapshot } from "./release-snapshot.mjs";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
async function createArchive(source, target) {
  // This ASAR API returns its output stream after end(), before finish.
  const stream = await createPackage(source, target);
  await finished(stream);
}

test("published source snapshot independently starts the server and rejects a missing entry", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hz-release-test-"));
  let app;
  try {
    const snapshot = path.join(dir, "source");
    copySourceSnapshot(root, snapshot);
    const { createLocalApp } = await import(pathToFileURL(path.join(snapshot, "server.js")));
    app = createLocalApp({ dataDir: path.join(dir, "data") });
    const origin = await app.start();
    const response = await fetch(origin + "/");
    assert.equal(response.status, 200);
    assert.match(await response.text(), /衡账/);
    const cookie = response.headers.get("set-cookie").split(";")[0];
    const workspace = await fetch(origin + "/api/workspace", { headers: { cookie } });
    assert.equal(workspace.status, 200);
    assert.deepEqual((await workspace.json()).cases, []);
    fs.rmSync(path.join(snapshot, "server.js"));
    assert.throws(() => verifySourceSnapshot(root, snapshot), /发布快照缺少：server.js/);
  } finally {
    if (app) await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("release preflight checks packaged files against the actual source snapshot in both directions", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hz-archive-test-"));
  try {
    const snapshot = path.join(dir, "source"), packed = path.join(dir, "packed");
    copySourceSnapshot(root, snapshot);
    fs.mkdirSync(packed);
    for (const name of ["package.json", "server.js", "desktop", "lib", "public"])
      fs.cpSync(path.join(root, name), path.join(packed, name), { recursive: true });
    const archive = path.join(dir, "app.asar");
    await createArchive(packed, archive);
    verifySourceSnapshot(root, snapshot, archive);
    fs.writeFileSync(path.join(snapshot, "server.js"), "// stale source");
    assert.throws(() => verifySourceSnapshot(root, snapshot, archive), /发布快照与源码不一致：server.js/);
    copySourceSnapshot(root, snapshot);
    fs.rmSync(path.join(packed, "server.js"));
    const missing = path.join(dir, "missing.asar");
    await createArchive(packed, missing);
    assert.throws(() => verifySourceSnapshot(root, snapshot, missing), /安装包缺少源码文件：server.js/);
    fs.cpSync(path.join(root, "server.js"), path.join(packed, "server.js"));
    fs.appendFileSync(path.join(packed, "server.js"), "\n// stale build\n");
    const stale = path.join(dir, "stale.asar");
    await createArchive(packed, stale);
    assert.throws(() => verifySourceSnapshot(root, snapshot, stale), /请重新打包：server.js/);
    fs.cpSync(path.join(root, "server.js"), path.join(packed, "server.js"));
    fs.writeFileSync(path.join(packed, "lib", "removed.js"), "// removed module");
    const extra = path.join(dir, "extra.asar");
    await createArchive(packed, extra);
    assert.throws(() => verifySourceSnapshot(root, snapshot, extra), /发布快照缺少安装包文件：lib\/removed.js/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
