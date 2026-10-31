import {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  shell,
  net,
  safeStorage,
} from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalApp } from "../server.js";
import { readBackup } from "../lib/store.js";
import { ReleaseUpdates } from "./updates.mjs";
import { UpdateAccess } from "./update-access.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const dataDir =
  process.env.HZ_DATA_DIR ||
  path.join(app.getPath("appData"), "Hengzhang Local");
app.setPath("userData", dataDir);
app.setName("衡账");
let backend,
  updates,
  updateAccess,
  updateInterval,
  origin,
  window,
  quitting = false;
const primary = app.requestSingleInstanceLock();
if (!primary) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  // Do not await readiness at module scope: Electron finishes loading the main
  // ES module before it emits ready. Register the continuation instead.
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: "衡账",
          submenu: [
            {
              label: "关于衡账",
              click: () =>
                dialog.showMessageBox({
                  type: "info",
                  title: "衡账",
                  message: "衡账 · Mac 本地版",
                  detail:
                    "版本 " +
                    app.getVersion() +
                    "\n开发者：潘松律师\nhttps://aifalv.vip/\n个人案件与律师费管理。",
                }),
            },
            {
              label: "开发者主页",
              click: () => shell.openExternal("https://aifalv.vip/"),
            },
            {
              label: "检查更新…",
              click: async () => {
                if (!updates || !window) return;
                await updates.check({ manual: true });
                if (window && !window.isDestroyed())
                  window.webContents.send("hengzhang:show-updates");
              },
            },
            { type: "separator" },
            { role: "hide", label: "隐藏衡账" },
            { role: "hideOthers", label: "隐藏其他应用" },
            { role: "unhide", label: "显示全部" },
            { type: "separator" },
            { role: "quit", label: "退出衡账" },
          ],
        },
        {
          label: "编辑",
          submenu: [
            { role: "undo", label: "撤销" },
            { role: "redo", label: "重做" },
            { type: "separator" },
            { role: "cut", label: "剪切" },
            { role: "copy", label: "复制" },
            { role: "paste", label: "粘贴" },
            { role: "selectAll", label: "全选" },
          ],
        },
        {
          label: "显示",
          submenu: [
            { role: "resetZoom", label: "实际大小" },
            { role: "zoomIn", label: "放大" },
            { role: "zoomOut", label: "缩小" },
            { type: "separator" },
            { role: "togglefullscreen", label: "进入全屏" },
          ],
        },
        {
          label: "窗口",
          submenu: [
            { role: "minimize", label: "最小化" },
            { role: "zoom", label: "缩放" },
            { role: "close", label: "关闭窗口" },
          ],
        },
      ]),
    );
    async function recoverStartup(error) {
      const result = await dialog.showMessageBox({
        type: "error",
        title: "未能读取衡账数据",
        message: "本机数据无法读取，原文件已保留。",
        detail: error.message,
        buttons: ["选择完整备份恢复", "打开数据文件夹", "退出"],
        defaultId: 0,
        cancelId: 2,
      });
      if (result.response === 1) {
        await shell.openPath(dataDir);
        return false;
      }
      if (result.response !== 0) return false;
      const selected = await dialog.showOpenDialog({
        title: "选择衡账完整备份",
        defaultPath: path.join(dataDir, "backups"),
        properties: ["openFile"],
        filters: [{ name: "衡账备份", extensions: ["json"] }],
      });
      if (selected.canceled) return false;
      const filename = selected.filePaths[0];
      if (fs.statSync(filename).size > 64 * 1024 * 1024)
        throw Error("备份文件超过 64 MB");
      const restored = readBackup(
        JSON.parse(fs.readFileSync(filename, "utf8")),
      );
      const confirmed = await dialog.showMessageBox({
        type: "warning",
        title: "确认恢复",
        message: "将恢复 " + restored.cases.length + " 件案件及相关记录。",
        detail: "当前无法读取的文件会先保留在 recovery 目录。",
        buttons: ["取消", "恢复数据"],
        defaultId: 0,
        cancelId: 0,
      });
      if (confirmed.response !== 1) return false;
      const recovery = path.join(dataDir, "recovery");
      fs.mkdirSync(recovery, { recursive: true, mode: 0o700 });
      fs.copyFileSync(
        filename,
        path.join(recovery, "selected-backup-" + Date.now() + ".json"),
      );
      if (fs.existsSync(path.join(dataDir, "db.json")))
        fs.renameSync(
          path.join(dataDir, "db.json"),
          path.join(recovery, "unreadable-db-" + Date.now() + ".json"),
        );
      fs.writeFileSync(
        path.join(dataDir, "db.json"),
        JSON.stringify(restored),
        {
          mode: 0o600,
        },
      );
      return true;
    }
    try {
      try {
        backend = createLocalApp({ dataDir });
      } catch (error) {
        if (!(await recoverStartup(error))) {
          app.quit();
        } else backend = createLocalApp({ dataDir });
      }
      if (backend) {
        origin = await backend.start();
        updateAccess = new UpdateAccess(dataDir, safeStorage);
        const source = JSON.parse(
          fs.readFileSync(path.join(HERE, "update-source.json"), "utf8"),
        );
        updates = new ReleaseUpdates({
          currentVersion: app.getVersion(),
          repository: source.repository,
          dataDir,
          fetchImpl: (url, options) => net.fetch(url, options),
          tokenProvider: () => updateAccess.token(),
          onChange: (state) => {
            if (window && !window.isDestroyed())
              window.webContents.send("hengzhang:update-state", {
                ...state,
                storedAccess: updateAccess.hasStored(),
              });
          },
        });
        const trusted = (event) => {
          if (
            event.sender !== window?.webContents ||
            event.senderFrame?.url !== origin + "/"
          )
            throw Error("无效窗口");
        };
        const updateState = () => ({
          ...updates.snapshot(),
          storedAccess: updateAccess.hasStored(),
        });
        ipcMain.handle("hengzhang:updates:status", (event) => {
          trusted(event);
          return updateState();
        });
        ipcMain.handle("hengzhang:updates:check", async (event) => {
          trusted(event);
          await updates.check({ manual: true });
          return updateState();
        });
        ipcMain.handle("hengzhang:updates:automatic", (event, value) => {
          trusted(event);
          updates.setAutomatic(value);
          if (value) void updates.check();
          return updateState();
        });
        ipcMain.handle("hengzhang:updates:dismiss", (event) => {
          trusted(event);
          updates.dismiss();
          return updateState();
        });
        ipcMain.handle("hengzhang:updates:download", async (event) => {
          trusted(event);
          await shell.openExternal(updates.downloadPage());
          return true;
        });
        ipcMain.handle("hengzhang:updates:access", (event, token) => {
          trusted(event);
          updateAccess.save(token);
          return updateState();
        });
        ipcMain.handle("hengzhang:updates:clear-access", (event) => {
          trusted(event);
          updateAccess.clear();
          return updateState();
        });
        updateInterval = setInterval(
          () => void updates.check(),
          6 * 60 * 60 * 1000,
        );
        updateInterval.unref();
        ipcMain.handle("hengzhang:open-homepage", async (event) => {
          if (
            event.sender !== window?.webContents ||
            event.senderFrame?.url !== origin + "/"
          )
            throw Error("无效窗口");
          await shell.openExternal("https://aifalv.vip/");
          return true;
        });
        ipcMain.handle("hengzhang:reveal-data", async (event) => {
          if (
            event.sender !== window?.webContents ||
            event.senderFrame?.url !== origin + "/"
          )
            throw Error("无效窗口");
          const error = await shell.openPath(dataDir);
          if (error) throw Error("未能打开数据目录");
          return true;
        });
        function createWindow() {
          window = new BrowserWindow({
            width: 1380,
            height: 900,
            minWidth: 1000,
            minHeight: 680,
            title: "衡账",
            titleBarStyle: "hiddenInset",
            backgroundColor: "#f4f7f9",
            show: false,
            webPreferences: {
              preload: path.join(HERE, "preload.cjs"),
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: true,
              webSecurity: true,
              partition: "hengzhang-local",
            },
          });
          const session = window.webContents.session;
          session.setPermissionRequestHandler((_wc, _permission, callback) =>
            callback(false),
          );
          session.setPermissionCheckHandler(() => false);
          session.webRequest.onBeforeRequest(
            { urls: ["<all_urls>"] },
            (details, callback) => {
              let allowed = false;
              try {
                allowed =
                  new URL(details.url).origin === origin ||
                  details.url.startsWith("blob:" + origin + "/");
              } catch {}
              callback({ cancel: !allowed });
            },
          );
          session.removeAllListeners("will-download");
          session.on("will-download", (_event, item) => {
            item.setSaveDialogOptions({
              title: "保存文件",
              defaultPath: path.join(
                app.getPath("documents"),
                path.basename(item.getFilename()),
              ),
            });
          });
          window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
          window.webContents.on("will-navigate", (event, url) => {
            if (url !== origin + "/") event.preventDefault();
          });
          window.webContents.on("will-attach-webview", (event) =>
            event.preventDefault(),
          );
          window.once("ready-to-show", () => window.show());
          window.webContents.once("did-finish-load", () => {
            const timer = setTimeout(() => void updates.check(), 2500);
            timer.unref();
          });
          window.on("closed", () => {
            window = null;
          });
          window.loadURL(origin + "/");
        }
        createWindow();
        app.on("activate", () => {
          if (!window) createWindow();
          else window.show();
        });
      }
    } catch (error) {
      dialog.showErrorBox("衡账未能启动", error.message);
      app.quit();
    }
    app.on("before-quit", (event) => {
      if (backend && !quitting) {
        event.preventDefault();
        quitting = true;
        clearInterval(updateInterval);
        backend.close().finally(() => app.quit());
      }
    });
  });
}
