"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FocusEvent, type KeyboardEvent } from "react";
import * as XLSX from "xlsx";

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
};

type EditableField = "name" | "residentId" | "phone" | "trade" | "unitPrice" | "workUnits" | "note";
type NumericField = "unitPrice" | "workUnits";
type FocusedNumericCell = {
  rowId: string;
  field: NumericField;
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
};

const EDITABLE_FIELDS: EditableField[] = [
  "name",
  "residentId",
  "phone",
  "trade",
  "unitPrice",
  "workUnits",
  "note",
];

const EXCEL_UPLOAD_HEADERS = ["번호", "성명", "주민번호", "전화번호", "직종", "단가", "공수", "지급액", "비고"] as const;

const ALL_TRADES_LABEL = "전체";
const MAX_DAY_COLUMNS = 31;

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

function formatCurrency(value: number) {
  return Math.round(value).toLocaleString("ko-KR");
}

function getPaymentAmount(row: LaborRow) {
  return parseNumber(row.unitPrice) * getEffectiveWorkUnits(row);
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
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
    return [] as string[];
  }

  const [year, month] = targetMonth.split("-").map(Number);

  if (!year || !month) {
    return [] as string[];
  }

  return Array.from({ length: MAX_DAY_COLUMNS }, (_, index) => {
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

function getLastWorkedDate(entries: WorkEntry[] | null) {
  if (!entries) {
    return "";
  }

  const workedDates = entries
    .filter((entry) => parseNumber(entry.units ?? entry.work_days) > 0 && entry.date)
    .map((entry) => entry.date as string);

  return workedDates.at(-1) ?? "";
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

function buildMonthlyRecordWorkEntries(row: LaborRow, workUnits: number, grossAmount: number): WorkEntry[] {
  const rowSnapshot = {
    name: row.name.trim() || null,
    resident_number: row.residentId.trim() || null,
    phone: row.phone.trim() || null,
    job_type: row.trade.trim() || null,
    unit_price: parseNumber(row.unitPrice) || null,
    total_work_units: workUnits,
    gross_amount: grossAmount,
    note: row.note.trim() || null,
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
    [row.name, row.residentId, row.phone, row.trade, row.unitPrice, row.workUnits, row.note].some((value) =>
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

  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedTradeFilter, setSelectedTradeFilter] = useState(ALL_TRADES_LABEL);
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth);
  const [rows, setRows] = useState<LaborRow[]>([createEmptyRow("manual-1")]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRecordsLoading, setIsRecordsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveWarningMessage, setSaveWarningMessage] = useState("");
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");
  const [focusedNumericCell, setFocusedNumericCell] = useState<FocusedNumericCell | null>(null);

  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const dailyCellRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingFocusRef = useRef<{ rowId: string; field: EditableField } | null>(null);
  const excelFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!companies.length) {
      return;
    }

    const hasSelectedCompany = companies.some((company) => String(company.id) === selectedCompanyId);

    if (!selectedCompanyId || !hasSelectedCompany) {
      setSelectedCompanyId(String(companies[0].id));
    }
  }, [companies, selectedCompanyId]);

  const selectedCompany = useMemo(
    () => companies.find((company) => String(company.id) === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );

  const availableSites = useMemo(
    () => sites.filter((site) => String(site.company_id) === selectedCompanyId),
    [selectedCompanyId, sites],
  );

  useEffect(() => {
    if (!availableSites.length) {
      if (selectedSiteId) {
        setSelectedSiteId("");
      }
      return;
    }

    const hasSelectedSite = availableSites.some((site) => String(site.id) === selectedSiteId);

    if (!selectedSiteId || !hasSelectedSite) {
      setSelectedSiteId(String(availableSites[0].id));
    }
  }, [availableSites, selectedSiteId]);

  const selectedSite = useMemo(
    () => availableSites.find((site) => String(site.id) === selectedSiteId) ?? null,
    [availableSites, selectedSiteId],
  );

  const monthDates = useMemo(() => getMonthDateList(selectedMonth), [selectedMonth]);

  useEffect(() => {
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
  }, [selectedMonth, selectedSiteId]);

  const baseStatementRows = useMemo(() => {
    const workerMap = new Map(dailyWorkers.map((worker) => [worker.id, worker]));

    return monthlyRecords.map((record) => {
      const workerId = getRecordWorkerId(record);
      const worker = workerId ? workerMap.get(workerId) : undefined;
      const snapshot = getMonthlyRecordSnapshot(record.work_entries);
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
      const lastWorkedDate = getLastWorkedDate(record.work_entries);
      const note = snapshot?.note?.trim() || (lastWorkedDate ? `최종 작업일 ${formatDateDisplay(lastWorkedDate)}` : "");
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
        note: lastWorkedDate ? `최종 작업일 ${formatDateDisplay(lastWorkedDate)}` : "",
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
      } satisfies LaborRow;
    });
  }, [dailyWorkers, monthlyRecords, selectedMonth]);

  useEffect(() => {
    if (baseStatementRows.length) {
      setRows(baseStatementRows);
      return;
    }

    setRows([createEmptyRow(`manual-${Date.now()}`)]);
  }, [baseStatementRows]);

  const tradeOptions = useMemo(() => {
    const uniqueTrades = new Set<string>();

    rows.forEach((row) => {
      if (row.trade.trim()) {
        uniqueTrades.add(row.trade);
      }
    });

    return [ALL_TRADES_LABEL, ...Array.from(uniqueTrades).sort((left, right) => left.localeCompare(right))];
  }, [rows]);

  useEffect(() => {
    if (selectedTradeFilter !== ALL_TRADES_LABEL && !tradeOptions.includes(selectedTradeFilter)) {
      setSelectedTradeFilter(ALL_TRADES_LABEL);
    }
  }, [selectedTradeFilter, tradeOptions]);

  const visibleRows = useMemo(() => {
    if (selectedTradeFilter === ALL_TRADES_LABEL) {
      return rows;
    }

    return rows.filter((row) => row.trade === selectedTradeFilter);
  }, [rows, selectedTradeFilter]);

  const totalWorkUnits = useMemo(
    () => visibleRows.reduce((sum, row) => sum + getEffectiveWorkUnits(row), 0),
    [visibleRows],
  );

  const totalPaymentAmount = useMemo(
    () => visibleRows.reduce((sum, row) => sum + getPaymentAmount(row), 0),
    [visibleRows],
  );

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

        if (field === "unitPrice" || field === "workUnits") {
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

  const isFocusedNumericCell = (rowId: string, field: NumericField) =>
    focusedNumericCell?.rowId === rowId && focusedNumericCell.field === field;

  const getNumericInputValue = (row: LaborRow, field: NumericField) => {
    const rawValue = field === "workUnits" ? getDisplayedWorkUnits(row) : row[field];

    if (field === "workUnits" && hasDailyWorkEntries(row.dailyWorkEntries)) {
      return formatDecimalForDisplay(rawValue);
    }

    if (isFocusedNumericCell(row.id, field)) {
      return rawValue;
    }

    if (field === "unitPrice") {
      return formatIntegerWithCommas(rawValue);
    }

    return formatDecimalForDisplay(rawValue);
  };

  const handleNumericInputFocus = (
    event: FocusEvent<HTMLInputElement>,
    rowId: string,
    field: NumericField,
  ) => {
    setFocusedNumericCell({ rowId, field });
    window.requestAnimationFrame(() => {
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
    target.select();
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
    target.select();
    pendingFocusRef.current = null;
  }, [rows, visibleRows]);

  const addRow = (options?: { focusField?: EditableField }) => {
    const newRowId = `manual-${Date.now()}`;

    if (selectedTradeFilter !== ALL_TRADES_LABEL) {
      setSelectedTradeFilter(ALL_TRADES_LABEL);
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
      window.requestAnimationFrame(() => {
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
    event: KeyboardEvent<HTMLInputElement>,
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
      setSaveError("상단에서 회사, 현장, 기준월을 모두 선택해 주세요.");
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
            work_entries: buildMonthlyRecordWorkEntries(row, workUnits, grossAmount),
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
      row.note,
    ]);

    const worksheetData = [
      ["번호", "성명", "주민번호", "전화번호", "직종", "단가", "공수", "지급액", "비고"],
      ...exportRows,
      ["", "", "", "", "", "합계", totalWorkUnits, totalPaymentAmount, ""],
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
    window.print();
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
          const amount = parseExcelNumber(uploadedRow["지급액"]);

          const hasContent =
            Boolean(name) ||
            Boolean(residentId) ||
            Boolean(phone) ||
            Boolean(trade) ||
            Boolean(unitPrice) ||
            Boolean(workUnits) ||
            Boolean(note) ||
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
          } satisfies LaborRow;
        })
        .filter((row): row is LaborRow => row !== null);

      setRows(nextRows.length ? nextRows : [createEmptyRow(`manual-${uploadTimestamp}`)]);
      setSelectedTradeFilter(ALL_TRADES_LABEL);
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

  const sheetInputClass =
    "h-10 w-full min-w-0 border-0 bg-transparent px-1.5 text-[14px] leading-5 outline-none transition focus:bg-amber-50/70";
  const sheetNumericClass = `${sheetInputClass} whitespace-nowrap text-right tabular-nums`;
  const dailyEntryInputClass =
    "h-9 w-full min-w-[42px] border-0 bg-transparent px-0.5 text-center text-[13px] font-medium tabular-nums outline-none transition focus:bg-amber-50/70";
  const deleteButtonClass =
    "inline-flex h-7 items-center justify-center rounded border border-red-200 bg-red-50 px-2 py-0 text-[13px] font-medium text-red-700 transition hover:border-red-300 hover:bg-red-100";

  return (
    <>
      <style jsx global>{`
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

          .print-interactive,
          .print-interactive * {
            pointer-events: auto !important;
          }
        }

        @media print {
          html,
          body {
            background: #ffffff;
            font-size: 10px;
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
            table-layout: auto;
            font-size: 8.6px;
            line-height: 1.24;
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
            padding: 2px 2px !important;
            vertical-align: middle;
            overflow: visible !important;
            font-size: 8.6px !important;
          }

          .print-cell-actions,
          .print-col-actions {
            display: none !important;
          }

          .print-kicker {
            font-size: 9px !important;
          }

          .print-title {
            font-size: 18px !important;
            line-height: 1.1 !important;
          }

          .print-top-summary,
          .print-meta-label,
          .print-meta-value,
          .print-summary-label,
          .print-summary-value,
          .print-sheet-table thead th,
          .print-sheet-table tfoot td {
            font-size: 9px !important;
            line-height: 1.22 !important;
          }

          .print-cell-name,
          .print-cell-trade,
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

          .print-cell-number {
            text-align: right !important;
            font-variant-numeric: tabular-nums;
          }

          .print-cell-trade,
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
            min-width: 12px !important;
            width: 12px !important;
            max-width: 12px !important;
            text-align: center !important;
          }

          .print-day-header {
            font-size: 8.2px !important;
            font-weight: 700 !important;
          }

          .print-sheet-table input {
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
            font-size: 8.6px !important;
            letter-spacing: -0.01em;
          }

          .print-cell-trade input,
          .print-cell-name input,
          .print-cell-phone input,
          .print-cell-resident input {
            width: 100% !important;
            min-width: 0 !important;
            font-size: 8.8px !important;
            letter-spacing: -0.01em;
          }

          .print-cell-note input {
            white-space: normal !important;
            line-height: 1.22 !important;
          }

          .print-cell-date input {
            font-size: 8px !important;
            font-weight: 600 !important;
          }
        }
      `}</style>
      <main className="min-h-screen bg-[#e7e0d2] px-1.5 py-2 text-slate-900 sm:px-2 sm:py-3 lg:px-3">
        <div className="print-root mx-auto w-full max-w-[2160px]">
          <section className="print-hidden print-interactive mb-1.5 border border-stone-400 bg-[#f7f2e7] shadow-[0_8px_20px_-16px_rgba(15,23,42,0.45)]">
            <div className="grid gap-0 md:grid-cols-4 xl:grid-cols-[1.1fr_1.1fr_0.8fr_0.8fr]">
              <label className="border-b border-r border-stone-300 px-3 py-2 text-[15px]">
                <span className="mb-1 block font-medium text-stone-700">상호</span>
                <select
                  className="h-10 w-full border border-stone-300 bg-white px-2 text-[15px] outline-none transition focus:border-stone-700"
                  value={selectedCompanyId}
                  onChange={(event) => setSelectedCompanyId(event.target.value)}
                  disabled={isLoading || !companies.length}
                >
                  {companies.length ? null : <option value="">회사 선택</option>}
                  {companies.map((company) => (
                    <option key={company.id} value={String(company.id)}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="border-b border-r border-stone-300 px-3 py-2 text-[15px]">
                <span className="mb-1 block font-medium text-stone-700">공사명 / 현장명</span>
                <select
                  className="h-10 w-full border border-stone-300 bg-white px-2 text-[15px] outline-none transition focus:border-stone-700"
                  value={selectedSiteId}
                  onChange={(event) => setSelectedSiteId(event.target.value)}
                  disabled={isLoading || !availableSites.length}
                >
                  {availableSites.length ? null : <option value="">현장 선택</option>}
                  {availableSites.map((site) => (
                    <option key={site.id} value={String(site.id)}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="border-b border-r border-stone-300 px-3 py-2 text-[15px]">
                <span className="mb-1 block font-medium text-stone-700">직종 필터</span>
                <select
                  className="h-10 w-full border border-stone-300 bg-white px-2 text-[15px] outline-none transition focus:border-stone-700"
                  value={selectedTradeFilter}
                  onChange={(event) => setSelectedTradeFilter(event.target.value)}
                >
                  {tradeOptions.map((trade) => (
                    <option key={trade} value={trade}>
                      {trade}
                    </option>
                  ))}
                </select>
              </label>
              <label className="border-b border-stone-300 px-3 py-2 text-[15px] md:border-r xl:border-r-0">
                <span className="mb-1 block font-medium text-stone-700">기준월</span>
                <input
                  type="month"
                  className="h-10 w-full border border-stone-300 bg-white px-2 text-[15px] outline-none transition focus:border-stone-700"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-stone-300 px-3 py-2">
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
                className="inline-flex h-10 items-center justify-center border border-stone-700 bg-white px-3 text-[15px] font-medium text-stone-800 transition hover:bg-stone-100"
              >
                행 추가
              </button>
              <button
                type="button"
                onClick={handleDownloadExcel}
                className="inline-flex h-10 items-center justify-center border border-sky-700 bg-white px-3 text-[15px] font-medium text-sky-800 transition hover:bg-sky-50"
              >
                엑셀 다운로드
              </button>
              <button
                type="button"
                onClick={handleUploadButtonClick}
                className="inline-flex h-10 items-center justify-center border border-violet-700 bg-white px-3 text-[15px] font-medium text-violet-800 transition hover:bg-violet-50"
              >
                엑셀 업로드
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex h-10 items-center justify-center border border-slate-700 bg-white px-3 text-[15px] font-medium text-slate-800 transition hover:bg-slate-100"
              >
                PDF 출력
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isLoading || isRecordsLoading}
                className="inline-flex h-10 items-center justify-center border border-emerald-700 bg-emerald-700 px-4 text-[15px] font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:border-emerald-300 disabled:bg-emerald-300"
              >
                {isSaving ? "저장 중..." : "저장"}
              </button>
            </div>

            {selectedCompany ? (
              <div className="border-b border-stone-300 bg-stone-50 px-3 py-2 text-[15px] text-stone-600">
                사업자번호 {selectedCompany.business_number || "-"} / 주소 {selectedCompany.address || "-"}
              </div>
            ) : null}
            {loadError ? <p className="border-b border-red-200 bg-red-50 px-3 py-2 text-[15px] text-red-700">{loadError}</p> : null}
            {saveError ? <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-[15px] text-amber-700">{saveError}</p> : null}
            {saveWarningMessage ? (
              <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-[15px] text-amber-700">{saveWarningMessage}</p>
            ) : null}
            {saveSuccessMessage ? (
              <p className="bg-emerald-50 px-3 py-2 text-[15px] text-emerald-700">{saveSuccessMessage}</p>
            ) : null}
          </section>

          <section className="print-shell border border-stone-500 bg-white shadow-[0_18px_40px_-30px_rgba(15,23,42,0.45)]">
            <header className="border-b-2 border-stone-700 px-3 py-3 sm:px-4">
              <div className="mb-3 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="print-kicker text-xs tracking-[0.28em] text-stone-500">LABOR STATEMENT</p>
                  <h1 className="print-title mt-1 text-[30px] font-bold tracking-[0.15em] text-slate-900 sm:text-[34px]">노무비 명세서</h1>
                </div>
                <div className="print-top-summary hidden min-w-[220px] border border-stone-400 text-[13px] sm:block">
                  <div className="grid grid-cols-[68px_1fr]">
                    <div className="border-b border-r border-stone-300 bg-stone-100 px-2 py-1.5 font-medium">기준월</div>
                    <div className="border-b border-stone-300 px-2 py-1.5 text-right tabular-nums">{selectedMonth || "-"}</div>
                    <div className="border-r border-stone-300 bg-stone-100 px-2 py-1.5 font-medium">인원수</div>
                    <div className="px-2 py-1.5 text-right tabular-nums">{visibleRows.length}명</div>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden border border-stone-400">
                <div className="grid grid-cols-1 border-stone-300 md:grid-cols-2">
                  <div className="grid grid-cols-[112px_minmax(0,1fr)] border-b border-stone-300 md:border-r">
                    <div className="print-meta-label bg-stone-100 px-3 py-2 text-[15px] font-medium">상호</div>
                    <div className="print-meta-value min-w-0 px-3 py-2 text-[15px] break-keep">{selectedCompany?.name || "-"}</div>
                  </div>
                  <div className="grid grid-cols-[112px_minmax(0,1fr)] border-b border-stone-300">
                    <div className="print-meta-label bg-stone-100 px-3 py-2 text-[15px] font-medium">공사명</div>
                    <div className="print-meta-value min-w-0 px-3 py-2 text-[15px] break-keep">{selectedSite?.name || "-"}</div>
                  </div>
                  <div className="grid grid-cols-[112px_minmax(0,1fr)] border-b border-stone-300 md:border-b-0 md:border-r">
                    <div className="print-meta-label bg-stone-100 px-3 py-2 text-[15px] font-medium">현장명</div>
                    <div className="print-meta-value min-w-0 px-3 py-2 text-[15px] break-keep">{selectedSite?.client_name || selectedSite?.name || "-"}</div>
                  </div>
                  <div className="grid grid-cols-[112px_minmax(0,1fr)]">
                    <div className="print-meta-label bg-stone-100 px-3 py-2 text-[15px] font-medium">기간</div>
                    <div className="print-meta-value min-w-0 px-3 py-2 text-[15px] break-keep">
                      {selectedMonth || "-"}
                      {selectedSite?.construction_start_date || selectedSite?.construction_end_date || selectedSite?.start_date || selectedSite?.end_date
                        ? ` / ${formatDateDisplay(selectedSite?.construction_start_date ?? selectedSite?.start_date)} ~ ${formatDateDisplay(selectedSite?.construction_end_date ?? selectedSite?.end_date)}`
                        : ""}
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <div className="print-sheet-scroll overflow-x-auto">
              <table
                className="print-sheet-table w-full border-collapse text-[14px]"
                style={{ minWidth: `${1116 + MAX_DAY_COLUMNS * 42}px` }}
              >
                <colgroup>
                  <col style={{ width: "52px" }} />
                  <col style={{ width: "112px" }} />
                  <col style={{ width: "132px" }} />
                  <col style={{ width: "172px" }} />
                  <col style={{ width: "184px" }} />
                  {monthDates.map((date, index) => (
                    <col key={`col-${date ?? `slot-${index + 1}`}`} style={{ width: "42px" }} />
                  ))}
                  <col style={{ width: "92px" }} />
                  <col style={{ width: "112px" }} />
                  <col style={{ width: "132px" }} />
                  <col style={{ width: "130px" }} />
                  <col style={{ width: "70px" }} />
                </colgroup>
                <thead className="bg-[#f3ede1] text-stone-700">
                  <tr className="border-b border-stone-400">
                    <th rowSpan={2} className="border-r border-stone-300 px-2 py-2 text-center font-semibold">번호</th>
                    <th rowSpan={2} className="border-r border-stone-300 px-2 py-2 text-center font-semibold">직종</th>
                    <th rowSpan={2} className="border-r border-stone-300 px-2 py-2 text-center font-semibold">성명</th>
                    <th rowSpan={2} className="border-r border-stone-300 px-2 py-2 text-center font-semibold">전화번호</th>
                    <th rowSpan={2} className="border-r border-stone-300 px-2 py-2 text-center font-semibold">주민번호</th>
                    <th colSpan={MAX_DAY_COLUMNS} className="border-r border-stone-300 px-2 py-2 text-center font-semibold">일자별 공수</th>
                    <th rowSpan={2} className="border-r border-stone-300 px-2 py-2 text-center font-semibold">총 공수</th>
                    <th rowSpan={2} className="border-r border-stone-300 px-2 py-2 text-center font-semibold">단가</th>
                    <th rowSpan={2} className="border-r border-stone-300 px-2 py-2 text-center font-semibold">지급액</th>
                    <th rowSpan={2} className="border-r border-stone-300 px-2 py-2 text-center font-semibold">비고</th>
                    <th rowSpan={2} className="print-col-actions px-2 py-2 text-center font-semibold">관리</th>
                  </tr>
                  <tr className="border-b border-stone-400">
                    {monthDates.map((date, index) => (
                      <th
                        key={date}
                        className="print-day-header border-r border-stone-300 px-0.5 py-1.5 text-center text-sm font-semibold text-stone-800"
                      >
                        {index + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, index) => {
                    const rowIndex = rows.findIndex((currentRow) => currentRow.id === row.id);
                    const rowHasDailyEntries = hasDailyWorkEntries(row.dailyWorkEntries);

                    return (
                      <tr key={row.id} className="border-b border-stone-300 align-middle odd:bg-white even:bg-stone-50/30">
                        <td className="border-r border-stone-300 px-2 py-1.5 text-center text-sm tabular-nums">{index + 1}</td>
                        <td className="print-cell-trade border-r border-stone-300 px-1 py-1">
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
                        <td className="print-cell-name border-r border-stone-300 px-1 py-1">
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
                        <td className="print-cell-phone border-r border-stone-300 px-1 py-1">
                          <input
                            ref={(element) => {
                              cellRefs.current[`${row.id}:phone`] = element;
                            }}
                            value={row.phone}
                            onChange={(event) => updateRow(row.id, "phone", event.target.value)}
                            onKeyDown={(event) => handleCellKeyDown(event, row.id, "phone")}
                            inputMode="numeric"
                            placeholder="010-0000-0000"
                            className={sheetInputClass}
                          />
                        </td>
                        <td className="print-cell-resident border-r border-stone-300 px-1 py-1">
                          <input
                            ref={(element) => {
                              cellRefs.current[`${row.id}:residentId`] = element;
                            }}
                            value={row.residentId}
                            onChange={(event) => updateRow(row.id, "residentId", event.target.value)}
                            onKeyDown={(event) => handleCellKeyDown(event, row.id, "residentId")}
                            inputMode="numeric"
                            placeholder="000000-0000000"
                            className={sheetInputClass}
                          />
                        </td>
                        {monthDates.map((date) => (
                          <td key={`${row.id}:${date}`} className="print-cell-date border-r border-stone-300 px-0.5 py-1">
                            <input
                              ref={(element) => {
                                dailyCellRefs.current[`${row.id}:${date}`] = element;
                              }}
                              type="text"
                              value={row.dailyWorkEntries[date] ?? ""}
                              onChange={(event) => updateDailyWorkEntry(row.id, date, event.target.value)}
                              onBlur={() => handleDailyWorkEntryBlur(row.id, date)}
                              onKeyDown={(event) => handleDailyCellKeyDown(event, row.id, date)}
                              inputMode="decimal"
                              autoComplete="off"
                              aria-label={`${getMonthDayLabel(date)} 공수`}
                              className={dailyEntryInputClass}
                            />
                          </td>
                        ))}
                        <td className="print-cell-number border-r border-stone-300 px-1.5 py-1">
                          <div className="space-y-0.5">
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
                            />
                            {rowHasDailyEntries ? <p className="text-[11px] text-stone-400">일자합계</p> : null}
                          </div>
                        </td>
                        <td className="print-cell-number border-r border-stone-300 px-1.5 py-1">
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
                            className={sheetNumericClass}
                          />
                        </td>
                        <td className="print-cell-number border-r border-stone-300 bg-stone-50 px-2 py-1 text-right font-medium tabular-nums text-slate-800">
                          {formatCurrency(getPaymentAmount(row))}
                        </td>
                        <td className="print-cell-note border-r border-stone-300 px-1 py-1">
                          <input
                            ref={(element) => {
                              cellRefs.current[`${row.id}:note`] = element;
                            }}
                            value={row.note}
                            onChange={(event) => updateRow(row.id, "note", event.target.value)}
                            onKeyDown={(event) => handleCellKeyDown(event, row.id, "note")}
                            placeholder="비고"
                            className={sheetInputClass}
                          />
                        </td>
                        <td className="print-cell-actions px-1 py-1">
                          <button type="button" aria-label="삭제" onClick={() => removeRowAtIndex(rowIndex)} className={deleteButtonClass}>
                            삭제
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-[#f3ede1]">
                  <tr className="border-t-2 border-stone-500">
                    <td colSpan={5 + MAX_DAY_COLUMNS} className="print-summary-label border-r border-stone-300 px-2 py-2 text-right text-[15px] font-semibold text-stone-700">
                      합계
                    </td>
                    <td className="print-summary-value border-r border-stone-300 px-2 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {totalWorkUnits.toLocaleString("ko-KR")}
                    </td>
                    <td className="border-r border-stone-300 px-2 py-2"></td>
                    <td className="print-summary-value border-r border-stone-300 px-2 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {formatCurrency(totalPaymentAmount)}
                    </td>
                    <td className="print-summary-value border-r border-stone-300 px-2 py-2 text-[15px] text-stone-600">{visibleRows.length}명</td>
                    <td className="print-col-actions px-2 py-2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <footer className="border-t border-stone-400 px-3 py-3">
              <div className="grid gap-0 border border-stone-300 md:grid-cols-[1.05fr_0.9fr_1fr_1.35fr]">
                <div className="print-summary-label border-b border-r border-stone-300 bg-stone-100 px-3 py-2 text-[15px] font-medium text-stone-700 md:border-b-0">하단 요약</div>
                <div className="print-summary-value border-b border-r border-stone-300 px-3 py-2 text-[15px] md:border-b-0">
                  총 공수 <span className="whitespace-nowrap float-right font-semibold tabular-nums">{totalWorkUnits.toLocaleString("ko-KR")}</span>
                </div>
                <div className="print-summary-value border-b border-r border-stone-300 px-3 py-2 text-[15px] md:border-b-0">
                  총 지급액 <span className="whitespace-nowrap float-right font-semibold tabular-nums">{formatCurrency(totalPaymentAmount)}</span>
                </div>
                <div className="print-summary-note px-3 py-2 text-[15px] text-stone-600">
                  <span className="mb-1 block font-medium text-stone-700">입력 안내</span>
                  <span className="block leading-5">Enter는 아래 행, Tab은 다음 칸으로 이동합니다. 날짜 칸도 동일하게 이동합니다.</span>
                </div>
              </div>
              <div className="print-hidden mt-2 text-[13px] leading-6 text-stone-500">
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
