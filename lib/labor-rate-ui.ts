import type { LaborRateConfig } from "@/lib/labor";

export const LABOR_RATE_CONFIG_STORAGE_KEY = "company-system-labor-rate-config";

export const RATE_TABLE_SECTIONS: Array<{
  title: string;
  fields: Array<{ key: keyof LaborRateConfig; label: string; suffix?: string; step?: string }>;
}> = [
  {
    title: "소득세",
    fields: [
      { key: "incomeTaxRate1", label: "요율1", suffix: "%", step: "0.01" },
      { key: "incomeTaxRate2", label: "요율2", suffix: "%", step: "0.01" },
      { key: "incomeTaxNonTaxableBase", label: "비과세 기준액", suffix: "원", step: "1" },
      { key: "residentTaxRate", label: "주민세 요율", suffix: "%", step: "0.01" },
    ],
  },
  {
    title: "건강보험",
    fields: [{ key: "healthRate", label: "요율", suffix: "%", step: "0.001" }],
  },
  {
    title: "노인장기요양보험",
    fields: [{ key: "longTermCareRate", label: "요율", suffix: "%", step: "0.01" }],
  },
  {
    title: "국민연금",
    fields: [
      { key: "pensionRate", label: "요율", suffix: "%", step: "0.01" },
      { key: "pensionApplyMinDays", label: "적용 근무일수 기준", suffix: "일", step: "1" },
      { key: "pensionNonTaxableBase", label: "비과세 기준액", suffix: "원", step: "1" },
      { key: "pensionMinAmount", label: "하한액", suffix: "원", step: "1" },
      { key: "pensionMaxAmount", label: "상한액", suffix: "원", step: "1" },
    ],
  },
  {
    title: "고용보험",
    fields: [{ key: "employmentRate", label: "요율", suffix: "%", step: "0.01" }],
  },
];

export const RATE_OPTION_FIELDS: Array<{ key: keyof LaborRateConfig; label: string; description: string }> = [
  { key: "truncateIncomeTaxUnderTen", label: "소득세 10원 미만 절사", description: "소득세 계산 후 10원 미만을 절사합니다." },
  { key: "applyEmploymentForSenior65", label: "65세 이상 고용보험 적용", description: "주민번호로 65세 이상을 판별해 고용보험 적용 여부를 결정합니다." },
  { key: "applyEmploymentForForeigners", label: "외국인 고용보험 적용", description: "외국인 등록번호 패턴인 경우 고용보험 적용 여부를 결정합니다." },
  { key: "applyResidentTaxForForeigners", label: "외국인 지방소득세 적용", description: "외국인 등록번호 패턴인 경우 주민세 적용 여부를 결정합니다." },
];
