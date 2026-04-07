"use client";

import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { FORM_DAY_COLUMN_COUNT, FORM_DEDUCTION_COLUMNS } from "@/lib/labor-layout";
import { calculateInsurance, formatGongsu, formatLaborRemarkLines, getLaborRemark, loadDefaultRateConfig, parseSnapshotNote } from "@/lib/labor";
import { supabase } from "@/lib/supabase";

interface Company {
  id: number;
  name: string;
}

interface Site {
  id: number;
  name: string;
  company_id: number;
  companies?: Company | null;
}

interface DailyWorker {
  id: string;
  name: string;
  resident_number?: string | null;
  job_type?: string | null;
  first_work_date?: string | null;
  hourly_rate?: number | null;
}

interface MonthlyRecordRowSnapshot {
  name?: string | null;
  resident_number?: string | null;
  job_type?: string | null;
  unit_price?: number | null;
  total_work_units?: number | null;
  gross_amount?: number | null;
  note?: string | null;
}

interface WorkEntry {
  date?: string | null;
  units?: number | null;
  row_snapshot?: MonthlyRecordRowSnapshot | null;
}

interface DailyWorkerMonthlyRecord {
  id: string;
  daily_worker_id: string;
  site_id: number;
  target_month: string;
  work_entries: WorkEntry[];
  total_work_units: number;
  gross_amount: number;
  resident_number?: string | null;
  job_type?: string | null;
}

interface PrintRow {
  id: string;
  name: string;
  residentId: string;
  trade: string;
  dailyWorkEntries: Record<string, string>;
  totalWorkUnits: number;
  unitPrice: number;
  grossAmount: number;
  note: string;
  category: string;
  workedDays: number;
  insurance: ReturnType<typeof calculateInsurance>;
}

type DeductionColumnKey = (typeof FORM_DEDUCTION_COLUMNS)[number]["key"];

const PRINT_DEDUCTION_HEADERS: Record<DeductionColumnKey, [string, string]> = {
  national: ["국민", "연금"],
  health: ["건강", "보험"],
  longTermCare: ["장기요양", "보험"],
  employment: ["고용", "보험"],
  incomeTax: ["소득세", ""],
  residentTax: ["주민세", ""],
  totalDeduction: ["공제", "금액"],
};

const PRINT_TABLE_WIDTH = "1698px";

function getMonthLastDay(targetMonth: string) {
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
    return 31;
  }

  const [year, month] = targetMonth.split("-").map(Number);
  if (Number.isNaN(year) || Number.isNaN(month)) {
    return 31;
  }

  return new Date(year, month, 0).getDate();
}

function getMonthlyRecordSnapshot(entries: WorkEntry[] | null | undefined) {
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

function getMonthlyRecordTextValue(record: DailyWorkerMonthlyRecord, field: "resident_number" | "job_type") {
  const value = record[field];
  return typeof value === "string" ? value : "";
}

function formatAmount(value: number) {
  return Math.round(value).toLocaleString("ko-KR");
}

function formatOneDecimal(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toFixed(1) : "0.0";
}

function getWorkedDaysCountFromEntries(entries: WorkEntry[] | null | undefined) {
  return (entries ?? []).filter((entry) => entry.date && Number(entry.units ?? 0) > 0).length;
}

function buildPrintDayGrid(targetMonth: string) {
  const allDays = Array.from({ length: 31 }, (_, index) => index + 1);
  const toDate = (day: number) => `${targetMonth}-${String(day).padStart(2, "0")}`;

  return {
    top: Array.from({ length: FORM_DAY_COLUMN_COUNT }, (_, index) => {
      const day = index < 15 ? allDays[index] : null;
      return {
        date: day ? toDate(day) : null,
        label: day ? String(day) : "",
      };
    }),
    bottom: Array.from({ length: FORM_DAY_COLUMN_COUNT }, (_, index) => {
      const day = allDays[index + 15];
      return {
        date: toDate(day),
        label: String(day),
      };
    }),
    count: FORM_DAY_COLUMN_COUNT,
  };
}

function PrintPageContent() {
  const searchParams = useSearchParams();
  const targetMonthParam = searchParams?.get("targetMonth");
  const queryYear = searchParams?.get("year") || "2024";
  const queryMonth = searchParams?.get("month") || "12";
  const targetMonth = targetMonthParam || `${queryYear}-${queryMonth.padStart(2, "0")}`;
  const [targetYearLabel = "", targetMonthLabel = ""] = targetMonth.split("-");
  const siteId = searchParams?.get("siteId");
  const rateConfig = useMemo(() => loadDefaultRateConfig(searchParams?.get("rateConfig")), [searchParams]);

  const [data, setData] = useState<{
    company: Company | null;
    site: Site | null;
    workers: DailyWorker[];
    records: DailyWorkerMonthlyRecord[];
  }>({
    company: null,
    site: null,
    workers: [],
    records: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (!siteId) {
          setData({ company: null, site: null, workers: [], records: [] });
          return;
        }

        const parsedSiteId = Number(siteId);
        if (Number.isNaN(parsedSiteId)) {
          throw new Error("잘못된 현장 ID입니다.");
        }

        const { data: sitesData, error: siteError } = await supabase
          .from("sites")
          .select("*, companies(*)")
          .eq("id", parsedSiteId);

        if (siteError) {
          throw new Error(`현장 정보를 불러오지 못했습니다. ${siteError.message}`);
        }

        const siteData = (sitesData?.[0] ?? null) as Site | null;
        if (!siteData) {
          throw new Error("현장 정보를 찾을 수 없습니다.");
        }

        const { data: workers, error: workersError } = await supabase
          .from("daily_workers")
          .select("*")
          .eq("company_id", siteData.company_id);

        if (workersError) {
          throw new Error(`근로자 정보를 불러오지 못했습니다. ${workersError.message}`);
        }

        const { data: records, error: recordsError } = await supabase
          .from("daily_worker_monthly_records")
          .select("*")
          .eq("site_id", parsedSiteId)
          .eq("target_month", targetMonth);

        if (recordsError) {
          throw new Error(`기록 정보를 불러오지 못했습니다. ${recordsError.message}`);
        }

        setData({
          company: siteData.companies || null,
          site: siteData,
          workers: (workers ?? []) as DailyWorker[],
          records: (records ?? []) as DailyWorkerMonthlyRecord[],
        });
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "출력 데이터를 불러오지 못했습니다.");
        setData({ company: null, site: null, workers: [], records: [] });
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [siteId, targetMonth]);

  const dayGrid = useMemo(() => buildPrintDayGrid(targetMonth), [targetMonth]);

  const statementRows = useMemo(() => {
    const workerMap = new Map(data.workers.map((worker) => [worker.id, worker]));

    return data.records.map((record) => {
      const worker = workerMap.get(record.daily_worker_id);
      const snapshot = getMonthlyRecordSnapshot(record.work_entries);
      const snapshotMeta = parseSnapshotNote(snapshot?.note);
      const dailyWorkEntries: Record<string, string> = {};

      for (const entry of record.work_entries ?? []) {
        if (entry.date && typeof entry.units === "number" && entry.units > 0) {
          dailyWorkEntries[entry.date] = String(entry.units);
        }
      }

      const totalWorkUnits = record.total_work_units || snapshot?.total_work_units || 0;
      const grossAmount = record.gross_amount || snapshot?.gross_amount || 0;
      const unitPrice = snapshot?.unit_price || (totalWorkUnits > 0 ? grossAmount / totalWorkUnits : 0);
      const residentId =
        snapshot?.resident_number?.trim() ||
        getMonthlyRecordTextValue(record, "resident_number") ||
        worker?.resident_number ||
        "";
      const workedDays = getWorkedDaysCountFromEntries(record.work_entries);
      const note = formatLaborRemarkLines(
        getLaborRemark(targetMonth, worker?.first_work_date || null, record.work_entries ?? []),
      ).text;

      return {
        id: record.id,
        name: snapshot?.name?.trim() || worker?.name || "",
        residentId,
        trade:
          snapshot?.job_type?.trim() ||
          getMonthlyRecordTextValue(record, "job_type") ||
          worker?.job_type ||
          "",
        dailyWorkEntries,
        totalWorkUnits,
        unitPrice,
        grossAmount,
        note,
        category: snapshotMeta.category || "",
        workedDays,
        insurance: calculateInsurance({ grossPay: grossAmount, workDays: workedDays, residentId, targetMonth }, rateConfig),
      } satisfies PrintRow;
    });
  }, [data.records, data.workers, rateConfig, targetMonth]);

  const totals = useMemo(
    () =>
      statementRows.reduce(
        (sum, row) => ({
          totalWorkUnits: sum.totalWorkUnits + row.totalWorkUnits,
          workedDays: sum.workedDays + row.workedDays,
          grossAmount: sum.grossAmount + row.grossAmount,
          national: sum.national + row.insurance.national,
          health: sum.health + row.insurance.health,
          longTermCare: sum.longTermCare + row.insurance.longTermCare,
          employment: sum.employment + row.insurance.employment,
          incomeTax: sum.incomeTax + row.insurance.incomeTax,
          residentTax: sum.residentTax + row.insurance.residentTax,
          totalDeduction: sum.totalDeduction + row.insurance.totalDeduction,
          netPay: sum.netPay + row.insurance.netPay,
        }),
        {
          totalWorkUnits: 0,
          workedDays: 0,
          grossAmount: 0,
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
    [statementRows],
  );

  if (isLoading) {
    return <div style={{ padding: "20px", textAlign: "center" }}>데이터를 불러오는 중입니다.</div>;
  }

  if (!siteId) {
    return <div style={{ padding: "20px", textAlign: "center" }}>현장 ID가 없어 출력할 수 없습니다.</div>;
  }

  if (error) {
    return <div style={{ padding: "20px", textAlign: "center", color: "red" }}>{error}</div>;
  }

  return (
    <div className="print-container" style={{ padding: "12mm" }}>
      <style jsx>{`
        @media print {
          .print-container {
            margin: 0;
            padding: 8mm;
          }

          .no-print {
            display: none;
          }
        }
      `}</style>

      <div
        style={{
          width: PRINT_TABLE_WIDTH,
          margin: "0 auto",
          border: "1px solid #000",
          borderBottom: 0,
          padding: "12px 0 10px",
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "23px", fontWeight: "bold", letterSpacing: "0.14em", lineHeight: 1.15 }}>
          {`${targetYearLabel}년 ${targetMonthLabel}월 일용노무비지급명세서`}
        </h1>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.15fr 1fr",
          width: PRINT_TABLE_WIDTH,
          margin: "0 auto 6px",
          border: "1px solid #000",
          fontSize: "11px",
          lineHeight: 1.35,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "52px 1fr", borderRight: "1px solid #000" }}>
          <div style={{ borderRight: "1px solid #000", padding: "5px 4px", textAlign: "center", fontWeight: 700 }}>상호</div>
          <div style={{ padding: "5px 8px" }}>{data.company?.name || "-"}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "52px 1fr", borderRight: "1px solid #000" }}>
          <div style={{ borderRight: "1px solid #000", padding: "5px 4px", textAlign: "center", fontWeight: 700 }}>기간</div>
          <div style={{ padding: "4px 8px", textAlign: "center" }}>
            <div>{`${targetMonth}-01`}</div>
            <div>{`${targetMonth}-${String(getMonthLastDay(targetMonth)).padStart(2, "0")}`}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "58px 1fr" }}>
          <div style={{ borderRight: "1px solid #000", padding: "5px 4px", textAlign: "center", fontWeight: 700 }}>공사명</div>
          <div style={{ padding: "5px 8px" }}>{data.site?.name || "-"}</div>
        </div>
      </div>

      <table
        style={{
          width: PRINT_TABLE_WIDTH,
          margin: "0 auto 16px",
          borderCollapse: "collapse",
          tableLayout: "fixed",
          fontSize: "9px",
          lineHeight: 1.15,
        }}
      >
        <colgroup>
          <col style={{ width: "34px" }} />
          <col style={{ width: "54px" }} />
          <col style={{ width: "68px" }} />
          <col style={{ width: "84px" }} />
          <col style={{ width: "92px" }} />
          <col style={{ width: "92px" }} />
          {Array.from({ length: FORM_DAY_COLUMN_COUNT }, (_, index) => (
            <col key={`col-day-${index + 1}`} style={{ width: "24px" }} />
          ))}
          <col style={{ width: "42px" }} />
          <col style={{ width: "54px" }} />
          <col style={{ width: "84px" }} />
          <col style={{ width: "84px" }} />
          {FORM_DEDUCTION_COLUMNS.map((column) => (
            <col key={column.key} style={{ width: "60px" }} />
          ))}
          <col style={{ width: "78px" }} />
          <col style={{ width: "80px" }} />
          <col style={{ width: "48px" }} />
        </colgroup>
        <thead>
          <tr style={{ backgroundColor: "#eef4ff" }}>
            <th colSpan={6} style={{ border: "1px solid #000", padding: "3px 4px", textAlign: "center", verticalAlign: "middle", fontWeight: 700 }}>기본정보</th>
            <th colSpan={dayGrid.count} style={{ border: "1px solid #000", padding: "3px 4px", textAlign: "center", verticalAlign: "middle", fontWeight: 700 }}>일자별 공수</th>
            <th colSpan={4} style={{ border: "1px solid #000", padding: "3px 4px", textAlign: "center", verticalAlign: "middle", fontWeight: 700 }}>노무비</th>
            <th colSpan={FORM_DEDUCTION_COLUMNS.length} style={{ border: "1px solid #000", padding: "3px 4px", textAlign: "center", verticalAlign: "middle", fontWeight: 700 }}>공제</th>
            <th rowSpan={3} style={{ border: "1px solid #000", padding: "4px 3px", textAlign: "center", verticalAlign: "middle", lineHeight: 1.15 }}>차감<br />지급액</th>
            <th rowSpan={3} style={{ border: "1px solid #000", padding: "4px 3px", textAlign: "center", verticalAlign: "middle" }}>비고</th>
            <th rowSpan={3} style={{ border: "1px solid #000", padding: "4px 3px", textAlign: "center", verticalAlign: "middle", color: "#444" }}>구분</th>
          </tr>
          <tr style={{ backgroundColor: "#f8fbff" }}>
            <th rowSpan={2} style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center", verticalAlign: "middle" }}>번호</th>
            <th rowSpan={2} style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center", verticalAlign: "middle" }}>직종</th>
            <th rowSpan={2} style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center", verticalAlign: "middle" }}>성명</th>
            <th rowSpan={2} style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center", verticalAlign: "middle" }}>전화번호</th>
            <th colSpan={2} style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center", verticalAlign: "middle" }}>주소</th>
            {dayGrid.top.map((cell, index) => (
              <th
                key={`day-top-${index + 1}`}
                style={{ border: "1px solid #000", height: "18px", padding: "1px 0", textAlign: "center", verticalAlign: "middle", lineHeight: 1.1 }}
              >
                {cell.label}
              </th>
            ))}
            <th rowSpan={2} style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center", verticalAlign: "middle", lineHeight: 1.15 }}>근로<br />일수</th>
            <th rowSpan={2} style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center", verticalAlign: "middle", lineHeight: 1.15 }}>근로<br />공수</th>
            <th rowSpan={2} style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center", verticalAlign: "middle", lineHeight: 1.15 }}>노무비<br />단가</th>
            <th rowSpan={2} style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center", verticalAlign: "middle", lineHeight: 1.15 }}>노무비<br />총액</th>
            {FORM_DEDUCTION_COLUMNS.map((column) => {
              const [topLabel, bottomLabel] =
                column.key === "incomeTax"
                  ? ["소득", "세"]
                  : column.key === "residentTax"
                    ? ["주민", "세"]
                    : PRINT_DEDUCTION_HEADERS[column.key];
              return (
                <th key={column.key} rowSpan={2} style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center", verticalAlign: "middle", lineHeight: 1.15 }}>
                  {topLabel}
                  {bottomLabel}
                </th>
              );
            })}
          </tr>
          <tr style={{ backgroundColor: "#f8fbff" }}>
            <th style={{ border: "1px solid #000", height: "18px", padding: "1px 2px", textAlign: "center", verticalAlign: "middle", lineHeight: 1.1 }}>주민등록번호</th>
            <th style={{ border: "1px solid #000", height: "18px", padding: "1px 2px", textAlign: "center", verticalAlign: "middle", lineHeight: 1.1 }}>계좌번호</th>
            {dayGrid.bottom.map((cell, index) => (
              <th
                key={`day-bottom-${index + 1}`}
                style={{ border: "1px solid #000", height: "18px", padding: "1px 0", textAlign: "center", verticalAlign: "middle", lineHeight: 1.1 }}
              >
                {cell.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {statementRows.length === 0 ? (
            <tr>
              <td colSpan={6 + dayGrid.count + 4 + FORM_DEDUCTION_COLUMNS.length + 3} style={{ border: "1px solid #000", padding: "18px", textAlign: "center", color: "#666" }}>
                근무 내역이 없습니다.
              </td>
            </tr>
          ) : (
            statementRows.map((row, index) => (
              <Fragment key={row.id}>
                <tr style={{ height: "28px" }}>
                  <td rowSpan={2} style={{ border: "1px solid #000", padding: "2px 3px", textAlign: "center", verticalAlign: "middle" }}>{index + 1}</td>
                  <td rowSpan={2} style={{ border: "1px solid #000", padding: "2px 3px", textAlign: "center", verticalAlign: "middle" }}>{row.trade || "-"}</td>
                  <td rowSpan={2} style={{ border: "1px solid #000", padding: "2px 3px", textAlign: "center", verticalAlign: "middle" }}>{row.name || "-"}</td>
                  <td rowSpan={2} style={{ border: "1px solid #000", padding: "2px 3px", textAlign: "center", verticalAlign: "middle" }}>-</td>
                  <td colSpan={2} style={{ border: "1px solid #000", padding: "2px 3px", textAlign: "center", verticalAlign: "middle" }}>-</td>
                  {dayGrid.top.map((cell, dayIndex) => (
                    <td key={`${row.id}:top:${cell.date ?? dayIndex}`} style={{ border: "1px solid #000", padding: "1px 0", textAlign: "center", verticalAlign: "middle" }}>
                      {cell.date ? formatGongsu(row.dailyWorkEntries[cell.date]) : ""}
                    </td>
                  ))}
                  <td rowSpan={2} style={{ border: "1px solid #000", padding: "2px 3px", textAlign: "center", verticalAlign: "middle" }}>{row.workedDays || ""}</td>
                  <td rowSpan={2} style={{ border: "1px solid #000", padding: "2px 3px", textAlign: "center", verticalAlign: "middle" }}>{formatOneDecimal(row.totalWorkUnits)}</td>
                  <td rowSpan={2} style={{ border: "1px solid #000", textAlign: "right", verticalAlign: "middle", paddingRight: "5px" }}>{formatAmount(row.unitPrice)}</td>
                  <td rowSpan={2} style={{ border: "1px solid #000", textAlign: "right", verticalAlign: "middle", paddingRight: "5px" }}>{formatAmount(row.grossAmount)}</td>
                  {FORM_DEDUCTION_COLUMNS.map((column) => (
                    <td key={`${row.id}:${column.key}`} rowSpan={2} style={{ border: "1px solid #000", textAlign: "right", verticalAlign: "middle", paddingRight: "5px" }}>
                      {formatAmount(row.insurance[column.key])}
                    </td>
                  ))}
                  <td rowSpan={2} style={{ border: "1px solid #000", textAlign: "right", verticalAlign: "middle", paddingRight: "5px" }}>{formatAmount(row.insurance.netPay)}</td>
                  <td rowSpan={2} style={{ border: "1px solid #000", padding: "2px 3px", textAlign: "center", verticalAlign: "middle", whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{row.note || ""}</td>
                  <td rowSpan={2} style={{ border: "1px solid #000", padding: "2px 3px", textAlign: "center", verticalAlign: "middle", color: "#444" }}>{row.category || "-"}</td>
                </tr>
                <tr style={{ height: "24px", backgroundColor: "#fcfdff" }}>
                  <td style={{ border: "1px solid #000", padding: "2px 3px", textAlign: "center", verticalAlign: "middle", whiteSpace: "nowrap" }}>{row.residentId || "-"}</td>
                  <td style={{ border: "1px solid #000", padding: "2px 3px", textAlign: "center", verticalAlign: "middle" }}>-</td>
                  {dayGrid.bottom.map((cell, dayIndex) => (
                    <td key={`${row.id}:bottom:${cell.date ?? dayIndex}`} style={{ border: "1px solid #000", padding: "1px 0", textAlign: "center", verticalAlign: "middle" }}>
                      {cell.date ? formatGongsu(row.dailyWorkEntries[cell.date]) : ""}
                    </td>
                  ))}
                </tr>
              </Fragment>
            ))
          )}
        </tbody>
        <tfoot>
          <tr style={{ backgroundColor: "#fff200", fontWeight: 700, height: "32px" }}>
            <td colSpan={6} style={{ border: "1px solid #000", textAlign: "center", verticalAlign: "middle", padding: "5px 4px" }}>총계</td>
            {Array.from({ length: dayGrid.count }, (_, index) => (
              <td key={`sum-day-${index + 1}`} style={{ border: "1px solid #000" }}></td>
            ))}
            <td style={{ border: "1px solid #000", textAlign: "center", verticalAlign: "middle" }}>{totals.workedDays || ""}</td>
            <td style={{ border: "1px solid #000", textAlign: "center", verticalAlign: "middle" }}>{formatOneDecimal(totals.totalWorkUnits)}</td>
            <td style={{ border: "1px solid #000", textAlign: "center", verticalAlign: "middle" }}>-</td>
            <td style={{ border: "1px solid #000", textAlign: "right", verticalAlign: "middle", paddingRight: "5px" }}>{formatAmount(totals.grossAmount)}</td>
            {FORM_DEDUCTION_COLUMNS.map((column) => (
              <td key={`sum-${column.key}`} style={{ border: "1px solid #000", textAlign: "right", verticalAlign: "middle", paddingRight: "5px" }}>
                {formatAmount(totals[column.key])}
              </td>
            ))}
            <td style={{ border: "1px solid #000", textAlign: "right", verticalAlign: "middle", paddingRight: "5px" }}>{formatAmount(totals.netPay)}</td>
            <td style={{ border: "1px solid #000", textAlign: "center", verticalAlign: "middle" }}>합계</td>
            <td style={{ border: "1px solid #000", textAlign: "center", verticalAlign: "middle" }}>{`${statementRows.length}명`}</td>
          </tr>
        </tfoot>
      </table>

      <div style={{ marginTop: "18px", textAlign: "center" }} className="no-print">
        <button onClick={() => window.print()} style={{ padding: "10px 20px", fontSize: "14px" }}>
          인쇄 / PDF 저장
        </button>
      </div>
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={<div>로딩 중...</div>}>
      <PrintPageContent />
    </Suspense>
  );
}
