"use client";

import { Suspense, useEffect, useState } from 'react';
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

interface PrintPageContentProps {}

function PrintPageContent({}: PrintPageContentProps) {
  const searchParams = useSearchParams();
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

        const companyId = searchParams.get('companyId');
        const siteId = searchParams.get('siteId');
        const targetMonth = searchParams.get('targetMonth');

        console.log('Search params:', { companyId, siteId, targetMonth });

        if (!companyId || !siteId || !targetMonth) {
          console.log('Missing required params, using sample data');
          // 파라미터 없으면 샘플 데이터 사용
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

        const parsedCompanyId = parseInt(companyId);
        const parsedSiteId = parseInt(siteId);

        if (isNaN(parsedCompanyId) || isNaN(parsedSiteId)) {
          throw new Error('잘못된 파라미터 형식입니다');
        }

        // 회사 정보 로드
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', parsedCompanyId)
          .single();

        if (companyError) {
          console.error('Company load error:', companyError);
          throw new Error(`회사 정보 조회 실패: ${companyError.message}`);
        }

        // 현장 정보 로드
        const { data: site, error: siteError } = await supabase
          .from('sites')
          .select('*')
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
          .eq('company_id', parsedCompanyId);

        if (workersError) {
          console.error('Workers load error:', workersError);
          throw new Error(`근로자 정보 조회 실패: ${workersError.message}`);
        }

        // 월별 기록 로드
        const { data: records, error: recordsError } = await supabase
          .from('daily_worker_monthly_records')
          .select('*')
          .eq('site_id', parsedSiteId)
          .eq('target_month', targetMonth);

        if (recordsError) {
          console.error('Records load error:', recordsError);
          throw new Error(`기록 조회 실패: ${recordsError.message}`);
        }

        console.log('Loaded data:', { company, site, workers: workers?.length, records: records?.length });

        setData({
          company,
          site,
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
  }, [searchParams]);

  if (isLoading) {
    return <div>데이터를 불러오는 중...</div>;
  }

  if (error && !data.company) {
    return <div>에러: {error}</div>;
  }

  const targetMonth = searchParams.get('targetMonth') || '2024-04';
  const [year, month] = targetMonth.split('-');

  return (
    <div className="print-container" style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', lineHeight: '1.4' }}>
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
              <td style={{ border: '1px solid #000', padding: '8px' }}>{data.company?.name}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', textAlign: 'center' }}>현장명</td>
              <td style={{ border: '1px solid #000', padding: '8px' }}>{data.site?.name}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', textAlign: 'center' }}>기간</td>
              <td style={{ border: '1px solid #000', padding: '8px' }}>{year}년 {month}월</td>
            </tr>
          </tbody>
        </table>
      </div>

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