"use client";

import React, { useState } from 'react';
import { Search, Plus, Edit2, Trash2, X } from 'lucide-react';

interface Site {
  id: number;
  name: string;
  client: string;
  address: string;
  startDate: string;
  endDate: string;
  status: '진행중' | '완료' | '중단';
  manager: string;
  contact: string;
  note: string;
}

const DUMMY_SITES: Site[] = [
  { id: 1, name: '서울숲 복합문화센터', client: '서울시', address: '성동구 성수동', startDate: '2024-01-10', endDate: '2025-06-30', status: '진행중', manager: '김철수', contact: '010-1234-5678', note: '특이사항 없음' },
  { id: 2, name: '판교 오피스 신축공사', client: '테크홀딩스', address: '분당구 삼평동', startDate: '2023-05-20', endDate: '2024-12-15', status: '진행중', manager: '이영희', contact: '010-9876-5432', note: '안전 점검 강화 기간' },
  { id: 3, name: '강남 데이터센터 리모델링', client: '데이터월드', address: '강남구 역삼동', startDate: '2023-11-01', endDate: '2024-03-20', status: '완료', manager: '박지성', contact: '010-1111-2222', note: '성공적 준공' },
];

export default function SitesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">현장 관리</h1>
            <p className="text-gray-500 mt-1">회사가 운영 중인 모든 건설 및 프로젝트 현장을 관리합니다.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={18} /> 현장 등록
          </button>
        </div>

        {/* Search & Stats */}
        <div className="bg-white p-4 rounded-xl shadow-sm border mb-6 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="현장명, 발주처, 담당자 검색..." 
              className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-bottom text-gray-600 text-sm">
                <th className="p-4 font-semibold">현장명</th>
                <th className="p-4 font-semibold">발주처</th>
                <th className="p-4 font-semibold">주소</th>
                <th className="p-4 font-semibold">기간</th>
                <th className="p-4 font-semibold">상태</th>
                <th className="p-4 font-semibold">담당자</th>
                <th className="p-4 font-semibold text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {DUMMY_SITES.map((site) => (
                <tr key={site.id} className="hover:bg-gray-50 text-sm">
                  <td className="p-4 font-medium text-gray-900">{site.name}</td>
                  <td className="p-4 text-gray-600">{site.client}</td>
                  <td className="p-4 text-gray-600 truncate max-w-[150px]">{site.address}</td>
                  <td className="p-4 text-gray-600 text-xs">
                    {site.startDate} ~<br/>{site.endDate}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      site.status === '진행중' ? 'bg-green-100 text-green-700' : 
                      site.status === '완료' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {site.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="text-gray-900">{site.manager}</div>
                    <div className="text-gray-500 text-xs">{site.contact}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <button className="p-1 hover:text-blue-600 transition"><Edit2 size={16} /></button>
                      <button className="p-1 hover:text-red-600 transition"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">신규 현장 등록</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">현장명</label>
                <input type="text" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="현장명을 입력하세요" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">발주처</label>
                <input type="text" className="w-full border p-2 rounded outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">진행상태</label>
                <select className="w-full border p-2 rounded outline-none">
                  <option>진행중</option>
                  <option>완료</option>
                  <option>중단</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">주소</label>
                <input type="text" className="w-full border p-2 rounded outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">착공일</label>
                <input type="date" className="w-full border p-2 rounded outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">준공일</label>
                <input type="date" className="w-full border p-2 rounded outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">담당자</label>
                <input type="text" className="w-full border p-2 rounded outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">연락처</label>
                <input type="text" className="w-full border p-2 rounded outline-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">비고</label>
                <textarea className="w-full border p-2 rounded outline-none h-24"></textarea>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-6 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-lg hover:bg-white transition">취소</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">저장하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

