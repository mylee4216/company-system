export const SNAPSHOT_META_PREFIX = "__ROW_META__";

export type SnapshotMetaNote = {
  note: string;
  category: string;
};

export type MinimalWorkEntry = {
  date?: string | null;
  units?: number | null;
  work_days?: number | null;
};

export type LaborRemarkResult = {
  text: string;
  source: "previous_month" | "current_month" | "none";
  date: string;
};

export type LaborDeductionBreakdown = {
  nationalPension: number;
  healthInsurance: number;
  longTermCareInsurance: number;
  employmentInsurance: number;
  incomeTax: number;
  localIncomeTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netPayment: number;
};

export type LaborDeductionInput = {
  grossAmount: number;
  otherDeductions?: number;
};

const DEDUCTION_RATES = {
  nationalPension: 0.045,
  healthInsurance: 0.03545,
  longTermCareRateOnHealthInsurance: 0.1295,
  employmentInsurance: 0.009,
  incomeTax: 0.03,
  localIncomeTaxRateOnIncomeTax: 0.1,
} as const;

function parseNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value.replace(/,/g, "").trim();

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundWon(value: number) {
  return Math.round(value);
}

function isValidDateString(value: string | null | undefined): value is string {
  return Boolean(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getMonthStartDate(targetMonth: string) {
  return /^\d{4}-\d{2}$/.test(targetMonth) ? `${targetMonth}-01` : "";
}

function getCurrentMonthWorkedDates(targetMonth: string, workEntries: MinimalWorkEntry[]) {
  return workEntries
    .filter((entry) => parseNumber(entry.units ?? entry.work_days) > 0)
    .map((entry) => entry.date?.trim() ?? "")
    .filter((date): date is string => isValidDateString(date) && date.startsWith(`${targetMonth}-`))
    .sort((left, right) => left.localeCompare(right));
}

export function parseSnapshotNote(value: string | null | undefined): SnapshotMetaNote {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    return { note: "", category: "" };
  }

  const markerIndex = normalized.indexOf(SNAPSHOT_META_PREFIX);

  if (markerIndex < 0) {
    return { note: normalized, category: "" };
  }

  const note = normalized.slice(0, markerIndex).trim();
  const serializedMeta = normalized.slice(markerIndex + SNAPSHOT_META_PREFIX.length).trim();

  try {
    const parsed = JSON.parse(serializedMeta) as { category?: unknown };
    return {
      note,
      category: typeof parsed.category === "string" ? parsed.category.trim() : "",
    };
  } catch {
    return { note, category: "" };
  }
}

export function buildSnapshotNote(note: string | null | undefined, category: string | null | undefined) {
  const normalizedNote = note?.trim() ?? "";
  const normalizedCategory = category?.trim() ?? "";

  if (!normalizedCategory) {
    return normalizedNote || null;
  }

  const serializedMeta = JSON.stringify({ category: normalizedCategory });
  return normalizedNote
    ? `${normalizedNote}\n${SNAPSHOT_META_PREFIX}${serializedMeta}`
    : `${SNAPSHOT_META_PREFIX}${serializedMeta}`;
}

export function getLaborRemark(
  targetMonth: string,
  workerFirstWorkDate: string | null | undefined,
  workEntries: MinimalWorkEntry[] = [],
): LaborRemarkResult {
  const normalizedFirstWorkDate = workerFirstWorkDate?.trim() ?? "";
  const monthStartDate = getMonthStartDate(targetMonth);
  const currentMonthWorkedDates = getCurrentMonthWorkedDates(targetMonth, workEntries);

  if (isValidDateString(normalizedFirstWorkDate)) {
    if (monthStartDate && normalizedFirstWorkDate < monthStartDate) {
      return {
        text: `전월첫근무일 ${normalizedFirstWorkDate}`,
        source: "previous_month",
        date: normalizedFirstWorkDate,
      };
    }

    if (normalizedFirstWorkDate.startsWith(`${targetMonth}-`)) {
      return {
        text: `최초근무일 ${normalizedFirstWorkDate}`,
        source: "current_month",
        date: normalizedFirstWorkDate,
      };
    }
  }

  if (currentMonthWorkedDates.length > 0) {
    return {
      text: `최초근무일 ${currentMonthWorkedDates[0]}`,
      source: "current_month",
      date: currentMonthWorkedDates[0],
    };
  }

  return { text: "", source: "none", date: "" };
}

export function calculateNationalPension(grossAmount: number) {
  return roundWon(Math.max(0, grossAmount) * DEDUCTION_RATES.nationalPension);
}

export function calculateHealthInsurance(grossAmount: number) {
  return roundWon(Math.max(0, grossAmount) * DEDUCTION_RATES.healthInsurance);
}

export function calculateLongTermCareInsurance(healthInsurance: number) {
  return roundWon(Math.max(0, healthInsurance) * DEDUCTION_RATES.longTermCareRateOnHealthInsurance);
}

export function calculateEmploymentInsurance(grossAmount: number) {
  return roundWon(Math.max(0, grossAmount) * DEDUCTION_RATES.employmentInsurance);
}

export function calculateIncomeTax(grossAmount: number) {
  return roundWon(Math.max(0, grossAmount) * DEDUCTION_RATES.incomeTax);
}

export function calculateLocalIncomeTax(incomeTax: number) {
  return roundWon(Math.max(0, incomeTax) * DEDUCTION_RATES.localIncomeTaxRateOnIncomeTax);
}

export function calculateLaborDeductions(input: LaborDeductionInput): LaborDeductionBreakdown {
  const grossAmount = Math.max(0, input.grossAmount || 0);
  const nationalPension = calculateNationalPension(grossAmount);
  const healthInsurance = calculateHealthInsurance(grossAmount);
  const longTermCareInsurance = calculateLongTermCareInsurance(healthInsurance);
  const employmentInsurance = calculateEmploymentInsurance(grossAmount);
  const incomeTax = calculateIncomeTax(grossAmount);
  const localIncomeTax = calculateLocalIncomeTax(incomeTax);
  const otherDeductions = roundWon(Math.max(0, input.otherDeductions || 0));
  const totalDeductions =
    nationalPension +
    healthInsurance +
    longTermCareInsurance +
    employmentInsurance +
    incomeTax +
    localIncomeTax +
    otherDeductions;

  return {
    nationalPension,
    healthInsurance,
    longTermCareInsurance,
    employmentInsurance,
    incomeTax,
    localIncomeTax,
    otherDeductions,
    totalDeductions,
    netPayment: Math.max(0, grossAmount - totalDeductions),
  };
}
