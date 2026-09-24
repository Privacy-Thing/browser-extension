export type SlavicPluralForm = "one" | "few" | "many";

export const slavicPluralForm = (count: number): SlavicPluralForm => {
  const integer = Math.abs(Math.trunc(count));
  const lastTwo = integer % 100;
  const last = integer % 10;
  if (last === 1 && lastTwo !== 11) return "one";
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return "few";
  return "many";
};

export const slavicCount = (
  count: number,
  forms: readonly [one: string, few: string, many: string],
): string => {
  const form = slavicPluralForm(count);
  const index = { one: 0, few: 1, many: 2 }[form];
  return `${count} ${forms[index]}`;
};
