import { createHash } from "node:crypto";
import { cents, yuan, invalid } from "./money.js";

const money = (value) => {
  const n = Number(value);
  if (
    !Number.isFinite(n) ||
    n <= 0 ||
    n > 1e12 ||
    Math.abs(n * 100 - cents(n)) > 0.0001
  )
    throw invalid("基数和金额须为正数，最多两位小数");
  return cents(n);
};

const active = (record) => !record.voided_at;

const used = (data, id) =>
  (data.records || [])
    .filter((record) => record.basis_id === id && active(record))
    .reduce((sum, record) => sum + cents(record.amount), 0);

export function allocationData(value) {
  return {
    bases: value?.bases || {},
    records: value?.records || [],
    requests: value?.requests || {},
  };
}

export function latestCaseReceipt(c) {
  const list = Array.isArray(c?.collections) ? c.collections : [];
  if (!list.length) return null;
  return (
    list
      .slice()
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
      .at(-1) || null
  );
}

export function caseAllocationLabel(c) {
  if (!c) return "未命名案件";
  if (c.track === "project" && c.name) return c.name;
  if (c.client && c.case_type) return c.client + " · " + c.case_type;
  return c.client || c.name || c.case_type || c.case_no || "未命名案件";
}

export function recordDirection(record) {
  return record?.direction === "inbound" ? "inbound" : "outbound";
}

export function visibleAllocations(db) {
  const caseIds = new Set((db.cases || []).map((c) => c.id));
  return allocationData(db.meta?.fee_allocations).records.filter((record) =>
    caseIds.has(record.case_id),
  );
}

export function allocationSummary(db) {
  const groups = new Map(),
    outGroups = new Map(),
    inGroups = new Map();
  let outCents = 0,
    inCents = 0,
    outCount = 0,
    inCount = 0;
  const outCases = new Set(),
    inCases = new Set();
  for (const record of visibleAllocations(db).filter(active)) {
    const amt = cents(record.amount);
    if (!groups.has(record.recipient))
      groups.set(record.recipient, { cents: 0, cases: new Set() });
    const group = groups.get(record.recipient);
    group.cents += amt;
    group.cases.add(record.case_id);
    if (recordDirection(record) === "inbound") {
      inCents += amt;
      inCount++;
      inCases.add(record.case_id);
      const src =
        String(record.from_lawyer || record.by || "合作律师").trim() ||
        "合作律师";
      if (!inGroups.has(src))
        inGroups.set(src, { cents: 0, cases: new Set() });
      const ig = inGroups.get(src);
      ig.cents += amt;
      ig.cases.add(record.case_id);
    } else {
      outCents += amt;
      outCount++;
      outCases.add(record.case_id);
      if (!outGroups.has(record.recipient))
        outGroups.set(record.recipient, { cents: 0, cases: new Set() });
      const og = outGroups.get(record.recipient);
      og.cents += amt;
      og.cases.add(record.case_id);
    }
  }
  return {
    can_allocate: true,
    total: yuan(
      [...groups.values()].reduce((sum, row) => sum + row.cents, 0),
    ),
    by_lawyer: [...groups].map(([lawyer, row]) => ({
      lawyer,
      allocated: yuan(row.cents),
      cases: row.cases.size,
    })),
    outbound_total: yuan(outCents),
    outbound_count: outCount,
    outbound_cases: outCases.size,
    outbound_by_lawyer: [...outGroups].map(([lawyer, row]) => ({
      lawyer,
      allocated: yuan(row.cents),
      cases: row.cases.size,
    })),
    inbound_total: yuan(inCents),
    inbound_count: inCount,
    inbound_cases: inCases.size,
    inbound_by_source: [...inGroups].map(([lawyer, row]) => ({
      lawyer,
      allocated: yuan(row.cents),
      cases: row.cases.size,
    })),
    net_total: yuan(inCents - outCents),
  };
}

export function allocationOptions(db) {
  const data = allocationData(db.meta?.fee_allocations);
  return (db.cases || []).map((c) => {
    const latest = latestCaseReceipt(c);
    const id = JSON.stringify([c.id, latest?.id || "manual"]);
    const bases = Object.values(data.bases)
      .filter((basis) => basis.case_id === c.id)
      .map((basis) => ({
        ...basis,
        allocated: yuan(used(data, basis.id)),
        remaining: yuan(cents(basis.amount) - used(data, basis.id)),
        locked: used(data, basis.id) > 0,
      }));
    if (!bases.some((basis) => basis.id === id)) {
      bases.unshift({
        id,
        case_id: c.id,
        receipt_id: latest?.id || null,
        amount: latest?.amount > 0 ? latest.amount : null,
        date: latest?.date || "",
        period: "",
        source_amount: latest?.amount || null,
        allocated: 0,
        remaining: latest?.amount > 0 ? latest.amount : null,
        locked: false,
      });
    }
    return {
      id: c.id,
      name: caseAllocationLabel(c),
      code: c.case_no || "",
      client: c.client || "",
      lawyer: c.lawyer || "",
      track: c.track,
      latest_receipt: latest,
      default_basis: id,
      bases,
    };
  });
}

export function calculateAllocation(base, recipients) {
  const total = money(base);
  if (!Array.isArray(recipients) || !recipients.length)
    throw invalid("请至少填写一名分配律师");
  const seen = new Set();
  const rules = recipients.map((rule) => {
    const name = String(rule.name || "").trim(),
      value = Number(rule.value);
    if (!name || name.length > 40 || seen.has(name))
      throw invalid("律师姓名不能为空、超过40字或重复");
    seen.add(name);
    if (!["rate", "amount"].includes(rule.kind))
      throw invalid("请选择比例或金额");
    if (
      rule.kind === "rate" &&
      (!Number.isFinite(value) ||
        value <= 0 ||
        value > 100 ||
        Math.abs(value * 100 - Math.round(value * 100)) > 0.0001)
    )
      throw invalid("比例须大于0且不超过100%，最多两位小数");
    return {
      name,
      kind: rule.kind,
      value,
      units: rule.kind === "rate" ? Math.round(value * 100) : money(value),
    };
  });
  const rateTotal = rules
    .filter((rule) => rule.kind === "rate")
    .reduce((sum, rule) => sum + rule.units, 0);
  if (rateTotal > 10000) throw invalid("分配比例合计不能超过100%");
  const target = Number(
    (BigInt(total) * BigInt(rateTotal) + 5000n) / 10000n,
  );
  const amounts = rules.map((rule) =>
    rule.kind === "rate"
      ? Number((BigInt(total) * BigInt(rule.units)) / 10000n)
      : rule.units,
  );
  const rateRows = rules
    .map((rule, index) => ({
      index,
      remainder:
        rule.kind === "rate"
          ? Number((BigInt(total) * BigInt(rule.units)) % 10000n)
          : -1,
    }))
    .filter((row) => row.remainder >= 0)
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const remaining =
    target - rateRows.reduce((sum, row) => sum + amounts[row.index], 0);
  for (let i = 0; i < remaining; i++) amounts[rateRows[i].index]++;
  if (amounts.reduce((a, b) => a + b, 0) > total)
    throw invalid("本次分配金额合计超过基数");
  return rules.map((rule, index) => ({
    name: rule.name,
    kind: rule.kind,
    value: rule.value,
    amount: yuan(amounts[index]),
  }));
}

export function createAllocationBatch(
  db,
  value,
  payload = {},
  username = "本机",
  uid,
  now,
) {
  const data = allocationData(value);
  const requestId = payload.request_id;
  if (typeof requestId !== "string" || !requestId || requestId.length > 100)
    throw invalid("缺少有效的分配标识");
  if (
    payload.direction !== undefined &&
    !["outbound", "inbound"].includes(payload.direction)
  )
    throw invalid("请选择有效的分配方向");
  const direction = payload.direction === "inbound" ? "inbound" : "outbound";
  const fromLawyer = String(payload.from_lawyer || "").trim();
  if (direction === "inbound" && (!fromLawyer || fromLawyer.length > 40))
    throw invalid("选择“他人分给我”时请填写来源律师姓名（不超过40字）");
  const normalizedRecipients =
    direction === "inbound" && Array.isArray(payload.recipients)
      ? payload.recipients.map((r) => ({
          ...r,
          name: String(r?.name || "").trim() || username,
        }))
      : payload.recipients;
  const fpSource =
    payload.direction !== undefined || payload.from_lawyer !== undefined
      ? {
          direction,
          from_lawyer: fromLawyer,
          cases: payload.cases,
          recipients: normalizedRecipients,
          note: payload.note || "",
        }
      : {
          cases: payload.cases,
          recipients: payload.recipients,
          note: payload.note || "",
        };
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(fpSource))
    .digest("hex");
  if (!Array.isArray(payload.cases) || !payload.cases.length)
    throw invalid("请至少选择一个案件");
  for (const item of payload.cases) {
    if (!db.cases.some((c) => c.id === item?.case_id))
      throw invalid("案件不存在", 404);
  }
  if (data.requests[requestId]) {
    if (data.requests[requestId].hash !== fingerprint)
      throw invalid("同一分配标识不能提交不同内容", 409);
    return {
      data,
      result: {
        ok: true,
        unchanged: true,
        batch_id: data.requests[requestId].batch_id,
      },
    };
  }
  const options = allocationOptions({
    ...db,
    meta: { ...db.meta, fee_allocations: data },
  });
  const selected = new Set(),
    plans = [];
  for (const item of payload.cases) {
    if (selected.has(item.case_id))
      throw invalid("同一案件不能在一个批次中重复选择");
    selected.add(item.case_id);
    const option = options.find((c) => c.id === item.case_id);
    if (!option) throw invalid("案件不存在", 404);
    const basis = option.bases.find((b) => b.id === item.basis_id);
    if (!basis)
      throw invalid(option.name + "的最近到账已变化，请刷新分配表单", 409);
    const base = money(item.base_amount);
    if (basis.locked && base !== cents(basis.amount))
      throw invalid(option.name + "的基数已用于分配，不能直接更改", 409);
    const splits = calculateAllocation(item.base_amount, normalizedRecipients);
    const total = splits.reduce((sum, row) => sum + cents(row.amount), 0);
    if (!total)
      throw invalid(option.name + "本次计算金额为0，请调整金额或比例");
    if (cents(basis.allocated) + total > base)
      throw invalid(
        option.name +
          "累计分配超过基数；剩余可分配 " +
          yuan(base - cents(basis.allocated)).toFixed(2) +
          " 元",
      );
    plans.push({ option, basis, base, splits });
  }
  const batch = uid(),
    at = now();
  for (const plan of plans) {
    const { option, basis, base, splits } = plan;
    const c = db.cases.find((item) => item.id === option.id);
    const effFrom = direction === "inbound" ? fromLawyer : c.lawyer || username;
    data.bases[basis.id] = {
      ...basis,
      amount: yuan(base),
      by: basis.by || username,
      at: basis.at || at,
    };
    for (const split of splits.filter((s) => s.amount > 0)) {
      data.records.push({
        id: uid(),
        batch_id: batch,
        basis_id: basis.id,
        case_id: c.id,
        case_name: caseAllocationLabel(c),
        case_code: c.case_no || "",
        case_lawyer: c.lawyer || "",
        direction,
        from_lawyer: effFrom,
        recipient: split.name,
        kind: split.kind,
        value: split.value,
        amount: split.amount,
        base_amount: yuan(base),
        receipt_id: basis.receipt_id,
        source_date: basis.date || "",
        source_period: basis.period || "",
        note: String(payload.note || ""),
        by: username,
        at,
      });
    }
  }
  data.requests[requestId] = { hash: fingerprint, batch_id: batch };
  return {
    data,
    result: {
      ok: true,
      batch_id: batch,
      direction,
      from_lawyer: direction === "inbound" ? fromLawyer : "",
      cases: plans.length,
      plans: plans.map((plan) => ({
        case_id: plan.option.id,
        case_name: plan.option.name,
        direction,
        from_lawyer:
          direction === "inbound" ? fromLawyer : plan.option.lawyer || username,
        base_amount: yuan(plan.base),
        allocated: plan.basis.allocated,
        splits: plan.splits,
      })),
      total: yuan(
        plans.reduce(
          (sum, plan) =>
            sum + plan.splits.reduce((s, row) => s + cents(row.amount), 0),
          0,
        ),
      ),
    },
  };
}

export function voidAllocationRecord(
  db,
  value,
  recordId,
  reason,
  username = "本机",
  now,
) {
  const cleanReason = String(reason || "").trim();
  if (!cleanReason) throw invalid("请填写撤销原因");
  if (cleanReason.length > 2000) throw invalid("撤销原因过长");
  const data = allocationData(value);
  const record = data.records.find((row) => row.id === recordId);
  if (!record) throw invalid("分配记录不存在", 404);
  if (!db.cases.some((c) => c.id === record.case_id))
    throw invalid("案件不存在", 404);
  if (record.voided_at) {
    return { data, result: { ok: true, unchanged: true } };
  }
  Object.assign(record, {
    voided_at: now(),
    voided_by: username,
    void_reason: cleanReason,
  });
  return { data, result: { ok: true } };
}

export function cascadeDeleteCaseAllocations(meta, caseId) {
  const allocations = meta?.fee_allocations;
  if (!allocations || typeof allocations !== "object") return 0;
  const records = Array.isArray(allocations.records) ? allocations.records : [];
  const deleted = records.filter((row) => row.case_id === caseId);
  allocations.records = records.filter((row) => row.case_id !== caseId);
  if (allocations.bases && typeof allocations.bases === "object") {
    for (const [id, basis] of Object.entries(allocations.bases)) {
      if (basis?.case_id === caseId) delete allocations.bases[id];
    }
  }
  if (allocations.requests && typeof allocations.requests === "object") {
    const batches = new Set(deleted.map((row) => row.batch_id));
    for (const [id, request] of Object.entries(allocations.requests)) {
      if (
        batches.has(request?.batch_id) &&
        !allocations.records.some((row) => row.batch_id === request.batch_id)
      ) {
        delete allocations.requests[id];
      }
    }
  }
  return deleted.length;
}
