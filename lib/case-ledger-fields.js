import { feeNote } from "./fee-note.js";
import { LITIGATION_STAGES } from "./litigation-stage.js";
export const splitParties = (value) => [
  ...new Set(
    (Array.isArray(value) ? value : String(value || "").split(/[,，、;；\n]/))
      .map((v) => String(v).trim())
      .filter(Boolean),
  ),
];
export const partyText = (value) => splitParties(value).join(",");
export function normalizeCaseParties(c) {
  for (const key of [
    "client",
    "plaintiff",
    "defendant",
    "third_party",
    "opponent",
  ])
    if (key in c) c[key] = partyText(c[key]);
  return c;
}
const common = {
  track: ["类型", "按模板所属业务线填写，可留空。"],
  internal_no: [
    "内部案号",
    "填写本所内部案号；唯一匹配时合并，非空字段以后导入为准。暂缺可导入后补齐。",
  ],
  lawyer: ["承办律师", "填写姓名，可留空。"],
  co_lawyers: ["协办律师", "填写姓名；多人用逗号分隔，可留空。"],
  client_contact: ["客户联系人", "联系人姓名及联系方式，可留空。"],
  contract_amount: [
    "签约律师费",
    "单位：元。可含计算说明，如 7604.98（380249.08×2%）。",
  ],
  invoice_amount: ["开票金额", "累计开票金额，单位：元。"],
  collected_amount: [
    "收款金额",
    "累计已收律师费，单位：元；不是本次新增收款。",
  ],
  unpaid: ["未付金额", "单位：元。可留空，由系统按签约律师费减累计收款计算。"],
  invoiced_unpaid: [
    "开票未付金额",
    "单位：元。可填写当前开票未付金额；留空按累计开票减累计已收款计算，最低为零。手填后以登记值为准，可在案件编辑中清空以恢复自动计算。",
  ],
  fee_note: [
    "费用说明",
    "填写收费计算依据、付款安排、收费节点等。统一使用此列。",
  ],
  sign_date: ["签约日期", "填写年-月-日，如 2026-10-25。"],
  status: [
    "案件状态",
    "在办、已结或中止。新建留空默认在办；合并留空保留原状态。",
  ],
  notes: ["备注", "补充事项，可留空。"],
};
const fields = (extras, keys) =>
  keys.map((key) => {
    const [label, note] = extras[key] || common[key];
    return { key, label, note };
  });
const money = [
  "contract_amount",
  "invoice_amount",
  "collected_amount",
  "unpaid",
  "invoiced_unpaid",
  "fee_note",
  "sign_date",
  "status",
  "notes",
];
export const CASE_LEDGER_FIELDS = {
  advisory: {
    name: "顾问案件",
    file: "advisory-cases-template.xlsx",
    label: "顾问",
    fields: fields(
      {
        client: ["客户", "填写客户名称。"],
        service_period: [
          "服务期限",
          "填写起止日期，如 2026-01-01 至 2026-12-31。",
        ],
      },
      [
        "track",
        "internal_no",
        "client",
        "lawyer",
        "co_lawyers",
        "client_contact",
        "service_period",
        ...money,
      ],
    ),
  },
  project: {
    name: "专项案件",
    file: "project-cases-template.xlsx",
    label: "专项",
    fields: fields(
      {
        name: ["项目名称", "填写专项项目名称。"],
        client: [
          "客户",
          "多个客户在同一单元格中用逗号分隔，如甲公司,乙公司；此列均为客户。",
        ],
        opponent: [
          "对方当事人",
          "多个主体用逗号分隔，如丙公司,丁公司；对方当事人不能标记为客户。",
        ],
      },
      [
        "track",
        "internal_no",
        "name",
        "client",
        "opponent",
        "lawyer",
        "co_lawyers",
        "client_contact",
        ...money,
      ],
    ),
  },
  litigation: {
    name: "诉讼案件",
    file: "litigation-cases-template.xlsx",
    label: "诉讼",
    fields: fields(
      {
        plaintiff: ["原告", "多个原告用逗号分隔，如甲公司,乙公司。"],
        defendant: ["被告", "多个被告用逗号分隔，如丙公司,丁公司。"],
        third_party: ["第三人", "多个第三人用逗号分隔；没有可留空。"],
        client: [
          "客户",
          "填写属于客户的原告、被告或第三人名称，须与对应主体名称一致；可选择多个，用逗号分隔。历史客户身份未补齐时会保留为“身份待补充”。",
        ],
        status: [
          "状态",
          "在办、已结或中止。新建留空默认在办；合并留空保留原状态。",
        ],
        case_type: ["案由", "填写具体案由，如买卖合同纠纷。"],
        case_stage: [
          "案件阶段",
          "记录案件目前所处阶段，单选" +
            LITIGATION_STAGES.join("、") +
            "；不是合同约定的服务范围，未确定可留空。",
        ],
        service_period: [
          "服务阶段",
          "按合同约定的服务范围填写" +
            LITIGATION_STAGES.join("、") +
            "，可多选并用逗号分隔。",
        ],
      },
      [
        "track",
        "internal_no",
        "plaintiff",
        "defendant",
        "third_party",
        "client",
        "case_type",
        "lawyer",
        "co_lawyers",
        "client_contact",
        "case_stage",
        "service_period",
        ...money,
      ],
    ),
  },
};
export function businessLedgerSheets(cases, finance, track) {
  return Object.entries(CASE_LEDGER_FIELDS)
    .filter(([key]) => !track || key === track)
    .map(([key, spec]) => {
      const list = cases.filter((c) => c.track === key);
      const exportFields = spec.fields;
      return {
        track: key,
        name: spec.name,
        headers: exportFields.map((f) => f.label),
        rows: list.map((c) => {
          const fs = finance(c);
          const values = {
            ...c,
            fee_note: feeNote(c),
            track: spec.label,
            internal_no: c.case_no || "",
            co_lawyers: (c.co_lawyers || []).join(","),
            contract_amount: fs.signed ?? "",
            invoice_amount: fs.invoice ?? "",
            collected_amount: fs.received ?? "",
            unpaid: fs.unpaid ?? "",
            invoiced_unpaid: fs.invoiced_unpaid,
          };
          return exportFields.map((f) => values[f.key] ?? "");
        }),
      };
    });
}
