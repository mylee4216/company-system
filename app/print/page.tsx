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

function PrintPageContent() {
  const searchParams = useSearchParams();
  const year = searchParams.get('year') || '2024';
  const month = searchParams.get('month') || '12';

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

        const siteId = searchParams.get('siteId');
        if (!siteId) {
          console.warn('siteId 파라미터가 없어 샘플 데이터를 사용합니다');
          // siteId 없으면 샘플 데이터 사용
          setData({
            company: {
              id: 1,
              name: '테스트건설회사',
              business_number: '123-45-67890',
              address: '서울시 강남구',
              representative: '김대표'
            },
            site: {
              id: 1,
              name: '테스트현장',
              company_id: 1,
              client_name: '의뢰처',
              contract_type: '원도급',
              construction_start_date: '2024-01-01',
              construction_end_date: '2024-12-31',
              start_date: '2024-01-01',
              end_date: '2024-12-31',
              address: '현장주소'
            },
            workers: [
              {
                id: '1',
                name: '김철수',
                phone: '010-1234-5678',
                resident_number: '800101-1234567',
                job_type: '철근공',
                company_id: 1,
                site_id: 1,
                hourly_rate: 50000
              },
              {
                id: '2',
                name: '이영희',
                phone: '010-9876-5432',
                resident_number: '850202-2345678',
                job_type: '목공',
                company_id: 1,
                site_id: 1,
                hourly_rate: 55000
              }
            ],
            records: []
          });
          return;
        }

        const parsedSiteId = parseInt(siteId);
        if (isNaN(parsedSiteId)) {
          throw new Error('잘못된 siteId 파라미터 형식입니다');
        }

        // 현장 정보 및 회사 정보 로드
        const { data: siteData, error: siteError } = await supabase
          .from('sites')
          .select('*, companies(*)')
          .eq('id', parsedSiteId)
          .single();

        if (siteError) {
          console.error('Site load error:', siteError);
          throw new Error(`현장 정보 조회 실패: ${siteError.message}`);
        }

        // 근로자 정보 로드
        const { data: workers, error: workersError } = await supabase
          .from('daily_workers')
          .select('*')
          .eq('site_id', parsedSiteId);

        if (workersError) {
          console.error('Workers load error:', workersError);
          throw new Error(`근로자 정보 조회 실패: ${workersError.message}`);
        }

        // 월별 기록 로드
        const targetMonth = `${year}-${month.padStart(2, '0')}`;
        const { data: records, error: recordsError } = await supabase
          .from('daily_worker_monthly_records')
          .select('*')
          .eq('site_id', parsedSiteId)
          .eq('target_month', targetMonth);

        if (recordsError) {
          console.error('Records load error:', recordsError);
          throw new Error(`기록 조회 실패: ${recordsError.message}`);
        }

        console.log('Loaded data:', {
          company: siteData.companies,
          site: siteData,
          workers: workers?.length,
          records: records?.length
        });

        setData({
          company: siteData.companies || null,
          site: siteData,
          workers: workers || [],
          records: records || [],
        });
      } catch (err) {
        console.error('Data load failed:', err);
        setError(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다');
        // 에러 시에도 샘플 데이터 표시
        setData({
          company: {
            id: 1,
            name: '테스트건설회사',
            business_number: '123-45-67890',
            address: '서울시 강남구',
            representative: '김대표'
          },
          site: {
            id: 1,
            name: '테스트현장',
            company_id: 1,
            client_name: '의뢰처',
            contract_type: '원도급',
            construction_start_date: '2024-01-01',
            construction_end_date: '2024-12-31',
            start_date: '2024-01-01',
            end_date: '2024-12-31',
            address: '현장주소'
          },
          workers: [
            {
              id: '1',
              name: '김철수',
              phone: '010-1234-5678',
              resident_number: '800101-1234567',
              job_type: '철근공',
              company_id: 1,
              site_id: 1,
              hourly_rate: 50000
            },
            {
              id: '2',
              name: '이영희',
              phone: '010-9876-5432',
              resident_number: '850202-2345678',
              job_type: '목공',
              company_id: 1,
              site_id: 1,
              hourly_rate: 55000
            }
          ],
          records: []
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [searchParams, year, month]);

  if (isLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        데이터를 불러오는 중...
      </div>
    );
  }

  if (error && !data.company) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        <h2>출력 데이터를 불러오지 못했습니다</h2>
        <p>{error}</p>
        <p>콘솔에서 자세한 오류 정보를 확인하세요.</p>
      </div>
    );
  }

  // 메인 페이지와 동일한 로직으로 행 데이터 생성
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

  console.log('Statement rows:', statementRows.length, statementRows[0]);

  // 날짜별 공수 계산을 위한 날짜 목록
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };
  const daysInMonth = getDaysInMonth(parseInt(year), parseInt(month));
  const monthDates = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(parseInt(year), parseInt(month) - 1, i + 1);
    return date.toISOString().split('T')[0];
  });

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
              <td style={{ border: '1px solid #000', padding: '8px' }}>{year}년 {month}월</td>
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
                {new Date(date).getDate()}
              </th>
            ))}
            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>총공수</th>
            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>지급액</th>
            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>비고</th>
            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>구분</th>
          </tr>
        </thead>
        <tbody>
          {statementRows.length === 0 ? (
            <tr>
              <td colSpan={5 + monthDates.length + 5} style={{ border: '1px solid #000', padding: '20px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
                근무내역이 없습니다
              </td>
            </tr>
          ) : (
            statementRows.map((row, index) => (
              <tr key={row.id}>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{index + 1}</td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{row.name}</td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontSize: '9px' }}>{row.residentId}</td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{row.trade}</td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{row.unitPrice.toLocaleString()}</td>
                {monthDates.map(date => {
                  const units = parseFloat(row.dailyWorkEntries[date] || '0');
                  return (
                    <td key={date} style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>
                      {units > 0 ? units : ''}
                    </td>
                  );
                })}
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{row.totalWorkUnits}</td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{row.grossAmount.toLocaleString()}</td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{row.note}</td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{row.category}</td>
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
                  return statementRows.reduce((sum, row) => sum + (row.totalWorkUnits || 0), 0);
                } catch (err) {
                  console.error('Error calculating total work units:', err);
                  return 0;
                }
              })()}
            </td>
            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>
              {(() => {
                try {
                  return statementRows.reduce((sum, row) => sum + (row.grossAmount || 0), 0).toLocaleString();
                } catch (err) {
                  console.error('Error calculating total gross amount:', err);
                  return '0';
                }
              })()}
            </td>
            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}></td>
            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{statementRows.length}명</td>
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