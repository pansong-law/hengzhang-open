const isOther = () => true;
const text = (value) =>
  String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
export const mergeFeeNotes = (...values) =>
  [...new Set(values.map(text).filter(Boolean))].join("\n");
export const feeNote = (c) =>
  mergeFeeNotes(c.fee_note, c.pay_terms, c.contract_formula);
export function normalizeFeeNote(c) {
  if (!isOther(c)) return c;
  if (
    !["fee_note", "pay_terms", "contract_formula"].some((key) =>
      Object.hasOwn(c, key),
    )
  )
    return c;
  c.fee_note = feeNote(c);
  delete c.pay_terms;
  delete c.contract_formula;
  return c;
}
// Older clients may still send either old field. New clients write only fee_note,
// including an explicit empty string when the user clears the description.
export function applyFeeNotePatch(c, body) {
  if (!isOther(c)) return c;
  if (Object.hasOwn(body, "fee_note")) {
    c.fee_note = text(body.fee_note);
    delete c.pay_terms;
    delete c.contract_formula;
  } else if (
    Object.hasOwn(body, "pay_terms") ||
    Object.hasOwn(body, "contract_formula")
  ) {
    c.fee_note = mergeFeeNotes(
      c.fee_note,
      body.pay_terms,
      body.contract_formula,
    );
    delete c.pay_terms;
    delete c.contract_formula;
  } else normalizeFeeNote(c);
  return c;
}
