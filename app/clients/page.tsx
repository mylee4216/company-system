"use client";

import React, { useState } from 'react';
import { Search, Plus, UserPlus, MoreVertical, Mail, Phone } from 'lucide-react';

interface Client {
  id: number;
  name: string;
  type: string;
  manager: string;
  contact: string;
  email: string;
  address: string;
  businessNo: string;
  note: string;
}

const DUMMY_CLIENTS: Client[] = [
  { id: 1, name: '(주)미래건축디자인', type: '외주/시공', manager: '강건우', contact: '010-2222-3333', email: 'mirae@arch.com', address: '서울시 강남구 테헤란로', businessNo: '123-45-67890', note: 'A급 협력업체' },
  { id: 2, name: '한울건재', type: '자재공급', manager: '송철호', contact: '010-4444-5555', email: 'hanul@supply.co.kr', address: '경기도 하남시 덕풍로', businessNo: '234-56-78901', note: '결제 기한 엄수 필요' },
  { id: 3, name: '태양전기공사', type: '전기설비', manager: '임태양', contact: '010-6666-7777', email: 'sun@electric.com', address: '서울시 성북구 안암로', businessNo: '345-67-89012', note: '' },
];

export default function ClientsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">거래처 관리</h1>
            <p className="text-gray-500">협력업체 및 발주처 주소록과 사업자 정보를 관리합니다.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 shadow-sm transition"
          >
            <UserPlus size={18} /> 거래처 등록
          </button>
        </div>

        <div className="mb-6 relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="거래처명, 담당자명, 사업자번호 검색..." 
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DUMMY_CLIENTS.map((client) => (
            <div key={client.id} className="bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="inline-block px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase mb-2 tracking-wider">{client.type}</span>
                  <h3 className="text-lg font-bold text-gray-900">{client.name}</h3>
                </div>
                <button className="text-gray-400 hover:text-gray-600"><MoreVertical size={20}/></button>
              </div>
              
              <div className="space-y-3 text-sm mb-6 text-gray-600">
                <div className="flex items-center gap-3"><Phone size={14}/> {client.contact} ({client.manager})</div>
                <div className="flex items-center gap-3"><Mail size={14}/> {client.email}</div>
                <div className="text-xs pt-2 border-t mt-2">
                  <p className="font-semibold text-gray-400 mb-1">사업자번호</p>
                  <p>{client.businessNo}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 py-2 text-sm border rounded-lg hover:bg-gray-50">상세보기</button>
                <button className="flex-1 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">정보 수정</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Basic Dialog Simulation */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 bg-gray-900 text-white flex justify-between items-center">
              <h2 className="text-xl font-semibold">새 거래처 등록</h2>
              <button onClick={() => setIsModalOpen(false)} className="opacity-70 hover:opacity-100 transition"><Plus size={24} className="rotate-45" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">거래처명</label>
                  <input type="text" className="w-full border-b py-2 focus:border-indigo-600 outline-none transition" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">구분</label>
                  <select className="w-full border-b py-2 focus:border-indigo-600 outline-none">
                    <option>외주/시공</option>
                    <option>자재공급</option>
                    <option>장비대여</option>
                    <option>기타</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">사업자번호</label>
                  <input type="text" className="w-full border-b py-2 focus:border-indigo-600 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">담당자</label>
                  <input type="text" className="w-full border-b py-2 focus:border-indigo-600 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">연락처</label>
                  <input type="text" className="w-full border-b py-2 focus:border-indigo-600 outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">이메일</label>
                  <input type="email" className="w-full border-b py-2 focus:border-indigo-600 outline-none" />
                </div>
              </div>
              <button className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold mt-4 hover:bg-indigo-700 transition">등록 완료</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

