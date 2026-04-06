export const FORM_DAY_COLUMN_COUNT = 16;

export type DayGridCell = {
  date: string | null;
  label: string;
};

export const FORM_DEDUCTION_COLUMNS = [
  { key: "national", label: "국민연금", lines: ["국민", "연금"] },
  { key: "health", label: "건강보험", lines: ["건강", "보험"] },
  { key: "longTermCare", label: "장기요양보험", lines: ["장기요양", "보험"] },
  { key: "employment", label: "고용보험", lines: ["고용", "보험"] },
  { key: "incomeTax", label: "소득세", lines: ["소득세"] },
  { key: "residentTax", label: "주민세", lines: ["주민세"] },
  { key: "totalDeduction", label: "공제금액", lines: ["공제", "금액"] },
] as const;

export function buildLaborDayGrid(monthDates: string[]) {
  const top: DayGridCell[] = Array.from({ length: FORM_DAY_COLUMN_COUNT }, (_, index) => ({
    date: index < 15 ? monthDates[index] ?? null : null,
    label: index < 15 && monthDates[index] ? String(index + 1) : "",
  }));

  const bottom: DayGridCell[] = Array.from({ length: FORM_DAY_COLUMN_COUNT }, (_, index) => {
    const date = monthDates[index + 15] ?? null;
    return {
      date,
      label: date ? String(index + 16) : "",
    };
  });

  return {
    top,
    bottom,
    count: FORM_DAY_COLUMN_COUNT,
  };
}
