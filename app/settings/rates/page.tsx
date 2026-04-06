"use client";

import { useEffect, useMemo, useState } from "react";

import { LABOR_RATE_CONFIG_STORAGE_KEY, RATE_OPTION_FIELDS, RATE_TABLE_SECTIONS } from "@/lib/labor-rate-ui";
import { defaultRateConfig, getRateFormulaSummary, loadDefaultRateConfig, serializeRateConfig, type LaborRateConfig } from "@/lib/labor";

function getStoredRateConfig() {
  if (typeof window === "undefined") {
    return defaultRateConfig;
  }

  return loadDefaultRateConfig(window.localStorage.getItem(LABOR_RATE_CONFIG_STORAGE_KEY));
}

export default function RatesSettingsPage() {
  const [rateConfig, setRateConfig] = useState<LaborRateConfig>(getStoredRateConfig);
  const rateFormulaRows = useMemo(() => getRateFormulaSummary(rateConfig), [rateConfig]);

  useEffect(() => {
    window.localStorage.setItem(LABOR_RATE_CONFIG_STORAGE_KEY, serializeRateConfig(rateConfig));
  }, [rateConfig]);

  const updateRateNumberField = (field: keyof LaborRateConfig, rawValue: string) => {
    const nextValue = rawValue.trim() === "" ? 0 : Number(rawValue);

    if (!Number.isFinite(nextValue)) {
      return;
    }

    setRateConfig((currentConfig) => ({
      ...currentConfig,
      [field]: nextValue,
    }));
  };

  const updateRateToggleField = (field: keyof LaborRateConfig, checked: boolean) => {
    setRateConfig((currentConfig) => ({
      ...currentConfig,
      [field]: checked,
    }));
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-2xl border border-slate-300 bg-white px-5 py-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold tracking-[0.16em] text-slate-500">LABOR RATE SETTINGS</p>
              <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.03em] text-slate-900">보험/세금 기준표</h1>
              <p className="mt-2 text-[14px] leading-[1.6] text-slate-600">
                이 화면에서 입력한 기준요율표와 옵션은 같은 브라우저의 입력 화면과 출력 화면 계산에 바로 반영됩니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRateConfig(defaultRateConfig)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50"
              >
                기본값으로 되돌리기
              </button>
              <button
                type="button"
                onClick={() => window.close()}
                className="rounded-md border border-blue-700 bg-blue-700 px-3 py-2 text-[13px] font-medium text-white transition hover:bg-blue-600"
              >
                창 닫기
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.95fr]">
          <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-blue-50 px-5 py-4">
              <h2 className="text-[17px] font-semibold text-slate-800">기준요율표</h2>
              <p className="mt-1 text-[13px] leading-[1.5] text-slate-600">요율은 % 숫자만, 기준금액은 원 단위로 입력합니다.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[14px] leading-[1.45]">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="border-b border-r border-slate-200 px-3 py-2 text-left font-semibold">구분</th>
                    <th className="border-b border-r border-slate-200 px-3 py-2 text-left font-semibold">항목</th>
                    <th className="border-b border-r border-slate-200 px-3 py-2 text-left font-semibold">기준값</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">단위</th>
                  </tr>
                </thead>
                <tbody>
                  {RATE_TABLE_SECTIONS.map((section) =>
                    section.fields.map((field, fieldIndex) => (
                      <tr key={`${section.title}-${String(field.key)}`} className="odd:bg-white even:bg-slate-50/40">
                        {fieldIndex === 0 ? (
                          <th
                            rowSpan={section.fields.length}
                            className="border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left align-top font-semibold text-slate-700"
                          >
                            {section.title}
                          </th>
                        ) : null}
                        <td className="border-b border-r border-slate-200 px-3 py-2 text-slate-700">{field.label}</td>
                        <td className="border-b border-r border-slate-200 px-3 py-2">
                          <input
                            type="number"
                            inputMode="decimal"
                            step={field.step ?? "0.01"}
                            value={String(rateConfig[field.key] as number)}
                            onChange={(event) => updateRateNumberField(field.key, event.target.value)}
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-right font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 text-slate-500">{field.suffix ?? "-"}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 px-5 py-4">
              <h3 className="mb-3 text-[15px] font-semibold text-slate-800">추가 적용 옵션</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {RATE_OPTION_FIELDS.map((option) => (
                  <label
                    key={String(option.key)}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(rateConfig[option.key])}
                      onChange={(event) => updateRateToggleField(option.key, event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      <span className="block text-[14px] font-medium text-slate-800">{option.label}</span>
                      <span className="mt-1 block text-[12.5px] leading-[1.45] text-slate-500">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-blue-50 px-5 py-4">
              <h2 className="text-[17px] font-semibold text-slate-800">계산식 요약표</h2>
              <p className="mt-1 text-[13px] leading-[1.5] text-slate-600">현재 설정값을 기준으로 적용 공식을 읽기 쉽게 정리했습니다.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13.5px] leading-[1.5]">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="border-b border-r border-slate-200 px-3 py-2 text-left font-semibold">항목</th>
                    <th className="border-b border-r border-slate-200 px-3 py-2 text-left font-semibold">계산식</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">비고</th>
                  </tr>
                </thead>
                <tbody>
                  {rateFormulaRows.map((row) => (
                    <tr key={row.label} className="odd:bg-white even:bg-slate-50/40">
                      <th className="border-b border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">{row.label}</th>
                      <td className="border-b border-r border-slate-200 px-3 py-2 font-medium text-slate-800">{row.formula}</td>
                      <td className="border-b border-slate-200 px-3 py-2 text-slate-500">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
