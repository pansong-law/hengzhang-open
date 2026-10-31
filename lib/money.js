export const cents = (value) => Math.round(Number(value || 0) * 100);
export const yuan = (value) => value / 100;
export const invalid = (message, status = 400) =>
  Object.assign(Error(message), { status });
export function amount(value, label = "金额", nullable = true) {
  if (value == null || value === "") {
    if (nullable) return null;
    throw invalid(label + "不能为空");
  }
  const text = String(value).trim().replace(/[,，]/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(text))
    throw invalid(label + "须为非负数，最多两位小数");
  const n = Number(text);
  if (!Number.isFinite(n) || n > 1e10) throw invalid(label + "超出可登记范围");
  return yuan(cents(n));
}
