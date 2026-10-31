import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ReleaseUpdates,
  compareVersions,
  releaseInfo,
} from "../desktop/updates.mjs";
import { UpdateAccess } from "../desktop/update-access.mjs";
const repository = "pansong-law/hengzhang-mac";
function release(version = "1.0.4", patch = {}) {
  const name = "Hengzhang-" + version + "-universal.dmg";
  return {
    tag_name: "v" + version,
    draft: false,
    prerelease: false,
    body: "更新说明",
    published_at: "2026-10-31T03:00:00Z",
    assets: [
      {
        name,
        state: "uploaded",
        size: 100,
        browser_download_url:
          "https://github.com/" +
          repository +
          "/releases/download/v" +
          version +
          "/" +
          name,
      },
    ],
    ...patch,
  };
}
const response = (value, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), { status, headers });
function fixture(fetchImpl, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hz-updates-"));
  const updates = new ReleaseUpdates({
    currentVersion: "1.0.3",
    repository,
    dataDir: dir,
    fetchImpl,
    ...extra,
  });
  return {
    updates,
    dir,
    close() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
test("stable versions compare numerically and malformed versions are rejected", () => {
  assert.equal(compareVersions("1.0.10", "1.0.9"), 1);
  assert.equal(compareVersions("1.0.3", "v1.0.3"), 0);
  assert.equal(compareVersions("1.0.2", "1.0.3"), -1);
  for (const v of ["1.0", "1.0.4-beta", "1.0.01", "https://bad.example"])
    assert.throws(() => compareVersions(v, "1.0.3"));
});
test("only a complete matching Mac installer can trigger an update", () => {
  assert.equal(releaseInfo(release(), repository, "1.0.3").available, true);
  for (const patch of [
    { draft: true },
    { prerelease: true },
    { assets: [] },
    {
      assets: [
        {
          ...release().assets[0],
          browser_download_url: "https://bad.example/app.dmg",
        },
      ],
    },
  ])
    assert.throws(() =>
      releaseInfo(release("1.0.4", patch), repository, "1.0.3"),
    );
});
test("new version includes notes and a pinned release page; current and older releases do not notify", async () => {
  for (const version of ["1.0.4", "1.0.3", "1.0.2"]) {
    const requests = [],
      s = fixture(async (url, options) => {
        requests.push({ url, options });
        return response(release(version));
      });
    try {
      const state = await s.updates.check({ manual: true });
      assert.equal(state.available, version === "1.0.4");
      assert.equal(
        state.status,
        version === "1.0.4" ? "available" : "up_to_date",
      );
      assert.equal(state.notes, "更新说明");
      assert.equal(requests.length, 1);
      assert.equal(
        requests[0].url,
        "https://api.github.com/repos/" + repository + "/releases/latest",
      );
      assert.equal(requests[0].options.credentials, "omit");
      assert.equal(requests[0].options.headers.Authorization, undefined);
      assert(!JSON.stringify(requests).includes("cases"));
      if (state.available)
        assert.equal(
          s.updates.downloadPage(),
          "https://github.com/" + repository + "/releases/tag/v1.0.4",
        );
      else assert.throws(() => s.updates.downloadPage());
    } finally {
      s.close();
    }
  }
});
test("private access retries with a transient credential and never writes it into update preferences", async () => {
  const credential = "test_readonly_access_0000000000",
    calls = [],
    s = fixture(
      async (url, options) => {
        calls.push({ url, authorization: options.headers.Authorization });
        return options.headers.Authorization
          ? response(release())
          : response({}, 404);
      },
      { tokenProvider: async () => credential },
    );
  try {
    const state = await s.updates.check({ manual: true });
    assert.equal(state.status, "available");
    assert.equal(calls[0].authorization, undefined);
    assert.equal(calls[1].authorization, "Bearer " + credential);
    assert(!JSON.stringify(state).includes(credential));
    assert(!fs.readFileSync(s.updates.file, "utf8").includes(credential));
  } finally {
    s.close();
  }
});
test("private authorization failure and an empty release list are distinct from up to date", async () => {
  for (const exists of [true, false]) {
    const s = fixture(async (url) =>
      url.endsWith("/releases/latest")
        ? response({}, 404)
        : response({}, exists ? 200 : 404),
    );
    try {
      const state = await s.updates.check({ manual: true });
      assert.equal(
        state.status,
        exists ? "not_published" : "authorization_required",
      );
      assert.equal(state.latestVersion, null);
      assert.equal(state.available, false);
    } finally {
      s.close();
    }
  }
});
test("network, server and rate-limit failures cannot report latest or leak error details", async () => {
  for (const fetchImpl of [
    async () => {
      throw Error("sensitive details");
    },
    async () => response({}, 503),
    async () => response({}, 403, { "x-ratelimit-remaining": "0" }),
    async () => new Response("invalid JSON"),
  ]) {
    const s = fixture(fetchImpl);
    try {
      const state = await s.updates.check({ manual: true });
      assert.equal(state.status, "error");
      assert.equal(state.available, false);
      assert(!state.message.includes("sensitive"));
    } finally {
      s.close();
    }
  }
});
test("timeouts and oversized responses end the check without blocking the workspace", async () => {
  const s = fixture(
    (_url, options) =>
      new Promise((_resolve, reject) =>
        options.signal.addEventListener("abort", () =>
          reject(Error("aborted")),
        ),
      ),
    { timeoutMs: 10 },
  );
  try {
    const state = await s.updates.check({ manual: true });
    assert.equal(state.status, "error");
    assert.match(state.message, /超时/);
  } finally {
    s.close();
  }
  const large = fixture(async () => new Response("x".repeat(1024 * 1024 + 1)));
  try {
    assert.equal((await large.updates.check({ manual: true })).status, "error");
  } finally {
    large.close();
  }
});
test("automatic toggle and dismissed versions persist, manual checks still work", async () => {
  let version = "1.0.4",
    calls = 0;
  const s = fixture(async () => {
    calls++;
    return response(release(version));
  });
  try {
    await s.updates.check();
    assert.equal(calls, 1);
    await s.updates.check();
    assert.equal(calls, 1);
    s.updates.dismiss();
    assert.equal(s.updates.snapshot().dismissed, true);
    s.updates.setAutomatic(false);
    await s.updates.check();
    assert.equal(calls, 1);
    await s.updates.check({ manual: true });
    assert.equal(calls, 2);
    const restarted = new ReleaseUpdates({
      currentVersion: "1.0.3",
      repository,
      dataDir: s.dir,
      fetchImpl: async () => response(release(version)),
    });
    assert.equal(restarted.snapshot().automatic, false);
    await restarted.check({ manual: true });
    assert.equal(restarted.snapshot().dismissed, true);
    version = "1.0.5";
    await restarted.check({ manual: true });
    assert.equal(restarted.snapshot().dismissed, false);
  } finally {
    s.close();
  }
});
test("concurrent checks share a request and previous version data is retained on a later failure", async () => {
  let calls = 0,
    fail = false;
  const s = fixture(async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 10));
    if (fail) throw Error("offline");
    return response(release());
  });
  try {
    await Promise.all([
      s.updates.check({ manual: true }),
      s.updates.check({ manual: true }),
    ]);
    assert.equal(calls, 1);
    fail = true;
    const state = await s.updates.check({ manual: true });
    assert.equal(state.status, "error");
    assert.equal(state.available, true);
    assert.equal(state.latestVersion, "1.0.4");
  } finally {
    s.close();
  }
});
test("private credential storage requires the OS encryption adapter and keeps plaintext out of files", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hz-access-")),
    token = "test_readonly_access_0000000000";
  try {
    const unavailable = new UpdateAccess(dir, {
      isEncryptionAvailable: () => false,
    });
    assert.throws(() => unavailable.save(token));
    assert.equal(unavailable.hasStored(), false);
    const access = new UpdateAccess(dir, {
      isEncryptionAvailable: () => true,
      encryptString: (s) => Buffer.from(s).reverse(),
      decryptString: (b) => Buffer.from(b).reverse().toString(),
    });
    access.save(token);
    assert(!fs.readFileSync(access.file).includes(token));
    assert.equal(await access.token(), token);
    assert.equal(fs.statSync(access.file).mode & 0o777, 0o600);
    access.clear();
    assert.equal(access.hasStored(), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
