"use client";

import React from 'react';
import { Users, FileText, ExternalLink, ShieldCheck, CreditCard, Search, Plus, Filter } from 'lucide-react';

export default function HRPage() {
  const dummyEmployees = [
    { id: 1, name: '강석주', pos: '팀장', dept: '공사부', contact: '010-1111-2222', joinDate: '2020-03-01', status: '재직', salaryType: '월급제' },
    { id: 2, name: '이미래', pos: '대리', dept: '총무부', contact: '010-3333-4444', joinDate: '2022-07-15', status: '재직', salaryType: '월급제' },
    { id: 3, name: '박건설', pos: '사원', dept: '현장관리', contact: '010-5555-6666', joinDate: '2023-11-01', status: '수습', salaryType: '일급제' },
  ];

  const dummyDocs = [
    { id: 1, title: '근로계약서_강석주', type: '계약서', target: '강석주', date: '2024-03-01', status: '승인완료' },
    { id: 2, title: '개인정보제공동의서', type: '동의서', target: '이미래', date: '2024-03-02', status: '대기중' },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">인사 관리</h1>
          <p className="text-gray-500">임직원 정보 및 주요 증빙 서류를 관리합니다.</p>
        </header>

        {/* Quick Links Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-2xl text-white flex justify-between items-center shadow-lg group cursor-pointer">
            <div>
              <h2 className="text-xl font-bold mb-1">현장 노무자 관리</h2>
              <p className="text-blue-100 text-sm">일용직 근로자 등록 및 일보 관리</p>
            </div>
            <div className="bg-white/20 p-3 rounded-full group-hover:scale-110 transition"><ExternalLink size={24}/></div>
          </div>
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 rounded-2xl text-white flex justify-between items-center shadow-lg group cursor-pointer">
            <div>
              <h2 className="text-xl font-bold mb-1">노무비 명세서</h2>
              <p className="text-indigo-100 text-sm">월별 급여 및 노무비 지급 명세서</p>
            </div>
            <div className="bg-white/20 p-3 rounded-full group-hover:scale-110 transition"><CreditCard size={24}/></div>
          </div>
        </div>

        {/* Employee Section */}
        <section className="bg-white rounded-2xl border shadow-sm mb-8 overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center">
            <h2 className="text-lg font-bold flex items-center gap-2"><Users size={20} className="text-blue-600"/> 직원 현황</h2>
            <div className="flex gap-2">
              <button className="p-2 border rounded-lg hover:bg-gray-50"><Filter size={18} className="text-gray-600"/></button>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700">
                <Plus size={16}/> 직원 등록
              </button>
            </div>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="p-4">이름 / 직책</th>
                <th className="p-4">부서</th>
                <th className="p-4">연락처</th>
                <th className="p-4">입사일</th>
                <th className="p-4">상태</th>
                <th className="p-4">급여구분</th>
                <th className="p-4">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {dummyEmployees.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 transition cursor-pointer">
                  <td className="p-4">
                    <div className="font-bold text-gray-900">{e.name}</div>
                    <div className="text-xs text-gray-500">{e.pos}</div>
                  </td>
                  <td className="p-4 text-gray-600">{e.dept}</td>
                  <td className="p-4 text-gray-600">{e.contact}</td>
                  <td className="p-4 text-gray-600">{e.joinDate}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">{e.status}</span>
                  </td>
                  <td className="p-4 text-gray-600 font-medium">{e.salaryType}</td>
                  <td className="p-4 text-gray-400">-</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Document Section */}
        <section className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-lg font-bold flex items-center gap-2"><ShieldCheck size={20} className="text-indigo-600"/> 인사 서류 관리</h2>
          </div>
          <div className="p-0">
            <div className="grid grid-cols-1 divide-y">
              {dummyDocs.map((doc) => (
                <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-100 rounded text-gray-500"><FileText size={20}/></div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">{doc.title}</div>
                      <div className="text-xs text-gray-500">{doc.type} | 대상자: {doc.target} | 등록일: {doc.date}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded ${doc.status === '승인완료' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                      {doc.status}
                    </span>
                    <button className="text-gray-400 hover:text-gray-600 text-sm font-medium border px-3 py-1 rounded">열람</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-gray-50 text-center">
              <button className="text-sm text-indigo-600 font-semibold hover:underline">모든 서류 보기 (12건)</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

