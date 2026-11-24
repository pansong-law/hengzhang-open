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
  unpaid_mode: [
    "未付金额计算方式",
    "填写自动或手填。自动时忽略金额列并恢复自动计算；手填时须填写金额。留空或缺少此列时，按原有规则导入非空金额。",
  ],
  invoiced_unpaid_mode: [
    "开票未付金额计算方式",
    "填写自动或手填。自动时忽略金额列并恢复自动计算；手填时须填写金额。修改导出表金额时，请同时将此列改为手填；留空或缺少此列时，按原有规则导入非空金额。",
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
  "unpaid_mode",
  "invoiced_unpaid",
  "invoiced_unpaid_mode",
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
export const COMBINED_LEDGER_TEMPLATE = {
  name: "综合案件",
  file: "all-cases-template.xlsx",
  tracks: ["advisory", "project", "litigation"],
  trackLabels: ["顾问", "专项", "诉讼"],
  colorLegend: [
    [
      "必填列（琥珀底）",
      "类型",
      "新建案件必填，下拉选择「顾问」「专项」或「诉讼」；按唯一内部案号更新已有案件时可留空。",
    ],
    [
      "通用列（深青蓝底）",
      "内部案号、客户、律师、费用及计算方式、日期、状态、备注",
      "三类业务线均可填写；其中「客户」列在顾问、专项、诉讼中的填写口径不同，请见下方对比表。",
    ],
    [
      "仅顾问列（青绿底）",
      "服务期限（仅顾问）",
      "仅「顾问」填写起止日期；专项和诉讼请留空。",
    ],
    [
      "仅专项列（棕褐底）",
      "项目名称（仅专项）、对方当事人（仅专项）",
      "仅「专项」填写；顾问和诉讼请留空。",
    ],
    [
      "仅诉讼列（靛蓝底）",
      "原告、被告、第三人、案由、案件阶段、服务阶段（仅诉讼）",
      "仅「诉讼」填写；顾问和专项请留空。",
    ],
  ],
  trackComparison: [
    [
      "顾问",
      "填写客户名称",
      "无需填写项目名称/当事人/案由",
      "填写「服务期限（仅顾问）」（起止日期，如 2026-01-01 至 2026-12-31）；「案件阶段」「服务阶段」留空",
    ],
    [
      "专项",
      "多个客户用逗号分隔，此列均为客户",
      "填写「项目名称（仅专项）」「对方当事人（仅专项）」（对方不能标记为客户）",
      "期限与阶段列均留空",
    ],
    [
      "诉讼",
      "从原告、被告或第三人中填写属于客户的名称，须与对应主体一致，多个用逗号分隔",
      "填写「原告」「被告」「第三人」「案由」（均仅诉讼列）",
      "「案件阶段（仅诉讼）」单选当前阶段；「服务阶段（仅诉讼）」填合同约定范围（可多选逗号分隔）；「服务期限」留空",
    ],
  ],
  fields: [
    {
      key: "track",
      label: "类型",
      scope: "required",
      scopeLabel: "必填（顾问/专项/诉讼）",
      color: "85511E",
      note: "必填。下拉选择「顾问」「专项」或「诉讼」；按唯一内部案号更新已有案件时可留空保留原业务线。",
    },
    {
      key: "internal_no",
      label: "内部案号",
      scope: "all",
      scopeLabel: "通用",
      color: "294C60",
      note: common.internal_no[1],
    },
    {
      key: "client",
      label: "客户",
      scope: "all",
      scopeLabel: "通用（三类口径不同）",
      color: "294C60",
      note: "三类业务线填写要求不同：①顾问：填写客户名称；②专项：多个客户用逗号分隔，此列均为客户；③诉讼：填写属于客户的原告、被告或第三人名称，须与对应主体名称一致，可填多个并用逗号分隔。",
    },
    {
      key: "service_period",
      label: "服务期限（仅顾问）",
      scope: "advisory",
      scopeLabel: "仅顾问",
      color: "2A6F5B",
      note: "仅顾问填写，专项和诉讼请留空。填写起止日期，如 2026-01-01 至 2026-12-31。",
    },
    {
      key: "name",
      label: "项目名称（仅专项）",
      scope: "project",
      scopeLabel: "仅专项",
      color: "7A5A2B",
      note: "仅专项填写，顾问和诉讼请留空。填写专项项目名称。",
    },
    {
      key: "opponent",
      label: "对方当事人（仅专项）",
      scope: "project",
      scopeLabel: "仅专项",
      color: "7A5A2B",
      note: "仅专项填写，顾问和诉讼请留空。多个主体用逗号分隔，如丙公司,丁公司；对方当事人不能标记为客户。",
    },
    {
      key: "plaintiff",
      label: "原告（仅诉讼）",
      scope: "litigation",
      scopeLabel: "仅诉讼",
      color: "3D4F7C",
      note: "仅诉讼填写，顾问和专项请留空。多个原告用逗号分隔，如甲公司,乙公司。",
    },
    {
      key: "defendant",
      label: "被告（仅诉讼）",
      scope: "litigation",
      scopeLabel: "仅诉讼",
      color: "3D4F7C",
      note: "仅诉讼填写，顾问和专项请留空。多个被告用逗号分隔，如丙公司,丁公司。",
    },
    {
      key: "third_party",
      label: "第三人（仅诉讼）",
      scope: "litigation",
      scopeLabel: "仅诉讼",
      color: "3D4F7C",
      note: "仅诉讼填写，顾问和专项请留空。多个第三人用逗号分隔；没有可留空。",
    },
    {
      key: "case_type",
      label: "案由（仅诉讼）",
      scope: "litigation",
      scopeLabel: "仅诉讼",
      color: "3D4F7C",
      note: "仅诉讼填写，顾问和专项请留空。填写具体案由，如买卖合同纠纷。",
    },
    {
      key: "case_stage",
      label: "案件阶段（仅诉讼）",
      scope: "litigation",
      scopeLabel: "仅诉讼",
      color: "3D4F7C",
      note:
        "仅诉讼填写，顾问和专项请留空。记录案件目前所处阶段，单选" +
        LITIGATION_STAGES.join("、") +
        "；不是合同约定的服务范围，未确定可留空。",
    },
    {
      key: "service_stages",
      label: "服务阶段（仅诉讼）",
      scope: "litigation",
      scopeLabel: "仅诉讼",
      color: "3D4F7C",
      note:
        "仅诉讼填写，顾问和专项请留空。按合同约定的服务范围填写" +
        LITIGATION_STAGES.join("、") +
        "，可多选并用逗号分隔。",
    },
    {
      key: "lawyer",
      label: "承办律师",
      scope: "all",
      scopeLabel: "通用",
      color: "294C60",
      note: common.lawyer[1],
    },
    {
      key: "co_lawyers",
      label: "协办律师",
      scope: "all",
      scopeLabel: "通用",
      color: "294C60",
      note: common.co_lawyers[1],
    },
    {
      key: "client_contact",
      label: "客户联系人",
      scope: "all",
      scopeLabel: "通用",
      color: "294C60",
      note: common.client_contact[1],
    },
    {
      key: "contract_amount",
      label: "签约律师费",
      scope: "all",
      scopeLabel: "通用",
      color: "294C60",
      note: common.contract_amount[1],
    },
    {
      key: "invoice_amount",
      label: "开票金额",
      scope: "all",
      scopeLabel: "通用",
      color: "294C60",
      note: common.invoice_amount[1],
    },
    {
      key: "collected_amount",
      label: "收款金额",
      scope: "all",
      scopeLabel: "通用",
      color: "294C60",
      note: common.collected_amount[1],
    },
    {
      key: "unpaid",
      label: "未付金额",
      scope: "all",
      scopeLabel: "通用",
      color: "294C60",
      note: common.unpaid[1],
    },
    {
      key: "unpaid_mode",
      label: "未付金额计算方式",
      scope: "all",
      scopeLabel: "通用",
      color: "294C60",
      note: common.unpaid_mode[1],
    },
    {
      key: "invoiced_unpaid",
      label: "开票未付金额",
      scope: "all",
      scopeLabel: "通用",
      color: "294C60",
      note: common.invoiced_unpaid[1],
    },
    {
      key: "invoiced_unpaid_mode",
      label: "开票未付金额计算方式",
      scope: "all",
      scopeLabel: "通用",
      color: "294C60",
      note: common.invoiced_unpaid_mode[1],
    },
    {
      key: "fee_note",
      label: "费用说明",
      scope: "all",
      scopeLabel: "通用",
      color: "294C60",
      note: common.fee_note[1],
    },
    {
      key: "sign_date",
      label: "签约日期",
      scope: "all",
      scopeLabel: "通用",
      color: "294C60",
      note: common.sign_date[1],
    },
    {
      key: "status",
      label: "案件状态",
      scope: "all",
      scopeLabel: "通用",
      color: "294C60",
      note: "在办、已结或中止（诉讼案件对应台账中的「状态」）。新建留空默认在办；合并留空保留原状态。",
    },
    {
      key: "notes",
      label: "备注",
      scope: "all",
      scopeLabel: "通用",
      color: "294C60",
      note: common.notes[1],
    },
  ],
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
            unpaid_mode: c.unpaid == null ? "自动" : "手填",
            invoiced_unpaid: fs.invoiced_unpaid,
            invoiced_unpaid_mode: c.invoiced_unpaid == null ? "自动" : "手填",
          };
          return exportFields.map((f) => values[f.key] ?? "");
        }),
      };
    });
}
