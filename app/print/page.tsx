"use client";

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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
}

interface DailyWorker {
  id: string;
  name: string;
  phone?: string;
  resident_number?: string;
  job_type?: string;
  company_id?: number;
  site_id?: number;
  hourly_rate: number;
}

interface WorkEntry {
  date?: string;
  units?: number;
}

interface DailyWorkerMonthlyRecord {
  id: string;
  daily_worker_id: string;
  site_id: number;
  target_month: string;
  work_entries: WorkEntry[];
  total_work_units: number;
  gross_amount: number;
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
}

function getMonthLastDay(targetMonth: string) {
  if (!/^[0-9]{4}-[0-9]{2}$/.test(targetMonth)) {
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
  const startDate = `${targetMonth}-01`;
  const endDate = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;
  return `${startDate} ~ ${endDate}`;
}

function PrintPageContent() {
  const searchParams = useSearchParams();
  const targetMonthParam = searchParams?.get('targetMonth');
  const queryYear = searchParams?.get('year') || '2024';
  const queryMonth = searchParams?.get('month') || '12';
  const targetMonth = targetMonthParam || `${queryYear}-${queryMonth.padStart(2, '0')}`;
  const [year, month] = targetMonth.split('-');
  const normalizedYear = year || '2024';
  const normalizedMonth = month?.padStart(2, '0') || '12';
  const siteId = searchParams?.get('siteId');
  const monthPeriod = useMemo(() => getMonthPeriod(`${normalizedYear}-${normalizedMonth}`), [normalizedYear, normalizedMonth]);

  console.log('Search params:', { targetMonth, normalizedYear, normalizedMonth, siteId });

  console.log('Search params:', { year, month, siteId });

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

  // 항상 최상단에서 Hook 호출
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // siteId가 없으면 빈 데이터로 처리
        if (!siteId) {
          console.log('No siteId provided, showing empty state');
          setData({
            company: null,
            site: null,
            workers: [],
            records: [],
          });
          return;
        }

        const parsedSiteId = parseInt(siteId);
        if (isNaN(parsedSiteId)) {
          throw new Error('잘못된 siteId 파라미터 형식입니다');
        }

        // 현장 정보 및 회사 정보 로드 (.single() 제거하여 안전하게 처리)
        const { data: sitesData, error: siteError } = await supabase
          .from('sites')
          .select('*, companies(*)')
          .eq('id', parsedSiteId);

        if (siteError) {
          console.error('Site load error:', siteError);
          throw new Error(`현장 정보 조회 실패: ${siteError.message}`);
        }

        console.log('Sites query result count:', sitesData?.length || 0);

        // 결과 검증 및 처리
        if (!sitesData || sitesData.length === 0) {
          console.log('No site found for siteId:', parsedSiteId);
          throw new Error('현장 정보를 찾을 수 없습니다');
        }

        if (sitesData.length > 1) {
          console.warn('Multiple sites found for siteId:', parsedSiteId, 'using first one');
        }

        const siteData = sitesData[0]; // 첫 번째 결과 사용

        // 근로자 정보 로드 (company_id 기준으로 조회)
        console.log('Querying daily_workers with company_id:', siteData.company_id);
        const { data: workers, error: workersError } = await supabase
          .from('daily_workers')
          .select('*')
          .eq('company_id', siteData.company_id);

        if (workersError) {
          console.error('Workers load error:', workersError);
          throw new Error(`근로자 정보 조회 실패: ${workersError.message}`);
        }

        // 월별 기록 로드
        console.log('Querying daily_worker_monthly_records with site_id:', parsedSiteId, 'target_month:', `${normalizedYear}-${normalizedMonth}`);
        const { data: records, error: recordsError } = await supabase
          .from('daily_worker_monthly_records')
          .select('*')
          .eq('site_id', parsedSiteId)
          .eq('target_month', `${normalizedYear}-${normalizedMonth}`);

        if (recordsError) {
          console.error('Records load error:', recordsError);
          throw new Error(`기록 조회 실패: ${recordsError.message}`);
        }

        console.log('Query results - workers:', workers?.length || 0, 'records:', records?.length || 0);

        setData({
          company: siteData.companies || null,
          site: siteData,
          workers: workers || [],
          records: records || [],
        });
      } catch (err) {
        console.error('Data load failed:', err);
        setError(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다');
        // 에러 시 빈 데이터로 설정
        setData({
          company: null,
          site: null,
          workers: [],
          records: [],
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [targetMonth, siteId]);

  // 항상 최상단에서 Hook 호출
  const statementRows = useMemo(() => {
    try {
      if (!data.workers || !data.records) {
        console.log('No data available for statement rows');
        return [];
      }

      const workerMap = new Map(data.workers.map((worker) => [worker.id, worker]));

      return data.records.map((record) => {
        const workerId = record.daily_worker_id;
        const worker = workerId ? workerMap.get(workerId) : undefined;

        // work_entries에서 일별 공수 계산
        const dailyWorkEntries: { [date: string]: string } = {};
        if (record.work_entries && Array.isArray(record.work_entries)) {
          record.work_entries.forEach(entry => {
            if (entry.date && entry.units !== undefined && entry.units > 0) {
              dailyWorkEntries[entry.date] = String(entry.units);
            }
          });
        }

        const totalWorkUnits = record.total_work_units || 0;
        const grossAmount = record.gross_amount || 0;
        const unitPrice = worker?.hourly_rate || (totalWorkUnits > 0 ? grossAmount / totalWorkUnits : 0);

        return {
          id: record.id,
          name: worker?.name || `근로자 #${workerId || "-"}`,
          residentId: worker?.resident_number || "",
          trade: worker?.job_type || "",
          unitPrice: unitPrice || 0,
          dailyWorkEntries,
          totalWorkUnits,
          grossAmount,
          note: "",
          category: "",
        };
      });
    } catch (err) {
      console.error('Error creating statement rows:', err);
      return [];
    }
  }, [data.workers, data.records]);

  // 날짜별 공수 계산을 위한 날짜 목록
  const monthDates = useMemo(() => {
    try {
      const parsedYear = parseInt(String(normalizedYear));
      const parsedMonth = parseInt(String(normalizedMonth));
      if (isNaN(parsedYear) || isNaN(parsedMonth)) {
        return Array.from({ length: 31 }, (_, i) => `2024-12-${String(i + 1).padStart(2, '0')}`);
      }
      const daysInMonth = new Date(parsedYear, parsedMonth, 0).getDate();
      return Array.from({ length: daysInMonth }, (_, i) => {
        const date = new Date(parsedYear, parsedMonth - 1, i + 1);
        return date.toISOString().split('T')[0];
      });
    } catch (err) {
      console.error('Error creating month dates:', err);
      return Array.from({ length: 31 }, (_, i) => `2024-12-${String(i + 1).padStart(2, '0')}`);
    }
  }, [normalizedYear, normalizedMonth]);

  console.log('Statement rows:', statementRows.length, statementRows[0]);

  // 조건부 렌더링은 Hook 호출 이후에만
  if (isLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        데이터를 불러오는 중...
      </div>
    );
  }

  // siteId가 없으면 안내 메시지 표시
  if (!siteId) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>출력 조건이 없습니다</h2>
        <p>현장 ID(siteId)를 URL 파라미터로 전달해 주세요.</p>
        <p>예: /print?siteId=1&year=2024&month=12</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        <h2>출력 데이터를 불러오지 못했습니다</h2>
        <p>{error}</p>
        <p>콘솔에서 자세한 오류 정보를 확인하세요.</p>
      </div>
    );
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

      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <h1 style={{ margin: '0', fontSize: '18px', fontWeight: 'bold' }}>노무현황표</h1>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #000', padding: '8px', width: '20%', fontWeight: 'bold', textAlign: 'center' }}>사업장명</td>
              <td style={{ border: '1px solid #000', padding: '8px' }}>{data.company?.name || '정보 없음'}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', textAlign: 'center' }}>현장명</td>
              <td style={{ border: '1px solid #000', padding: '8px' }}>{data.site?.name || '정보 없음'}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', textAlign: 'center' }}>기간</td>
              <td style={{ border: '1px solid #000', padding: '8px' }}>{monthPeriod}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 근로자 데이터 테이블 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '20px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f0f0f0' }}>
            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>순번</th>
            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>성명</th>
            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>주민등록번호</th>
            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>직종</th>
            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>단가</th>
            {monthDates.map(date => (
              <th key={date} style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontSize: '9px', fontWeight: 'bold' }}>
                {(() => {
                  try {
                    const dateObj = new Date(date);
                    return isNaN(dateObj.getTime()) ? date.split('-')[2] : dateObj.getDate();
                  } catch (err) {
                    console.error('Error parsing date for header:', err);
                    return date.split('-')[2] || '1';
                  }
                })()}
              </th>
            ))}
            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>총공수</th>
            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>지급액</th>
            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>비고</th>
            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>구분</th>
          </tr>
        </thead>
        <tbody>
          {(!Array.isArray(statementRows) || statementRows.length === 0) ? (
            <tr>
              <td colSpan={5 + monthDates.length + 5} style={{ border: '1px solid #000', padding: '20px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
                근무내역이 없습니다
              </td>
            </tr>
          ) : (
            statementRows.map((row, index) => (
              <tr key={row.id}>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{index + 1}</td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{row?.name || ''}</td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontSize: '9px' }}>{row?.residentId || ''}</td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{row?.trade || ''}</td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>
                  {(() => {
                    try {
                      const price = row?.unitPrice || 0;
                      return typeof price === 'number' ? price.toLocaleString() : '0';
                    } catch (err) {
                      console.error('Error formatting unit price:', err);
                      return '0';
                    }
                  })()}
                </td>
                {monthDates.map(date => {
                  const units = (() => {
                    try {
                      const entry = row?.dailyWorkEntries?.[date] || '0';
                      const parsed = parseFloat(String(entry));
                      return isNaN(parsed) ? 0 : parsed;
                    } catch (err) {
                      console.error('Error parsing daily work units:', err);
                      return 0;
                    }
                  })();
                  return (
                    <td key={date} style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>
                      {units > 0 ? units : ''}
                    </td>
                  );
                })}
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{row?.totalWorkUnits || 0}</td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>
                  {(() => {
                    try {
                      const amount = row?.grossAmount || 0;
                      return typeof amount === 'number' ? amount.toLocaleString() : '0';
                    } catch (err) {
                      console.error('Error formatting gross amount:', err);
                      return '0';
                    }
                  })()}
                </td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{row?.note || ''}</td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{row?.category || ''}</td>
              </tr>
            ))
          )}
          {/* 합계 행 */}
          <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }} colSpan={5}>합계</td>
            {monthDates.map(() => (
              <td key={`total-${Math.random()}`} style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}></td>
            ))}
            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>
              {(() => {
                try {
                  if (!Array.isArray(statementRows)) return 0;
                  return statementRows.reduce((sum, row) => sum + (row?.totalWorkUnits || 0), 0);
                } catch (err) {
                  console.error('Error calculating total work units:', err);
                  return 0;
                }
              })()}
            </td>
            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>
              {(() => {
                try {
                  if (!Array.isArray(statementRows)) return '0';
                  const total = statementRows.reduce((sum, row) => sum + (row?.grossAmount || 0), 0);
                  return typeof total === 'number' ? total.toLocaleString() : '0';
                } catch (err) {
                  console.error('Error calculating total gross amount:', err);
                  return '0';
                }
              })()}
            </td>
            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}></td>
            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>
              {Array.isArray(statementRows) ? `${statementRows.length}명` : '0명'}
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: '20px', textAlign: 'center' }} className="no-print">
        <button onClick={() => window.print()} style={{ padding: '10px 20px', fontSize: '14px' }}>
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