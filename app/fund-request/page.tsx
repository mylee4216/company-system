"use client";

import React, { useState } from "react";
import { Save, Printer, Plus, Trash2 } from "lucide-react";

interface DetailItem {
  id: string;
  companyName: string;
  itemName: string;
  supplyAmount: number;
  taxAmount: number;
  totalAmount: number;
  issueDate: string;
  prepaidAmount: number;
  paymentAmount: number;
  bankName: string;
  accountNo: string;
  accountHolder: string;
  note: string;
}

const EMPTY_ITEM: Omit<DetailItem, "id"> = {
  companyName: "",
  itemName: "",
  supplyAmount: 0,
  taxAmount: 0,
  totalAmount: 0,
  issueDate: "",
  prepaidAmount: 0,
  paymentAmount: 0,
  bankName: "",
  accountNo: "",
  accountHolder: "",
  note: "",
};

export default function FundRequestPageV3() {
  const [baseInfo, setBaseInfo] = useState({
    projectName: "",
    period: "",
    contractAmount: 0,
  });

  const [items, setItems] = useState<DetailItem[]>([
    {
      id: "1",
      ...EMPTY_ITEM,
    },
  ]);

  const handleItemChange = (
    id: string,
    field:
      | "companyName"
      | "itemName"
      | "issueDate"
      | "bankName"
      | "accountNo"
      | "accountHolder"
      | "note",
    value: string,
  ) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      }),
    );
  };

  const addRow = () => {
    const newItem: DetailItem = {
      id: Date.now().toString(),
      ...EMPTY_ITEM,
    };
    setItems((prevItems) => [...prevItems, newItem]);
  };

  const handleAmountChange = (
    id: string,
    field: "supplyAmount" | "taxAmount" | "prepaidAmount",
    value: number,
  ) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };

          if (field === "supplyAmount" || field === "taxAmount") {
            updated.totalAmount = updated.supplyAmount + updated.taxAmount;
          }

          updated.paymentAmount = updated.totalAmount - updated.prepaidAmount;
          return updated;
        }
        return item;
      }),
    );
  };

  const totalSummary = items.reduce(
    (acc, curr) => ({
      supply: acc.supply + curr.supplyAmount,
      tax: acc.tax + curr.taxAmount,
      total: acc.total + curr.totalAmount,
      payment: acc.payment + curr.paymentAmount,
    }),
    { supply: 0, tax: 0, total: 0, payment: 0 },
  );

  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans text-sm">
      <div className="max-w-[1400px] mx-auto bg-white p-6 shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-bold">공사투입 자금 청구서 (인건비 상세)</h1>
          <div className="flex gap-2">
            <button
              onClick={addRow}
              className="flex items-center gap-1 bg-white border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50 transition"
            >
              <Plus size={16} /> 행 추가
            </button>
            <button className="flex items-center gap-1 bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 transition">
              <Save size={16} /> 저장
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 bg-gray-800 text-white px-4 py-1.5 rounded hover:bg-black transition"
            >
              <Printer size={16} /> 인쇄
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8 p-4 bg-gray-50 rounded">
          <div>
            <label className="block font-bold mb-1">공사명</label>
            <input
              type="text"
              className="w-full border p-2"
              placeholder="현장명 입력"
              value={baseInfo.projectName}
              onChange={(e) =>
                setBaseInfo((prev) => ({ ...prev, projectName: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block font-bold mb-1">공사투입기간</label>
            <input
              type="text"
              className="w-full border p-2"
              placeholder="2026-04-01 ~ 2026-04-30"
              value={baseInfo.period}
              onChange={(e) => setBaseInfo((prev) => ({ ...prev, period: e.target.value }))}
            />
          </div>
          <div>
            <label className="block font-bold mb-1">공사계약금액</label>
            <input
              type="number"
              className="w-full border p-2 text-right"
              placeholder="0"
              value={baseInfo.contractAmount || ""}
              onChange={(e) =>
                setBaseInfo((prev) => ({
                  ...prev,
                  contractAmount: parseInt(e.target.value, 10) || 0,
                }))
              }
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-400">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 p-2 w-32">상호 / 품목</th>
                <th className="border border-gray-400 p-2 w-28">공급가액</th>
                <th className="border border-gray-400 p-2 w-24">세액</th>
                <th className="border border-gray-400 p-2 w-28 bg-blue-50">합계(발생)</th>
                <th className="border border-gray-400 p-2 w-28">발행일자</th>
                <th className="border border-gray-400 p-2 w-28">기지급/공제</th>
                <th className="border border-gray-400 p-2 w-28 bg-yellow-50">지급금액</th>
                <th className="border border-gray-400 p-2">계좌정보 (은행/계좌/예금주)</th>
                <th className="border border-gray-400 p-2 w-12">삭제</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="border border-gray-400 p-1">
                    <input
                      type="text"
                      placeholder="상호"
                      className="w-full mb-1 border-b outline-none"
                      value={item.companyName}
                      onChange={(e) => handleItemChange(item.id, "companyName", e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="품목"
                      className="w-full text-[11px] outline-none"
                      value={item.itemName}
                      onChange={(e) => handleItemChange(item.id, "itemName", e.target.value)}
                    />
                  </td>
                  <td className="border border-gray-400 p-1">
                    <input
                      type="number"
                      className="w-full text-right outline-none"
                      value={item.supplyAmount || ""}
                      onChange={(e) =>
                        handleAmountChange(item.id, "supplyAmount", parseInt(e.target.value, 10) || 0)
                      }
                    />
                  </td>
                  <td className="border border-gray-400 p-1">
                    <input
                      type="number"
                      className="w-full text-right outline-none"
                      value={item.taxAmount || ""}
                      onChange={(e) =>
                        handleAmountChange(item.id, "taxAmount", parseInt(e.target.value, 10) || 0)
                      }
                    />
                  </td>
                  <td className="border border-gray-400 p-1 bg-blue-50 font-bold text-right">
                    {item.totalAmount.toLocaleString()}
                  </td>
                  <td className="border border-gray-400 p-1">
                    <input
                      type="date"
                      className="w-full text-xs outline-none"
                      value={item.issueDate}
                      onChange={(e) => handleItemChange(item.id, "issueDate", e.target.value)}
                    />
                  </td>
                  <td className="border border-gray-400 p-1 text-red-600">
                    <input
                      type="number"
                      className="w-full text-right outline-none"
                      value={item.prepaidAmount || ""}
                      onChange={(e) =>
                        handleAmountChange(item.id, "prepaidAmount", parseInt(e.target.value, 10) || 0)
                      }
                    />
                  </td>
                  <td className="border border-gray-400 p-1 bg-yellow-50 font-bold text-right text-blue-700">
                    {item.paymentAmount.toLocaleString()}
                  </td>
                  <td className="border border-gray-400 p-1">
                    <div className="flex gap-1 mb-1">
                      <input
                        type="text"
                        placeholder="은행"
                        className="w-1/3 border-b outline-none text-[11px]"
                        value={item.bankName}
                        onChange={(e) => handleItemChange(item.id, "bankName", e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="예금주"
                        className="w-2/3 border-b outline-none text-[11px]"
                        value={item.accountHolder}
                        onChange={(e) => handleItemChange(item.id, "accountHolder", e.target.value)}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="계좌번호"
                      className="w-full outline-none text-[11px]"
                      value={item.accountNo}
                      onChange={(e) => handleItemChange(item.id, "accountNo", e.target.value)}
                    />
                  </td>
                  <td className="border border-gray-400 p-1 text-center">
                    <button
                      onClick={() => setItems((prevItems) => prevItems.filter((i) => i.id !== item.id))}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-800 text-white font-bold">
                <td className="border border-gray-400 p-2 text-center">합계</td>
                <td className="border border-gray-400 p-2 text-right">
                  {totalSummary.supply.toLocaleString()}
                </td>
                <td className="border border-gray-400 p-2 text-right">
                  {totalSummary.tax.toLocaleString()}
                </td>
                <td className="border border-gray-400 p-2 text-right text-yellow-400">
                  {totalSummary.total.toLocaleString()}
                </td>
                <td colSpan={2} className="border border-gray-400"></td>
                <td className="border border-gray-400 p-2 text-right text-green-400">
                  {totalSummary.payment.toLocaleString()}
                </td>
                <td colSpan={2} className="border border-gray-400"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-gray-500 italic">
          * 공급가액과 세액을 입력하면 합계와 지급금액이 자동 계산됩니다.
        </div>
      </div>
    </div>
  );
}
