"use client";

import React from 'react';

export default function FundRequestPrintPage() {
  // 인쇄용 더미 데이터 (실제 프로젝트에서는 전역 상태나 서버에서 가져옴)
  const printData = {
    date: "2026-04-08",
    dept: "경영지원팀",
    name: "홍길동",
    items: [
      { date: '2026-04-01', category: '소모품비', content: '사무용 문구류 구입', amount: 55000 },
      { date: '2026-04-03', category: '복리후생비', content: '팀 간식 구매', amount: 32000 },
      { date: '2026-04-05', category: '여비교통비', content: '지방 출장 통행료', amount: 14500 },
    ]
  };

  const total = printData.items.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="bg-white min-h-screen p-0 sm:p-10 flex justify-center">
      {/* 브라우저 기본 인쇄 설정 스타일 */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { padding: 0; margin: 0; }
          .no-print { display: none; }
          @page { size: A4; margin: 15mm; }
        }
      `}} />

      <div className="w-[210mm] min-h-[297mm] p-[20mm] bg-white border shadow-sm relative text-black">
        
        {/* 인쇄 버튼 (화면에서만 보임) */}
        <div className="no-print absolute top-5 right-5">
          <button 
            onClick={() => window.print()}
            className="bg-black text-white px-6 py-2 rounded-full font-bold shadow-xl hover:scale-105 transition"
          >
            문서 인쇄
          </button>
        </div>

        {/* 제목 및 결재란 */}
        <div className="flex justify-between items-start mb-12">
          <h1 className="text-4xl font-black underline underline-offset-[10px] decoration-4">자 금 청 구 서</h1>
          
          <table className="border-collapse border border-black text-center text-sm">
            <tr>
              <th rowSpan={2} className="border border-black bg-gray-100 px-2 py-4 w-6 font-bold">결<br/>재</th>
              <th className="border border-black px-6 py-1 bg-gray-50 font-bold">담 당</th>
              <th className="border border-black px-6 py-1 bg-gray-50 font-bold">검 토</th>
              <th className="border border-black px-6 py-1 bg-gray-50 font-bold">승 인</th>
            </tr>
            <tr className="h-16">
              <td className="border border-black min-w-[80px]"></td>
              <td className="border border-black min-w-[80px]"></td>
              <td className="border border-black min-w-[80px]"></td>
            </tr>
          </table>
        </div>

        {/* 기본 정보 테이블 */}
        <table className="w-full border-collapse border border-black mb-10">
          <tbody>
            <tr className="h-10">
              <th className="border border-black bg-gray-100 w-1/6 font-bold">청구일자</th>
              <td className="border border-black px-4 w-2/6">{printData.date}</td>
              <th className="border border-black bg-gray-100 w-1/6 font-bold">부 서</th>
              <td className="border border-black px-4 w-2/6">{printData.dept}</td>
            </tr>
            <tr className="h-10">
              <th className="border border-black bg-gray-100 font-bold">작성자</th>
              <td colSpan={3} className="border border-black px-4 font-bold">{printData.name} (인)</td>
            </tr>
          </tbody>
        </table>

        {/* 상세 내역 테이블 */}
        <div className="mb-10">
          <p className="mb-2 font-bold">■ 청구 내역</p>
          <table className="w-full border-collapse border-2 border-black">
            <thead>
              <tr className="bg-gray-100 h-10">
                <th className="border border-black px-2 w-[15%]">날짜</th>
                <th className="border border-black px-2 w-[20%]">항목</th>
                <th className="border border-black px-2">내용(적요)</th>
                <th className="border border-black px-2 w-[20%]">금액</th>
              </tr>
            </thead>
            <tbody>
              {printData.items.map((item, idx) => (
                <tr key={idx} className="h-10">
                  <td className="border border-black text-center">{item.date}</td>
                  <td className="border border-black text-center">{item.category}</td>
                  <td className="border border-black px-3">{item.content}</td>
                  <td className="border border-black text-right px-3 font-mono">
                    {item.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
              {/* 빈 행 채우기 (최소 10줄 유지 예시) */}
              {Array.from({ length: Math.max(0, 10 - printData.items.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className="h-10">
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="h-12 bg-gray-50">
                <th colSpan={3} className="border border-black bg-gray-100 text-center font-bold text-lg">합 계 금 액</th>
                <td className="border border-black text-right px-3 font-bold text-xl">
                  ₩ {total.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 하단 확인 서명 */}
        <div className="mt-20 text-center">
          <p className="text-lg font-bold mb-10">위와 같이 자금을 청구하오니 승인하여 주시기 바랍니다.</p>
          <p className="text-xl font-black">2026년 04월 08일</p>
          <div className="mt-10 flex justify-end pr-10">
            <p className="text-lg font-bold">신청인 : <span className="inline-block border-b border-black w-32 ml-2"></span> (인)</p>
          </div>
        </div>

        {/* 하단 고정 텍스트 */}
        <div className="absolute bottom-10 left-0 w-full text-center text-gray-400 text-xs">
          본 서류는 회사 내부 회계 처리용으로만 사용 가능합니다.
        </div>
      </div>
    </div>
  );
}