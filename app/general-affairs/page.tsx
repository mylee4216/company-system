"use client";

import React, { useState } from 'react';
import { Home, Car, Search, Plus, MapPin, Calendar, Users, AlertCircle } from 'lucide-react';

export default function GeneralAffairsPage() {
  const [activeTab, setActiveTab] = useState<'housing' | 'vehicle'>('housing');

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">총무 관리</h1>
          <p className="text-gray-500">숙소 운영 현황 및 법인 차량 리스트를 관리합니다.</p>
        </header>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-gray-200 rounded-xl w-fit mb-8">
          <button 
            onClick={() => setActiveTab('housing')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition ${activeTab === 'housing' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Home size={18} /> 숙소 관리
          </button>
          <button 
            onClick={() => setActiveTab('vehicle')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition ${activeTab === 'vehicle' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Car size={18} /> 차량 관리
          </button>
        </div>

        {activeTab === 'housing' ? <HousingSection /> : <VehicleSection />}
      </div>
    </div>
  );
}

function HousingSection() {
  const dummyHousing = [
    { id: 1, name: '성수빌라 201호', address: '성수동 2가', site: '서울숲 복합센터', count: 4, start: '2024-01-01', end: '2024-12-31', cost: '1,200,000', status: '사용중' },
    { id: 2, name: '판교 메트로텔 505호', address: '삼평동', site: '판교 오피스', count: 2, start: '2024-02-15', end: '2025-02-14', cost: '1,500,000', status: '사용중' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input type="text" placeholder="숙소명 또는 현장명 검색" className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition">
          <Plus size={18} /> 숙소 등록
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {dummyHousing.map((h) => (
          <div key={h.id} className="bg-white p-5 rounded-xl border flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-full"><Home size={24}/></div>
              <div>
                <h3 className="font-bold text-gray-900">{h.name} <span className="text-xs font-normal text-gray-500 ml-2">{h.address}</span></h3>
                <div className="flex gap-4 mt-1 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><MapPin size={14}/> {h.site}</span>
                  <span className="flex items-center gap-1"><Users size={14}/> {h.count}인 거주</span>
                  <span className="flex items-center gap-1"><Calendar size={14}/> ~{h.end}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-gray-900">월 {h.cost}원</div>
              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">{h.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VehicleSection() {
  const dummyVehicles = [
    { id: 1, name: '카니발', number: '12가 3456', manager: '박지성', site: '서울 본사', insurance: '2024-10-12', check: '2024-05-01', status: '운행중' },
    { id: 2, name: '포터 II', number: '55나 9876', manager: '이한울', site: '서울숲 복합센터', insurance: '2024-12-20', check: '2024-06-15', status: '정비필요' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center text-sm">
        <div className="flex gap-2">
          <input type="text" placeholder="차량번호 검색" className="px-4 py-2 border rounded-lg outline-none" />
          <button className="bg-gray-800 text-white px-4 py-2 rounded-lg">검색</button>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <Plus size={18} /> 차량 등록
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-semibold text-sm">차량명/번호</th>
              <th className="p-4 font-semibold text-sm">담당자</th>
              <th className="p-4 font-semibold text-sm">사용현장</th>
              <th className="p-4 font-semibold text-sm">보험만기일</th>
              <th className="p-4 font-semibold text-sm">점검예정일</th>
              <th className="p-4 font-semibold text-sm">상태</th>
              <th className="p-4 font-semibold text-sm">비고</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {dummyVehicles.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className="p-4 font-medium">{v.name} <br/> <span className="text-gray-500 font-normal">{v.number}</span></td>
                <td className="p-4">{v.manager}</td>
                <td className="p-4">{v.site}</td>
                <td className="p-4">{v.insurance}</td>
                <td className="p-4">{v.check}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${v.status === '운행중' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                    {v.status}
                  </span>
                </td>
                <td className="p-4 text-gray-400">---</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

