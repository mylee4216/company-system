"use client";

import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { calculateInsurance, formatGongsu, getLaborRemark, parseSnapshotNote } from "@/lib/labor";
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
  unitPrice: number;
  dailyWorkEntries: Record<string, string>;
  totalWorkUnits: number;
  grossAmount: number;
  note: string;
  category: string;
  insurance: ReturnType<typeof calculateInsurance>;
}

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

function getMonthPeriod(targetMonth: string) {
  const lastDay = getMonthLastDay(targetMonth);
  return `${targetMonth}-01 ~ ${targetMonth}-${String(lastDay).padStart(2, "0")}`;
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

function PrintPageContent() {
  const searchParams = useSearchParams();
  const targetMonthParam = searchParams?.get("targetMonth");
  const queryYear = searchParams?.get("year") || "2024";
  const queryMonth = searchParams?.get("month") || "12";
  const targetMonth = targetMonthParam || `${queryYear}-${queryMonth.padStart(2, "0")}`;
  const siteId = searchParams?.get("siteId");
  const monthPeriod = useMemo(() => getMonthPeriod(targetMonth), [targetMonth]);

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

  const monthDates = useMemo(() => {
    const [year, month] = targetMonth.split("-").map(Number);
    if (Number.isNaN(year) || Number.isNaN(month)) {
      return [];
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => `${targetMonth}-${String(index + 1).padStart(2, "0")}`);
  }, [targetMonth]);

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
      const unitPrice =
        snapshot?.unit_price ??
        worker?.hourly_rate ??
        (totalWorkUnits > 0 ? grossAmount / totalWorkUnits : 0);
      const note =
        getLaborRemark(targetMonth, worker?.first_work_date || null, record.work_entries ?? []).text ||
        snapshotMeta.note;

      return {
        id: record.id,
        name: snapshot?.name?.trim() || worker?.name || "",
        residentId:
          snapshot?.resident_number?.trim() ||
          getMonthlyRecordTextValue(record, "resident_number") ||
          worker?.resident_number ||
          "",
        trade:
          snapshot?.job_type?.trim() ||
          getMonthlyRecordTextValue(record, "job_type") ||
          worker?.job_type ||
          "",
        unitPrice: unitPrice || 0,
        dailyWorkEntries,
        totalWorkUnits,
        grossAmount,
        note,
        category: snapshotMeta.category || "",
        insurance: calculateInsurance({ grossPay: grossAmount }),
      } satisfies PrintRow;
    });
  }, [data.records, data.workers, targetMonth]);

  const totals = useMemo(
    () =>
      statementRows.reduce(
        (sum, row) => ({
          totalWorkUnits: sum.totalWorkUnits + row.totalWorkUnits,
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

      <div style={{ marginBottom: "14px", textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "bold", letterSpacing: "0.08em" }}>노무비 명세서</h1>
      </div>

      <div
        style={{
          marginBottom: "14px",
          border: "1px solid #000",
          padding: "10px 14px",
          fontSize: "11px",
          lineHeight: 1.7,
        }}
      >
        <div>회사명: {data.company?.name || "-"}</div>
        <div>현장명: {data.site?.name || "-"}</div>
        <div>기간: {monthPeriod}</div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: "9px", marginBottom: "16px" }}>
        <colgroup>
          <col style={{ width: "34px" }} />
          <col style={{ width: "72px" }} />
          <col style={{ width: "96px" }} />
          <col style={{ width: "58px" }} />
          <col style={{ width: "64px" }} />
          {monthDates.map((date) => (
            <col key={`col-${date}`} style={{ width: "24px" }} />
          ))}
          <col style={{ width: "52px" }} />
          <col style={{ width: "70px" }} />
          <col style={{ width: "56px" }} />
          <col style={{ width: "56px" }} />
          <col style={{ width: "56px" }} />
          <col style={{ width: "56px" }} />
          <col style={{ width: "56px" }} />
          <col style={{ width: "56px" }} />
          <col style={{ width: "66px" }} />
          <col style={{ width: "72px" }} />
          <col style={{ width: "92px" }} />
          <col style={{ width: "54px" }} />
        </colgroup>
        <thead>
          <tr style={{ backgroundColor: "#eef4ff" }}>
            <th colSpan={5} style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "center" }}>기본정보</th>
            <th colSpan={monthDates.length} style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "center" }}>일자별 공수</th>
            <th colSpan={2} style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "center" }}>지급</th>
            <th colSpan={6} style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "center" }}>공제</th>
            <th colSpan={4} style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "center" }}>정산</th>
          </tr>
          <tr style={{ backgroundColor: "#f8fbff" }}>
            <th style={{ border: "1px solid #000", padding: "6px 2px", textAlign: "center" }}>번호</th>
            <th style={{ border: "1px solid #000", padding: "6px 2px", textAlign: "center" }}>성명</th>
            <th style={{ border: "1px solid #000", padding: "6px 2px", textAlign: "center" }}>주민번호</th>
            <th style={{ border: "1px solid #000", padding: "6px 2px", textAlign: "center" }}>직종</th>
            <th style={{ border: "1px solid #000", padding: "6px 2px", textAlign: "center" }}>단가</th>
            {monthDates.map((date) => (
              <th key={date} style={{ border: "1px solid #000", padding: "4px 0", textAlign: "center" }}>
                {Number(date.slice(-2))}
              </th>
            ))}
            <th style={{ border: "1px solid #000", padding: "6px 2px", textAlign: "center" }}>총공수</th>
            <th style={{ border: "1px solid #000", padding: "6px 2px", textAlign: "center" }}>지급액</th>
            <th style={{ border: "1px solid #000", padding: "5px 2px", textAlign: "center", lineHeight: 1.15 }}>국민연금</th>
            <th style={{ border: "1px solid #000", padding: "5px 2px", textAlign: "center", lineHeight: 1.15 }}>건강보험</th>
            <th style={{ border: "1px solid #000", padding: "5px 2px", textAlign: "center", lineHeight: 1.15 }}>장기요양</th>
            <th style={{ border: "1px solid #000", padding: "5px 2px", textAlign: "center", lineHeight: 1.15 }}>고용보험</th>
            <th style={{ border: "1px solid #000", padding: "5px 2px", textAlign: "center", lineHeight: 1.15 }}>소득세</th>
            <th style={{ border: "1px solid #000", padding: "5px 2px", textAlign: "center", lineHeight: 1.15 }}>주민세</th>
            <th style={{ border: "1px solid #000", padding: "5px 2px", textAlign: "center", lineHeight: 1.15 }}>공제합계</th>
            <th style={{ border: "1px solid #000", padding: "5px 2px", textAlign: "center", lineHeight: 1.15 }}>실지급액</th>
            <th style={{ border: "1px solid #000", padding: "5px 2px", textAlign: "center", lineHeight: 1.15 }}>비고</th>
            <th style={{ border: "1px solid #000", padding: "5px 2px", textAlign: "center", lineHeight: 1.15 }}>구분</th>
          </tr>
        </thead>
        <tbody>
          {statementRows.length === 0 ? (
            <tr>
              <td colSpan={5 + monthDates.length + 12} style={{ border: "1px solid #000", padding: "18px", textAlign: "center", color: "#666" }}>
                근무 내역이 없습니다.
              </td>
            </tr>
          ) : (
            statementRows.map((row, index) => (
              <Fragment key={row.id}>
                <tr key={`${row.id}-main`} style={{ height: "36px" }}>
                  <td rowSpan={2} style={{ border: "1px solid #000", textAlign: "center", verticalAlign: "middle" }}>{index + 1}</td>
                  <td rowSpan={2} style={{ border: "1px solid #000", textAlign: "center", verticalAlign: "middle" }}>{row.name}</td>
                  <td rowSpan={2} style={{ border: "1px solid #000", textAlign: "center", verticalAlign: "middle", whiteSpace: "nowrap" }}>{row.residentId}</td>
                  <td rowSpan={2} style={{ border: "1px solid #000", textAlign: "center", verticalAlign: "middle" }}>{row.trade}</td>
                  <td rowSpan={2} style={{ border: "1px solid #000", textAlign: "right", verticalAlign: "middle", paddingRight: "4px" }}>{formatAmount(row.unitPrice)}</td>
                  {monthDates.map((date) => (
                    <td key={`${row.id}-${date}`} rowSpan={2} style={{ border: "1px solid #000", textAlign: "center", verticalAlign: "middle" }}>
                      {formatGongsu(row.dailyWorkEntries[date])}
                    </td>
                  ))}
                  <td rowSpan={2} style={{ border: "1px solid #000", textAlign: "center", verticalAlign: "middle" }}>{formatGongsu(row.totalWorkUnits) || "0.0"}</td>
                  <td rowSpan={2} style={{ border: "1px solid #000", textAlign: "right", verticalAlign: "middle", paddingRight: "4px" }}>{formatAmount(row.grossAmount)}</td>
                  <td colSpan={8} style={{ border: "1px solid #000", textAlign: "center", verticalAlign: "middle", background: "#fafcff", lineHeight: 1.25 }}>
                    공제합계 {formatAmount(row.insurance.totalDeduction)} / 실지급액 {formatAmount(row.insurance.netPay)}
                  </td>
                  <td rowSpan={2} style={{ border: "1px solid #000", textAlign: "center", verticalAlign: "middle", whiteSpace: "pre-line" }}>{row.note || ""}</td>
                  <td rowSpan={2} style={{ border: "1px solid #000", textAlign: "center", verticalAlign: "middle" }}>{row.category}</td>
                </tr>
                <tr key={`${row.id}-detail`} style={{ height: "30px", backgroundColor: "#fcfdff" }}>
                  <td style={{ border: "1px solid #000", textAlign: "right", paddingRight: "4px" }}>{formatAmount(row.insurance.national)}</td>
                  <td style={{ border: "1px solid #000", textAlign: "right", paddingRight: "4px" }}>{formatAmount(row.insurance.health)}</td>
                  <td style={{ border: "1px solid #000", textAlign: "right", paddingRight: "4px" }}>{formatAmount(row.insurance.longTermCare)}</td>
                  <td style={{ border: "1px solid #000", textAlign: "right", paddingRight: "4px" }}>{formatAmount(row.insurance.employment)}</td>
                  <td style={{ border: "1px solid #000", textAlign: "right", paddingRight: "4px" }}>{formatAmount(row.insurance.incomeTax)}</td>
                  <td style={{ border: "1px solid #000", textAlign: "right", paddingRight: "4px" }}>{formatAmount(row.insurance.residentTax)}</td>
                  <td style={{ border: "1px solid #000", textAlign: "right", paddingRight: "4px", fontWeight: 600 }}>{formatAmount(row.insurance.totalDeduction)}</td>
                  <td style={{ border: "1px solid #000", textAlign: "right", paddingRight: "4px", fontWeight: 600 }}>{formatAmount(row.insurance.netPay)}</td>
                </tr>
              </Fragment>
            ))
          )}
        </tbody>
        <tfoot>
          <tr style={{ backgroundColor: "#eef4ff", fontWeight: 700 }}>
            <td colSpan={5} style={{ border: "1px solid #000", textAlign: "center", padding: "6px 4px" }}>합계</td>
            {monthDates.map((date) => (
              <td key={`total-${date}`} style={{ border: "1px solid #000" }}></td>
            ))}
            <td style={{ border: "1px solid #000", textAlign: "center" }}>{formatGongsu(totals.totalWorkUnits) || "0.0"}</td>
            <td style={{ border: "1px solid #000", textAlign: "right", paddingRight: "4px" }}>{formatAmount(totals.grossAmount)}</td>
            <td style={{ border: "1px solid #000", textAlign: "right", paddingRight: "4px" }}>{formatAmount(totals.national)}</td>
            <td style={{ border: "1px solid #000", textAlign: "right", paddingRight: "4px" }}>{formatAmount(totals.health)}</td>
            <td style={{ border: "1px solid #000", textAlign: "right", paddingRight: "4px" }}>{formatAmount(totals.longTermCare)}</td>
            <td style={{ border: "1px solid #000", textAlign: "right", paddingRight: "4px" }}>{formatAmount(totals.employment)}</td>
            <td style={{ border: "1px solid #000", textAlign: "right", paddingRight: "4px" }}>{formatAmount(totals.incomeTax)}</td>
            <td style={{ border: "1px solid #000", textAlign: "right", paddingRight: "4px" }}>{formatAmount(totals.residentTax)}</td>
            <td style={{ border: "1px solid #000", textAlign: "right", paddingRight: "4px" }}>{formatAmount(totals.totalDeduction)}</td>
            <td style={{ border: "1px solid #000", textAlign: "right", paddingRight: "4px" }}>{formatAmount(totals.netPay)}</td>
            <td style={{ border: "1px solid #000", textAlign: "center" }}>총계</td>
            <td style={{ border: "1px solid #000", textAlign: "center" }}>{`${statementRows.length}명`}</td>
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
