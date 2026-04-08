"use client";

import React from 'react';

export default function LaborStatementPrintPageV3() {
  // 실제 구현시에는 상태 관리 도구(Zustand, Redux 등)나 URL Params로 데이터를 받아옵니다.
  const printData = Array(10).fill(null); // 인쇄용 10행 더미

  return (
    <div className="bg-white p-4 w-[297mm] mx-auto min-h-screen">
      <div className="no-print mb-3 text-sm font-bold text-blue-700">
        노무비명세서 V3 테스트
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none; }
          @page { size: A4 landscape; margin: 10mm; }
        }
      `}} />

      <div className="no-print mb-4 flex justify-end">
        <button onClick={() => window.print()} className="bg-black text-white px-6 py-2 rounded shadow">
          인쇄 시작
        </button>
      </div>

      <div className="border border-black p-2">
        {/* 헤더 정보 */}
        <div className="flex justify-between items-end border-b-2 border-black pb-1 mb-2">
          <div className="flex gap-10">
            <div className="flex items-center"><span className="text-lg font-bold mr-4">상 호 :</span> <span className="border-b border-black min-w-[150px] px-2 text-center">건설혁신(주)</span></div>
            <div className="flex items-center"><span className="text-lg font-bold mr-4">공사명 :</span> <span className="border-b border-black min-w-[250px] px-2 text-center">신축공사 현장</span></div>
          </div>
          <div className="text-right">
            <div className="flex items-center"><span className="font-bold mr-2">기 간 :</span> <span>2026-04-01 ~ 2026-04-30</span></div>
          </div>
        </div>

        <h1 className="text-4xl font-black text-center my-6 tracking-[0.8em]">일용노무비지급명세서</h1>

        <table className="w-full border-collapse border-[1.5px] border-black text-[10px]">
          <thead>
            <tr className="bg-gray-100">
              <th rowSpan={2} className="border border-black w-[40px]">직종</th>
              <th className="border border-black w-[80px]">성명</th>
              <th className="border border-black w-[100px]">전화번호</th>
              <th className="border border-black w-[180px]">주소</th>
              {Array.from({length: 15}, (_, i) => (
                <th key={i+1} className="border border-black w-[20px] text-red-600">{i+1}</th>
              ))}
              <th rowSpan={2} className="border border-black w-[35px]">근로<br/>일수</th>
              <th rowSpan={2} className="border border-black w-[70px]">노무비<br/>단가</th>
              <th rowSpan={2} className="border border-black w-[80px]">노무비<br/>총액</th>
              <th className="border border-black w-[65px]">국민연금</th>
              <th className="border border-black w-[65px]">건강보험</th>
              <th className="border border-black w-[65px]">고용보험</th>
              <th rowSpan={2} className="border border-black w-[80px]">공제<br/>총액</th>
              <th rowSpan={2} className="border border-black w-[85px]">차감<br/>지급액</th>
              <th rowSpan={2} className="border border-black w-[50px]">비고</th>
            </tr>
            <tr className="bg-gray-100">
              <th colSpan={2} className="border border-black">주민등록번호</th>
              <th className="border border-black">계좌번호</th>
              {Array.from({length: 16}, (_, i) => (
                <th key={i+16} className="border border-black w-[20px]">{i+16}</th>
              ))}
              <th className="border border-black">갑근세</th>
              <th className="border border-black">주민세</th>
              <th className="border border-black text-[8px]">노인장기요양</th>
            </tr>
          </thead>
          <tbody>
            {printData.map((_, i) => (
              <React.Fragment key={i}>
                <tr className="h-7">
                  <td rowSpan={2} className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  {Array.from({length: 15}).map((_, j) => <td key={j} className="border border-black"></td>)}
                  <td rowSpan={2} className="border border-black text-center">0.0</td>
                  <td rowSpan={2} className="border border-black text-right pr-1"></td>
                  <td rowSpan={2} className="border border-black text-right pr-1 font-bold"></td>
                  <td className="border border-black text-right pr-1"></td>
                  <td className="border border-black text-right pr-1"></td>
                  <td className="border border-black text-right pr-1"></td>
                  <td rowSpan={2} className="border border-black text-right pr-1 bg-gray-50"></td>
                  <td rowSpan={2} className="border border-black text-right pr-1 font-bold"></td>
                  <td rowSpan={2} className="border border-black"></td>
                </tr>
                <tr className="h-7">
                  <td colSpan={2} className="border border-black"></td>
                  <td className="border border-black text-center text-[9px]"></td>
                  {Array.from({length: 16}).map((_, j) => <td key={j} className="border border-black text-center"></td>)}
                  <td className="border border-black text-right pr-1"></td>
                  <td className="border border-black text-right pr-1"></td>
                  <td className="border border-black text-right pr-1 text-[8px]"></td>
                </tr>
              </React.Fragment>
            ))}
            {/* 합계행 (인쇄용 노란 강조) */}
            <tr className="h-6 bg-yellow-100 font-bold">
              <td colSpan={4} rowSpan={2} className="border border-black text-center text-sm">합 계</td>
              {Array.from({length: 15}).map((_, j) => <td key={j} className="border border-black text-center text-[8px]">0.0</td>)}
              <td rowSpan={2} className="border border-black text-center">0.0</td>
              <td rowSpan={2} className="border border-black"></td>
              <td rowSpan={2} className="border border-black text-right pr-1">0</td>
              <td className="border border-black text-right pr-1">0</td>
              <td className="border border-black text-right pr-1">0</td>
              <td className="border border-black text-right pr-1">0</td>
              <td rowSpan={2} className="border border-black text-right pr-1">0</td>
              <td rowSpan={2} className="border border-black text-right pr-1">0</td>
              <td rowSpan={2} className="border border-black"></td>
            </tr>
            <tr className="h-6 bg-yellow-100 font-bold">
              {Array.from({length: 16}).map((_, j) => <td key={j} className="border border-black text-center text-[8px]">0.0</td>)}
              <td className="border border-black text-right pr-1">0</td>
              <td className="border border-black text-right pr-1">0</td>
              <td className="border border-black text-right pr-1 text-[8px]">0</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 flex justify-between px-10 font-bold">
          <span>작성일 : 2026년 04월 30일</span>
          <span>현장대리인 : ________________ (인)</span>
          <span>확인자 : ________________ (인)</span>
        </div>
      </div>
    </div>
  );
}
