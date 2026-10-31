import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ReleaseUpdates,
  AUTOMATIC_CHECK_INTERVAL,
  compareVersions,
  releaseInfo,
} from "../desktop/updates.mjs";
const repository = "pansong-law/hengzhang-open";
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
test("update checks never attach private credentials or offer authorization", async () => {
  const calls = [],
    s = fixture(async (url, options) => {
      calls.push({ url, options });
      return response({}, 401);
    });
  try {
    const state = await s.updates.check({ manual: true });
    assert.equal(state.status, "error");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.headers.Authorization, undefined);
    assert.equal(calls[0].options.credentials, "omit");
    assert(!/令牌|设置授权|GitHub CLI/.test(state.message));
  } finally { s.close(); }
});
test("unavailable public repository and an empty release list are distinct from up to date", async () => {
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
        exists ? "not_published" : "error",
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
test("automatic checks wait exactly 48 hours across restarts while manual checks bypass the interval", async () => {
  const interval = 48 * 60 * 60 * 1000;
  assert.equal(AUTOMATIC_CHECK_INTERVAL, interval);
  let now = Date.parse("2026-10-31T00:00:00Z"), calls = 0;
  const fetchImpl = async () => { calls++; return response(release()); };
  const s = fixture(fetchImpl, { now: () => now });
  const restart = () => new ReleaseUpdates({
    currentVersion: "1.0.3", repository, dataDir: s.dir, fetchImpl, now: () => now,
  });
  try {
    assert.equal(s.updates.automaticDelay(), 0);
    await s.updates.check();
    assert.equal(calls, 1);
    assert.equal(s.updates.automaticDelay(), interval);
    const first = now;
    assert.equal(JSON.parse(fs.readFileSync(s.updates.file)).lastAutomaticAttempt, first);
    for (const elapsed of [6 * 3600000, 24 * 3600000, interval - 1]) {
      now = first + elapsed;
      await s.updates.check();
      assert.equal(calls, 1);
    }
    const restarted = restart();
    assert.equal(restarted.automaticDelay(), 1);
    await restarted.check();
    assert.equal(calls, 1);
    await restarted.check({ manual: true });
    assert.equal(calls, 2);
    assert.equal(restarted.automaticDelay(), 1);
    now = first + interval;
    await restarted.check();
    assert.equal(calls, 3);
    assert.equal(restarted.automaticDelay(), interval);
    restarted.setAutomatic(false);
    now += interval;
    assert.equal(restarted.automaticDelay(), null);
    await restarted.check();
    assert.equal(calls, 3);
    await restarted.check({ manual: true });
    assert.equal(calls, 4);
    restarted.setAutomatic(true);
    await restarted.check();
    assert.equal(calls, 5);
    assert.equal(restart().automaticDelay(), interval);
  } finally { s.close(); }
});
test("failed automatic attempts also retain the 48 hour interval after restart", async () => {
  let now = Date.parse("2026-10-31T00:00:00Z"), calls = 0;
  const fetchImpl = async () => { calls++; throw Error("offline"); };
  const s = fixture(fetchImpl, { now: () => now });
  try {
    assert.equal((await s.updates.check()).status, "error");
    assert.equal(calls, 1);
    const restarted = new ReleaseUpdates({
      currentVersion: "1.0.3", repository, dataDir: s.dir, fetchImpl, now: () => now,
    });
    now += AUTOMATIC_CHECK_INTERVAL - 1;
    await restarted.check();
    assert.equal(calls, 1);
    now++;
    assert.equal((await restarted.check()).status, "error");
    assert.equal(calls, 2);
  } finally { s.close(); }
});
