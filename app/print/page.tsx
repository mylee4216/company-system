"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { calculateInsurance, getLaborRemark, parseSnapshotNote } from "@/lib/labor";
import { supabase } from "@/lib/supabase";

interface Company {
  id: number;
  name: string;
  business_number?: string;
  address?: string;
  representative?: string;
}

interface Site {
  id: number;
  name: string;
  company_id: number;
  client_name?: string;
  contract_type?: string;
  construction_start_date?: string;
  construction_end_date?: string;
  start_date?: string;
  end_date?: string;
  address?: string;
  companies?: Company | null;
}

interface DailyWorker {
  id: string;
  name: string;
  phone?: string | null;
  resident_number?: string | null;
  job_type?: string | null;
  company_id?: number;
  first_work_date?: string | null;
  hourly_rate?: number | null;
}

interface MonthlyRecordRowSnapshot {
  name?: string | null;
  resident_number?: string | null;
  phone?: string | null;
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
  phone?: string | null;
}

interface LaborRow {
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

function getMonthlyRecordTextValue(record: DailyWorkerMonthlyRecord, field: "resident_number" | "job_type" | "phone") {
  const value = record[field];
  return typeof value === "string" ? value : "";
}

function formatNumber(value: number) {
  return value.toLocaleString("ko-KR");
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
      } satisfies LaborRow;
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
          total: sum.total + row.insurance.totalDeduction,
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
          total: 0,
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
    <div className="print-container">
      <style jsx>{`
        @media print {
          .print-container { margin: 0; padding: 10mm; }
          table { page-break-inside: avoid; }
          .no-print { display: none; }
        }
      `}</style>

      <div style={{ marginBottom: "20px", textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "bold" }}>노무비 명세서</h1>
      </div>

      <div
        style={{
          marginBottom: "20px",
          border: "1px solid #000",
          padding: "12px 14px",
          fontSize: "11px",
          lineHeight: 1.6,
        }}
      >
        <div>회사명: {data.company?.name || "-"}</div>
        <div>현장명: {data.site?.name || "-"}</div>
        <div>기간: {monthPeriod}</div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px", marginBottom: "20px" }}>
        <thead>
          <tr style={{ backgroundColor: "#f0f0f0" }}>
            <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>번호</th>
            <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>성명</th>
            <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>주민번호</th>
            <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>직종</th>
            <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>단가</th>
            {monthDates.map((date) => (
              <th key={date} style={{ border: "1px solid #000", padding: "4px", textAlign: "center", fontSize: "9px", fontWeight: "bold" }}>
                {Number(date.slice(-2))}
              </th>
            ))}
            <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>총공수</th>
            <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>지급액</th>
            <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>국민연금</th>
            <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>건강보험</th>
            <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>장기요양</th>
            <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>고용보험</th>
            <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>소득세</th>
            <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>주민세</th>
            <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>공제합계</th>
            <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>실지급액</th>
            <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>비고</th>
            <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>구분</th>
          </tr>
        </thead>
        <tbody>
          {statementRows.length === 0 ? (
            <tr>
              <td colSpan={5 + monthDates.length + 12} style={{ border: "1px solid #000", padding: "20px", textAlign: "center", fontSize: "12px", color: "#666" }}>
                근무 내역이 없습니다.
              </td>
            </tr>
          ) : (
            statementRows.map((row, index) => (
              <tr key={row.id}>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>{index + 1}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>{row.name}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center", fontSize: "9px" }}>{row.residentId}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>{row.trade}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "right" }}>{formatNumber(row.unitPrice)}</td>
                {monthDates.map((date) => {
                  const units = Number(row.dailyWorkEntries[date] || 0);
                  return (
                    <td key={date} style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>
                      {units > 0 ? units : ""}
                    </td>
                  );
                })}
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "right" }}>{formatNumber(row.totalWorkUnits)}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "right" }}>{formatNumber(row.grossAmount)}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "right" }}>{formatNumber(row.insurance.national)}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "right" }}>{formatNumber(row.insurance.health)}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "right" }}>{formatNumber(row.insurance.longTermCare)}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "right" }}>{formatNumber(row.insurance.employment)}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "right" }}>{formatNumber(row.insurance.incomeTax)}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "right" }}>{formatNumber(row.insurance.residentTax)}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "right" }}>{formatNumber(row.insurance.totalDeduction)}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "right" }}>{formatNumber(row.insurance.netPay)}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center", whiteSpace: "pre-line" }}>{row.note || ""}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>{row.category}</td>
              </tr>
            ))
          )}
          <tr style={{ backgroundColor: "#f0f0f0", fontWeight: "bold" }}>
            <td style={{ border: "1px solid #000", padding: "6px", textAlign: "center" }} colSpan={5}>합계</td>
            {monthDates.map((date) => (
              <td key={`total-${date}`} style={{ border: "1px solid #000", padding: "6px", textAlign: "center" }}></td>
            ))}
            <td style={{ border: "1px solid #000", padding: "6px", textAlign: "right" }}>{formatNumber(totals.totalWorkUnits)}</td>
            <td style={{ border: "1px solid #000", padding: "6px", textAlign: "right" }}>{formatNumber(totals.grossAmount)}</td>
            <td style={{ border: "1px solid #000", padding: "6px", textAlign: "right" }}>{formatNumber(totals.national)}</td>
            <td style={{ border: "1px solid #000", padding: "6px", textAlign: "right" }}>{formatNumber(totals.health)}</td>
            <td style={{ border: "1px solid #000", padding: "6px", textAlign: "right" }}>{formatNumber(totals.longTermCare)}</td>
            <td style={{ border: "1px solid #000", padding: "6px", textAlign: "right" }}>{formatNumber(totals.employment)}</td>
            <td style={{ border: "1px solid #000", padding: "6px", textAlign: "right" }}>{formatNumber(totals.incomeTax)}</td>
            <td style={{ border: "1px solid #000", padding: "6px", textAlign: "right" }}>{formatNumber(totals.residentTax)}</td>
            <td style={{ border: "1px solid #000", padding: "6px", textAlign: "right" }}>{formatNumber(totals.total)}</td>
            <td style={{ border: "1px solid #000", padding: "6px", textAlign: "right" }}>{formatNumber(totals.netPay)}</td>
            <td style={{ border: "1px solid #000", padding: "6px", textAlign: "center" }}>보험 1차 반영</td>
            <td style={{ border: "1px solid #000", padding: "6px", textAlign: "center" }}>{`${statementRows.length}명`}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: "20px", textAlign: "center" }} className="no-print">
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
