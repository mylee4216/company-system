"use client";

import React, { useState } from 'react';
import { Printer, Save, Plus, Trash2 } from 'lucide-react';

interface LaborEntry {
  id: number;
  jobType: string;
  name: string;
  phone: string;
  address: string;
  rrn: string;
  account: string;
  days: (string | number)[]; // 1~31일 출근 기록
  workCount: number;
  unitPrice: number;
  totalAmount: number;
  nationalPension: number;
  healthInsurance: number;
  employmentInsurance: number;
  incomeTax: number;
  localTax: number;
  deductionTotal: number;
  netPay: number;
  note: string;
}

export default function LaborStatementPageV3() {
  const [companyName, setCompanyName] = useState("건설혁신(주)");
  const [startDate, setStartDate] = useState("2026-04-01");
  const [endDate, setEndDate] = useState("2026-04-30");
  const [projectName, setProjectName] = useState("신축공사 현장");

  // 초기 더미 데이터
  const [data, setData] = useState<LaborEntry[]>([
    {
      id: 1, jobType: "형틀목공", name: "홍길동", phone: "010-1234-5678", address: "서울시 강남구...",
      rrn: "800101-1******", account: "국민 123-456-789",
      days: Array(31).fill(""), workCount: 0, unitPrice: 200000, totalAmount: 0,
      nationalPension: 0, healthInsurance: 0, employmentInsurance: 0, incomeTax: 0, localTax: 0,
      deductionTotal: 0, netPay: 0, note: ""
    }
  ]);

  const addRow = () => {
    const newRow: LaborEntry = {
      id: Date.now(), jobType: "", name: "", phone: "", address: "", rrn: "", account: "",
      days: Array(31).fill(""), workCount: 0, unitPrice: 0, totalAmount: 0,
      nationalPension: 0, healthInsurance: 0, employmentInsurance: 0, incomeTax: 0, localTax: 0,
      deductionTotal: 0, netPay: 0, note: ""
    };
    setData([...data, newRow]);
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen font-sans">
      <div className="max-w-[1600px] mx-auto mb-3 text-sm font-bold text-blue-700">
        노무비명세서 V3 테스트
      </div>
      <div className="max-w-[1600px] mx-auto bg-white p-8 shadow-lg rounded-lg">
        
        {/* 상단 설정 영역 */}
        <div className="flex justify-between items-end mb-6 border-b pb-4">
          <div className="grid grid-cols-3 gap-4 flex-1">
            <div>
              <label className="block text-xs font-bold mb-1">상호</label>
              <input type="text" value={companyName} onChange={(e)=>setCompanyName(e.target.value)} className="w-full border p-2 rounded" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">기간</label>
              <div className="flex items-center gap-2">
                <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="border p-2 rounded flex-1" />
                <span>~</span>
                <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="border p-2 rounded flex-1" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">공사명</label>
              <input type="text" value={projectName} onChange={(e)=>setProjectName(e.target.value)} className="w-full border p-2 rounded" />
            </div>
          </div>
          <div className="ml-4 flex gap-2">
            <button onClick={addRow} className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
              <Plus size={16} /> 행 추가
            </button>
            <button className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition">
              <Save size={16} /> 저장
            </button>
            <button onClick={() => window.open('/labor-statement-print-page-v3', '_blank')} className="flex items-center gap-1 bg-gray-800 text-white px-4 py-2 rounded hover:bg-black transition">
              <Printer size={16} /> 인쇄하기
            </button>
          </div>
        </div>

        <h1 className="text-3xl font-black text-center my-8 tracking-[0.5em]">년 월 일용노무비지급명세서</h1>

        {/* 메인 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-2 border-black text-[11px]">
            <thead>
              <tr className="bg-gray-50">
                <th rowSpan={2} className="border border-black w-10">직종</th>
                <th className="border border-black w-24">성명</th>
                <th className="border border-black w-32">전화번호</th>
                <th className="border border-black">주소</th>
                {/* 1~15일 */}
                {Array.from({length: 15}, (_, i) => (
                  <th key={i+1} className="border border-black w-6 text-red-600">{i+1}</th>
                ))}
                <th rowSpan={2} className="border border-black w-10">근로<br/>일수</th>
                <th rowSpan={2} className="border border-black w-20">노무비<br/>단가</th>
                <th rowSpan={2} className="border border-black w-24">노무비<br/>총액</th>
                <th className="border border-black w-20">국민연금</th>
                <th className="border border-black w-20">건강보험</th>
                <th className="border border-black w-20">고용보험</th>
                <th rowSpan={2} className="border border-black w-24 text-blue-700">공제<br/>금액</th>
                <th rowSpan={2} className="border border-black w-24 text-red-700">차감<br/>지급액</th>
                <th rowSpan={2} className="border border-black w-16">비고</th>
              </tr>
              <tr className="bg-gray-50">
                <th colSpan={2} className="border border-black">주민등록번호</th>
                <th className="border border-black">계좌번호</th>
                {/* 16~31일 */}
                {Array.from({length: 16}, (_, i) => (
                  <th key={i+16} className="border border-black w-6">{i+16}</th>
                ))}
                <th className="border border-black">갑근세</th>
                <th className="border border-black">주민세</th>
                <th className="border border-black text-[9px]">노인장기요양</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <React.Fragment key={row.id}>
                  {/* 첫 번째 줄: 인적사항 상단 + 날짜 1~15 */}
                  <tr>
                    <td rowSpan={2} className="border border-black p-0 text-center">
                      <input type="text" className="w-full text-center outline-none" defaultValue={row.jobType} />
                    </td>
                    <td className="border border-black p-0 text-center">
                      <input type="text" className="w-full text-center outline-none font-bold" defaultValue={row.name} />
                    </td>
                    <td className="border border-black p-0 text-center">
                      <input type="text" className="w-full text-center outline-none" defaultValue={row.phone} />
                    </td>
                    <td className="border border-black p-0 px-1">
                      <input type="text" className="w-full outline-none" defaultValue={row.address} />
                    </td>
                    {/* 날짜 입력 1~15 */}
                    {Array.from({length: 15}, (_, i) => (
                      <td key={i} className="border border-black p-0">
                        <input type="text" className="w-full text-center outline-none bg-yellow-50" />
                      </td>
                    ))}
                    <td rowSpan={2} className="border border-black p-0 text-center font-bold">0.0</td>
                    <td rowSpan={2} className="border border-black p-0 text-right pr-1 font-mono">0</td>
                    <td rowSpan={2} className="border border-black p-0 text-right pr-1 font-mono bg-blue-50">0</td>
                    <td className="border border-black p-0 text-right pr-1 font-mono">0</td>
                    <td className="border border-black p-0 text-right pr-1 font-mono">0</td>
                    <td className="border border-black p-0 text-right pr-1 font-mono">0</td>
                    <td rowSpan={2} className="border border-black p-0 text-right pr-1 font-mono text-blue-700 bg-gray-50">0</td>
                    <td rowSpan={2} className="border border-black p-0 text-right pr-1 font-mono text-red-700 bg-yellow-50">0</td>
                    <td rowSpan={2} className="border border-black p-0 text-center">
                      <button onClick={() => setData(data.filter(item => item.id !== row.id))} className="text-red-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                  {/* 두 번째 줄: 인적사항 하단 + 날짜 16~31 */}
                  <tr>
                    <td colSpan={2} className="border border-black p-0">
                      <input type="text" className="w-full text-center outline-none bg-gray-50" placeholder="000000-0000000" />
                    </td>
                    <td className="border border-black p-0">
                      <input type="text" className="w-full text-center outline-none bg-gray-50" placeholder="은행 및 계좌번호" />
                    </td>
                    {/* 날짜 입력 16~31 */}
                    {Array.from({length: 16}, (_, i) => (
                      <td key={i} className="border border-black p-0">
                        <input type="text" className="w-full text-center outline-none bg-yellow-50" />
                      </td>
                    ))}
                    <td className="border border-black p-0 text-right pr-1 font-mono">0</td>
                    <td className="border border-black p-0 text-right pr-1 font-mono">0</td>
                    <td className="border border-black p-0 text-right pr-1 font-mono text-[9px]">0</td>
                  </tr>
                </React.Fragment>
              ))}
              {/* 합계 행 */}
              <tr className="bg-yellow-200 font-bold">
                <td colSpan={4} className="border border-black text-center py-2">총 계</td>
                {/* 날짜별 합계 칸 1~15 (디자인 유지용) */}
                {Array.from({length: 15}, (_, i) => (
                  <td key={i} className="border border-black text-center text-[9px]">0.0</td>
                ))}
                <td rowSpan={2} className="border border-black text-center">0.0</td>
                <td rowSpan={2} className="border border-black"></td>
                <td rowSpan={2} className="border border-black text-right pr-1">0</td>
                <td className="border border-black text-right pr-1">0</td>
                <td className="border border-black text-right pr-1">0</td>
                <td className="border border-black text-right pr-1">0</td>
                <td rowSpan={2} className="border border-black text-right pr-1 text-blue-700">0</td>
                <td rowSpan={2} className="border border-black text-right pr-1 text-red-700">0</td>
                <td rowSpan={2} className="border border-black"></td>
              </tr>
              <tr className="bg-yellow-200 font-bold">
                <td colSpan={4} className="border border-black h-4"></td>
                {/* 날짜별 합계 칸 16~31 */}
                {Array.from({length: 16}, (_, i) => (
                  <td key={i} className="border border-black text-center text-[9px]">0.0</td>
                ))}
                <td className="border border-black text-right pr-1 text-[9px]">0</td>
                <td className="border border-black text-right pr-1 text-[9px]">0</td>
                <td className="border border-black text-right pr-1 text-[9px]">0</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
