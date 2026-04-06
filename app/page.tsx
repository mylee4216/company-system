"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FocusEvent, type KeyboardEvent } from "react";
import * as XLSX from "xlsx";

import { buildSnapshotNote, calculateInsurance, formatGongsu, getLaborRemark, parseSnapshotNote } from "@/lib/labor";
import { supabase } from "@/lib/supabase";

type CompanyRow = {
  id: number;
  name: string;
  business_number: string | null;
  address: string | null;
};

type SiteRow = {
  id: number;
  name: string;
  company_id: number;
  client_name: string | null;
  contract_type: string | null;
  construction_start_date: string | null;
  construction_end_date: string | null;
  start_date: string | null;
  end_date: string | null;
};

type DailyWorkerRow = {
  id: number;
  name: string;
  daily_wage: number | null;
  phone: string | null;
  resident_number: string | null;
  job_type: string | null;
  company_id: number | null;
  first_work_date: string | null;
};

type WorkEntry = {
  date?: string | null;
  units?: number | null;
  work_days?: number | null;
  row_snapshot?: MonthlyRecordRowSnapshot | null;
};

type MonthlyRecordRowSnapshot = {
  name?: string | null;
  resident_number?: string | null;
  phone?: string | null;
  job_type?: string | null;
  unit_price?: number | null;
  total_work_units?: number | null;
  gross_amount?: number | null;
  note?: string | null;
};

type DailyWorkerMonthlyRecordRow = {
  id: string;
  target_month?: string | null;
  work_entries: WorkEntry[] | null;
  work_dates?: string[] | null;
  total_work_units: number | null;
  worked_days_count: number | null;
  gross_amount: number | null;
  daily_worker_id?: number | null;
  site_id: number | null;
  phone?: string | null;
  resident_number?: string | null;
};

type DailyWorkerMonthlyRecordSavePayload = {
  id?: string;
  daily_worker_id?: number | null;
  site_id: number;
  target_month: string;
  work_dates?: string[];
  work_entries: WorkEntry[];
  total_work_units: number;
  worked_days_count: number;
  gross_amount: number;
};

type DailyWorkEntryMap = Record<string, string>;

type LaborRow = {
  id: string;
  sourceRecordId: string | null;
  sourceWorkerId: number | null;
  name: string;
  residentId: string;
  phone: string;
  trade: string;
  unitPrice: string;
  workUnits: string;
  dailyWorkEntries: DailyWorkEntryMap;
  note: string;
  category: string;
  // Deduction fields
  nationalPension?: string;
  healthInsurance?: string;
  longTermCareInsurance?: string;
  employmentInsurance?: string;
  incomeTax?: string;
  localIncomeTax?: string;
  otherDeductions?: string;
};

type EditableField = "name" | "residentId" | "phone" | "trade" | "unitPrice" | "workUnits" | "note" | "category" | "nationalPension" | "healthInsurance" | "longTermCareInsurance" | "employmentInsurance" | "incomeTax" | "localIncomeTax" | "otherDeductions";
type NumericField = "unitPrice" | "workUnits" | "nationalPension" | "healthInsurance" | "longTermCareInsurance" | "employmentInsurance" | "incomeTax" | "localIncomeTax" | "otherDeductions";
type FocusedNumericCell = {
  rowId: string;
  field: NumericField;
};
type FocusedDailyWorkCell = {
  rowId: string;
  date: string;
};

type UploadedSheetRow = {
  "번호"?: string | number;
  "성명"?: string;
  "주민번호"?: string | number;
  "전화번호"?: string | number;
  "직종"?: string;
  "단가"?: string | number;
  "공수"?: string | number;
  "지급액"?: string | number;
  "비고"?: string;
  "구분"?: string;
};

const EDITABLE_FIELDS: EditableField[] = [
  "name",
  "residentId",
  "phone",
  "trade",
  "unitPrice",
  "workUnits",
  "note",
  "category",
];

const EXCEL_UPLOAD_HEADERS = ["번호", "성명", "주민번호", "전화번호", "직종", "단가", "공수", "지급액", "비고"] as const;

const ALL_CATEGORIES_LABEL = "전체";
const CATEGORY_FILTER_OPTIONS = [ALL_CATEGORIES_LABEL, "직영", "용역", "기타"] as const;
const MAX_DAY_COLUMNS = 31;
const APP_PASSWORD = "leejuu1996!";
const AUTH_STORAGE_KEY = "company-system-authenticated";
const SCREEN_UI_SCALE = 0.68;
const isBrowser = () => typeof window !== "undefined";

function getStoredAuthStatus(): boolean {
  if (!isBrowser()) {
    return false;
  }

  return window.localStorage.getItem(AUTH_STORAGE_KEY) === "true";
}

function setStoredAuthStatus(isAuthenticated: boolean): void {
  if (!isBrowser()) {
    return;
  }

  if (isAuthenticated) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

function runOnNextFrame(callback: () => void): void {
  if (!isBrowser()) {
    callback();
    return;
  }

  window.requestAnimationFrame(callback);
}
const TABLE_COLUMN_BASE_WIDTHS = {
  index: 52,
  trade: 96,
  name: 108,
  phone: 162,
  resident: 150,
  day: 28,
  total: 70,
  unitPrice: 108,
  payment: 98,
  deduction: 88,
  deductionTotal: 98,
  netPay: 104,
  note: 144,
  category: 120,
  actions: 64,
} as const;
const TABLE_COLUMN_WIDTHS = Object.fromEntries(
  Object.entries(TABLE_COLUMN_BASE_WIDTHS).map(([key, value]) => [key, Math.max(20, Math.round(value * SCREEN_UI_SCALE))]),
) as typeof TABLE_COLUMN_BASE_WIDTHS;

function createEmptyRow(id: string, trade = ""): LaborRow {
  return {
    id,
    sourceRecordId: null,
    sourceWorkerId: null,
    name: "",
    residentId: "",
    phone: "",
    trade,
    unitPrice: "",
    workUnits: "",
    dailyWorkEntries: {},
    note: "",
    category: "",
    nationalPension: "",
    healthInsurance: "",
    longTermCareInsurance: "",
    employmentInsurance: "",
    incomeTax: "",
    localIncomeTax: "",
    otherDeductions: "",
  };
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatDateInput(value: string) {
  const digits = onlyDigits(value).slice(0, 8);

  if (digits.length <= 4) {
    return digits;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function formatDateDisplay(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return formatDateInput(value);
}

function formatResidentId(value: string) {
  const digits = onlyDigits(value).slice(0, 13);

  if (digits.length <= 6) {
    return digits;
  }

  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

function formatPhoneNumber(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length < 4) {
    return digits;
  }

  if (digits.length < 8) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function sanitizeDecimal(value: string) {
  const sanitized = value.replace(/[^\d.]/g, "");
  const [integerPart = "", ...decimalParts] = sanitized.split(".");
  const decimalPart = decimalParts.join("");

  if (!sanitized.includes(".")) {
    return integerPart;
  }

  return `${integerPart}.${decimalPart}`;
}

function isBlankDecimal(value: string | null | undefined) {
  return !value || !sanitizeDecimal(value);
}

function parseNumber(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseExcelNumber(value: string | number | null | undefined) {
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

function normalizeUploadedNumericText(value: string | number | null | undefined) {
  const parsed = parseExcelNumber(value);
  return parsed ? String(parsed) : "";
}

function formatIntegerWithCommas(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  const normalizedDigits = digits.replace(/^0+(?=\d)/, "");
  return (normalizedDigits || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatDecimalForDisplay(value: string) {
  const sanitized = sanitizeDecimal(value);

  if (!sanitized || sanitized === ".") {
    return "";
  }

  const hasDecimalPoint = sanitized.includes(".");
  const [integerPart = "", decimalPart = ""] = sanitized.split(".");
  const formattedIntegerPart = formatIntegerWithCommas(integerPart);

  if (!hasDecimalPoint) {
    return formattedIntegerPart;
  }

  if (!decimalPart) {
    return `${formattedIntegerPart}.`;
  }

  return `${formattedIntegerPart}.${decimalPart}`;
}

function formatWorkUnitsWithFixedDecimal(value: string | number | null | undefined) {
  return formatGongsu(value);
}

function formatCurrency(value: number) {
  return Math.round(value).toLocaleString("ko-KR");
}

function normalizeLookupText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getPaymentAmount(row: LaborRow) {
  return parseNumber(row.unitPrice) * getEffectiveWorkUnits(row);
}

function getTotalDeductions(row: LaborRow) {
  const deductions = [
    parseNumber(row.nationalPension),
    parseNumber(row.healthInsurance),
    parseNumber(row.longTermCareInsurance),
    parseNumber(row.employmentInsurance),
    parseNumber(row.incomeTax),
    parseNumber(row.localIncomeTax),
    parseNumber(row.otherDeductions),
  ];
  return deductions.reduce((sum, val) => sum + val, 0);
}

function getNetPayment(row: LaborRow) {
  return getPaymentAmount(row) - getTotalDeductions(row);
}

function getDisplayedWorkUnits(row: LaborRow) {
  if (hasDailyWorkEntries(row.dailyWorkEntries)) {
    return String(getDailyWorkEntriesTotal(row.dailyWorkEntries));
  }

  return row.workUnits;
}

function getDefaultMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getMonthLastDay(targetMonth: string) {
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
    return 0;
  }

  const [year, month] = targetMonth.split("-").map(Number);

  if (!year || !month) {
    return 0;
  }

  return new Date(year, month, 0).getDate();
}

function getMonthPeriod(targetMonth: string) {
  const lastDay = getMonthLastDay(targetMonth);

  if (!lastDay) {
    return {
      startDate: "",
      endDate: "",
      label: "-",
    };
  }

  const startDate = `${targetMonth}-01`;
  const endDate = `${targetMonth}-${String(lastDay).padStart(2, "0")}`;

  return {
    startDate,
    endDate,
    label: `${startDate} ~ ${endDate}`,
  };
}

function getWorkUnitsFromEntries(entries: WorkEntry[] | null) {
  if (!entries) {
    return 0;
  }

  return entries.reduce((sum, entry) => {
    const units = entry.units ?? entry.work_days ?? 0;
    return sum + parseNumber(units);
  }, 0);
}

function getMonthDateList(targetMonth: string) {
  const lastDay = getMonthLastDay(targetMonth);

  if (!lastDay) {
    return [] as string[];
  }

  return Array.from({ length: Math.min(lastDay, MAX_DAY_COLUMNS) }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${targetMonth}-${day}`;
  });
}

function getMonthDayLabel(date: string) {
  const day = Number(date.slice(-2));
  return Number.isFinite(day) ? `${day}일` : date;
}

function getDailyWorkEntriesFromRecord(entries: WorkEntry[] | null, targetMonth: string): DailyWorkEntryMap {
  if (!entries?.length || !targetMonth) {
    return {};
  }

  return entries.reduce<DailyWorkEntryMap>((accumulator, entry) => {
    if (!entry.date || !entry.date.startsWith(`${targetMonth}-`)) {
      return accumulator;
    }

    const units = parseNumber(entry.units ?? entry.work_days);

    if (units <= 0) {
      return accumulator;
    }

    accumulator[entry.date] = String(units);
    return accumulator;
  }, {});
}

function getDailyWorkEntriesTotal(dailyWorkEntries: DailyWorkEntryMap) {
  return Object.values(dailyWorkEntries).reduce((sum, value) => sum + parseNumber(value), 0);
}

function hasDailyWorkEntries(dailyWorkEntries: DailyWorkEntryMap) {
  return Object.values(dailyWorkEntries).some((value) => parseNumber(value) > 0);
}

function getEffectiveWorkUnits(row: LaborRow) {
  if (hasDailyWorkEntries(row.dailyWorkEntries)) {
    return getDailyWorkEntriesTotal(row.dailyWorkEntries);
  }

  return parseNumber(row.workUnits);
}

function getWorkedDaysCount(row: LaborRow) {
  if (hasDailyWorkEntries(row.dailyWorkEntries)) {
    return Object.values(row.dailyWorkEntries).filter((value) => parseNumber(value) > 0).length;
  }

  const workUnits = parseNumber(row.workUnits);
  return workUnits > 0 ? Math.ceil(workUnits) : 0;
}

function getCategoryFilterValue(category: string | null | undefined) {
  const normalized = category?.trim() ?? "";

  if (!normalized) {
    return "";
  }

  if (normalized === "직영" || normalized === "용역") {
    return normalized;
  }

  return "기타";
}

function getMonthlyRecordSnapshot(entries: WorkEntry[] | null) {
  if (!entries) {
    return null;
  }

  for (const entry of entries) {
    if (entry.row_snapshot) {
      return entry.row_snapshot;
    }
  }

  return null;
}

function buildMonthlyRecordWorkEntries(
  row: LaborRow,
  workUnits: number,
  grossAmount: number,
  targetMonth: string,
  workerFirstWorkDate?: string | null,
): WorkEntry[] {
  const remark = getLaborRemark(
    targetMonth,
    workerFirstWorkDate,
    Object.entries(row.dailyWorkEntries).map(([date, units]) => ({
      date,
      units: parseNumber(units),
    })),
  ).text;
  const rowSnapshot = {
    name: row.name.trim() || null,
    resident_number: row.residentId.trim() || null,
    phone: row.phone.trim() || null,
    job_type: row.trade.trim() || null,
    unit_price: parseNumber(row.unitPrice) || null,
    total_work_units: workUnits,
    gross_amount: grossAmount,
    note: buildSnapshotNote(remark, row.category),
  } satisfies MonthlyRecordRowSnapshot;

  const datedEntries = Object.entries(row.dailyWorkEntries)
    .map(([date, units]) => ({
      date,
      units: parseNumber(units),
    }))
    .filter((entry) => entry.units > 0)
    .sort((left, right) => left.date.localeCompare(right.date));

  if (!datedEntries.length) {
    return [
      {
        units: workUnits,
        row_snapshot: rowSnapshot,
      },
    ];
  }

  return datedEntries.map((entry, index) => ({
    date: entry.date,
    units: entry.units,
    row_snapshot: index === 0 ? rowSnapshot : null,
  }));
}

function getTradeLabel(jobType: string | null) {
  const normalized = jobType?.trim();
  return normalized ? normalized : "미분류";
}

function getRecordWorkerId(record: DailyWorkerMonthlyRecordRow) {
  return record.daily_worker_id ?? null;
}

function getMonthlyRecordTextValue(
  record: DailyWorkerMonthlyRecordRow,
  field: "phone" | "resident_number",
) {
  const value = record[field];
  return typeof value === "string" ? value : "";
}

function isFilledRow(row: LaborRow) {
  return (
    [row.name, row.residentId, row.phone, row.trade, row.unitPrice, row.workUnits].some((value) =>
      value.trim(),
    ) || hasDailyWorkEntries(row.dailyWorkEntries)
  );
}

function getFriendlySaveErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (error.message.startsWith("MATCH_WORKER:")) {
    const workerNames = error.message.replace("MATCH_WORKER:", "").trim();
    return `일치하는 근로자 정보를 찾지 못했습니다: ${workerNames}. 성명, 주민번호 또는 전화번호를 확인해 주세요.`;
  }

  if (error.message.includes("schema cache")) {
    return "저장 항목과 DB 컬럼 구성이 맞지 않아 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.";
  }

  return "저장 중 문제가 발생했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.";
}

type SupabaseLikeError = {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

function isSupabaseLikeError(error: unknown): error is SupabaseLikeError {
  if (!error || typeof error !== "object") {
    return false;
  }

  return "message" in error && typeof error.message === "string";
}

function toAppError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return error;
  }

  if (isSupabaseLikeError(error)) {
    const nextError = new Error(error.message || fallbackMessage);
    nextError.cause = error;
    return nextError;
  }

  return new Error(fallbackMessage);
}

function logSupabaseError(context: string, error: unknown, extra?: Record<string, unknown>) {
  if (isSupabaseLikeError(error)) {
    console.error(`[daily_worker_monthly_records:${context}]`, {
      message: error.message,
      details: error.details ?? null,
      hint: error.hint ?? null,
      code: error.code ?? null,
      ...extra,
    });
    return;
  }

  console.error(`[daily_worker_monthly_records:${context}]`, error, extra);
}

async function fetchCompanies() {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, business_number, address")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`회사 정보를 불러오지 못했습니다. ${error.message}`);
  }

  return (data ?? []) as CompanyRow[];
}

async function fetchSites() {
  const { data, error } = await supabase
    .from("sites")
    .select(
      "id, name, company_id, client_name, contract_type, construction_start_date, construction_end_date, start_date, end_date",
    )
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`현장 정보를 불러오지 못했습니다. ${error.message}`);
  }

  return (data ?? []) as SiteRow[];
}

async function fetchDailyWorkers() {
  const { data, error } = await supabase
    .from("daily_workers")
    .select("id, name, daily_wage, phone, resident_number, job_type, company_id, first_work_date")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`근로자 정보를 불러오지 못했습니다. ${error.message}`);
  }

  return (data ?? []) as DailyWorkerRow[];
}

async function fetchDailyWorkerMonthlyRecords(siteId: number, targetMonth: string) {
  const { data, error } = await supabase
    .from("daily_worker_monthly_records")
    .select(
      "id, target_month, work_dates, work_entries, total_work_units, worked_days_count, gross_amount, daily_worker_id, site_id",
    )
    .eq("site_id", siteId)
    .eq("target_month", targetMonth)
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`월별 근로 기록을 불러오지 못했습니다. ${error.message}`);
  }

  return (data ?? []) as DailyWorkerMonthlyRecordRow[];
}

export default function Page() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [dailyWorkers, setDailyWorkers] = useState<DailyWorkerRow[]>([]);
  const [monthlyRecords, setMonthlyRecords] = useState<DailyWorkerMonthlyRecordRow[]>([]);

  const [companyNameInput, setCompanyNameInput] = useState("");
  const [siteNameInput, setSiteNameInput] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(ALL_CATEGORIES_LABEL);
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth);
  const [rows, setRows] = useState<LaborRow[]>([createEmptyRow("manual-1")]);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authStatus, setAuthStatus] = useState<"checking" | "authenticated" | "unauthenticated">("checking");

  const [isLoading, setIsLoading] = useState(true);
  const [isRecordsLoading, setIsRecordsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveWarningMessage, setSaveWarningMessage] = useState("");
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");
  const [focusedNumericCell, setFocusedNumericCell] = useState<FocusedNumericCell | null>(null);
  const [focusedDailyWorkCell, setFocusedDailyWorkCell] = useState<FocusedDailyWorkCell | null>(null);

  const cellRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>>({});
  const dailyCellRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingFocusRef = useRef<{ rowId: string; field: EditableField } | null>(null);
  const excelFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setAuthStatus(getStoredAuthStatus() ? "authenticated" : "unauthenticated");
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setIsLoading(false);
      return;
    }

    let active = true;

    async function loadStatementData() {
      setIsLoading(true);
      setLoadError("");

      try {
        const [nextCompanies, nextSites, nextDailyWorkers] = await Promise.all([
          fetchCompanies(),
          fetchSites(),
          fetchDailyWorkers(),
        ]);

        if (!active) {
          return;
        }

        setCompanies(nextCompanies);
        setSites(nextSites);
        setDailyWorkers(nextDailyWorkers);
      } catch (error) {
        if (!active) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "데이터를 불러오는 중 문제가 발생했습니다.";
        setLoadError(message);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadStatementData();

    return () => {
      active = false;
    };
  }, [authStatus]);

  useEffect(() => {
    if (!companies.length) {
      return;
    }

    if (!companyNameInput.trim()) {
      const defaultCompany = companies[0];
      const defaultSite = sites.find((site) => site.company_id === defaultCompany.id) ?? sites[0];

      setCompanyNameInput(defaultCompany.name);

      if (!siteNameInput.trim() && defaultSite) {
        setSiteNameInput(defaultSite.name);
      }
    }
  }, [companies, companyNameInput, siteNameInput, sites]);

  const matchedCompany = useMemo(() => {
    const normalizedCompanyName = normalizeLookupText(companyNameInput);

    if (!normalizedCompanyName) {
      return null;
    }

    return (
      companies.find((company) => normalizeLookupText(company.name) === normalizedCompanyName) ?? null
    );
  }, [companies, companyNameInput]);

  const siteSearchPool = useMemo(
    () => (matchedCompany ? sites.filter((site) => site.company_id === matchedCompany.id) : sites),
    [matchedCompany, sites],
  );

  useEffect(() => {
    if (!siteNameInput.trim()) {
      const defaultSite = siteSearchPool[0];

      if (defaultSite) {
        setSiteNameInput(defaultSite.name);
      }
    }
  }, [siteNameInput, siteSearchPool]);

  const matchedSite = useMemo(() => {
    const normalizedSiteName = normalizeLookupText(siteNameInput);

    if (!normalizedSiteName) {
      return null;
    }

    return siteSearchPool.find((site) => normalizeLookupText(site.name) === normalizedSiteName) ?? null;
  }, [siteNameInput, siteSearchPool]);

  useEffect(() => {
    const nextCompanyId = matchedCompany?.id ?? matchedSite?.company_id ?? null;

    if (selectedCompanyId !== (nextCompanyId ? String(nextCompanyId) : "")) {
      setSelectedCompanyId(nextCompanyId ? String(nextCompanyId) : "");
    }
  }, [matchedCompany, matchedSite, selectedCompanyId]);

  useEffect(() => {
    const nextSiteId = matchedSite ? String(matchedSite.id) : "";

    if (selectedSiteId !== nextSiteId) {
      setSelectedSiteId(nextSiteId);
    }
  }, [matchedSite, selectedSiteId]);

  const selectedCompany = useMemo(
    () => companies.find((company) => String(company.id) === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );
  const dailyWorkerMap = useMemo(
    () => new Map(dailyWorkers.map((worker) => [worker.id, worker])),
    [dailyWorkers],
  );
  const selectedSite = matchedSite;
  const resolvedCompanyName = companyNameInput.trim() || selectedCompany?.name || "-";
  const resolvedSiteName = siteNameInput.trim() || selectedSite?.name || "-";

  const monthDates = useMemo(() => getMonthDateList(selectedMonth), [selectedMonth]);
  const monthPeriod = useMemo(() => getMonthPeriod(selectedMonth), [selectedMonth]);
  const tableMinWidth = useMemo(
    () =>
      TABLE_COLUMN_WIDTHS.index +
      TABLE_COLUMN_WIDTHS.trade +
      TABLE_COLUMN_WIDTHS.name +
      TABLE_COLUMN_WIDTHS.phone +
      TABLE_COLUMN_WIDTHS.resident +
      TABLE_COLUMN_WIDTHS.day * monthDates.length +
      TABLE_COLUMN_WIDTHS.total +
      TABLE_COLUMN_WIDTHS.unitPrice +
      TABLE_COLUMN_WIDTHS.payment +
      TABLE_COLUMN_WIDTHS.deduction * 6 +
      TABLE_COLUMN_WIDTHS.deductionTotal +
      TABLE_COLUMN_WIDTHS.netPay +
      TABLE_COLUMN_WIDTHS.note +
      TABLE_COLUMN_WIDTHS.category +
      TABLE_COLUMN_WIDTHS.actions,
    [monthDates.length],
  );

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setMonthlyRecords([]);
      setIsRecordsLoading(false);
      return;
    }

    let active = true;

    async function loadMonthlyRecords() {
      if (!selectedSiteId || !selectedMonth) {
        setMonthlyRecords([]);
        return;
      }

      setIsRecordsLoading(true);
      setLoadError("");

      try {
        const nextMonthlyRecords = await fetchDailyWorkerMonthlyRecords(
          parseNumber(selectedSiteId),
          selectedMonth,
        );

        if (!active) {
          return;
        }

        setMonthlyRecords(nextMonthlyRecords);
      } catch (error) {
        if (!active) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "월별 기록을 불러오는 중 문제가 발생했습니다.";
        setLoadError(message);
        setMonthlyRecords([]);
      } finally {
        if (active) {
          setIsRecordsLoading(false);
        }
      }
    }

    void loadMonthlyRecords();

    return () => {
      active = false;
    };
  }, [authStatus, selectedMonth, selectedSiteId]);

  const baseStatementRows = useMemo(() => {
    return monthlyRecords.map((record) => {
      const workerId = getRecordWorkerId(record);
      const worker = workerId ? dailyWorkerMap.get(workerId) : undefined;
      const snapshot = getMonthlyRecordSnapshot(record.work_entries);
      const parsedSnapshotNote = parseSnapshotNote(snapshot?.note);
      const dailyWorkEntries = getDailyWorkEntriesFromRecord(record.work_entries, selectedMonth);
      const summedDailyWorkUnits = getDailyWorkEntriesTotal(dailyWorkEntries);
      const totalWorkUnits =
        summedDailyWorkUnits ||
        parseNumber(record.total_work_units) ||
        parseNumber(snapshot?.total_work_units) ||
        getWorkUnitsFromEntries(record.work_entries);
      const grossAmount = parseNumber(record.gross_amount);
      const unitPrice =
        parseNumber(snapshot?.unit_price) ||
        parseNumber(worker?.daily_wage) ||
        (totalWorkUnits > 0 ? grossAmount / totalWorkUnits : 0);
      const note =
        getLaborRemark(selectedMonth, worker?.first_work_date || null, record.work_entries ?? []).text ||
        parsedSnapshotNote.note;
      const name = snapshot?.name?.trim() || worker?.name || `근로자 #${workerId ?? "-"}`;

      return {
        ...{
        id: `record-${record.id}`,
        sourceRecordId: record.id,
        sourceWorkerId: workerId,
        name: worker?.name ?? `근로자 #${workerId ?? "-"}`,
        residentId: formatResidentId(
          getMonthlyRecordTextValue(record, "resident_number") || worker?.resident_number || "",
        ),
        phone: formatPhoneNumber(getMonthlyRecordTextValue(record, "phone") || worker?.phone || ""),
        trade: getTradeLabel(worker?.job_type ?? null),
        unitPrice: unitPrice ? String(unitPrice) : "",
        workUnits: totalWorkUnits ? String(totalWorkUnits) : "",
        note,
        category: parsedSnapshotNote.category,
        },
        name,
        residentId: formatResidentId(
          snapshot?.resident_number ||
            getMonthlyRecordTextValue(record, "resident_number") ||
            worker?.resident_number ||
            "",
        ),
        phone: formatPhoneNumber(
          snapshot?.phone || getMonthlyRecordTextValue(record, "phone") || worker?.phone || "",
        ),
        trade: getTradeLabel(snapshot?.job_type || worker?.job_type || null),
        dailyWorkEntries,
        note,
        category: parsedSnapshotNote.category,
      } satisfies LaborRow;
    });
  }, [dailyWorkerMap, monthlyRecords, selectedMonth]);

  useEffect(() => {
    if (baseStatementRows.length) {
      setRows(baseStatementRows);
      return;
    }

    setRows([createEmptyRow(`manual-${Date.now()}`)]);
  }, [baseStatementRows]);

  useEffect(() => {
    if (!CATEGORY_FILTER_OPTIONS.some((option) => option === selectedCategoryFilter)) {
      setSelectedCategoryFilter(ALL_CATEGORIES_LABEL);
    }
  }, [selectedCategoryFilter]);

  const visibleRows = useMemo(() => {
    if (selectedCategoryFilter === ALL_CATEGORIES_LABEL) {
      return rows;
    }

    return rows.filter((row) => getCategoryFilterValue(row.category) === selectedCategoryFilter);
  }, [rows, selectedCategoryFilter]);

  const totalWorkUnits = useMemo(
    () => visibleRows.reduce((sum, row) => sum + getEffectiveWorkUnits(row), 0),
    [visibleRows],
  );

  const totalPaymentAmount = useMemo(
    () => visibleRows.reduce((sum, row) => sum + getPaymentAmount(row), 0),
    [visibleRows],
  );

  const getRowInsurance = (row: LaborRow) =>
    calculateInsurance({
      grossPay: getPaymentAmount(row),
    });

  const insuranceTotals = useMemo(
    () =>
      visibleRows.reduce(
        (sum, row) => {
          const insurance = getRowInsurance(row);
          return {
            national: sum.national + insurance.national,
            health: sum.health + insurance.health,
            longTermCare: sum.longTermCare + insurance.longTermCare,
            employment: sum.employment + insurance.employment,
            incomeTax: sum.incomeTax + insurance.incomeTax,
            residentTax: sum.residentTax + insurance.residentTax,
            totalDeduction: sum.totalDeduction + insurance.totalDeduction,
            netPay: sum.netPay + insurance.netPay,
          };
        },
        {
          national: 0,
          health: 0,
          longTermCare: 0,
          employment: 0,
          incomeTax: 0,
          residentTax: 0,
          totalDeduction: 0,
          netPay: 0,
        },
      ),
    [visibleRows],
  );

  const getRowRemark = (row: LaborRow) =>
    getLaborRemark(
      selectedMonth,
      row.sourceWorkerId ? dailyWorkerMap.get(row.sourceWorkerId)?.first_work_date ?? null : null,
      Object.entries(row.dailyWorkEntries).map(([date, units]) => ({
        date,
        units: parseNumber(units),
      })),
    ).text;

  const updateRow = (rowId: string, field: keyof LaborRow, value: string) => {
    setSaveSuccessMessage("");
    setSaveError("");
    setSaveWarningMessage("");

    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        if (field === "residentId") {
          return { ...row, residentId: formatResidentId(value) };
        }

        if (field === "phone") {
          return { ...row, phone: formatPhoneNumber(value) };
        }

        // Numeric fields: unitPrice, workUnits, and all deduction fields
        if (field === "unitPrice" || field === "workUnits" || 
            field === "nationalPension" || field === "healthInsurance" || 
            field === "longTermCareInsurance" || field === "employmentInsurance" || 
            field === "incomeTax" || field === "localIncomeTax" || field === "otherDeductions") {
          return { ...row, [field]: sanitizeDecimal(value) };
        }

        return { ...row, [field]: value };
      }),
    );
  };

  const updateDailyWorkEntry = (rowId: string, date: string, value: string) => {
    setSaveSuccessMessage("");
    setSaveError("");
    setSaveWarningMessage("");

    const sanitizedValue = sanitizeDecimal(value);

    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        const nextDailyWorkEntries = { ...row.dailyWorkEntries };

        if (isBlankDecimal(sanitizedValue)) {
          delete nextDailyWorkEntries[date];
        } else {
          nextDailyWorkEntries[date] = sanitizedValue;
        }

        return {
          ...row,
          dailyWorkEntries: nextDailyWorkEntries,
        };
      }),
    );
  };

  const handleDailyWorkEntryBlur = (rowId: string, date: string) => {
    setFocusedDailyWorkCell((currentCell) => {
      if (currentCell?.rowId === rowId && currentCell.date === date) {
        return null;
      }

      return currentCell;
    });

    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        const currentValue = row.dailyWorkEntries[date];

        if (isBlankDecimal(currentValue) || parseNumber(currentValue) <= 0) {
          const nextDailyWorkEntries = { ...row.dailyWorkEntries };
          delete nextDailyWorkEntries[date];

          return {
            ...row,
            dailyWorkEntries: nextDailyWorkEntries,
          };
        }

        return row;
      }),
    );
  };

  const isFocusedDailyWorkEntry = (rowId: string, date: string) =>
    focusedDailyWorkCell?.rowId === rowId && focusedDailyWorkCell.date === date;

  const getDailyWorkEntryInputValue = (row: LaborRow, date: string) => {
    const rawValue = row.dailyWorkEntries[date] ?? "";

    if (isFocusedDailyWorkEntry(row.id, date)) {
      return rawValue;
    }

    return formatWorkUnitsWithFixedDecimal(rawValue);
  };

  const isFocusedNumericCell = (rowId: string, field: NumericField) =>
    focusedNumericCell?.rowId === rowId && focusedNumericCell.field === field;

  const getNumericInputValue = (row: LaborRow, field: NumericField) => {
    const rawValue = field === "workUnits" ? getDisplayedWorkUnits(row) : row[field];

    if (isFocusedNumericCell(row.id, field)) {
      return rawValue;
    }

    if (field === "unitPrice") {
      return formatIntegerWithCommas(rawValue);
    }

    if (field === "workUnits") {
      return formatWorkUnitsWithFixedDecimal(rawValue);
    }

    return formatDecimalForDisplay(rawValue);
  };

  const handleNumericInputFocus = (
    event: FocusEvent<HTMLInputElement>,
    rowId: string,
    field: NumericField,
  ) => {
    setFocusedNumericCell({ rowId, field });
    runOnNextFrame(() => {
      event.target.select();
    });
  };

  const handleNumericInputBlur = (rowId: string, field: NumericField) => {
    setFocusedNumericCell((currentCell) => {
      if (currentCell?.rowId === rowId && currentCell.field === field) {
        return null;
      }

      return currentCell;
    });
  };

  const focusCell = (rowId: string, field: EditableField) => {
    const target = cellRefs.current[`${rowId}:${field}`];

    if (!target) {
      return;
    }

    target.focus();

    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      target.select();
    }
  };

  const focusDailyCell = (rowId: string, date: string) => {
    const target = dailyCellRefs.current[`${rowId}:${date}`];

    if (!target) {
      return;
    }

    target.focus();
    target.select();
  };

  useEffect(() => {
    const pendingFocus = pendingFocusRef.current;

    if (!pendingFocus) {
      return;
    }

    const target = cellRefs.current[`${pendingFocus.rowId}:${pendingFocus.field}`];

    if (!target) {
      return;
    }

    target.focus();

    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      target.select();
    }

    pendingFocusRef.current = null;
  }, [rows, visibleRows]);

  const addRow = (options?: { focusField?: EditableField }) => {
    const newRowId = `manual-${Date.now()}`;

    if (selectedCategoryFilter !== ALL_CATEGORIES_LABEL) {
      setSelectedCategoryFilter(ALL_CATEGORIES_LABEL);
    }

    setRows((currentRows) => [...currentRows, createEmptyRow(newRowId)]);
    setSaveSuccessMessage("");
    setSaveError("");
    setSaveWarningMessage("");

    if (options?.focusField) {
      pendingFocusRef.current = {
        rowId: newRowId,
        field: options.focusField,
      };
    }

    return newRowId;
  };

  const removeRowAtIndex = (rowIndex: number) => {
    setRows((currentRows) => {
      if (rowIndex < 0 || rowIndex >= currentRows.length) {
        return currentRows;
      }

      return currentRows.filter((_, index) => index !== rowIndex);
    });

    setSaveSuccessMessage("");
    setSaveError("");
    setSaveWarningMessage("");
  };

  const moveFocus = (rowId: string, field: EditableField, direction: "down" | "next" | "previous") => {
    const currentIndex = visibleRows.findIndex((row) => row.id === rowId);

    if (currentIndex < 0) {
      return;
    }

    if (direction === "down") {
      const nextRow = visibleRows[currentIndex + 1];

      if (nextRow) {
        focusCell(nextRow.id, field);
        return;
      }

      addRow({ focusField: field });
      return;
    }

    const currentColumnIndex = EDITABLE_FIELDS.indexOf(field);

    if (currentColumnIndex < 0) {
      return;
    }

    const offset = direction === "previous" ? -1 : 1;
    const targetColumnIndex = currentColumnIndex + offset;

    if (targetColumnIndex >= 0 && targetColumnIndex < EDITABLE_FIELDS.length) {
      focusCell(rowId, EDITABLE_FIELDS[targetColumnIndex]);
      return;
    }

    if (direction === "previous") {
      const previousRow = visibleRows[currentIndex - 1];

      if (previousRow) {
        focusCell(previousRow.id, EDITABLE_FIELDS.at(-1) ?? "note");
      }

      return;
    }

    const nextRow = visibleRows[currentIndex + 1];

    if (nextRow) {
      focusCell(nextRow.id, EDITABLE_FIELDS[0]);
      return;
    }

    addRow({ focusField: EDITABLE_FIELDS[0] });
  };

  const moveDailyFocus = (
    rowId: string,
    date: string,
    direction: "down" | "next" | "previous",
  ) => {
    const currentRowIndex = visibleRows.findIndex((row) => row.id === rowId);
    const currentDateIndex = monthDates.indexOf(date);

    if (currentRowIndex < 0 || currentDateIndex < 0) {
      return;
    }

    if (direction === "down") {
      const nextRow = visibleRows[currentRowIndex + 1];

      if (nextRow) {
        focusDailyCell(nextRow.id, date);
        return;
      }

      const newRowId = addRow();
      runOnNextFrame(() => {
        focusDailyCell(newRowId, date);
      });
      return;
    }

    const nextDateIndex = currentDateIndex + (direction === "previous" ? -1 : 1);

    if (nextDateIndex >= 0 && nextDateIndex < monthDates.length) {
      focusDailyCell(rowId, monthDates[nextDateIndex]);
      return;
    }

    if (direction === "previous") {
      focusCell(rowId, "phone");
      return;
    }

    focusCell(rowId, "workUnits");
  };

  const handleCellKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    rowId: string,
    field: EditableField,
  ) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      moveFocus(rowId, field, "down");
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      moveFocus(rowId, field, event.shiftKey ? "previous" : "next");
    }
  };

  const handleDailyCellKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    rowId: string,
    date: string,
  ) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      moveDailyFocus(rowId, date, "down");
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      moveDailyFocus(rowId, date, event.shiftKey ? "previous" : "next");
    }
  };

  const resolveWorkerId = (row: LaborRow) => {
    if (row.sourceWorkerId) {
      return row.sourceWorkerId;
    }

    const normalizedResidentNumber = onlyDigits(row.residentId);
    const normalizedPhone = onlyDigits(row.phone);
    const normalizedName = row.name.trim();

    const matchedWorker = dailyWorkers.find((worker) => {
      if (selectedCompanyId && String(worker.company_id ?? "") !== selectedCompanyId) {
        return false;
      }

      if (
        normalizedResidentNumber &&
        onlyDigits(worker.resident_number ?? "") === normalizedResidentNumber
      ) {
        return true;
      }

      if (
        normalizedName &&
        normalizedPhone &&
        worker.name.trim() === normalizedName &&
        onlyDigits(worker.phone ?? "") === normalizedPhone
      ) {
        return true;
      }

      return normalizedName ? worker.name.trim() === normalizedName : false;
    });

    return matchedWorker?.id ?? null;
  };

  const reloadMonthlyRecords = async () => {
    if (!selectedSiteId || !selectedMonth) {
      setMonthlyRecords([]);
      return;
    }

    const nextMonthlyRecords = await fetchDailyWorkerMonthlyRecords(
      parseNumber(selectedSiteId),
      selectedMonth,
    );

    setMonthlyRecords(nextMonthlyRecords);
  };

  const handleSave = async () => {
    if (!selectedCompanyId || !selectedSiteId || !selectedMonth) {
      setSaveError("회사명, 현장명, 기준월을 확인해 주세요. 회사명과 현장명은 등록된 마스터와 일치해야 저장 및 조회가 가능합니다.");
      setSaveWarningMessage("");
      setSaveSuccessMessage("");
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveWarningMessage("");
    setSaveSuccessMessage("");

    try {
      const filledRows = rows.filter(isFilledRow);
      const siteId = parseNumber(selectedSiteId);
      const rowsWithWorkerId = filledRows.map((row) => ({
        row,
        workerId: resolveWorkerId(row),
      }));

      const unresolvedRows = rowsWithWorkerId.filter((item) => !item.workerId);

      if (unresolvedRows.length) {
        setSaveWarningMessage(
          `근로자 마스터와 연결되지 않은 행이 있지만 저장은 가능합니다: ${unresolvedRows
            .map(({ row }) => row.name || "(성명 없음)")
            .join(", ")}`,
        );
      }

      const removedRecordIds = monthlyRecords
        .map((record) => record.id)
        .filter((recordId) => !rows.some((row) => row.sourceRecordId === recordId));

      if (removedRecordIds.length) {
        const { error } = await supabase
          .from("daily_worker_monthly_records")
          .delete()
          .in("id", removedRecordIds);

        if (error) {
          logSupabaseError("delete removed rows", error, { removedRecordIds });
          throw toAppError(error, "삭제 대상 정리에 실패했습니다.");
        }
      }

      if (rowsWithWorkerId.length) {
        const workerProfilePayload = new Map<number, Pick<DailyWorkerRow, "phone" | "resident_number">>();

        rowsWithWorkerId.forEach(({ row, workerId }) => {
          if (!workerId) {
            return;
          }

          workerProfilePayload.set(workerId, {
            phone: row.phone.trim() || null,
            resident_number: row.residentId.trim() || null,
          });
        });

        const workerProfileUpdates = Array.from(workerProfilePayload.entries());

        if (workerProfileUpdates.length) {
          const updateResults = await Promise.all(
            workerProfileUpdates.map(([workerId, profile]) =>
              supabase.from("daily_workers").update(profile).eq("id", workerId),
            ),
          );

          const updateFailure = updateResults.find((result) => result.error);

          if (updateFailure?.error) {
            logSupabaseError("update worker profile", updateFailure.error, { workerProfileUpdates });
            throw toAppError(updateFailure.error, "근로자 연락처 정보 저장에 실패했습니다.");
          }

          setDailyWorkers((currentWorkers) =>
            currentWorkers.map((worker) => {
              const nextProfile = workerProfilePayload.get(worker.id);

              if (!nextProfile) {
                return worker;
              }

              return {
                ...worker,
                ...nextProfile,
              };
            }),
          );
        }
      }

      if (rowsWithWorkerId.length) {
        const recordIdByWorkerId = new Map<number, string>();
        const assignedRecordIdByWorkerId = new Map<number, string>();

        monthlyRecords.forEach((record) => {
          const workerId = getRecordWorkerId(record);

          if (workerId && !recordIdByWorkerId.has(workerId)) {
            recordIdByWorkerId.set(workerId, record.id);
          }
        });

        const recordsToUpsert = rowsWithWorkerId.map(({ row, workerId }) => {
          const workUnits = getEffectiveWorkUnits(row);
          const grossAmount = getPaymentAmount(row);
          const workDates = Object.entries(row.dailyWorkEntries)
            .filter(([, units]) => parseNumber(units) > 0)
            .map(([date]) => date)
            .sort((left, right) => left.localeCompare(right));
          let recordId = row.sourceRecordId;

          if (!recordId && workerId) {
            recordId =
              assignedRecordIdByWorkerId.get(workerId) ??
              recordIdByWorkerId.get(workerId) ??
              crypto.randomUUID();
            assignedRecordIdByWorkerId.set(workerId, recordId);
          }

          return {
            id: recordId ?? crypto.randomUUID(),
            daily_worker_id: workerId ?? null,
            site_id: siteId,
            target_month: selectedMonth,
            work_dates: workDates,
            work_entries: buildMonthlyRecordWorkEntries(
              row,
              workUnits,
              grossAmount,
              selectedMonth,
              row.sourceWorkerId ? dailyWorkerMap.get(row.sourceWorkerId)?.first_work_date ?? null : null,
            ),
            total_work_units: workUnits,
            worked_days_count: getWorkedDaysCount(row),
            gross_amount: grossAmount,
          } satisfies DailyWorkerMonthlyRecordSavePayload & { id: string };
        });

        const existingRecordIds = new Set(monthlyRecords.map((record) => record.id));
        const recordsToUpdate = recordsToUpsert.filter((record) => existingRecordIds.has(record.id));
        const recordsToInsert = recordsToUpsert.filter((record) => !existingRecordIds.has(record.id));

        for (const record of recordsToUpdate) {
          const { id, ...updatePayload } = record;
          const { error } = await supabase
            .from("daily_worker_monthly_records")
            .update(updatePayload)
            .eq("id", id);

          if (error) {
            logSupabaseError("update monthly record", error, { recordId: id, updatePayload });
            throw toAppError(error, "기존 노무비 내역 저장에 실패했습니다.");
          }
        }

        if (recordsToInsert.length) {
          const { error } = await supabase
            .from("daily_worker_monthly_records")
            .insert(recordsToInsert);

          if (error) {
            logSupabaseError("insert monthly records", error, { recordsToInsert });
            throw toAppError(error, "신규 노무비 내역 저장에 실패했습니다.");
          }
        }
      }

      await reloadMonthlyRecords();
      setSaveSuccessMessage("저장이 완료되었습니다.");
    } catch (error) {
      logSupabaseError("handleSave catch", error);
      setSaveError(getFriendlySaveErrorMessage(error));
      setSaveSuccessMessage("");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadExcel = () => {
    const exportRows = visibleRows.map((row, index) => [
      index + 1,
      row.name,
      row.residentId,
      row.phone,
      row.trade,
      parseNumber(row.unitPrice),
      getEffectiveWorkUnits(row),
      getPaymentAmount(row),
      getRowRemark(row),
      row.category,
    ]);

    const worksheetData = [
      ["번호", "성명", "주민번호", "전화번호", "직종", "단가", "공수", "지급액", "비고", "구분"],
      ...exportRows,
      ["", "", "", "", "", "합계", totalWorkUnits, totalPaymentAmount, "", ""],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 12 },
      { wch: 10 },
      { wch: 14 },
      { wch: 24 },
      { wch: 16 },
    ];

    const lastRowIndex = worksheetData.length;
    const numericCells = [`F2:F${lastRowIndex}`, `G2:H${lastRowIndex}`];
    numericCells.forEach((range) => {
      const decoded = XLSX.utils.decode_range(range);

      for (let rowIndex = decoded.s.r; rowIndex <= decoded.e.r; rowIndex += 1) {
        for (let colIndex = decoded.s.c; colIndex <= decoded.e.c; colIndex += 1) {
          const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
          const cell = worksheet[cellAddress];

          if (cell && typeof cell.v === "number") {
            cell.z = "#,##0.00";
          }
        }
      }
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "노무비명세서");
    XLSX.writeFile(workbook, `노무비명세서_${selectedMonth || getDefaultMonth()}.xlsx`);
  };

  const resetExcelInput = () => {
    if (excelFileInputRef.current) {
      excelFileInputRef.current.value = "";
    }
  };

  const handleUploadButtonClick = () => {
    resetExcelInput();
    excelFileInputRef.current?.click();
  };

  const handlePrint = () => {
    if (!selectedCompanyId || !selectedSiteId || !selectedMonth) {
      setSaveError("회사명과 현장명, 기준월을 먼저 선택해주세요.");
      return;
    }

    const params = new URLSearchParams({
      companyId: selectedCompanyId,
      siteId: selectedSiteId,
      targetMonth: selectedMonth,
    });
    window.open(`/print?${params.toString()}`, "_blank");
  };

  const handleExcelUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const isXlsxFile =
      file.name.toLowerCase().endsWith(".xlsx") ||
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    if (!isXlsxFile) {
      setSaveError("엑셀(.xlsx) 파일만 업로드할 수 있습니다.");
      setSaveSuccessMessage("");
      resetExcelInput();
      return;
    }

    try {
      const fileBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(fileBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error("INVALID_EXCEL_FORMAT");
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const uploadedRows = XLSX.utils.sheet_to_json<UploadedSheetRow>(worksheet, {
        defval: "",
        raw: false,
      });
      const headerRows = XLSX.utils.sheet_to_json<string[]>(worksheet, {
        header: 1,
        range: 0,
        blankrows: false,
      });
      const normalizedHeaders = (headerRows[0] ?? []).map((header) => String(header).trim());
      const hasRequiredHeaders = EXCEL_UPLOAD_HEADERS.every((header) => normalizedHeaders.includes(header));

      if (!hasRequiredHeaders) {
        throw new Error("INVALID_EXCEL_FORMAT");
      }

      const uploadTimestamp = Date.now();
      const nextRows = uploadedRows
        .map<LaborRow | null>((uploadedRow, index) => {
          const name = String(uploadedRow["성명"] ?? "").trim();
          const residentId = formatResidentId(String(uploadedRow["주민번호"] ?? "").trim());
          const phone = formatPhoneNumber(String(uploadedRow["전화번호"] ?? "").trim());
          const trade = String(uploadedRow["직종"] ?? "").trim();
          const unitPrice = normalizeUploadedNumericText(uploadedRow["단가"]);
          const workUnits = normalizeUploadedNumericText(uploadedRow["공수"]);
          const note = String(uploadedRow["비고"] ?? "").trim();
          const category = String(uploadedRow["구분"] ?? "").trim();
          const amount = parseExcelNumber(uploadedRow["지급액"]);

          const hasContent =
            Boolean(name) ||
            Boolean(residentId) ||
            Boolean(phone) ||
            Boolean(trade) ||
            Boolean(unitPrice) ||
            Boolean(workUnits) ||
            Boolean(note) ||
            Boolean(category) ||
            amount > 0;

          if (!hasContent) {
            return null;
          }

          return {
            id: `upload-${uploadTimestamp}-${index}`,
            sourceRecordId: null,
            sourceWorkerId: null,
            name,
            residentId,
            phone,
            trade,
            unitPrice,
            workUnits,
            dailyWorkEntries: {},
            note,
            category,
          } satisfies LaborRow;
        })
        .filter((row): row is LaborRow => row !== null);

      setRows(nextRows.length ? nextRows : [createEmptyRow(`manual-${uploadTimestamp}`)]);
      setSelectedCategoryFilter(ALL_CATEGORIES_LABEL);
      setFocusedNumericCell(null);
      pendingFocusRef.current = null;
      setSaveError("");
      setSaveWarningMessage("");
      setSaveSuccessMessage("엑셀 업로드 내용이 화면에 반영되었습니다. 검토 후 저장해 주세요.");
    } catch (error) {
      const message =
        error instanceof Error && error.message === "INVALID_EXCEL_FORMAT"
          ? "엑셀 양식을 확인해 주세요."
          : "엑셀 파일을 읽는 중 오류가 발생했습니다.";
      setSaveError(message);
      setSaveWarningMessage("");
      setSaveSuccessMessage("");
    } finally {
      resetExcelInput();
    }
  };

  // Portal style colors and components
  const sectionHeaderClass = "text-lg font-semibold text-slate-900 mb-4";
  const sectionCardClass = "rounded-lg border border-slate-200 bg-white p-5 shadow-sm mb-6";
  const formGroupClass = "mb-4";
  const labelClass = "block text-sm font-medium text-slate-700 mb-2";
  const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  const buttonPrimaryClass = "inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed";
  const buttonSecondaryClass = "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:bg-slate-100 disabled:cursor-not-allowed";

  const sheetInputClass =
    "h-10 w-full min-w-0 border-0 bg-transparent px-1 text-center text-[13px] leading-[1.3] outline-none transition focus:bg-blue-50/50";
  const sheetNumericClass = `${sheetInputClass} whitespace-nowrap tabular-nums`;
  const sheetResidentInputClass =
    "block h-10 w-full min-w-[126px] border-0 bg-transparent px-1 py-[7px] text-center text-[12.5px] leading-[1.15] tracking-[-0.02em] whitespace-nowrap tabular-nums outline-none transition focus:bg-blue-50/50";
  const sheetNoteTextareaClass =
    "block h-10 w-full min-w-0 resize-none border-0 bg-transparent px-1 py-[7px] text-center text-[12.5px] leading-[1.2] text-slate-600 [overflow-wrap:anywhere] outline-none transition focus:bg-blue-50/50";
  const sheetCategoryInputClass =
    "h-10 w-full min-w-0 border-0 bg-transparent px-1 text-center text-[12.5px] leading-[1.3] outline-none transition focus:bg-blue-50/50";
  const dailyEntryInputClass =
    "screen-daily-entry-input block w-full min-w-[32px] whitespace-nowrap border-0 bg-transparent px-0 py-0 text-center font-semibold tabular-nums outline-none transition focus:bg-blue-50/50";
  const workUnitsDisplayCellStyle = {
    verticalAlign: "middle",
    padding: 0,
  } as const;
  const workUnitsDisplayStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    lineHeight: 1,
    textAlign: "center",
    fontSize: "15px",
  } as const;
  const deleteButtonClass =
    "inline-flex h-8 min-w-[48px] shrink-0 items-center justify-center whitespace-nowrap rounded border border-red-200 bg-red-50 px-2 py-0 text-[12px] font-medium leading-none text-red-700 transition hover:border-red-300 hover:bg-red-100";

  const handlePasswordSubmit = () => {
    if (passwordInput === APP_PASSWORD) {
      setStoredAuthStatus(true);
      setAuthError("");
      setPasswordInput("");
      setAuthStatus("authenticated");
      return;
    }

    setStoredAuthStatus(false);
    setAuthError("비밀번호가 올바르지 않습니다.");
    setAuthStatus("unauthenticated");
  };

  const handlePasswordKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handlePasswordSubmit();
    }
  };

  if (authStatus !== "authenticated") {
    return (
      <main className="min-h-screen bg-slate-50 px-3 py-7 text-slate-900">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-sm items-center justify-center">
          <section className="w-full rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
            <div className="space-y-2">
              <h1 className="text-lg font-semibold tracking-[-0.02em] text-slate-900">접근 비밀번호</h1>
              <p className="text-[13px] leading-5 text-slate-600">
                내부 사용 화면입니다. 비밀번호를 입력해야 계속 진행할 수 있습니다.
              </p>
            </div>
            <div className="mt-4 space-y-2.5">
              <input
                type="password"
                value={passwordInput}
                onChange={(event) => {
                  setPasswordInput(event.target.value);
                  if (authError) {
                    setAuthError("");
                  }
                }}
                onKeyDown={handlePasswordKeyDown}
                placeholder="비밀번호 입력"
                autoComplete="current-password"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] outline-none transition focus:border-blue-700 focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handlePasswordSubmit}
                className="h-10 w-full rounded-lg bg-blue-700 text-[13px] font-medium text-white transition hover:bg-blue-600"
              >
                확인
              </button>
              {authStatus === "checking" ? (
                <p className="text-[12px] text-slate-400">접근 상태를 확인하는 중입니다.</p>
              ) : null}
              {authError ? <p className="text-[12px] text-red-600">{authError}</p> : null}
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <>
      <style jsx global>{`
        @media screen {
          .screen-app {
            font-size: 12px;
          }

          .screen-control-panel {
            font-size: 12px !important;
          }

          .screen-control-field {
            padding: 0.4rem 0.55rem !important;
            font-size: 12.5px !important;
            line-height: 1.25 !important;
          }

          .screen-control-input {
            height: 2.1rem !important;
            padding-left: 0.5rem !important;
            padding-right: 0.5rem !important;
            font-size: 12.5px !important;
            line-height: 1.25 !important;
          }

          .screen-status-message,
          .screen-feedback-message {
            padding: 0.4rem 0.55rem !important;
            font-size: 12px !important;
            line-height: 1.35 !important;
          }

          .screen-control-actions {
            gap: 0.4rem !important;
            padding: 0.4rem 0.55rem !important;
          }

          .screen-control-button {
            height: 2.1rem !important;
            padding-left: 0.7rem !important;
            padding-right: 0.7rem !important;
            font-size: 12.5px !important;
          }

          .print-shell {
            box-shadow: 0 10px 24px -24px rgba(15, 23, 42, 0.45) !important;
          }

          .print-shell > header {
            padding: 0.55rem 0.7rem !important;
          }

          .print-shell > footer {
            padding: 0.55rem 0.7rem !important;
          }

          .print-kicker {
            font-size: 9px !important;
            letter-spacing: 0.2em !important;
          }

          .print-title {
            margin-top: 0.1rem !important;
            font-size: 22px !important;
            line-height: 1.02 !important;
          }

          .print-top-summary {
            min-width: 148px !important;
            font-size: 12px !important;
            line-height: 1.25 !important;
          }

          .print-meta-label,
          .print-meta-value,
          .print-summary-label,
          .print-summary-value {
            padding: 0.35rem 0.55rem !important;
            font-size: 12.5px !important;
            line-height: 1.25 !important;
          }

          .print-sheet-table {
            font-size: 12.5px !important;
            line-height: 1.2 !important;
          }

          .print-sheet-table thead th {
            padding: 0.42rem 0.28rem !important;
            font-size: 13.5px !important;
            line-height: 1.15 !important;
          }

          .print-day-header {
            padding-top: 0.3rem !important;
            padding-bottom: 0.3rem !important;
            font-size: 11.5px !important;
          }

          .print-sheet-table tbody td,
          .print-sheet-table tfoot td {
            padding: 0.22rem 0.24rem !important;
            font-size: 12.5px !important;
            line-height: 1.15 !important;
          }

          .print-cell-phone,
          .print-cell-phone input {
            min-width: 106px;
          }

          .print-cell-resident,
          .print-cell-resident textarea {
            min-width: 98px;
          }

          .print-cell-unit-price,
          .print-cell-unit-price input {
            min-width: 72px;
          }

          .print-cell-trade input,
          .print-cell-name input,
          .print-cell-phone input,
          .print-cell-number input,
          .print-cell-category input {
            height: 2rem !important;
            padding-left: 0.2rem !important;
            padding-right: 0.2rem !important;
            font-size: 12.5px !important;
            line-height: 1.15 !important;
          }

          .print-cell-phone input,
          .print-cell-unit-price input,
          .print-cell-number input {
            font-size: 12.75px !important;
          }

          .print-cell-resident textarea,
          .print-cell-note textarea {
            height: 2rem !important;
            padding-top: 0.28rem !important;
            padding-bottom: 0.28rem !important;
            padding-left: 0.2rem !important;
            padding-right: 0.2rem !important;
            font-size: 12px !important;
            line-height: 1.1 !important;
          }

          .print-cell-number .flex {
            gap: 0.1rem !important;
          }

          .print-cell-number p {
            font-size: 10px !important;
            line-height: 1.1 !important;
          }

          .print-cell-actions button {
            height: 1.6rem !important;
            min-width: 40px !important;
            padding-left: 0.4rem !important;
            padding-right: 0.4rem !important;
            font-size: 10.5px !important;
          }

          .screen-daily-entry-cell {
            text-align: center;
            vertical-align: middle !important;
            padding: 0.08rem 0.05rem !important;
          }

          .screen-daily-entry-cell > .screen-daily-entry-input {
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            min-width: 28px !important;
            min-height: 1.7rem !important;
            margin: 0 auto !important;
            padding: 0.14rem 0 !important;
            box-sizing: border-box;
            text-align: center !important;
            text-align-last: center;
            vertical-align: middle;
            font-size: 10.1px !important;
            line-height: 1 !important;
            letter-spacing: -0.01em !important;
          }

          .print-footer-guide {
            font-size: 11.5px !important;
            line-height: 1.35 !important;
          }

          .print-footer-guide .block:last-child {
            line-height: 1.4 !important;
          }

          .print-hidden {
            margin-top: 0.4rem !important;
            font-size: 11.5px !important;
            line-height: 1.45 !important;
          }

          .screen-daily-entry-input::placeholder {
            text-align: center;
          }
        }

        @page {
          size: A4 landscape;
          margin: 7mm;
        }

        @media screen {
          .print-root,
          .print-shell,
          .print-sheet-scroll {
            position: static !important;
            inset: auto !important;
            pointer-events: auto !important;
          }

          .print-cell-note textarea,
          .print-cell-resident textarea {
            resize: none;
          }

          .print-cell-phone input {
            white-space: nowrap;
          }

          .print-sheet-table tbody td {
            text-align: center;
            vertical-align: middle;
          }

          .print-cell-actions {
            text-align: center;
          }

          .print-cell-actions button {
            margin-left: auto;
            margin-right: auto;
          }

          .print-cell-resident {
            text-align: center;
          }

          .print-cell-resident textarea {
            display: block;
            margin: 0 auto;
            text-align: center;
            vertical-align: middle;
            white-space: normal;
            word-break: normal;
            overflow-wrap: break-word;
            hyphens: manual;
          }

          .print-sheet-table {
            table-layout: fixed;
          }

          .print-cell-phone,
          .print-cell-resident,
          .print-cell-unit-price,
          .print-cell-number {
            overflow: visible;
          }

          .print-cell-phone,
          .print-cell-phone input {
            white-space: nowrap;
          }

          .print-cell-resident,
          .print-cell-resident textarea {
            white-space: nowrap;
          }

          .print-cell-unit-price,
          .print-cell-unit-price input {
            white-space: nowrap;
          }

          .print-interactive,
          .print-interactive * {
            pointer-events: auto !important;
          }
        }

        @media print {
          html,
          body {
            background: #ffffff;
            font-size: 9px;
            width: 297mm;
          }

          body * {
            visibility: hidden;
          }

          .print-root,
          .print-root * {
            visibility: visible;
          }

          .print-root {
            position: absolute;
            inset: 0;
            width: 100%;
            max-width: none;
            padding: 0;
            margin: 0;
          }

          .print-shell,
          .print-sheet-scroll {
            overflow: visible !important;
          }

          .print-shell {
            border: 0 !important;
            box-shadow: none !important;
            width: 100% !important;
          }

          main {
            min-height: auto !important;
            background: #ffffff !important;
            padding: 0 !important;
          }

          .print-root,
          .print-shell {
            min-width: 0 !important;
          }

          .print-hidden {
            display: none !important;
          }

          .print-sheet-table {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed;
            font-size: 8.4px;
            line-height: 1.2;
          }

          .print-col-index {
            width: 8mm !important;
          }

          .print-col-trade {
            width: 18mm !important;
          }

          .print-col-name {
            width: 17mm !important;
          }

          .print-col-phone {
            width: 25mm !important;
          }

          .print-col-resident {
            width: 29mm !important;
          }

          .print-col-day {
            width: 4mm !important;
          }

          .print-col-total {
            width: 12mm !important;
          }

          .print-col-unit-price {
            width: 16mm !important;
          }

          .print-col-payment {
            width: 17mm !important;
          }

          .print-col-note {
            width: 0 !important;
          }

          .print-col-category {
            width: 14mm !important;
          }

          .print-col-actions {
            width: 0 !important;
          }

          .print-sheet-table thead {
            display: table-header-group;
          }

          .print-sheet-table tfoot {
            display: table-footer-group;
          }

          .print-sheet-table tr,
          .print-sheet-table td,
          .print-sheet-table th {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .print-sheet-table th,
          .print-sheet-table td {
            padding: 1.4mm 0.8mm !important;
            vertical-align: middle;
            overflow: visible !important;
            font-size: 8.4px !important;
            line-height: 1.2 !important;
            box-sizing: border-box !important;
          }

          .print-cell-actions,
          .print-col-actions,
          .print-cell-note,
          .print-col-note,
          .print-note-header,
          .print-note-summary,
          .print-footer-guide {
            display: none !important;
          }

          .print-footer-grid {
            grid-template-columns: 1.05fr 0.9fr 1fr !important;
          }

          .print-kicker {
            font-size: 8.2px !important;
            line-height: 1.1 !important;
          }

          .print-title {
            font-size: 15.5px !important;
            line-height: 1.1 !important;
          }

          .print-top-summary,
          .print-meta-label,
          .print-meta-value,
          .print-summary-label,
          .print-summary-value,
          .print-sheet-table thead th,
          .print-sheet-table tfoot td {
            font-size: 8.5px !important;
            line-height: 1.2 !important;
          }

          .print-cell-name,
          .print-cell-trade,
          .print-cell-category,
          .print-cell-phone,
          .print-cell-resident,
          .print-cell-date,
          .print-cell-number {
            white-space: nowrap !important;
            word-break: normal !important;
            overflow-wrap: normal !important;
            overflow: visible !important;
            text-overflow: initial !important;
          }

          .print-cell-name,
          .print-cell-trade,
          .print-cell-category,
          .print-cell-phone,
          .print-cell-resident,
          .print-cell-number,
          .print-cell-note {
            font-size: 8.4px !important;
          }

          .print-cell-number {
            text-align: right !important;
            font-variant-numeric: tabular-nums;
          }

          .print-cell-number input,
          .print-cell-unit-price input {
            text-align: right !important;
          }

          .print-cell-trade,
          .print-cell-category,
          .print-cell-name,
          .print-cell-phone,
          .print-cell-resident {
            min-width: 0 !important;
          }

          .print-cell-note,
          .print-meta-value,
          .print-summary-note {
            white-space: normal !important;
            word-break: keep-all !important;
            overflow-wrap: anywhere !important;
          }

          .print-cell-date,
          .print-day-header {
            min-width: 4mm !important;
            width: 4mm !important;
            max-width: 4mm !important;
            text-align: center !important;
          }

          .print-cell-date {
            vertical-align: middle !important;
            padding-top: 0.08rem !important;
            padding-bottom: 0.08rem !important;
          }

          .print-day-header {
            font-size: 7.2px !important;
            font-weight: 700 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }

          .print-cell-phone,
          .print-cell-resident,
          .print-cell-phone input,
          .print-cell-resident input,
          .print-cell-resident textarea {
            white-space: pre-wrap !important;
            word-break: keep-all !important;
            overflow-wrap: normal !important;
            hyphens: manual !important;
            letter-spacing: -0.02em !important;
          }

          .print-cell-phone input {
            font-size: 8px !important;
          }

          .print-cell-resident input {
            font-size: 7.9px !important;
          }

          .print-sheet-table input,
          .print-sheet-table textarea {
            display: block !important;
            border-color: transparent !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            background: transparent !important;
            min-height: 0 !important;
            height: auto !important;
            line-height: inherit !important;
            color: inherit !important;
            box-shadow: none !important;
            overflow: visible !important;
            text-overflow: initial !important;
            width: 100% !important;
            min-width: 0 !important;
            max-width: none !important;
            white-space: nowrap !important;
            font-size: 8.4px !important;
            letter-spacing: -0.015em;
            box-sizing: border-box !important;
          }

          .print-cell-trade input,
          .print-cell-category input,
          .print-cell-name input,
          .print-cell-phone input,
          .print-cell-resident input,
          .print-cell-resident textarea {
            width: 100% !important;
            min-width: 0 !important;
            line-height: 1.15 !important;
          }

          .print-cell-resident textarea {
            white-space: pre-wrap !important;
            word-break: keep-all !important;
            overflow-wrap: normal !important;
            hyphens: manual !important;
            text-align: center !important;
          }

          .print-cell-note input,
          .print-cell-note textarea {
            color: transparent !important;
            caret-color: transparent !important;
            -webkit-text-fill-color: transparent !important;
            text-shadow: none !important;
          }

          .print-cell-note input::placeholder,
          .print-cell-note textarea::placeholder {
            color: transparent !important;
            -webkit-text-fill-color: transparent !important;
          }

          .print-cell-date input {
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            min-height: 1.02rem !important;
            margin: 0 auto !important;
            padding: 0.08rem 0 !important;
            font-size: 7.1px !important;
            font-weight: 600 !important;
            line-height: 1 !important;
            text-align: center !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
        }
      `}</style>
      <main className="screen-app min-h-screen bg-slate-50 px-0 py-0.5 text-slate-900 sm:px-0.5 sm:py-1">
        <div className="print-root mx-auto w-full max-w-none">
          <section className="screen-control-panel print-hidden print-interactive mb-1 border border-slate-300 bg-blue-50 text-[16px] shadow-[0_8px_20px_-16px_rgba(15,23,42,0.45)]">
            <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-[1.1fr_1.1fr_0.8fr_0.8fr]">
              <label className="screen-control-field border-b border-r border-slate-300 px-2 py-2 text-[17px] leading-[1.35]">
                <span className="mb-1 block font-medium text-slate-700">회사명</span>
                <input
                  type="text"
                  className="screen-control-input h-12 w-full border border-slate-300 bg-white px-2.5 text-[17px] leading-[1.35] outline-none transition focus:border-blue-700"
                  value={companyNameInput}
                  onChange={(event) => setCompanyNameInput(event.target.value)}
                  placeholder="회사명 입력"
                />
              </label>
              <label className="screen-control-field border-b border-r border-slate-300 px-2 py-2 text-[17px] leading-[1.35]">
                <span className="mb-1 block font-medium text-slate-700">현장명</span>
                <input
                  type="text"
                  className="screen-control-input h-12 w-full border border-slate-300 bg-white px-2.5 text-[17px] leading-[1.35] outline-none transition focus:border-blue-700"
                  value={siteNameInput}
                  onChange={(event) => setSiteNameInput(event.target.value)}
                  placeholder="현장명 입력"
                />
              </label>
              <label className="screen-control-field border-b border-r border-slate-300 px-2 py-2 text-[17px] leading-[1.35]">
                <span className="mb-1 block font-medium text-slate-700">구분</span>
                <select
                  className="screen-control-input h-12 w-full border border-slate-300 bg-white px-2.5 text-[17px] leading-[1.35] outline-none transition focus:border-blue-700"
                  value={selectedCategoryFilter}
                  onChange={(event) => setSelectedCategoryFilter(event.target.value)}
                >
                  {CATEGORY_FILTER_OPTIONS.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="screen-control-field border-b border-slate-300 px-2 py-2 text-[17px] leading-[1.35] md:border-r xl:border-r-0">
                <span className="mb-1 block font-medium text-slate-700">기준월</span>
                <input
                  type="month"
                  className="screen-control-input h-12 w-full border border-slate-300 bg-white px-2.5 text-[17px] leading-[1.35] outline-none transition focus:border-blue-700"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                />
              </label>
            </div>

            <div className="screen-status-message border-b border-slate-300 px-2 py-2 text-[15px] leading-[1.45] text-slate-600">
              기간: {monthPeriod.label}
            </div>

            <div className="screen-status-message border-b border-slate-300 px-2 py-2 text-[15px] leading-[1.45] text-slate-600">
              {selectedSite
                ? `등록된 현장과 연결됨: ${selectedCompany?.name ?? "-"} / ${selectedSite.name}`
                : "저장 및 기존 내역 조회를 위해 회사명과 현장명을 등록된 이름과 동일하게 입력해 주세요."}
            </div>

            <div className="screen-control-actions flex flex-wrap gap-2 border-b border-slate-300 px-2 py-2">
              <input
                ref={excelFileInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleExcelUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => addRow()}
                className="screen-control-button inline-flex h-12 items-center justify-center border border-blue-700 bg-white px-3.5 text-[17px] leading-none font-medium text-blue-700 transition hover:bg-blue-50"
              >
                행 추가
              </button>
              <button
                type="button"
                onClick={handleDownloadExcel}
                className="screen-control-button inline-flex h-12 items-center justify-center border border-blue-700 bg-white px-3.5 text-[17px] leading-none font-medium text-blue-700 transition hover:bg-blue-50"
              >
                엑셀 다운로드
              </button>
              <button
                type="button"
                onClick={handleUploadButtonClick}
                className="screen-control-button inline-flex h-12 items-center justify-center border border-blue-700 bg-white px-3.5 text-[17px] leading-none font-medium text-blue-700 transition hover:bg-blue-50"
              >
                엑셀 업로드
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="screen-control-button inline-flex h-12 items-center justify-center border border-blue-700 bg-white px-3.5 text-[17px] leading-none font-medium text-blue-700 transition hover:bg-blue-50"
              >
                PDF 출력
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isLoading || isRecordsLoading}
                className="screen-control-button inline-flex h-12 items-center justify-center border border-emerald-700 bg-emerald-700 px-4 text-[17px] leading-none font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:border-emerald-300 disabled:bg-emerald-300"
              >
                {isSaving ? "저장 중..." : "저장"}
                </button>
              </div>

            {loadError ? <p className="screen-feedback-message border-b border-red-200 bg-red-50 px-2 py-2 text-[16px] leading-[1.45] text-red-700">{loadError}</p> : null}
            {saveError ? <p className="screen-feedback-message border-b border-orange-200 bg-orange-50 px-2 py-2 text-[16px] leading-[1.45] text-orange-700">{saveError}</p> : null}
            {saveWarningMessage ? (
              <p className="screen-feedback-message border-b border-orange-200 bg-orange-50 px-2 py-2 text-[16px] leading-[1.45] text-orange-700">{saveWarningMessage}</p>
            ) : null}
            {saveSuccessMessage ? (
              <p className="screen-feedback-message bg-emerald-50 px-2 py-2 text-[16px] leading-[1.45] text-emerald-700">{saveSuccessMessage}</p>
            ) : null}
          </section>

          <section className="print-shell border border-slate-300 bg-white shadow-[0_18px_40px_-30px_rgba(15,23,42,0.45)]">
            <header className="border-b-2 border-blue-700 px-3 py-3 sm:px-4">
              <div className="mb-3 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="print-kicker text-xs tracking-[0.28em] text-stone-500">LABOR STATEMENT</p>
                  <h1 className="print-title mt-1 text-[30px] font-bold tracking-[0.15em] text-slate-900 sm:text-[34px]">노무비 명세서</h1>
                </div>
                <div className="print-top-summary hidden min-w-[220px] border border-blue-200 text-[16px] leading-[1.3] sm:block">
                  <div className="grid min-h-[56px] grid-cols-[68px_1fr]">
                    <div className="flex items-center bg-blue-50 px-2.5 py-2.5 font-semibold">인원수</div>
                    <div className="flex items-center justify-end px-2.5 py-2.5 text-right font-medium tabular-nums">{visibleRows.length}명</div>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[2px] border border-slate-300">
                <div className="grid grid-cols-1 md:grid-cols-2">
                  <div className="grid min-h-[56px] grid-cols-[112px_minmax(0,1fr)] border-b border-slate-200">
                    <div className="print-meta-label flex items-center bg-blue-50 px-3 py-3.5 text-[16.5px] font-semibold leading-[1.4]">회사명</div>
                    <div className="print-meta-value flex min-w-0 items-center px-3 py-3.5 text-[16.5px] leading-[1.4] break-keep">{resolvedCompanyName}</div>
                  </div>
                  <div className="grid min-h-[56px] grid-cols-[112px_minmax(0,1fr)] border-b border-slate-200">
                    <div className="print-meta-label flex items-center bg-blue-50 px-3 py-3.5 text-[16.5px] font-semibold leading-[1.4]">현장명</div>
                    <div className="print-meta-value flex min-w-0 items-center px-3 py-3.5 text-[16.5px] leading-[1.4] break-keep">{resolvedSiteName}</div>
                  </div>
                  <div className="grid min-h-[56px] grid-cols-[112px_minmax(0,1fr)]">
                    <div className="print-meta-label flex items-center bg-blue-50 px-3 py-3.5 text-[16.5px] font-semibold leading-[1.4]">기준월</div>
                    <div className="print-meta-value flex min-w-0 items-center px-3 py-3.5 text-[16.5px] leading-[1.4] break-keep">{selectedMonth || "-"}</div>
                  </div>
                  <div className="grid min-h-[56px] grid-cols-[112px_minmax(0,1fr)]">
                    <div className="print-meta-label flex items-center bg-blue-50 px-3 py-3.5 text-[16.5px] font-semibold leading-[1.4]">기간</div>
                    <div className="print-meta-value flex min-w-0 items-center px-3 py-3.5 text-[16.5px] leading-[1.4] break-keep">{monthPeriod.label}</div>
                  </div>
                </div>
              </div>
            </header>

            <div className="print-sheet-scroll overflow-x-auto">
              <table
                className="print-sheet-table w-full border-collapse text-[16.5px] leading-[1.4]"
                style={{ minWidth: `${tableMinWidth}px` }}
              >
                <colgroup>
                  <col className="print-col-index" style={{ width: `${TABLE_COLUMN_WIDTHS.index}px` }} />
                  <col className="print-col-trade" style={{ width: `${TABLE_COLUMN_WIDTHS.trade}px` }} />
                  <col className="print-col-name" style={{ width: `${TABLE_COLUMN_WIDTHS.name}px` }} />
                  <col className="print-col-phone" style={{ width: `${TABLE_COLUMN_WIDTHS.phone}px` }} />
                  <col className="print-col-resident" style={{ width: `${TABLE_COLUMN_WIDTHS.resident}px` }} />
                  {monthDates.map((date, index) => (
                    <col key={`col-${date ?? `slot-${index + 1}`}`} className="print-col-day" style={{ width: `${TABLE_COLUMN_WIDTHS.day}px` }} />
                  ))}
                  <col className="print-col-total" style={{ width: `${TABLE_COLUMN_WIDTHS.total}px` }} />
                  <col className="print-col-unit-price" style={{ width: `${TABLE_COLUMN_WIDTHS.unitPrice}px` }} />
                  <col className="print-col-payment" style={{ width: `${TABLE_COLUMN_WIDTHS.payment}px` }} />
                  <col className="print-col-deduction" style={{ width: `${TABLE_COLUMN_WIDTHS.deduction}px` }} />
                  <col className="print-col-deduction" style={{ width: `${TABLE_COLUMN_WIDTHS.deduction}px` }} />
                  <col className="print-col-deduction" style={{ width: `${TABLE_COLUMN_WIDTHS.deduction}px` }} />
                  <col className="print-col-deduction" style={{ width: `${TABLE_COLUMN_WIDTHS.deduction}px` }} />
                  <col className="print-col-deduction" style={{ width: `${TABLE_COLUMN_WIDTHS.deduction}px` }} />
                  <col className="print-col-deduction" style={{ width: `${TABLE_COLUMN_WIDTHS.deduction}px` }} />
                  <col className="print-col-deduction-total" style={{ width: `${TABLE_COLUMN_WIDTHS.deductionTotal}px` }} />
                  <col className="print-col-net-pay" style={{ width: `${TABLE_COLUMN_WIDTHS.netPay}px` }} />
                  <col className="print-col-note" style={{ width: `${TABLE_COLUMN_WIDTHS.note}px` }} />
                  <col className="print-col-category" style={{ width: `${TABLE_COLUMN_WIDTHS.category}px` }} />
                  <col className="print-col-actions" style={{ width: `${TABLE_COLUMN_WIDTHS.actions}px` }} />
                </colgroup>
                <thead className="bg-blue-100 text-slate-700">
                  <tr className="border-b border-slate-300">
                    <th colSpan={5} className="border-r border-slate-300 px-2 py-2 text-center text-[15px] font-semibold leading-[1.2]">기본정보</th>
                    <th colSpan={monthDates.length} className="border-r border-slate-300 px-2 py-2 text-center text-[15px] font-semibold leading-[1.2]">일자별 공수</th>
                    <th colSpan={3} className="border-r border-slate-300 px-2 py-2 text-center text-[15px] font-semibold leading-[1.2]">지급</th>
                    <th colSpan={7} className="border-r border-slate-300 px-2 py-2 text-center text-[15px] font-semibold leading-[1.2]">공제</th>
                    <th colSpan={4} className="px-2 py-2 text-center text-[15px] font-semibold leading-[1.2]">정산</th>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <th className="border-r border-slate-300 px-2 py-3 text-center text-[15px] font-semibold leading-[1.2]">번호</th>
                    <th className="border-r border-slate-300 px-2 py-3 text-center text-[15px] font-semibold leading-[1.2]">직종</th>
                    <th className="border-r border-slate-300 px-2 py-3 text-center text-[15px] font-semibold leading-[1.2]">성명</th>
                    <th className="border-r border-slate-300 px-1.5 py-3 text-center text-[15px] font-semibold leading-[1.2]">전화번호</th>
                    <th className="border-r border-slate-300 px-1.5 py-3 text-center text-[15px] font-semibold leading-[1.2] whitespace-nowrap">주민번호</th>
                    {monthDates.map((date, index) => (
                      <th
                        key={date}
                        className="print-day-header border-r border-slate-300 px-0 py-2.5 text-center text-[14px] font-semibold leading-[1] text-slate-700"
                      >
                        {index + 1}
                      </th>
                    ))}
                    <th className="border-r border-slate-300 px-1 py-3 text-center text-[14px] font-semibold leading-[1.15]">총공수</th>
                    <th className="border-r border-slate-300 px-1 py-3 text-center text-[14px] font-semibold leading-[1.15]">단가</th>
                    <th className="border-r border-slate-300 px-1 py-3 text-center text-[14px] font-semibold leading-[1.15]">지급액</th>
                    <th className="border-r border-slate-300 px-1 py-2 text-center text-[13px] font-semibold leading-[1.15]">국민연금</th>
                    <th className="border-r border-slate-300 px-1 py-2 text-center text-[13px] font-semibold leading-[1.15]">건강보험</th>
                    <th className="border-r border-slate-300 px-1 py-2 text-center text-[13px] font-semibold leading-[1.15]">장기요양<br />보험</th>
                    <th className="border-r border-slate-300 px-1 py-2 text-center text-[13px] font-semibold leading-[1.15]">고용보험</th>
                    <th className="border-r border-slate-300 px-1 py-2 text-center text-[13px] font-semibold leading-[1.15]">소득세</th>
                    <th className="border-r border-slate-300 px-1 py-2 text-center text-[13px] font-semibold leading-[1.15]">주민세</th>
                    <th className="border-r border-slate-300 px-1 py-2 text-center text-[13px] font-semibold leading-[1.15]">공제합계</th>
                    <th className="border-r border-slate-300 px-1 py-2 text-center text-[13px] font-semibold leading-[1.15]">실지급액</th>
                    <th className="print-note-header border-r border-slate-300 px-2 py-3 text-center text-[14px] font-semibold leading-[1.15]">비고</th>
                    <th className="border-r border-slate-300 px-2 py-3 text-center text-[14px] font-semibold leading-[1.15]">구분</th>
                    <th className="print-col-actions px-2 py-3 text-center text-[14px] font-semibold leading-[1.15]">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, index) => {
                    const rowIndex = rows.findIndex((currentRow) => currentRow.id === row.id);
                    const rowHasDailyEntries = hasDailyWorkEntries(row.dailyWorkEntries);
                    const insurance = getRowInsurance(row);

                    return (
                      <tr key={row.id} className="border-b border-slate-300 odd:bg-white even:bg-slate-50/30">
                        <td className="border-r border-slate-300 px-2 py-2 align-middle text-center text-[16px] leading-[1.3] tabular-nums">{index + 1}</td>
                        <td className="print-cell-trade border-r border-slate-300 px-1 py-2 align-middle text-center">
                          <input
                            ref={(element) => {
                              cellRefs.current[`${row.id}:trade`] = element;
                            }}
                            value={row.trade}
                            onChange={(event) => updateRow(row.id, "trade", event.target.value)}
                            onKeyDown={(event) => handleCellKeyDown(event, row.id, "trade")}
                            placeholder="직종"
                            className={sheetInputClass}
                          />
                        </td>
                        <td className="print-cell-name border-r border-slate-300 px-1 py-2 align-middle text-center">
                          <input
                            ref={(element) => {
                              cellRefs.current[`${row.id}:name`] = element;
                            }}
                            value={row.name}
                            onChange={(event) => updateRow(row.id, "name", event.target.value)}
                            onKeyDown={(event) => handleCellKeyDown(event, row.id, "name")}
                            placeholder="성명"
                            className={sheetInputClass}
                          />
                        </td>
                        <td className="print-cell-phone border-r border-slate-300 px-1 py-2 align-middle text-center">
                          <input
                            ref={(element) => {
                              cellRefs.current[`${row.id}:phone`] = element;
                            }}
                            value={row.phone}
                            onChange={(event) => updateRow(row.id, "phone", event.target.value)}
                            onKeyDown={(event) => handleCellKeyDown(event, row.id, "phone")}
                            inputMode="numeric"
                            placeholder="010-0000-0000"
                            className={`${sheetInputClass} whitespace-nowrap px-0.5 text-[16px] tracking-[-0.015em]`}
                          />
                        </td>
                        <td className="print-cell-resident border-r border-slate-300 px-0.5 py-2 align-middle text-center">
                          <input
                            ref={(element) => {
                              cellRefs.current[`${row.id}:residentId`] = element;
                            }}
                            value={row.residentId}
                            onChange={(event) => updateRow(row.id, "residentId", event.target.value)}
                            onKeyDown={(event) => handleCellKeyDown(event, row.id, "residentId")}
                            inputMode="numeric"
                            placeholder="000000-0000000"
                            className={sheetResidentInputClass}
                          />
                        </td>
                        {monthDates.map((date) => (
                          <td key={`${row.id}:${date}`} className="screen-daily-entry-cell print-cell-date border-r border-slate-300 px-0.5 py-2 align-middle text-center">
                            <input
                              ref={(element) => {
                                dailyCellRefs.current[`${row.id}:${date}`] = element;
                              }}
                              type="text"
                              value={getDailyWorkEntryInputValue(row, date)}
                              onChange={(event) => updateDailyWorkEntry(row.id, date, event.target.value)}
                              onFocus={() => setFocusedDailyWorkCell({ rowId: row.id, date })}
                              onBlur={() => handleDailyWorkEntryBlur(row.id, date)}
                              onKeyDown={(event) => handleDailyCellKeyDown(event, row.id, date)}
                              inputMode="decimal"
                              autoComplete="off"
                              aria-label={`${getMonthDayLabel(date)} 공수`}
                              className={dailyEntryInputClass}
                            />
                          </td>
                        ))}
                        <td className="print-cell-number border-r border-slate-300 px-1 py-2 align-middle text-center">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <input
                              ref={(element) => {
                                cellRefs.current[`${row.id}:workUnits`] = element;
                              }}
                              type="text"
                              value={getNumericInputValue(row, "workUnits")}
                              onChange={(event) => updateRow(row.id, "workUnits", event.target.value)}
                              onFocus={(event) => handleNumericInputFocus(event, row.id, "workUnits")}
                              onBlur={() => handleNumericInputBlur(row.id, "workUnits")}
                              onKeyDown={(event) => handleCellKeyDown(event, row.id, "workUnits")}
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder="0"
                              readOnly={rowHasDailyEntries}
                              className={`${sheetNumericClass} ${rowHasDailyEntries ? "text-stone-500" : ""}`}
                              style={{ fontSize: "16px", fontWeight: "600" }}
                            />
                            {rowHasDailyEntries ? <p className="text-center text-[13.5px] leading-[1.25] text-stone-400">일자합계</p> : null}
                          </div>
                        </td>
                        <td className="print-cell-unit-price print-cell-number border-r border-slate-300 px-0.5 py-2 align-middle text-center">
                          <input
                            ref={(element) => {
                              cellRefs.current[`${row.id}:unitPrice`] = element;
                            }}
                            type="text"
                            value={getNumericInputValue(row, "unitPrice")}
                            onChange={(event) => updateRow(row.id, "unitPrice", event.target.value)}
                            onFocus={(event) => handleNumericInputFocus(event, row.id, "unitPrice")}
                            onBlur={() => handleNumericInputBlur(row.id, "unitPrice")}
                            onKeyDown={(event) => handleCellKeyDown(event, row.id, "unitPrice")}
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0"
                            className={`${sheetNumericClass} px-0.5 text-[16px]`}
                          />
                        </td>
                        <td className="print-cell-number border-r border-slate-300 bg-blue-50 px-2 py-2 align-middle text-center text-[16.5px] font-medium leading-[1.3] tabular-nums text-slate-800">
                          {formatCurrency(getPaymentAmount(row))}
                        </td>
                        <td className="print-cell-number border-r border-slate-300 px-1 py-2 align-middle text-center text-[15px] leading-[1.3] tabular-nums text-slate-700">
                          {formatCurrency(insurance.national)}
                        </td>
                        <td className="print-cell-number border-r border-slate-300 px-1 py-2 align-middle text-center text-[15px] leading-[1.3] tabular-nums text-slate-700">
                          {formatCurrency(insurance.health)}
                        </td>
                        <td className="print-cell-number border-r border-slate-300 px-1 py-2 align-middle text-center text-[15px] leading-[1.3] tabular-nums text-slate-700">
                          {formatCurrency(insurance.longTermCare)}
                        </td>
                        <td className="print-cell-number border-r border-slate-300 px-1 py-2 align-middle text-center text-[15px] leading-[1.3] tabular-nums text-slate-700">
                          {formatCurrency(insurance.employment)}
                        </td>
                        <td className="print-cell-number border-r border-slate-300 px-1 py-2 align-middle text-center text-[15px] leading-[1.3] tabular-nums text-slate-700">
                          {formatCurrency(insurance.incomeTax)}
                        </td>
                        <td className="print-cell-number border-r border-slate-300 px-1 py-2 align-middle text-center text-[15px] leading-[1.3] tabular-nums text-slate-700">
                          {formatCurrency(insurance.residentTax)}
                        </td>
                        <td className="print-cell-number border-r border-slate-300 bg-slate-50 px-1 py-2 align-middle text-center text-[15px] font-medium leading-[1.3] tabular-nums text-slate-800">
                          {formatCurrency(insurance.totalDeduction)}
                        </td>
                        <td className="print-cell-number border-r border-slate-300 bg-emerald-50 px-1 py-2 align-middle text-center text-[15px] font-medium leading-[1.3] tabular-nums text-slate-800">
                          {formatCurrency(insurance.netPay)}
                        </td>
                        <td className="print-cell-note border-r border-slate-300 px-0.5 py-2 align-middle text-center">
                          <textarea
                            ref={(element) => {
                              cellRefs.current[`${row.id}:note`] = element;
                            }}
                            value={getRowRemark(row)}
                            readOnly
                            onKeyDown={(event) => handleCellKeyDown(event, row.id, "note")}
                            placeholder="비고"
                            rows={2}
                            className={sheetNoteTextareaClass}
                          />
                        </td>
                        <td className="print-cell-category border-r border-slate-300 px-1 py-2 align-middle text-center">
                          <input
                            ref={(element) => {
                              cellRefs.current[`${row.id}:category`] = element;
                            }}
                            value={row.category}
                            onChange={(event) => updateRow(row.id, "category", event.target.value)}
                            onKeyDown={(event) => handleCellKeyDown(event, row.id, "category")}
                            placeholder="직영/용역/기타"
                            list="labor-category-options"
                            className={sheetCategoryInputClass}
                          />
                        </td>
                        <td className="print-cell-actions px-1 py-2 align-middle text-center">
                          <button type="button" aria-label="삭제" onClick={() => removeRowAtIndex(rowIndex)} className={deleteButtonClass}>
                            삭제
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-blue-100">
                  <tr className="border-t-2 border-blue-700">
                    <td colSpan={5 + monthDates.length} className="print-summary-label border-r border-slate-300 px-2 py-3 text-right text-[17px] font-semibold leading-[1.3] text-slate-700">
                      합계
                    </td>
                    <td
                      className="print-summary-value border-r border-slate-300 px-2 py-3 text-center text-[16px] font-semibold leading-[1.3] tabular-nums text-slate-900"
                      style={workUnitsDisplayCellStyle}
                    >
                      <span style={workUnitsDisplayStyle}>{formatGongsu(totalWorkUnits) || "0.0"}</span>
                    </td>
                    <td className="border-r border-slate-300 px-2 py-2"></td>
                    <td className="print-summary-value border-r border-slate-300 px-2 py-3 text-center text-[16px] font-semibold leading-[1.3] tabular-nums text-slate-900">
                      {formatCurrency(totalPaymentAmount)}
                    </td>
                    <td className="print-summary-value border-r border-slate-300 px-1 py-3 text-center text-[14px] font-semibold leading-[1.3] tabular-nums text-slate-900">{formatCurrency(insuranceTotals.national)}</td>
                    <td className="print-summary-value border-r border-slate-300 px-1 py-3 text-center text-[14px] font-semibold leading-[1.3] tabular-nums text-slate-900">{formatCurrency(insuranceTotals.health)}</td>
                    <td className="print-summary-value border-r border-slate-300 px-1 py-3 text-center text-[14px] font-semibold leading-[1.3] tabular-nums text-slate-900">{formatCurrency(insuranceTotals.longTermCare)}</td>
                    <td className="print-summary-value border-r border-slate-300 px-1 py-3 text-center text-[14px] font-semibold leading-[1.3] tabular-nums text-slate-900">{formatCurrency(insuranceTotals.employment)}</td>
                    <td className="print-summary-value border-r border-slate-300 px-1 py-3 text-center text-[14px] font-semibold leading-[1.3] tabular-nums text-slate-900">{formatCurrency(insuranceTotals.incomeTax)}</td>
                    <td className="print-summary-value border-r border-slate-300 px-1 py-3 text-center text-[14px] font-semibold leading-[1.3] tabular-nums text-slate-900">{formatCurrency(insuranceTotals.residentTax)}</td>
                    <td className="print-summary-value border-r border-slate-300 px-1 py-3 text-center text-[14px] font-semibold leading-[1.3] tabular-nums text-slate-900">{formatCurrency(insuranceTotals.totalDeduction)}</td>
                    <td className="print-summary-value border-r border-slate-300 px-1 py-3 text-center text-[14px] font-semibold leading-[1.3] tabular-nums text-slate-900">{formatCurrency(insuranceTotals.netPay)}</td>
                    <td className="print-note-summary border-r border-slate-300 px-2 py-2"></td>
                    <td className="print-summary-value border-r border-slate-300 px-2 py-3 text-center text-[16px] leading-[1.3] text-slate-600">{visibleRows.length}명</td>
                    <td className="print-col-actions px-2 py-2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <datalist id="labor-category-options">
              <option value="직영" />
              <option value="용역" />
              <option value="기타" />
            </datalist>

            <footer className="border-t border-slate-300 px-3 py-3">
              <div className="print-footer-grid grid gap-0 border border-slate-300 md:grid-cols-[1.05fr_0.85fr_0.95fr_0.95fr_0.95fr_1.15fr]">
                <div className="print-summary-label border-b border-r border-slate-300 bg-blue-50 px-3 py-3 text-[17px] font-medium leading-[1.35] text-slate-700 md:border-b-0">하단 요약</div>
                <div className="print-summary-value border-b border-r border-slate-300 px-3 py-3 text-[17px] leading-[1.35] md:border-b-0">
                  총 공수{" "}
                  <span className="whitespace-nowrap float-right font-semibold tabular-nums" style={workUnitsDisplayStyle}>
                    {formatGongsu(totalWorkUnits) || "0.0"}
                  </span>
                </div>
                <div className="print-summary-value border-b border-r border-slate-300 px-3 py-3 text-[17px] leading-[1.35] md:border-b-0">
                  총 지급액 <span className="whitespace-nowrap float-right font-semibold tabular-nums">{formatCurrency(totalPaymentAmount)}</span>
                </div>
                <div className="print-summary-value border-b border-r border-slate-300 px-3 py-3 text-[17px] leading-[1.35] md:border-b-0">
                  총 공제액 <span className="whitespace-nowrap float-right font-semibold tabular-nums">{formatCurrency(insuranceTotals.totalDeduction)}</span>
                </div>
                <div className="print-summary-value border-b border-r border-slate-300 px-3 py-3 text-[17px] leading-[1.35] md:border-b-0">
                  총 실지급액 <span className="whitespace-nowrap float-right font-semibold tabular-nums">{formatCurrency(insuranceTotals.netPay)}</span>
                </div>
                <div className="print-footer-guide print-summary-note px-3 py-3 text-[16px] leading-[1.45] text-slate-600">
                  <span className="mb-1 block font-medium text-slate-700">입력 안내</span>
                  <span className="block leading-6">Enter는 아래 행, Tab은 다음 칸으로 이동합니다. 날짜 칸도 동일하게 이동합니다.</span>
                </div>
              </div>
              <div className="print-hidden mt-2 text-[15px] leading-7 text-slate-500">
                <p>주민번호는 숫자만 입력하면 자동 포맷됩니다.</p>
                <p>전화번호는 숫자만 입력하면 자동 포맷됩니다.</p>
                <p>날짜 칸에 공수를 입력하면 총 공수와 지급액이 즉시 연동됩니다.</p>
                {isLoading ? <p>기초 데이터를 불러오는 중입니다.</p> : null}
                {isRecordsLoading ? <p>월별 저장 내역을 불러오는 중입니다.</p> : null}
                {!isLoading && !baseStatementRows.length ? <p>선택한 조건에 기존 저장 데이터가 없어 새로 입력할 수 있습니다.</p> : null}
              </div>
            </footer>
          </section>
        </div>
      </main>
    </>
  );
}
