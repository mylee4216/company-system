"use client";

import { useMemo, useState } from "react";

type FundRow = {
  id: number;
  date: string;
  item: string;
  company: string;
  amountOccurred: string;
  issueDate: string;
  bankName: string;
  accountNumber: string;
  amountPaidBefore: string;
  amountToPay: string;
  note: string;
};

function createEmptyRow(id: number): FundRow {
  return {
    id,
    date: "",
    item: "",
    company: "",
    amountOccurred: "",
    issueDate: "",
    bankName: "",
    accountNumber: "",
    amountPaidBefore: "",
    amountToPay: "",
    note: "",
  };
}

function parseAmount(value: string): number {
  const normalized = value.replaceAll(",", "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmount(value: number): string {
  return value.toLocaleString("ko-KR");
}

export default function FundRequestPage() {
  const [writer, setWriter] = useState("");
  const [siteName, setSiteName] = useState("");
  const [clientName, setClientName] = useState("");
  const [createdDate, setCreatedDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<FundRow>([createEmptyRow(1), createEmptyRow(2), createEmptyRow(3)]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.occurred += parseAmount(row.amountOccurred);
        acc.paidBefore += parseAmount(row.amountPaidBefore);
        acc.toPay += parseAmount(row.amountToPay);
        return acc;
      },
      { occurred: 0, paidBefore: 0, toPay: 0 },
    );
  }, [rows]);

  const updateRow = (id: number, key: keyof FundRow, value: string) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyRow(Date.now())]);
  };

  const removeRow = () => {
    setRows((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  return (
    <div className="mx-auto w-full max-w-[1700px] p-6">
      <div className="rounded-md border border-slate-300 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-300 px-6 py-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">자금청구서</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addRow}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              행 추가
            </button>
            <button
              type="button"
              onClick={removeRow}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              행 삭제
            </button>
            <button
              type="button"
              onClick={() => window.alert("저장 기능은 준비 중입니다.")}
              className="rounded border border-blue-700 bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => window.open("/fund-request/print", "_blank")}
              className="rounded border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
            >
              출력
            </button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3 border-b border-slate-300 bg-slate-50 px-6 py-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">작성일</span>
            <input
              type="date"
              value={createdDate}
              onChange={(e) => setCreatedDate(e.target.value)}
              className="h-10 rounded border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-blue-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">현장명</span>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="h-10 rounded border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-blue-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">거래처명</span>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="h-10 rounded border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-blue-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">작성자</span>
            <input
              type="text"
              value={writer}
              onChange={(e) => setWriter(e.target.value)}
              className="h-10 rounded border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-blue-500"
            />
          </label>
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">합계금액</span>
            <div className="flex h-10 items-center rounded border border-slate-300 bg-white px-3 font-semibold text-slate-900">
              {formatAmount(totals.toPay)} 원
            </div>
          </div>
        </div>

        <div className="overflow-x-auto px-6 py-5">
          <table className="min-w-[1450px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-800">
                <th className="border border-slate-300 px-2 py-2">날짜</th>
                <th className="border border-slate-300 px-2 py-2">품목</th>
                <th className="border border-slate-300 px-2 py-2">상호</th>
                <th className="border border-slate-300 px-2 py-2">발생금액</th>
                <th className="border border-slate-300 px-2 py-2">발행일자</th>
                <th className="border border-slate-300 px-2 py-2">은행명</th>
                <th className="border border-slate-300 px-2 py-2">계좌번호</th>
                <th className="border border-slate-300 px-2 py-2">기지급액</th>
                <th className="border border-slate-300 px-2 py-2">지급금액</th>
                <th className="border border-slate-300 px-2 py-2">비고</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="border border-slate-300 p-1">
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => updateRow(row.id, "date", e.target.value)}
                      className="h-9 w-full rounded border border-slate-200 px-2 outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="border border-slate-300 p-1">
                    <input
                      type="text"
                      value={row.item}
                      onChange={(e) => updateRow(row.id, "item", e.target.value)}
                      className="h-9 w-full rounded border border-slate-200 px-2 outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="border border-slate-300 p-1">
                    <input
                      type="text"
                      value={row.company}
                      onChange={(e) => updateRow(row.id, "company", e.target.value)}
                      className="h-9 w-full rounded border border-slate-200 px-2 outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="border border-slate-300 p-1">
                    <input
                      type="text"
                      value={row.amountOccurred}
                      onChange={(e) => updateRow(row.id, "amountOccurred", e.target.value)}
                      className="h-9 w-full rounded border border-slate-200 px-2 text-right outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="border border-slate-300 p-1">
                    <input
                      type="date"
                      value={row.issueDate}
                      onChange={(e) => updateRow(row.id, "issueDate", e.target.value)}
                      className="h-9 w-full rounded border border-slate-200 px-2 outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="border border-slate-300 p-1">
                    <input
                      type="text"
                      value={row.bankName}
                      onChange={(e) => updateRow(row.id, "bankName", e.target.value)}
                      className="h-9 w-full rounded border border-slate-200 px-2 outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="border border-slate-300 p-1">
                    <input
                      type="text"
                      value={row.accountNumber}
                      onChange={(e) => updateRow(row.id, "accountNumber", e.target.value)}
                      className="h-9 w-full rounded border border-slate-200 px-2 outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="border border-slate-300 p-1">
                    <input
                      type="text"
                      value={row.amountPaidBefore}
                      onChange={(e) => updateRow(row.id, "amountPaidBefore", e.target.value)}
                      className="h-9 w-full rounded border border-slate-200 px-2 text-right outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="border border-slate-300 p-1">
                    <input
                      type="text"
                      value={row.amountToPay}
                      onChange={(e) => updateRow(row.id, "amountToPay", e.target.value)}
                      className="h-9 w-full rounded border border-slate-200 px-2 text-right outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="border border-slate-300 p-1">
                    <textarea
                      value={row.note}
                      onChange={(e) => updateRow(row.id, "note", e.target.value)}
                      className="h-14 w-full resize-none rounded border border-slate-200 px-2 py-1 outline-none focus:border-blue-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold text-slate-900">
                <td colSpan={3} className="border border-slate-300 px-3 py-2 text-right">
                  합계
                </td>
                <td className="border border-slate-300 px-3 py-2 text-right">{formatAmount(totals.occurred)}</td>
                <td colSpan={3} className="border border-slate-300 px-3 py-2"></td>
                <td className="border border-slate-300 px-3 py-2 text-right">{formatAmount(totals.paidBefore)}</td>
                <td className="border border-slate-300 px-3 py-2 text-right">{formatAmount(totals.toPay)}</td>
                <td className="border border-slate-300 px-3 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
