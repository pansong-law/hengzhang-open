export const LITIGATION_STAGES = ["仲裁", "一审", "二审", "执行", "再审"];
export function litigationStage(value) {
  const stage = String(value ?? "").trim();
  if (stage && !LITIGATION_STAGES.includes(stage))
    throw Object.assign(Error("案件阶段须选择仲裁、一审、二审、执行或再审"), {
      status: 400,
    });
  return stage;
}
