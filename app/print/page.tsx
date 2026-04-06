"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * 출력 전용 페이지 - 노무비명세표 양식
 *
 * 특징:
 * - 입력 기능 없음 (출력/PDF만)
 * - URL 파라미터로 데이터 식별 (companyId, siteId, targetMonth)
 * - DB에서 해당 데이터 조회 후 양식으로 표시
 * - Print CSS로 A4 용지 최적화
 * - 브라우저 인쇄 및 PDF 저장 지원
 */

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

type WorkEntry = {
  date?: string | null;
  units?: number | null;
  work_days?: number | null;
};

type DailyWorkerMonthlyRecordRow = {
  id: string;
  target_month: string;
  work_dates: string[] | null;
  work_entries: WorkEntry[];
  total_work_units: number;
  worked_days_count: number;
  gross_amount: number;
  daily_worker_id: number | null;
  site_id: number;
};

type PrintLaborRow = {
  // 근로자 정보
  workerName: string;
  residentNumber: string;
  phone: string;
  jobType: string;

  // 공수 정보
  dailyWorkEntries: Record<string, number | null>;
  totalWorkUnits: number;

  // 금액 정보
  unitPrice: number;
  grossAmount: number;

  // 공제 정보
  nationalPension: number;
  healthInsurance: number;
  longTermCareInsurance: number;
  employmentInsurance: number;
  incomeTax: number;
  localIncomeTax: number;
  otherDeductions: number;

  // 최종 정산
  totalDeductions: number;
  netPayment: number;
};

type PrintPageState = {
  isLoading: boolean;
  error: string;
  company: CompanyRow | null;
  site: SiteRow | null;
  laborRows: PrintLaborRow[];
  monthDates: (string | null)[];
  targetMonth: string;
};

function PrintPageContent() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get("companyId");
  const siteId = searchParams.get("siteId");
  const targetMonth = searchParams.get("targetMonth");

  const [state, setState] = useState<PrintPageState>({
    isLoading: true,
    error: "",
    company: null,
    site: null,
    laborRows: [],
    monthDates: [],
    targetMonth: targetMonth || "",
  });

  // 월별 날짜 범위 계산 (1~말일)
  const calculateMonthDates = (yearMonth: string) => {
    const [year, month] = yearMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) => `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`);
  };

  const monthDates = useMemo(() => {
    if (!state.targetMonth) return [];
    try {
      return calculateMonthDates(state.targetMonth);
    } catch {
      return [];
    }
  }, [state.targetMonth]);

  // 샘플 데이터 생성 함수 (테스트용)
  const getSampleData = () => {
    const company: CompanyRow = {
      id: 1,
      name: "테스트건설회사",
      business_number: "123-45-67890",
      address: "서울시 강남구",
    };

    const site: SiteRow = {
      id: 1,
      name: "테스트건설현장",
      company_id: 1,
      client_name: "의뢰처",
      contract_type: "도급",
      construction_start_date: "2024-01-01",
      construction_end_date: "2024-12-31",
      start_date: "2024-04-01",
      end_date: "2024-04-30",
    };

    const laborRows: PrintLaborRow[] = [
      {
        workerName: "김철수",
        residentNumber: "800101-1234567",
        phone: "010-1234-5678",
        jobType: "철근공",
        dailyWorkEntries: {},
        totalWorkUnits: 20,
        unitPrice: 50000,
        grossAmount: 1000000,
        nationalPension: 20000,
        healthInsurance: 15000,
        longTermCareInsurance: 3000,
        employmentInsurance: 5000,
        incomeTax: 30000,
        localIncomeTax: 3000,
        otherDeductions: 0,
        totalDeductions: 76000,
        netPayment: 924000,
      },
      {
        workerName: "이영희",
        residentNumber: "850202-2345678",
        phone: "010-9876-5432",
        jobType: "목공",
        dailyWorkEntries: {},
        totalWorkUnits: 18,
        unitPrice: 55000,
        grossAmount: 990000,
        nationalPension: 19800,
        healthInsurance: 14850,
        longTermCareInsurance: 2970,
        employmentInsurance: 4950,
        incomeTax: 29700,
        localIncomeTax: 2970,
        otherDeductions: 0,
        totalDeductions: 75240,
        netPayment: 914760,
      },
    ];

    return { company, site, laborRows };
  };

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      // 파라미터 없으면 샘플 데이터 사용
      if (!companyId || !siteId || !targetMonth) {
        const { company, site, laborRows } = getSampleData();
        setState((prev) => ({
          ...prev,
          isLoading: false,
          company,
          site,
          laborRows,
          monthDates: calculateMonthDates("2024-04"),
          targetMonth: "2024-04",
        }));
        return;
      }

      try {
        const parsedSiteId = parseInt(siteId);
        const parsedCompanyId = parseInt(companyId);

        // 1. 회사 정보 조회
        const { data: companyData, error: companyError } = await supabase
          .from("companies")
          .select("*")
          .eq("id", parsedCompanyId)
          .single();

        if (companyError) throw new Error(`회사 정보 조회 실패: ${companyError.message}`);

        // 2. 현장 정보 조회
        const { data: siteData, error: siteError } = await supabase
          .from("sites")
          .select("*")
          .eq("id", parsedSiteId)
          .single();

        if (siteError) throw new Error(`현장 정보 조회 실패: ${siteError.message}`);

        // 3. 월별 기록 조회
        const { data: recordsData, error: recordsError } = await supabase
          .from("daily_worker_monthly_records")
          .select("*")
          .eq("site_id", parsedSiteId)
          .eq("target_month", targetMonth)
          .order("id", { ascending: true });

        if (recordsError) throw new Error(`기록 조회 실패: ${recordsError.message}`);

        if (!recordsData || recordsData.length === 0) {
          // 기록이 없을 때 샘플 데이터 사용
          const { company, site, laborRows } = getSampleData();
          setState((prev) => ({
            ...prev,
            isLoading: false,
            company,
            site,
            laborRows,
            monthDates: calculateMonthDates(targetMonth),
          }));
          return;
        }

        // 4. 근로자 ID 목록 추출
        const workerIds = Array.from(
          new Set(
            recordsData
              .map((record) => record.daily_worker_id)
              .filter((id): id is number => id !== null)
          )
        );

        // 5. 근로자 정보 조회
        let workersData: any[] = [];
        if (workerIds.length > 0) {
          const { data: workers, error: workersError } = await supabase
            .from("daily_workers")
            .select("*")
            .in("id", workerIds);

          if (workersError) throw new Error(`근로자 정보 조회 실패: ${workersError.message}`);
          workersData = workers || [];
        }

        const workerMap = new Map(workersData.map((w) => [w.id, w]));

        // 6. 데이터 변환
        const laborRows = recordsData.map((record) => {
          const worker = workerMap.get(record.daily_worker_id);

          return {
            workerName: worker?.name || "(근로자 정보 없음)",
            residentNumber: worker?.resident_number || "-",
            phone: worker?.phone || "-",
            jobType: worker?.job_type || "-",

            // 공수 정보
            dailyWorkEntries: record.work_entries?.reduce((acc: Record<string, number | null>, entry: WorkEntry) => {
              if (entry.date) {
                acc[entry.date] = entry.units || null;
              }
              return acc;
            }, {}) || {},
            totalWorkUnits: record.total_work_units || 0,

            // 금액 정보
            unitPrice: record.work_entries?.length > 0
              ? (record.gross_amount / record.total_work_units) || 0
              : 0,
            grossAmount: record.gross_amount || 0,

            // 공제 정보 (현재는 0으로 초기화, 나중에 확대)
            nationalPension: 0,
            healthInsurance: 0,
            longTermCareInsurance: 0,
            employmentInsurance: 0,
            incomeTax: 0,
            localIncomeTax: 0,
            otherDeductions: 0,

            // 최종 정산
            totalDeductions: 0,
            netPayment: record.gross_amount || 0,
          } satisfies PrintLaborRow;
        });

        setState((prev) => ({
          ...prev,
          isLoading: false,
          company: companyData,
          site: siteData,
          laborRows,
          monthDates: calculateMonthDates(targetMonth),
        }));
      } catch (err) {
        console.error("데이터 로드 실패:", err);
        // 데이터 로드 실패 시 샘플 데이터 사용
        const { company, site, laborRows } = getSampleData();
        setState((prev) => ({
          ...prev,
          isLoading: false,
          company,
          site,
          laborRows,
          monthDates: calculateMonthDates(targetMonth),
        }));
      }
    };

    loadData();
  }, [companyId, siteId, targetMonth]);

  if (state.isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-3xl text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-8 w-32 mx-auto rounded bg-slate-300"></div>
            <div className="h-4 w-48 mx-auto rounded bg-slate-200"></div>
            <p className="text-sm text-slate-600 mt-4">노무비명세표를 불러오는 중입니다...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          html,
          body {
            margin: 0;
            padding: 0;
            background: white;
            width: 100%;
          }

          * {
            box-sizing: border-box;
          }

          .print-controls {
            display: none !important;
          }

          .print-document {
            max-width: none;
            margin: 0;
            padding: 0;
            border: none;
            box-shadow: none;
            page-break-after: avoid;
          }

          .print-header {
            page-break-after: avoid;
          }

          .print-section {
            page-break-inside: avoid;
            margin-bottom: 12pt;
          }

          table {
            page-break-inside: avoid;
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt;
          }

          tbody tr {
            page-break-inside: avoid;
          }

          tr:last-child {
            page-break-after: avoid;
          }

          @page {
            size: A4;
            margin: 8mm;
          }
        }

        @media screen {
          body {
            background-color: #f8fafc;
          }
        }
      `}</style>

      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 print:bg-white print:px-0 print:py-0">
        {/* 도구 모음 (인쇄 시 숨김) */}
        <div className="print-controls mx-auto max-w-4xl mb-4 flex gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            인쇄 / PDF 저장
          </button>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            돌아가기
          </button>
        </div>

        {/* 출력 문서 */}
        <div className="print-document mx-auto max-w-4xl rounded-lg border border-slate-300 bg-white p-6 shadow-sm print:rounded-none print:border-none print:shadow-none">
          {/* 제목 */}
          <div className="print-header mb-6 border-b-2 border-blue-700 pb-4 print:mb-3 print:pb-2">
            <p className="text-center text-xs tracking-widest text-slate-500 print:text-[8pt]">LABOR STATEMENT</p>
            <h1 className="mt-2 text-center text-3xl font-bold tracking-tight text-slate-900 print:text-xl print:mt-1">노무비 명세서</h1>
          </div>

          {/* 기본 정보 섹션 */}
          <div className="print-section mb-6">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 print:text-sm print:mb-2">기본정보</h2>
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 print:grid-cols-4 print:gap-2 print:p-2 print:rounded-none print:border-slate-300">
              <div>
                <p className="text-sm font-medium text-slate-600 print:text-[9pt]">회사명</p>
                <p className="mt-1 text-base text-slate-900 print:text-[10pt] print:mt-0.5">{state.company?.name || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 print:text-[9pt]">현장명</p>
                <p className="mt-1 text-base text-slate-900 print:text-[10pt] print:mt-0.5">{state.site?.name || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 print:text-[9pt]">기준월</p>
                <p className="mt-1 text-base text-slate-900 print:text-[10pt] print:mt-0.5">{state.targetMonth || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 print:text-[9pt]">인원수</p>
                <p className="mt-1 text-base text-slate-900 print:text-[10pt] print:mt-0.5">{state.laborRows.length}명</p>
              </div>
            </div>
          </div>

          {/* 근로자별 상세 데이터 테이블 */}
          <div className="print-section mb-6">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 print:text-sm print:mb-1">근로자 현황</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm print:text-[9pt]">
                <thead>
                  <tr className="bg-blue-100">
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-left font-semibold print:px-1 print:py-1">번호</th>
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-left font-semibold print:px-1 print:py-1">직종</th>
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-left font-semibold print:px-1 print:py-1">성명</th>
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-left font-semibold print:px-1 print:py-1">전화번호</th>
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-left font-semibold print:px-1 print:py-1">주민번호</th>
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-right font-semibold print:px-1 print:py-1">총공수</th>
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-right font-semibold print:px-1 print:py-1">단가</th>
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-right font-semibold print:px-1 print:py-1">지급액</th>
                  </tr>
                </thead>
                <tbody>
                  {state.laborRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="border border-slate-300 px-4 py-3 text-center text-slate-600">
                        등록된 근로자가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    state.laborRows.map((row, index) => (
                      <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="border border-slate-300 px-2 py-2 text-center print:px-1 print:py-0.5">{index + 1}</td>
                        <td className="border border-slate-300 px-2 py-2 print:px-1 print:py-0.5">{row.jobType}</td>
                        <td className="border border-slate-300 px-2 py-2 print:px-1 print:py-0.5">{row.workerName}</td>
                        <td className="border border-slate-300 px-2 py-2 print:px-1 print:py-0.5">{row.phone}</td>
                        <td className="border border-slate-300 px-2 py-2 print:px-1 print:py-0.5">{row.residentNumber}</td>
                        <td className="border border-slate-300 px-2 py-2 text-right tabular-nums print:px-1 print:py-0.5">{row.totalWorkUnits.toLocaleString()}</td>
                        <td className="border border-slate-300 px-2 py-2 text-right tabular-nums print:px-1 print:py-0.5">₩{row.unitPrice.toLocaleString()}</td>
                        <td className="border border-slate-300 px-2 py-2 text-right tabular-nums print:px-1 print:py-0.5">₩{row.grossAmount.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 공제 항목 섹션 */}
          <div className="print-section mb-6">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 print:text-sm print:mb-1">공제 현황</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm print:text-[9pt]">
                <thead>
                  <tr className="bg-blue-100">
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-left font-semibold print:px-1 print:py-1">성명</th>
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-right font-semibold print:px-1 print:py-1">국민연금</th>
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-right font-semibold print:px-1 print:py-1">건강보험</th>
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-right font-semibold print:px-1 print:py-1">장기요양</th>
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-right font-semibold print:px-1 print:py-1">고용보험</th>
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-right font-semibold print:px-1 print:py-1">소득세</th>
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-right font-semibold print:px-1 print:py-1">지방소득세</th>
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-right font-semibold print:px-1 print:py-1">기타공제</th>
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-right font-semibold print:px-1 print:py-1">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {state.laborRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="border border-slate-300 px-4 py-3 text-center text-slate-600">
                        등록된 근로자가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    state.laborRows.map((row, index) => (
                      <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="border border-slate-300 px-2 py-2 print:px-1 print:py-0.5">{row.workerName}</td>
                        <td className="border border-slate-300 px-2 py-2 text-right tabular-nums print:px-1 print:py-0.5">₩{row.nationalPension.toLocaleString()}</td>
                        <td className="border border-slate-300 px-2 py-2 text-right tabular-nums print:px-1 print:py-0.5">₩{row.healthInsurance.toLocaleString()}</td>
                        <td className="border border-slate-300 px-2 py-2 text-right tabular-nums print:px-1 print:py-0.5">₩{row.longTermCareInsurance.toLocaleString()}</td>
                        <td className="border border-slate-300 px-2 py-2 text-right tabular-nums print:px-1 print:py-0.5">₩{row.employmentInsurance.toLocaleString()}</td>
                        <td className="border border-slate-300 px-2 py-2 text-right tabular-nums print:px-1 print:py-0.5">₩{row.incomeTax.toLocaleString()}</td>
                        <td className="border border-slate-300 px-2 py-2 text-right tabular-nums print:px-1 print:py-0.5">₩{row.localIncomeTax.toLocaleString()}</td>
                        <td className="border border-slate-300 px-2 py-2 text-right tabular-nums print:px-1 print:py-0.5">₩{row.otherDeductions.toLocaleString()}</td>
                        <td className="border border-slate-300 px-2 py-2 text-right font-semibold tabular-nums print:px-1 print:py-0.5">₩{row.totalDeductions.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 최종 정산 섹션 */}
          <div className="print-section mb-6">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 print:text-sm print:mb-1">최종 정산</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm print:text-[9pt]">
                <thead>
                  <tr className="bg-blue-100">
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-left font-semibold print:px-1 print:py-1">성명</th>
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-right font-semibold print:px-1 print:py-1">지급액</th>
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-right font-semibold print:px-1 print:py-1">공제합계</th>
                    <th className="border border-slate-300 bg-blue-50 px-2 py-2 text-right font-semibold print:px-1 print:py-1">실지급액</th>
                  </tr>
                </thead>
                <tbody>
                  {state.laborRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="border border-slate-300 px-4 py-3 text-center text-slate-600">
                        등록된 근로자가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    state.laborRows.map((row, index) => (
                      <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="border border-slate-300 px-2 py-2 print:px-1 print:py-0.5">{row.workerName}</td>
                        <td className="border border-slate-300 px-2 py-2 text-right tabular-nums print:px-1 print:py-0.5">₩{row.grossAmount.toLocaleString()}</td>
                        <td className="border border-slate-300 px-2 py-2 text-right tabular-nums print:px-1 print:py-0.5">₩{row.totalDeductions.toLocaleString()}</td>
                        <td className="border border-slate-300 px-2 py-2 text-right font-semibold text-blue-700 tabular-nums print:px-1 print:py-0.5">₩{row.netPayment.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 총괄 요약 */}
          {state.laborRows.length > 0 && (
            <div className="print-section border-t-2 border-blue-700 pt-4 print:pt-2 print:mt-2">
              <div className="grid grid-cols-4 gap-4 print:grid-cols-4 print:gap-1">
                <div className="rounded bg-blue-50 p-3 print:p-1.5 print:rounded-none print:border print:border-slate-300">
                  <p className="text-xs font-medium text-slate-600 print:text-[8pt]">총 인원</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 print:text-[11pt] print:mt-0.5">{state.laborRows.length}명</p>
                </div>
                <div className="rounded bg-blue-50 p-3 print:p-1.5 print:rounded-none print:border print:border-slate-300">
                  <p className="text-xs font-medium text-slate-600 print:text-[8pt]">총 지급액</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums print:text-[11pt] print:mt-0.5">
                    ₩{state.laborRows.reduce((sum, row) => sum + row.grossAmount, 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded bg-blue-50 p-3 print:p-1.5 print:rounded-none print:border print:border-slate-300">
                  <p className="text-xs font-medium text-slate-600 print:text-[8pt]">총 공제액</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums print:text-[11pt] print:mt-0.5">
                    ₩{state.laborRows.reduce((sum, row) => sum + row.totalDeductions, 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded bg-blue-700 p-3 print:p-1.5 print:rounded-none print:bg-white print:border print:border-blue-700">
                  <p className="text-xs font-medium text-white print:text-[8pt] print:text-slate-900">최종 지급액</p>
                  <p className="mt-1 text-lg font-bold text-white tabular-nums print:text-[11pt] print:mt-0.5 print:text-slate-900">
                    ₩{state.laborRows.reduce((sum, row) => sum + row.netPayment, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PrintPageContent />
    </Suspense>
  );
}