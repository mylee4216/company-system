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

export type InsuranceBreakdown = {
  national: number;
  health: number;
  longTermCare: number;
  employment: number;
  incomeTax: number;
  residentTax: number;
  totalDeduction: number;
  total: number;
  netPay: number;
};

export type LaborRateConfig = {
  incomeTaxRate1: number;
  incomeTaxRate2: number;
  incomeTaxNonTaxableBase: number;
  healthRate: number;
  longTermCareRate: number;
  pensionRate: number;
  pensionApplyMinDays: number;
  pensionNonTaxableBase: number;
  pensionMinAmount: number;
  pensionMaxAmount: number;
  employmentRate: number;
  residentTaxRate: number;
  truncateIncomeTaxUnderTen: boolean;
  applyEmploymentForSenior65: boolean;
  applyEmploymentForForeigners: boolean;
  applyResidentTaxForForeigners: boolean;
};

export type LaborRateFormulaRow = {
  label: string;
  formula: string;
  note: string;
};

export type InsuranceCalculationInput = {
  grossPay: number;
  workDays?: number;
  residentId?: string | null;
  targetMonth?: string;
};

export const defaultRateConfig: LaborRateConfig = {
  incomeTaxRate1: 3,
  incomeTaxRate2: 100,
  incomeTaxNonTaxableBase: 0,
  healthRate: 3.545,
  longTermCareRate: 12.95,
  pensionRate: 4.5,
  pensionApplyMinDays: 0,
  pensionNonTaxableBase: 0,
  pensionMinAmount: 0,
  pensionMaxAmount: 0,
  employmentRate: 0.9,
  residentTaxRate: 10,
  truncateIncomeTaxUnderTen: true,
  applyEmploymentForSenior65: true,
  applyEmploymentForForeigners: true,
  applyResidentTaxForForeigners: true,
};

export function formatGongsu(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/,/g, "").trim());

  if (!Number.isFinite(parsed) || parsed === 0) {
    return "";
  }

  return parsed.toFixed(1);
}

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

function floorWon(value: number) {
  return Math.floor(value);
}

function clampNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function percentToRate(value: number) {
  return Math.max(0, value || 0) / 100;
}

function getResidentDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function isForeignResidentId(value: string | null | undefined) {
  const digits = getResidentDigits(value);

  if (digits.length < 7) {
    return false;
  }

  return ["5", "6", "7", "8"].includes(digits[6]);
}

function getBirthDateFromResidentId(value: string | null | undefined) {
  const digits = getResidentDigits(value);

  if (digits.length < 7) {
    return null;
  }

  const yearPart = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  const code = digits[6];

  const century =
    code === "1" || code === "2" || code === "5" || code === "6" ? 1900 :
    code === "3" || code === "4" || code === "7" || code === "8" ? 2000 :
    code === "9" || code === "0" ? 1800 :
    null;

  if (!century || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(century + yearPart, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getAgeOnMonthEnd(residentId: string | null | undefined, targetMonth: string | undefined) {
  if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
    return null;
  }

  const birthDate = getBirthDateFromResidentId(residentId);
  if (!birthDate) {
    return null;
  }

  const [year, month] = targetMonth.split("-").map(Number);
  const referenceDate = new Date(year, month, 0);
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

function applyMinMax(amount: number, minAmount: number, maxAmount: number) {
  let nextAmount = amount;

  if (minAmount > 0) {
    nextAmount = Math.max(nextAmount, minAmount);
  }

  if (maxAmount > 0) {
    nextAmount = Math.min(nextAmount, maxAmount);
  }

  return nextAmount;
}

export function normalizeRateConfig(config?: Partial<LaborRateConfig> | null): LaborRateConfig {
  return {
    incomeTaxRate1: clampNumber(config?.incomeTaxRate1, defaultRateConfig.incomeTaxRate1),
    incomeTaxRate2: clampNumber(config?.incomeTaxRate2, defaultRateConfig.incomeTaxRate2),
    incomeTaxNonTaxableBase: clampNumber(config?.incomeTaxNonTaxableBase, defaultRateConfig.incomeTaxNonTaxableBase),
    healthRate: clampNumber(config?.healthRate, defaultRateConfig.healthRate),
    longTermCareRate: clampNumber(config?.longTermCareRate, defaultRateConfig.longTermCareRate),
    pensionRate: clampNumber(config?.pensionRate, defaultRateConfig.pensionRate),
    pensionApplyMinDays: clampNumber(config?.pensionApplyMinDays, defaultRateConfig.pensionApplyMinDays),
    pensionNonTaxableBase: clampNumber(config?.pensionNonTaxableBase, defaultRateConfig.pensionNonTaxableBase),
    pensionMinAmount: clampNumber(config?.pensionMinAmount, defaultRateConfig.pensionMinAmount),
    pensionMaxAmount: clampNumber(config?.pensionMaxAmount, defaultRateConfig.pensionMaxAmount),
    employmentRate: clampNumber(config?.employmentRate, defaultRateConfig.employmentRate),
    residentTaxRate: clampNumber(config?.residentTaxRate, defaultRateConfig.residentTaxRate),
    truncateIncomeTaxUnderTen: normalizeBoolean(config?.truncateIncomeTaxUnderTen, defaultRateConfig.truncateIncomeTaxUnderTen),
    applyEmploymentForSenior65: normalizeBoolean(config?.applyEmploymentForSenior65, defaultRateConfig.applyEmploymentForSenior65),
    applyEmploymentForForeigners: normalizeBoolean(config?.applyEmploymentForForeigners, defaultRateConfig.applyEmploymentForForeigners),
    applyResidentTaxForForeigners: normalizeBoolean(config?.applyResidentTaxForForeigners, defaultRateConfig.applyResidentTaxForForeigners),
  };
}

export function serializeRateConfig(config: LaborRateConfig) {
  return JSON.stringify(normalizeRateConfig(config));
}

export function deserializeRateConfig(serialized: string | null | undefined) {
  if (!serialized) {
    return null;
  }

  try {
    return normalizeRateConfig(JSON.parse(serialized) as Partial<LaborRateConfig>);
  } catch {
    return null;
  }
}

export function loadDefaultRateConfig(serialized?: string | null) {
  return deserializeRateConfig(serialized) ?? defaultRateConfig;
}

export function getRateFormulaSummary(config: LaborRateConfig): LaborRateFormulaRow[] {
  const normalizedConfig = normalizeRateConfig(config);

  return [
    {
      label: "국민연금",
      formula: `max(0, 지급액 - ${normalizedConfig.pensionNonTaxableBase.toLocaleString("ko-KR")}) × ${normalizedConfig.pensionRate}%`,
      note: `근무일수 ${normalizedConfig.pensionApplyMinDays}일 미만이면 미적용, 하한 ${normalizedConfig.pensionMinAmount.toLocaleString("ko-KR")}원 / 상한 ${normalizedConfig.pensionMaxAmount.toLocaleString("ko-KR")}원`,
    },
    {
      label: "건강보험",
      formula: `지급액 × ${normalizedConfig.healthRate}%`,
      note: "지급액 기준 자동 계산",
    },
    {
      label: "장기요양보험",
      formula: `건강보험 × ${normalizedConfig.longTermCareRate}%`,
      note: "건강보험 계산값을 기준으로 연동",
    },
    {
      label: "고용보험",
      formula: `지급액 × ${normalizedConfig.employmentRate}%`,
      note: `65세 이상 적용 ${normalizedConfig.applyEmploymentForSenior65 ? "포함" : "제외"} / 외국인 적용 ${normalizedConfig.applyEmploymentForForeigners ? "포함" : "제외"}`,
    },
    {
      label: "소득세",
      formula: `max(0, 지급액 - ${normalizedConfig.incomeTaxNonTaxableBase.toLocaleString("ko-KR")}) × ${normalizedConfig.incomeTaxRate1}% × ${normalizedConfig.incomeTaxRate2}%`,
      note: normalizedConfig.truncateIncomeTaxUnderTen ? "10원 미만 절사 적용" : "절사 없이 원단위 계산",
    },
    {
      label: "주민세",
      formula: `소득세 × ${normalizedConfig.residentTaxRate}%`,
      note: `외국인 적용 ${normalizedConfig.applyResidentTaxForForeigners ? "포함" : "제외"}`,
    },
    {
      label: "공제합계 / 실지급액",
      formula: "공제합계 = 모든 공제 합계 / 실지급액 = 지급액 - 공제합계",
      note: "입력 화면과 출력 화면이 동일한 기준표를 사용",
    },
  ];
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

export function calculateNationalPension(
  grossAmount: number,
  config: LaborRateConfig = defaultRateConfig,
  workDays = 0,
) {
  const normalizedConfig = normalizeRateConfig(config);

  if (normalizedConfig.pensionApplyMinDays > 0 && workDays < normalizedConfig.pensionApplyMinDays) {
    return 0;
  }

  const pensionBase = Math.max(0, grossAmount - normalizedConfig.pensionNonTaxableBase);
  const amount = floorWon(pensionBase * percentToRate(normalizedConfig.pensionRate));
  return applyMinMax(amount, normalizedConfig.pensionMinAmount, normalizedConfig.pensionMaxAmount);
}

export function calculateHealthInsurance(grossAmount: number, config: LaborRateConfig = defaultRateConfig) {
  const normalizedConfig = normalizeRateConfig(config);
  return floorWon(Math.max(0, grossAmount) * percentToRate(normalizedConfig.healthRate));
}

export function calculateLongTermCareInsurance(healthInsurance: number, config: LaborRateConfig = defaultRateConfig) {
  const normalizedConfig = normalizeRateConfig(config);
  return floorWon(Math.max(0, healthInsurance) * percentToRate(normalizedConfig.longTermCareRate));
}

export function calculateEmploymentInsurance(
  grossAmount: number,
  config: LaborRateConfig = defaultRateConfig,
  options?: Pick<InsuranceCalculationInput, "residentId" | "targetMonth">,
) {
  const normalizedConfig = normalizeRateConfig(config);
  const isForeigner = isForeignResidentId(options?.residentId);
  const age = getAgeOnMonthEnd(options?.residentId, options?.targetMonth);

  if (!normalizedConfig.applyEmploymentForForeigners && isForeigner) {
    return 0;
  }

  if (!normalizedConfig.applyEmploymentForSenior65 && age !== null && age >= 65) {
    return 0;
  }

  return floorWon(Math.max(0, grossAmount) * percentToRate(normalizedConfig.employmentRate));
}

export function calculateIncomeTax(grossAmount: number, config: LaborRateConfig = defaultRateConfig) {
  const normalizedConfig = normalizeRateConfig(config);
  const taxableBase = Math.max(0, grossAmount - normalizedConfig.incomeTaxNonTaxableBase);
  let amount = floorWon(
    taxableBase *
      percentToRate(normalizedConfig.incomeTaxRate1) *
      percentToRate(normalizedConfig.incomeTaxRate2),
  );

  if (normalizedConfig.truncateIncomeTaxUnderTen) {
    amount = Math.floor(amount / 10) * 10;
  }

  return amount;
}

export function calculateLocalIncomeTax(
  incomeTax: number,
  config: LaborRateConfig = defaultRateConfig,
  options?: Pick<InsuranceCalculationInput, "residentId">,
) {
  const normalizedConfig = normalizeRateConfig(config);

  if (!normalizedConfig.applyResidentTaxForForeigners && isForeignResidentId(options?.residentId)) {
    return 0;
  }

  return floorWon(Math.max(0, incomeTax) * percentToRate(normalizedConfig.residentTaxRate));
}

export function calculateLaborDeductions(
  input: LaborDeductionInput & Pick<InsuranceCalculationInput, "workDays" | "residentId" | "targetMonth">,
  config: LaborRateConfig = defaultRateConfig,
): LaborDeductionBreakdown {
  const grossAmount = Math.max(0, input.grossAmount || 0);
  const nationalPension = calculateNationalPension(grossAmount, config, input.workDays ?? 0);
  const healthInsurance = calculateHealthInsurance(grossAmount, config);
  const longTermCareInsurance = calculateLongTermCareInsurance(healthInsurance, config);
  const employmentInsurance = calculateEmploymentInsurance(grossAmount, config, input);
  const incomeTax = calculateIncomeTax(grossAmount, config);
  const localIncomeTax = calculateLocalIncomeTax(incomeTax, config, input);
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

export function calculateInsurance(
  input: InsuranceCalculationInput,
  config: LaborRateConfig = defaultRateConfig,
): InsuranceBreakdown {
  const normalizedGrossPay = Math.max(0, input.grossPay || 0);
  const normalizedConfig = normalizeRateConfig(config);
  const national = calculateNationalPension(normalizedGrossPay, normalizedConfig, input.workDays ?? 0);
  const health = calculateHealthInsurance(normalizedGrossPay, normalizedConfig);
  const longTermCare = calculateLongTermCareInsurance(health, normalizedConfig);
  const employment = calculateEmploymentInsurance(normalizedGrossPay, normalizedConfig, input);
  const incomeTax = calculateIncomeTax(normalizedGrossPay, normalizedConfig);
  const residentTax = calculateLocalIncomeTax(incomeTax, normalizedConfig, input);
  const totalDeduction = national + health + longTermCare + employment + incomeTax + residentTax;

  return {
    national,
    health,
    longTermCare,
    employment,
    incomeTax,
    residentTax,
    totalDeduction,
    total: totalDeduction,
    netPay: normalizedGrossPay - totalDeduction,
  };
}
