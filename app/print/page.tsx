'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Company, Site, DailyWorker, DailyWorkerMonthlyRecord } from '@/lib/employee-status';

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

  useEffect(() => {
    const loadData = async () => {
      const companyId = searchParams.get('companyId');
      const siteId = searchParams.get('siteId');
      const year = searchParams.get('year');
      const month = searchParams.get('month');

      if (!companyId || !siteId || !year || !month) return;

      // 회사 정보 로드
      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      // 현장 정보 로드
      const { data: site } = await supabase
        .from('sites')
        .select('*')
        .eq('id', siteId)
        .single();

      // 근로자 정보 로드
      const { data: workers } = await supabase
        .from('daily_workers')
        .select('*')
        .eq('site_id', siteId);

      // 월별 기록 로드
      const { data: records } = await supabase
        .from('daily_worker_monthly_records')
        .select('*')
        .eq('site_id', siteId)
        .eq('year', parseInt(year))
        .eq('month', parseInt(month));

      setData({
        company,
        site,
        workers: workers || [],
        records: records || [],
      });
    };

    loadData();
  }, [searchParams]);

  if (!data.company || !data.site) {
    return <div>데이터를 불러오는 중...</div>;
  }

  const year = searchParams.get('year');
  const month = searchParams.get('month');

  // 날짜별 공수 계산
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const daysInMonth = getDaysInMonth(parseInt(year!), parseInt(month!));

  // 근로자별 날짜별 공수 맵 생성
  const workerDateMap = new Map<string, Map<string, number>>();
  data.records.forEach(record => {
    if (!workerDateMap.has(record.worker_id)) {
      workerDateMap.set(record.worker_id, new Map());
    }
    workerDateMap.get(record.worker_id)!.set(record.date, record.work_hours);
  });

  // 근로자별 총 공수 계산
  const workerTotalHours = new Map<string, number>();
  data.workers.forEach(worker => {
    const total = Array.from({ length: daysInMonth }, (_, i) => {
      const date = `${year}-${month!.padStart(2, '0')}-${(i + 1).toString().padStart(2, '0')}`;
      return workerDateMap.get(worker.id)?.get(date) || 0;
    }).reduce((sum, hours) => sum + hours, 0);
    workerTotalHours.set(worker.id, total);
  });

  // 합계 계산
  const totalWorkers = data.workers.length;
  const totalHours = Array.from(workerTotalHours.values()).reduce((sum, hours) => sum + hours, 0);
  const totalPayment = data.workers.reduce((sum, worker) => sum + (workerTotalHours.get(worker.id) || 0) * worker.hourly_rate, 0);

  return (
    <div className="print-container">
      <style jsx>{`
        @page {
          size: A4 landscape;
          margin: 5mm;
        }
        .print-container {
          font-family: 'Malgun Gothic', sans-serif;
          font-size: 10px;
          line-height: 1.2;
          color: black;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
        }
        th, td {
          border: 1px solid black;
          padding: 2px 4px;
          text-align: center;
          vertical-align: middle;
        }
        th {
          background-color: #f0f0f0;
          font-weight: bold;
        }
        .header-info {
          margin-bottom: 10px;
        }
        .header-info table {
          width: 100%;
        }
        .header-info th, .header-info td {
          border: none;
          text-align: left;
          padding: 2px 0;
        }
        .main-table {
          font-size: 9px;
        }
        .main-table th, .main-table td {
          padding: 1px 2px;
        }
        .total-row {
          background-color: #e0e0e0;
          font-weight: bold;
        }
        .worker-row:nth-child(even) {
          background-color: #f9f9f9;
        }
        .date-column {
          width: 20px;
          min-width: 20px;
        }
        .narrow-column {
          width: 40px;
          min-width: 40px;
        }
        .medium-column {
          width: 60px;
          min-width: 60px;
        }
        .wide-column {
          width: 80px;
          min-width: 80px;
        }
        .extra-wide-column {
          width: 100px;
          min-width: 100px;
        }
      `}</style>

      {/* 기본 정보 */}
      <div className="header-info">
        <table>
          <tbody>
            <tr>
              <th>회사명:</th>
              <td>{data.company.name}</td>
              <th>현장명:</th>
              <td>{data.site.name}</td>
              <th>기간:</th>
              <td>{year}년 {month}월</td>
            </tr>
            <tr>
              <th>사업자등록번호:</th>
              <td>{data.company.business_number}</td>
              <th>대표자:</th>
              <td>{data.company.representative}</td>
              <th>주소:</th>
              <td>{data.site.address}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 메인 표 */}
      <table className="main-table">
        <thead>
          <tr>
            <th className="narrow-column">번호</th>
            <th className="medium-column">직종</th>
            <th className="medium-column">성명</th>
            <th className="wide-column">전화번호</th>
            <th className="extra-wide-column">주민번호</th>
            {Array.from({ length: daysInMonth }, (_, i) => (
              <th key={i + 1} className="date-column">{i + 1}</th>
            ))}
            <th className="narrow-column">총공수</th>
            <th className="medium-column">단가</th>
            <th className="wide-column">지급액</th>
            <th className="narrow-column">국민연금</th>
            <th className="narrow-column">건강보험</th>
            <th className="narrow-column">고용보험</th>
            <th className="narrow-column">소득세</th>
            <th className="narrow-column">지방소득세</th>
            <th className="narrow-column">공제합계</th>
            <th className="wide-column">실지급액</th>
            <th className="medium-column">비고</th>
            <th className="narrow-column">구분</th>
          </tr>
        </thead>
        <tbody>
          {data.workers.map((worker, index) => {
            const totalHours = workerTotalHours.get(worker.id) || 0;
            const payment = totalHours * worker.hourly_rate;
            const deductions = {
              nationalPension: Math.round(payment * 0.045),
              healthInsurance: Math.round(payment * 0.03545),
              employmentInsurance: Math.round(payment * 0.008),
              incomeTax: Math.round(payment * 0.066),
              localIncomeTax: Math.round(payment * 0.0165),
            };
            const totalDeductions = Object.values(deductions).reduce((sum, deduction) => sum + deduction, 0);
            const netPayment = payment - totalDeductions;

            return (
              <tr key={worker.id} className="worker-row">
                <td>{index + 1}</td>
                <td>{worker.job_type}</td>
                <td>{worker.name}</td>
                <td>{worker.phone}</td>
                <td>{worker.resident_number}</td>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const date = `${year}-${month!.padStart(2, '0')}-${(i + 1).toString().padStart(2, '0')}`;
                  const hours = workerDateMap.get(worker.id)?.get(date) || 0;
                  return <td key={i + 1}>{hours || ''}</td>;
                })}
                <td>{totalHours}</td>
                <td>{worker.hourly_rate.toLocaleString()}</td>
                <td>{payment.toLocaleString()}</td>
                <td>{deductions.nationalPension.toLocaleString()}</td>
                <td>{deductions.healthInsurance.toLocaleString()}</td>
                <td>{deductions.employmentInsurance.toLocaleString()}</td>
                <td>{deductions.incomeTax.toLocaleString()}</td>
                <td>{deductions.localIncomeTax.toLocaleString()}</td>
                <td>{totalDeductions.toLocaleString()}</td>
                <td>{netPayment.toLocaleString()}</td>
                <td></td>
                <td>일용</td>
              </tr>
            );
          })}
          {/* 합계 행 */}
          <tr className="total-row">
            <td colSpan={5}>합계</td>
            {Array.from({ length: daysInMonth }, (_, i) => {
              const dayTotal = data.workers.reduce((sum, worker) => {
                const date = `${year}-${month!.padStart(2, '0')}-${(i + 1).toString().padStart(2, '0')}`;
                return sum + (workerDateMap.get(worker.id)?.get(date) || 0);
              }, 0);
              return <td key={i + 1}>{dayTotal || ''}</td>;
            })}
            <td>{totalHours}</td>
            <td></td>
            <td>{totalPayment.toLocaleString()}</td>
            <td>{data.workers.reduce((sum, worker) => {
              const totalHours = workerTotalHours.get(worker.id) || 0;
              const payment = totalHours * worker.hourly_rate;
              return sum + Math.round(payment * 0.045);
            }, 0).toLocaleString()}</td>
            <td>{data.workers.reduce((sum, worker) => {
              const totalHours = workerTotalHours.get(worker.id) || 0;
              const payment = totalHours * worker.hourly_rate;
              return sum + Math.round(payment * 0.03545);
            }, 0).toLocaleString()}</td>
            <td>{data.workers.reduce((sum, worker) => {
              const totalHours = workerTotalHours.get(worker.id) || 0;
              const payment = totalHours * worker.hourly_rate;
              return sum + Math.round(payment * 0.008);
            }, 0).toLocaleString()}</td>
            <td>{data.workers.reduce((sum, worker) => {
              const totalHours = workerTotalHours.get(worker.id) || 0;
              const payment = totalHours * worker.hourly_rate;
              return sum + Math.round(payment * 0.066);
            }, 0).toLocaleString()}</td>
            <td>{data.workers.reduce((sum, worker) => {
              const totalHours = workerTotalHours.get(worker.id) || 0;
              const payment = totalHours * worker.hourly_rate;
              return sum + Math.round(payment * 0.0165);
            }, 0).toLocaleString()}</td>
            <td>{data.workers.reduce((sum, worker) => {
              const totalHours = workerTotalHours.get(worker.id) || 0;
              const payment = totalHours * worker.hourly_rate;
              return sum + Object.values({
                nationalPension: Math.round(payment * 0.045),
                healthInsurance: Math.round(payment * 0.03545),
                employmentInsurance: Math.round(payment * 0.008),
                incomeTax: Math.round(payment * 0.066),
                localIncomeTax: Math.round(payment * 0.0165),
              }).reduce((sum, deduction) => sum + deduction, 0);
            }, 0).toLocaleString()}</td>
            <td>{data.workers.reduce((sum, worker) => {
              const totalHours = workerTotalHours.get(worker.id) || 0;
              const payment = totalHours * worker.hourly_rate;
              const deductions = Object.values({
                nationalPension: Math.round(payment * 0.045),
                healthInsurance: Math.round(payment * 0.03545),
                employmentInsurance: Math.round(payment * 0.008),
                incomeTax: Math.round(payment * 0.066),
                localIncomeTax: Math.round(payment * 0.0165),
              }).reduce((sum, deduction) => sum + deduction, 0);
              return sum + (payment - deductions);
            }, 0).toLocaleString()}</td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>
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