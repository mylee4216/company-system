import Link from "next/link";

export default function FundRequestPage() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-slate-900">자금청구서</h1>
      <p className="mt-2 text-sm text-slate-600">자금청구서 테스트 페이지입니다.</p>
      <div className="mt-6">
        <Link
          href="/fund-request/print"
          className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
        >
          인쇄 페이지 열기
        </Link>
      </div>
    </div>
  );
}
