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
  daily_worker_id: number;
  site_id: number;
  target_month: string;
  work_entries: WorkEntry[];
  total_work_units: number;
  worked_days_count: number;
  gross_amount: number;
};

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
  note: string;
};

type EditableField = "name" | "residentId" | "phone" | "trade" | "unitPrice" | "workUnits" | "note";
type NumericField = "unitPrice" | "workUnits";
type FocusedNumericCell = {
  rowId: string;
  field: NumericField;
};

type UploadedSheetRow = {
  번호?: string | number;
  성명?: string;
  주민번호?: string | number;
  전화번호?: string | number;
  직종?: string;
  단가?: string | number;
  공수?: string | number;
  지급액?: string | number;
  비고?: string;
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
const FALLBACK_TRADE = "미분류";

function createEmptyRow(id: string, trade = FALLBACK_TRADE): LaborRow {
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
  return parseNumber(row.unitPrice) * parseNumber(row.workUnits);
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

function getLastWorkedDate(entries: WorkEntry[] | null) {
  if (!entries) {
    return "";
  }

  const workedDates = entries
    .filter((entry) => parseNumber(entry.units ?? entry.work_days) > 0 && entry.date)
    .map((entry) => entry.date as string);

  return workedDates.at(-1) ?? "";
}

function getTradeLabel(jobType: string | null) {
  const normalized = jobType?.trim();
  return normalized ? normalized : FALLBACK_TRADE;
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
  return [row.name, row.residentId, row.phone, row.trade, row.unitPrice, row.workUnits, row.note].some(
    (value) => value.trim(),
  );
}

function getFriendlySaveErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (error.message.startsWith("MATCH_WORKER:")) {
    const workerNames = error.message.replace("MATCH_WORKER:", "").trim();
    return `일치하는 근로자 정보를 찾을 수 없는 항목이 있습니다: ${workerNames}. 성명, 주민번호 또는 전화번호를 확인해 주세요.`;
  }

  if (error.message.includes("schema cache")) {
    return "DB 스키마 정보가 아직 반영되지 않았습니다. 잠시 후 새로고침한 뒤 다시 시도해 주세요.";
  }

  return "저장 중 문제가 발생했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.";
}

async function fetchCompanies() {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, business_number, address")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`회사 정보를 불러오지 못했습니다: ${error.message}`);
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
    throw new Error(`현장 정보를 불러오지 못했습니다: ${error.message}`);
  }

  return (data ?? []) as SiteRow[];
}

async function fetchDailyWorkers() {
  const { data, error } = await supabase
    .from("daily_workers")
    .select("id, name, daily_wage, phone, resident_number, job_type, company_id, first_work_date")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`근로자 정보를 불러오지 못했습니다: ${error.message}`);
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
    throw new Error(`월별 근로 기록을 불러오지 못했습니다: ${error.message}`);
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
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");
  const [focusedNumericCell, setFocusedNumericCell] = useState<FocusedNumericCell | null>(null);

  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});
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
      const totalWorkUnits =
        parseNumber(record.total_work_units) || getWorkUnitsFromEntries(record.work_entries);
      const grossAmount = parseNumber(record.gross_amount);
      const unitPrice =
        parseNumber(worker?.daily_wage) || (totalWorkUnits > 0 ? grossAmount / totalWorkUnits : 0);
      const lastWorkedDate = getLastWorkedDate(record.work_entries);

      return {
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
      } satisfies LaborRow;
    });
  }, [dailyWorkers, monthlyRecords]);

  useEffect(() => {
    if (baseStatementRows.length) {
      setRows(baseStatementRows);
      return;
    }

    const defaultTrade =
      selectedTradeFilter !== ALL_TRADES_LABEL ? selectedTradeFilter : getTradeLabel(null);
    setRows([createEmptyRow(`manual-${Date.now()}`, defaultTrade)]);
  }, [baseStatementRows, selectedTradeFilter]);

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
    () => visibleRows.reduce((sum, row) => sum + parseNumber(row.workUnits), 0),
    [visibleRows],
  );

  const totalPaymentAmount = useMemo(
    () => visibleRows.reduce((sum, row) => sum + getPaymentAmount(row), 0),
    [visibleRows],
  );

  const updateRow = (rowId: string, field: keyof LaborRow, value: string) => {
    setSaveSuccessMessage("");
    setSaveError("");

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

  const isFocusedNumericCell = (rowId: string, field: NumericField) =>
    focusedNumericCell?.rowId === rowId && focusedNumericCell.field === field;

  const getNumericInputValue = (row: LaborRow, field: NumericField) => {
    const rawValue = row[field];

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

  const addRow = (options?: { focusField?: EditableField; trade?: string }) => {
    const trade =
      options?.trade?.trim() ||
      (selectedTradeFilter !== ALL_TRADES_LABEL ? selectedTradeFilter : tradeOptions[1] ?? FALLBACK_TRADE);
    const newRowId = `manual-${Date.now()}`;

    setRows((currentRows) => [...currentRows, createEmptyRow(newRowId, trade)]);
    setSaveSuccessMessage("");
    setSaveError("");

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

      const currentRow = visibleRows[currentIndex];
      addRow({ focusField: field, trade: currentRow?.trade });
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

    const currentRow = visibleRows[currentIndex];
    addRow({ focusField: EDITABLE_FIELDS[0], trade: currentRow?.trade });
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
      setSaveError("저장 전에 회사, 현장, 기준월을 모두 선택해 주세요.");
      setSaveSuccessMessage("");
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveSuccessMessage("");

    try {
      const filledRows = rows.filter(isFilledRow);

      const rowsWithWorkerId = filledRows.map((row) => ({
        row,
        workerId: resolveWorkerId(row),
      }));

      const unresolvedRows = rowsWithWorkerId.filter((item) => !item.workerId);

      if (unresolvedRows.length) {
        throw new Error(
          `MATCH_WORKER:${unresolvedRows.map(({ row }) => row.name || "(성명 없음)").join(", ")}`,
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
          throw new Error(error.message);
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

          const updateError = updateResults.find((result) => result.error)?.error;

          if (updateError) {
            throw new Error(updateError.message);
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
        const payload: DailyWorkerMonthlyRecordSavePayload[] = rowsWithWorkerId.map(
          ({ row, workerId }) => {
            const workUnits = parseNumber(row.workUnits);
            const amount = getPaymentAmount(row);

            return {
              id: row.sourceRecordId ?? undefined,
              daily_worker_id: workerId!,
              site_id: parseNumber(selectedSiteId),
              target_month: selectedMonth,
              work_entries: workUnits > 0 ? [{ units: workUnits }] : [],
              total_work_units: workUnits,
              gross_amount: amount,
              worked_days_count: workUnits > 0 ? Math.ceil(workUnits) : 0,
            };
          },
        );

        const { error } = await supabase
          .from("daily_worker_monthly_records")
          .upsert(payload, { onConflict: "daily_worker_id,site_id,target_month" });

        if (error) {
          throw new Error(error.message);
        }
      }

      await reloadMonthlyRecords();
      setSaveSuccessMessage("저장이 완료되었습니다.");
    } catch (error) {
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
      parseNumber(row.workUnits),
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
            trade: trade || FALLBACK_TRADE,
            unitPrice,
            workUnits,
            note,
          } satisfies LaborRow;
        })
        .filter((row): row is LaborRow => row !== null);

      setRows(nextRows.length ? nextRows : [createEmptyRow(`manual-${uploadTimestamp}`)]);
      setSelectedTradeFilter(ALL_TRADES_LABEL);
      setFocusedNumericCell(null);
      pendingFocusRef.current = null;
      setSaveError("");
      setSaveSuccessMessage("엑셀 업로드 내용을 화면에 반영했습니다. 검토 후 저장해 주세요.");
    } catch (error) {
      const message =
        error instanceof Error && error.message === "INVALID_EXCEL_FORMAT"
          ? "엑셀 양식을 확인하세요."
          : "엑셀 파일을 읽는 중 오류가 발생했습니다.";
      setSaveError(message);
      setSaveSuccessMessage("");
    } finally {
      resetExcelInput();
    }
  };

  const sheetInputClass =
    "h-9 w-full border border-stone-200 bg-white px-2 text-sm outline-none transition focus:border-stone-700";
  const sheetNumericClass = `${sheetInputClass} text-right tabular-nums`;
  const deleteButtonClass =
    "inline-flex h-7 items-center justify-center rounded border border-red-200 bg-red-50 px-2 py-0 text-xs font-medium text-transparent transition hover:border-red-300 hover:bg-red-100 before:text-red-700 before:content-['삭제']";

  return (
    <main className="min-h-screen bg-[#f3f0e8] px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
      <div className="mx-auto w-full max-w-[1500px]">
        <section className="border border-stone-400 bg-white shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)]">
          <header className="border-b-2 border-stone-700 px-4 py-4 sm:px-6">
  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
        노무비 명세서
      </p>
      <h1 className="text-2xl font-bold tracking-[0.12em] text-slate-900 sm:text-3xl">
        노무비 명세서
      </h1>
      <p className="text-sm leading-6 text-stone-600">
        회사, 현장, 기준월을 선택하고 월별 노무비 내역을 입력하거나 검토할 수 있습니다.
      </p>
    </div>

    <div className="grid min-w-[280px] grid-cols-2 border border-stone-400 text-sm">
      <div className="border-b border-r border-stone-300 bg-stone-100 px-3 py-2 font-medium">
        기준월
      </div>
      <div className="border-b border-stone-300 px-3 py-2 text-right tabular-nums">
        {selectedMonth || "-"}
      </div>
      <div className="border-r border-stone-300 bg-stone-100 px-3 py-2 font-medium">
        행 수
      </div>
      <div className="px-3 py-2 text-right tabular-nums">{visibleRows.length}</div>
    </div>
  </div>
</header>

          <div className="space-y-4 px-4 py-4 sm:px-6">
            <section className="border border-stone-300">
              <div className="border-b border-stone-300 bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-700">
                조회 조건
              </div>
              <div className="grid gap-x-4 gap-y-3 px-3 py-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-stone-700">회사 선택</span>
                  <select
                    className="h-10 w-full border border-stone-300 bg-white px-2.5 text-sm outline-none transition focus:border-stone-700"
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

                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-stone-700">현장 선택</span>
                  <select
                    className="h-10 w-full border border-stone-300 bg-white px-2.5 text-sm outline-none transition focus:border-stone-700"
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

                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-stone-700">직종</span>
                  <select
                    className="h-10 w-full border border-stone-300 bg-white px-2.5 text-sm outline-none transition focus:border-stone-700"
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

                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-stone-700">기준월</span>
                  <input
                    type="month"
                    className="h-10 w-full border border-stone-300 bg-white px-2.5 text-sm outline-none transition focus:border-stone-700"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                  />
                </label>
              </div>

              {selectedCompany ? (
                <div className="border-t border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-600">
                  사업자등록번호 {selectedCompany.business_number || "-"} / 주소 {selectedCompany.address || "-"}
                </div>
              ) : null}
              {loadError ? (
                <p className="border-t border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {loadError}
                </p>
              ) : null}
              {saveError ? (
                <p className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  {saveError}
                </p>
              ) : null}
              {saveSuccessMessage ? (
                <p className="border-t border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {saveSuccessMessage}
                </p>
              ) : null}
            </section>

            <section className="border border-stone-300">
              <div className="border-b border-stone-300 bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-700">
                현장 정보
              </div>
              <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-4">
                <div className="border-b border-r border-stone-300 px-3 py-3">
                  <div className="text-xs font-medium text-stone-500">발주자</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{selectedSite?.client_name || "-"}</div>
                </div>
                <div className="border-b border-r border-stone-300 px-3 py-3">
                  <div className="text-xs font-medium text-stone-500">공사구분</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{selectedSite?.contract_type || "-"}</div>
                </div>
                <div className="border-b border-r border-stone-300 px-3 py-3">
                  <div className="text-xs font-medium text-stone-500">착공일</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDateDisplay(selectedSite?.construction_start_date ?? selectedSite?.start_date)}
                  </div>
                </div>
                <div className="border-b px-3 py-3">
                  <div className="text-xs font-medium text-stone-500">준공일</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDateDisplay(selectedSite?.construction_end_date ?? selectedSite?.end_date)}
                  </div>
                </div>
              </div>
              <div className="border-t border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-600">
                선택 현장: {selectedSite?.name || "선택된 현장이 없습니다."}
              </div>
            </section>

            <section className="border border-stone-300">
              <div className="flex flex-col gap-3 border-b border-stone-300 bg-stone-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">노무비 입력표</h2>
                  <p className="text-sm text-stone-600">Enter 키로 다음 셀로 이동하며 내용을 연속 입력할 수 있습니다.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                    className="inline-flex h-9 items-center justify-center border border-stone-700 bg-white px-3 text-sm font-medium text-stone-800 transition hover:bg-stone-100"
                  >
                    행 추가
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadExcel}
                    className="inline-flex h-9 items-center justify-center border border-sky-700 bg-white px-3 text-sm font-medium text-sky-800 transition hover:bg-sky-50"
                  >
                    엑셀 다운로드
                  </button>
                  <button
                    type="button"
                    onClick={handleUploadButtonClick}
                    className="inline-flex h-9 items-center justify-center border border-violet-700 bg-white px-3 text-sm font-medium text-violet-800 transition hover:bg-violet-50"
                  >
                    엑셀 업로드
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || isLoading || isRecordsLoading}
                    className="inline-flex h-9 items-center justify-center border border-emerald-700 bg-emerald-700 px-4 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:border-emerald-300 disabled:bg-emerald-300"
                  >
                    {isSaving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[1240px] w-full border-collapse text-sm">
                  <thead className="bg-[#f5f2ea] text-stone-700">
                    <tr className="border-b border-stone-400">
                      <th className="w-14 border-r border-stone-300 px-2 py-2 text-center font-semibold">번호</th>
                      <th className="w-32 border-r border-stone-300 px-2 py-2 text-left font-semibold">성명</th>
                      <th className="w-40 border-r border-stone-300 px-2 py-2 text-left font-semibold">주민번호</th>
                      <th className="w-36 border-r border-stone-300 px-2 py-2 text-left font-semibold">전화번호</th>
                      <th className="w-28 border-r border-stone-300 px-2 py-2 text-left font-semibold">직종</th>
                      <th className="w-28 border-r border-stone-300 px-2 py-2 text-right font-semibold">단가</th>
                      <th className="w-24 border-r border-stone-300 px-2 py-2 text-right font-semibold">공수</th>
                      <th className="w-32 border-r border-stone-300 px-2 py-2 text-right font-semibold">지급액</th>
                      <th className="min-w-[280px] border-r border-stone-300 px-2 py-2 text-left font-semibold">비고</th>
                      <th className="w-20 px-2 py-2 text-center font-semibold">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, index) => {
                      const rowIndex = rows.findIndex((currentRow) => currentRow.id === row.id);

                      return (
                        <tr key={row.id} className="border-b border-stone-300 align-middle odd:bg-white even:bg-stone-50/40">
                        <td className="border-r border-stone-300 px-2 py-1.5 text-center text-xs text-stone-700">
                          {index + 1}
                        </td>
                        <td className="border-r border-stone-300 px-1.5 py-1">
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
                        <td className="border-r border-stone-300 px-1.5 py-1">
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
                        <td className="border-r border-stone-300 px-1.5 py-1">
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
                        <td className="border-r border-stone-300 px-1.5 py-1">
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
                        <td className="border-r border-stone-300 px-1.5 py-1">
                          <input
                            ref={(element) => {
                              cellRefs.current[`${row.id}:unitPrice`] = element;
                            }}
                            value={getNumericInputValue(row, "unitPrice")}
                            onChange={(event) => updateRow(row.id, "unitPrice", event.target.value)}
                            onFocus={(event) => handleNumericInputFocus(event, row.id, "unitPrice")}
                            onBlur={() => handleNumericInputBlur(row.id, "unitPrice")}
                            onKeyDown={(event) => handleCellKeyDown(event, row.id, "unitPrice")}
                            inputMode="decimal"
                            placeholder="0"
                            className={sheetNumericClass}
                          />
                        </td>
                        <td className="border-r border-stone-300 px-1.5 py-1">
                          <input
                            ref={(element) => {
                              cellRefs.current[`${row.id}:workUnits`] = element;
                            }}
                            value={getNumericInputValue(row, "workUnits")}
                            onChange={(event) => updateRow(row.id, "workUnits", event.target.value)}
                            onFocus={(event) => handleNumericInputFocus(event, row.id, "workUnits")}
                            onBlur={() => handleNumericInputBlur(row.id, "workUnits")}
                            onKeyDown={(event) => handleCellKeyDown(event, row.id, "workUnits")}
                            inputMode="decimal"
                            placeholder="0"
                            className={sheetNumericClass}
                          />
                        </td>
                        <td className="border-r border-stone-300 bg-stone-50 px-2 py-1 text-right text-sm font-medium tabular-nums text-slate-800">
                          {formatCurrency(getPaymentAmount(row))}
                        </td>
                        <td className="border-r border-stone-300 px-1.5 py-1">
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
                        <td className="px-1.5 py-1 text-center">
                          <button
                            type="button"
                            aria-label="삭제"
                            onClick={() => removeRowAtIndex(rowIndex)}
                            className={deleteButtonClass}
                          >
                            삭제
                          </button>
                        </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-[#f5f2ea]">
                    <tr className="border-t-2 border-stone-500">
                      <td colSpan={6} className="border-r border-stone-300 px-2 py-2 text-right text-sm font-semibold text-stone-700">
                        합계
                      </td>
                      <td className="border-r border-stone-300 px-2 py-2 text-right font-semibold tabular-nums text-slate-900">
                        {totalWorkUnits.toLocaleString("ko-KR")}
                      </td>
                      <td className="border-r border-stone-300 px-2 py-2 text-right font-semibold tabular-nums text-slate-900">
                        {formatCurrency(totalPaymentAmount)}
                      </td>
                      <td colSpan={2} className="px-2 py-2 text-sm text-stone-600">
                        공수 / 지급액 합계
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <section className="border border-stone-300">
              <div className="grid gap-0 md:grid-cols-[1.2fr_1fr_1fr_auto]">
                <div className="border-b border-r border-stone-300 bg-stone-100 px-3 py-2 text-sm font-medium text-stone-700 md:border-b-0">
                  입력 안내
                </div>
                <div className="border-b border-r border-stone-300 px-3 py-2 text-sm text-stone-600 md:border-b-0">
                  주민번호는 숫자만 입력
                </div>
                <div className="border-b border-r border-stone-300 px-3 py-2 text-sm text-stone-600 md:border-b-0">
                  전화번호는 숫자만 입력
                </div>
                <div className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || isLoading || isRecordsLoading}
                    className="inline-flex h-9 items-center justify-center border border-emerald-700 bg-emerald-700 px-5 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:border-emerald-300 disabled:bg-emerald-300"
                  >
                    {isSaving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
              <div className="grid gap-0 border-t border-stone-300 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
                <div className="border-r border-stone-300 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-700">
                  하단 합계
                </div>
                <div className="border-r border-stone-300 px-3 py-2 text-sm">
                  총 공수<span className="float-right font-semibold tabular-nums">{totalWorkUnits.toLocaleString("ko-KR")}</span>
                </div>
                <div className="border-r border-stone-300 px-3 py-2 text-sm">
                  총 지급액<span className="float-right font-semibold tabular-nums">{formatCurrency(totalPaymentAmount)}</span>
                </div>
                <div className="px-3 py-2 text-sm text-stone-600">현재 입력된 내용을 확인한 뒤 저장해 주세요.</div>
              </div>
            </section>

            <section className="border border-dashed border-stone-300 bg-stone-50 px-3 py-3 text-sm leading-6 text-stone-600">
              <p>입력 UX 안내</p>
              <p>날짜 `20260404` -&gt; `2026-04-04`</p>
              <p>주민번호 13자리 -&gt; `######-#######`</p>
              <p>전화번호 `01012345678` -&gt; `010-1234-5678`</p>
              {isLoading ? <p>데이터를 불러오는 중입니다.</p> : null}
              {isRecordsLoading ? <p>월별 기록을 불러오는 중입니다.</p> : null}
              {!isLoading && !baseStatementRows.length ? (
                <p>선택한 조건에 해당하는 월별 기록이 없어 새로 입력할 수 있습니다.</p>
              ) : null}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}


