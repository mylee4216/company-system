"use client";

import { useEffect, useMemo, useState } from "react";

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

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
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
    return `일용직 정보를 찾을 수 없는 행이 있습니다: ${workerNames}. 이름, 주민번호 또는 전화번호를 확인해 주세요.`;
  }

  if (error.message.includes("schema cache")) {
    return "저장 대상 컬럼이 현재 DB 구조와 맞지 않아 저장하지 못했습니다. 저장 로직을 실제 테이블 기준으로 다시 맞춘 뒤 재시도해 주세요.";
  }

  return "저장에 실패했습니다. 입력값과 연결 상태를 확인한 뒤 다시 시도해 주세요.";
}

async function fetchCompanies() {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, business_number, address")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`회사 데이터를 불러오지 못했습니다: ${error.message}`);
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
    throw new Error(`현장 데이터를 불러오지 못했습니다: ${error.message}`);
  }

  return (data ?? []) as SiteRow[];
}

async function fetchDailyWorkers() {
  const { data, error } = await supabase
    .from("daily_workers")
    .select("id, name, daily_wage, phone, resident_number, job_type, company_id, first_work_date")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`일용직 데이터를 불러오지 못했습니다: ${error.message}`);
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
    throw new Error(`월별 일용직 기록을 불러오지 못했습니다: ${error.message}`);
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
          error instanceof Error ? error.message : "??? ??????????? ????????";
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
        parseNumber(worker?.daily_wage) ||
        (totalWorkUnits > 0 ? grossAmount / totalWorkUnits : 0);
      const lastWorkedDate = getLastWorkedDate(record.work_entries);

      return {
        id: `record-${record.id}`,
        sourceRecordId: record.id,
        sourceWorkerId: workerId,
        name: worker?.name ?? `일용직 #${workerId ?? "-"}`,
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
    if (
      selectedTradeFilter !== ALL_TRADES_LABEL &&
      !tradeOptions.includes(selectedTradeFilter)
    ) {
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

  const addRow = () => {
    const trade =
      selectedTradeFilter !== ALL_TRADES_LABEL ? selectedTradeFilter : tradeOptions[1] ?? FALLBACK_TRADE;

    setRows((currentRows) => [...currentRows, createEmptyRow(`manual-${Date.now()}`, trade)]);
    setSaveSuccessMessage("");
    setSaveError("");
  };

  const removeRow = (rowId: string) => {
    setRows((currentRows) => {
      if (currentRows.length === 1) {
        const currentRow = currentRows[0];
        return [createEmptyRow(`manual-${Date.now()}`, currentRow.trade || FALLBACK_TRADE)];
      }

      return currentRows.filter((row) => row.id !== rowId);
    });
    setSaveSuccessMessage("");
    setSaveError("");
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
      const message = "저장 전에 회사, 현장, 기준 월을 모두 선택해 주세요.";
      setSaveError(message);
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
          `MATCH_WORKER:${unresolvedRows
            .map(({ row }) => row.name || "(\uC774\uB984 \uC5C6\uC74C)")
            .join(", ")}` 
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
        const workerProfilePayload = new Map<
          number,
          Pick<DailyWorkerRow, "phone" | "resident_number">
        >();

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
              work_entries:
                workUnits > 0
                  ? [
                      {
                        units: workUnits,
                      },
                    ]
                  : [],
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
      setSaveSuccessMessage("저장 완료");
    } catch (error) {
      const message = getFriendlySaveErrorMessage(error);
      setSaveError(message);
      setSaveSuccessMessage("");
    } finally {
      setIsSaving(false);
    }
  };

  const siteInfoItems = [
    { label: "발주자", value: selectedSite?.client_name || "-" },
    { label: "공사구분", value: selectedSite?.contract_type || "-" },
    {
      label: "착공일",
      value: formatDateDisplay(selectedSite?.construction_start_date ?? selectedSite?.start_date),
    },
    {
      label: "준공일",
      value: formatDateDisplay(selectedSite?.construction_end_date ?? selectedSite?.end_date),
    },
  ];

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)]">
          <div className="border-b border-stone-200 bg-[linear-gradient(135deg,#f8fafc_0%,#f5f5f4_45%,#ede9e1_100%)] px-6 py-8 sm:px-8">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                  Labor Cost Statement
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  노무비 명세표
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  기존 회사 관리 시스템의 회사, 현장, 일용직 데이터를 다시 연결한 조회 화면입니다.
                  명세표 레이아웃은 유지하고, 공수 입력과 지급액 계산은 바로 이어서 확인할 수
                  있게 구성했습니다.
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-slate-600 backdrop-blur">
                <div>기준 월: {selectedMonth || "-"}</div>
                <div>표시 인원: {visibleRows.length}명</div>
              </div>
            </div>
          </div>

          <div className="space-y-6 px-6 py-6 sm:px-8">
            <section className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">상단 필터</h2>
                <p className="text-sm text-slate-500">회사, 현장, 직종, 기준 월 선택</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">회사 선택</span>
                  <select
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    value={selectedCompanyId}
                    onChange={(event) => setSelectedCompanyId(event.target.value)}
                    disabled={isLoading || !companies.length}
                  >
                    {companies.length ? null : <option value="">회사 없음</option>}
                    {companies.map((company) => (
                      <option key={company.id} value={String(company.id)}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">현장 선택</span>
                  <select
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    value={selectedSiteId}
                    onChange={(event) => setSelectedSiteId(event.target.value)}
                    disabled={isLoading || !availableSites.length}
                  >
                    {availableSites.length ? null : <option value="">현장 없음</option>}
                    {availableSites.map((site) => (
                      <option key={site.id} value={String(site.id)}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">직종 필터</span>
                  <select
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
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

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">기준 월</span>
                  <input
                    type="month"
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                  />
                </label>
              </div>
              {selectedCompany ? (
                <p className="mt-4 text-sm text-slate-500">
                  사업자번호 {selectedCompany.business_number || "-"} / 주소{" "}
                  {selectedCompany.address || "-"}
                </p>
              ) : null}
              {loadError ? (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {loadError}
                </p>
              ) : null}
              {saveError ? (
                <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {saveError}
                </p>
              ) : null}
              {saveSuccessMessage ? (
                <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {saveSuccessMessage}
                </p>
              ) : null}
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">현장 정보</h2>
                <p className="text-sm text-slate-500">{selectedSite?.name || "선택된 현장 없음"}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {siteInfoItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4"
                  >
                    <div className="text-sm text-slate-500">{item.label}</div>
                    <div className="mt-2 text-base font-semibold text-slate-900">{item.value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-stone-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">노무비 입력표</h2>
                  <p className="text-sm text-slate-500">
                    조회된 월별 데이터로 행을 채우고, 공수 수정 시 지급액을 자동 계산합니다.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || isLoading || isRecordsLoading}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    {isSaving ? "\uC800\uC7A5 \uC911..." : "\uC800\uC7A5"}
                  </button>
                  <button
                    type="button"
                    onClick={addRow}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    {"\uD589 \uCD94\uAC00"}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[1220px] w-full border-collapse text-sm">
                  <thead className="bg-stone-100 text-slate-600">
                    <tr>
                      <th className="px-3 py-3 text-left font-semibold">번호</th>
                      <th className="px-3 py-3 text-left font-semibold">성명</th>
                      <th className="px-3 py-3 text-left font-semibold">주민번호</th>
                      <th className="px-3 py-3 text-left font-semibold">전화번호</th>
                      <th className="px-3 py-3 text-left font-semibold">직종</th>
                      <th className="px-3 py-3 text-left font-semibold">단가</th>
                      <th className="px-3 py-3 text-left font-semibold">공수</th>
                      <th className="px-3 py-3 text-left font-semibold">지급액</th>
                      <th className="px-3 py-3 text-left font-semibold">비고</th>
                      <th className="px-3 py-3 text-left font-semibold">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, index) => (
                      <tr key={row.id} className="border-t border-stone-200 align-top">
                        <td className="px-3 py-3 text-slate-700">{index + 1}</td>
                        <td className="px-3 py-3">
                          <input
                            value={row.name}
                            onChange={(event) => updateRow(row.id, "name", event.target.value)}
                            placeholder="성명"
                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            value={row.residentId}
                            onChange={(event) =>
                              updateRow(row.id, "residentId", event.target.value)
                            }
                            inputMode="numeric"
                            placeholder="000000-0000000"
                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            value={row.phone}
                            onChange={(event) => updateRow(row.id, "phone", event.target.value)}
                            inputMode="numeric"
                            placeholder="010-0000-0000"
                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            value={row.trade}
                            onChange={(event) => updateRow(row.id, "trade", event.target.value)}
                            placeholder="직종"
                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            value={row.unitPrice}
                            onChange={(event) => updateRow(row.id, "unitPrice", event.target.value)}
                            inputMode="decimal"
                            placeholder="0"
                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-right outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            value={row.workUnits}
                            onChange={(event) => updateRow(row.id, "workUnits", event.target.value)}
                            inputMode="decimal"
                            placeholder="0"
                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-right outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex min-h-[42px] items-center rounded-lg bg-stone-100 px-3 font-medium text-slate-800">
                            {formatCurrency(getPaymentAmount(row))}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            value={row.note}
                            onChange={(event) => updateRow(row.id, "note", event.target.value)}
                            placeholder="비고"
                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            className="inline-flex items-center justify-center rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-red-300 hover:text-red-600"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-stone-300 bg-stone-50">
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-right font-semibold text-slate-700">
                        합계
                      </td>
                      <td className="px-3 py-4 font-semibold text-slate-900">
                        {totalWorkUnits.toLocaleString("ko-KR")}
                      </td>
                      <td className="px-3 py-4 font-semibold text-slate-900">
                        {formatCurrency(totalPaymentAmount)}
                      </td>
                      <td colSpan={2} className="px-3 py-4 text-sm text-slate-500">
                        총 공수 / 총 지급액
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isLoading || isRecordsLoading}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {isSaving ? "\uC800\uC7A5 \uC911..." : "\uC800\uC7A5"}
              </button>
            </div>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                <div className="text-sm text-slate-500">총 공수</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  {totalWorkUnits.toLocaleString("ko-KR")}
                </div>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-slate-900 p-5 text-white">
                <div className="text-sm text-slate-300">총 지급액</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight">
                  {formatCurrency(totalPaymentAmount)}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-5 py-4 text-sm leading-6 text-slate-600">
              <p>입력 UX 보정:</p>
              <p>날짜 `20260404` → `2026-04-04`</p>
              <p>주민번호 13자리 → `######-#######`</p>
              <p>전화번호 `01012345678` → `010-1234-5678`</p>
              {isLoading ? <p>{"\uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4."}</p> : null}
              {isRecordsLoading ? <p>{"\uC800\uC7A5\uB41C \uBA85\uC138\uD45C\uB97C \uB2E4\uC2DC \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4."}</p> : null}
              {!isLoading && !baseStatementRows.length ? (
                <p>선택한 조건에 맞는 월별 기록이 없어 빈 행으로 시작합니다.</p>
              ) : null}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
