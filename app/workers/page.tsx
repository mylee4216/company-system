"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Worker = {
  id: number;
  name: string;
  phone: string | null;
  resident_number: string | null;
  job_type: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type FormData = Omit<Worker, "id" | "created_at" | "updated_at">;

const CATEGORY_OPTIONS = ["직영", "용역", "기타"] as const;
const APP_PASSWORD = "leejuu1996!";
const AUTH_STORAGE_KEY = "company-system-authenticated";

function isBrowser() {
  return typeof window !== "undefined";
}

function getStoredAuthStatus(): boolean {
  if (!isBrowser()) {
    return false;
  }
  return window.localStorage.getItem(AUTH_STORAGE_KEY) === "true";
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatPhoneNumber(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length < 4) {
    return digits;
  }
  if (digits.length < 8) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function formatResidentId(value: string) {
  const digits = onlyDigits(value).slice(0, 13);
  if (digits.length <= 6) {
    return digits;
  }
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

async function fetchWorkers(): Promise<Worker[]> {
  const { data, error } = await supabase
    .from("workers")
    .select("id, name, phone, resident_number, job_type, category, is_active, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`근로자 정보를 불러오지 못했습니다. ${error.message}`);
  }

  return (data ?? []) as Worker[];
}

async function insertWorker(formData: FormData): Promise<Worker> {
  const { data, error } = await supabase
    .from("workers")
    .insert([formData])
    .select()
    .single();

  if (error) {
    throw new Error(`근로자 등록에 실패했습니다. ${error.message}`);
  }

  return data as Worker;
}

async function updateWorker(id: number, formData: Partial<FormData>): Promise<Worker> {
  const { data, error } = await supabase
    .from("workers")
    .update(formData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`근로자 수정에 실패했습니다. ${error.message}`);
  }

  return data as Worker;
}

async function deleteWorker(id: number): Promise<void> {
  const { error } = await supabase.from("workers").delete().eq("id", id);

  if (error) {
    throw new Error(`근로자 삭제에 실패했습니다. ${error.message}`);
  }
}

export default function WorkersPage() {
  const [authStatus, setAuthStatus] = useState<"checking" | "authenticated" | "unauthenticated">("checking");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [isEditingId, setIsEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    resident_number: "",
    job_type: "",
    category: null,
    is_active: true,
  });

  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setAuthStatus(getStoredAuthStatus() ? "authenticated" : "unauthenticated");
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setIsLoading(false);
      return;
    }

    let active = true;

    async function loadWorkers() {
      setIsLoading(true);
      setError("");

      try {
        const data = await fetchWorkers();
        if (active) {
          setWorkers(data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "데이터 로드 실패");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadWorkers();

    return () => {
      active = false;
    };
  }, [authStatus]);

  const handlePasswordSubmit = () => {
    if (passwordInput === APP_PASSWORD) {
      if (isBrowser()) {
        window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
      }
      setAuthError("");
      setPasswordInput("");
      setAuthStatus("authenticated");
      return;
    }

    setAuthError("비밀번호가 올바르지 않습니다.");
  };

  const handlePasswordKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handlePasswordSubmit();
    }
  };

  const handleFormChange = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => {
      if (field === "phone") {
        return { ...prev, [field]: formatPhoneNumber(value as string) };
      }
      if (field === "resident_number") {
        return { ...prev, [field]: formatResidentId(value as string) };
      }
      return { ...prev, [field]: value };
    });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      resident_number: "",
      job_type: "",
      category: null,
      is_active: true,
    });
    setIsEditingId(null);
  };

  const handleAddClick = () => {
    resetForm();
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 0);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError("성명을 입력해주세요.");
      return;
    }

    setError("");
    setSuccessMessage("");

    try {
      if (isEditingId !== null) {
        const updated = await updateWorker(isEditingId, formData);
        setWorkers((prev) => prev.map((w) => (w.id === isEditingId ? updated : w)));
        setSuccessMessage("근로자 정보가 수정되었습니다.");
      } else {
        const newWorker = await insertWorker(formData);
        setWorkers((prev) => [newWorker, ...prev]);
        setSuccessMessage("근로자가 등록되었습니다.");
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    }
  };

  const handleEdit = (worker: Worker) => {
    setFormData({
      name: worker.name,
      phone: worker.phone || "",
      resident_number: worker.resident_number || "",
      job_type: worker.job_type || "",
      category: worker.category as typeof CATEGORY_OPTIONS[number] | null,
      is_active: worker.is_active,
    });
    setIsEditingId(worker.id);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) {
      return;
    }

    setError("");
    setSuccessMessage("");

    try {
      await deleteWorker(id);
      setWorkers((prev) => prev.filter((w) => w.id !== id));
      setSuccessMessage("근로자가 삭제되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  if (authStatus !== "authenticated") {
    return (
      <main className="min-h-screen bg-stone-100 px-3 py-7 text-stone-900">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-sm items-center justify-center">
          <section className="w-full rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="space-y-2">
              <h1 className="text-lg font-semibold tracking-[-0.02em] text-stone-900">접근 비밀번호</h1>
              <p className="text-[13px] leading-5 text-stone-500">근로자 관리 페이지입니다. 비밀번호를 입력해주세요.</p>
            </div>
            <div className="mt-4 space-y-2.5">
              <input
                type="password"
                value={passwordInput}
                onChange={(event) => {
                  setPasswordInput(event.target.value);
                  if (authError) {
                    setAuthError("");
                  }
                }}
                onKeyDown={handlePasswordKeyDown}
                placeholder="비밀번호 입력"
                autoComplete="current-password"
                className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-[14px] outline-none transition focus:border-stone-500"
              />
              <button
                type="button"
                onClick={handlePasswordSubmit}
                className="h-10 w-full rounded-lg bg-stone-900 text-[13px] font-medium text-white transition hover:bg-stone-800"
              >
                확인
              </button>
              {authError && <p className="text-[12px] text-red-600">{authError}</p>}
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-3xl font-bold text-stone-900">근로자 관리</h1>

        {error && (
          <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 rounded-lg">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 rounded-lg">
            {successMessage}
          </div>
        )}

        <section className="mb-8 rounded-lg border border-stone-300 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-stone-800">
            {isEditingId !== null ? "근로자 정보 수정" : "근로자 등록"}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700">성명 *</label>
              <input
                ref={nameInputRef}
                type="text"
                value={formData.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                placeholder="성명 입력"
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700">전화번호</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleFormChange("phone", e.target.value)}
                placeholder="010-0000-0000"
                inputMode="numeric"
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700">주민번호</label>
              <input
                type="text"
                value={formData.resident_number}
                onChange={(e) => handleFormChange("resident_number", e.target.value)}
                placeholder="000000-0000000"
                inputMode="numeric"
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700">직종</label>
              <input
                type="text"
                value={formData.job_type}
                onChange={(e) => handleFormChange("job_type", e.target.value)}
                placeholder="직종 입력 (예: 건설)"
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700">구분</label>
              <select
                value={formData.category || ""}
                onChange={(e) => handleFormChange("category", e.target.value || null)}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400"
              >
                <option value="">선택 안 함</option>
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => handleFormChange("is_active", e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300"
                />
                활성화
              </label>
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center justify-center rounded bg-emerald-700 px-6 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
            >
              {isEditingId !== null ? "수정" : "등록"}
            </button>
            {isEditingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center justify-center rounded border border-stone-300 px-6 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
              >
                취소
              </button>
            )}
            {!isEditingId && (
              <button
                type="button"
                onClick={handleAddClick}
                className="inline-flex items-center justify-center rounded border border-stone-300 px-6 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
              >
                초기화
              </button>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-stone-300 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200">
            <h2 className="text-lg font-semibold text-stone-800">근로자 목록</h2>
            <p className="mt-1 text-sm text-stone-500">{isLoading ? "로드 중..." : `총 ${workers.length}명`}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-stone-700">성명</th>
                  <th className="px-6 py-3 text-left font-semibold text-stone-700">전화번호</th>
                  <th className="px-6 py-3 text-left font-semibold text-stone-700">주민번호</th>
                  <th className="px-6 py-3 text-left font-semibold text-stone-700">직종</th>
                  <th className="px-6 py-3 text-left font-semibold text-stone-700">구분</th>
                  <th className="px-6 py-3 text-center font-semibold text-stone-700">상태</th>
                  <th className="px-6 py-3 text-center font-semibold text-stone-700">관리</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-stone-500">
                      로드 중...
                    </td>
                  </tr>
                ) : workers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-stone-500">
                      등록된 근로자가 없습니다.
                    </td>
                  </tr>
                ) : (
                  workers.map((worker, index) => (
                    <tr key={worker.id} className={index % 2 === 0 ? "bg-white" : "bg-stone-50"}>
                      <td className="px-6 py-3 text-stone-900">{worker.name}</td>
                      <td className="px-6 py-3 text-stone-600">{worker.phone || "-"}</td>
                      <td className="px-6 py-3 text-stone-600">{worker.resident_number || "-"}</td>
                      <td className="px-6 py-3 text-stone-600">{worker.job_type || "-"}</td>
                      <td className="px-6 py-3 text-stone-600">{worker.category || "-"}</td>
                      <td className="px-6 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            worker.is_active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-stone-200 text-stone-600"
                          }`}
                        >
                          {worker.is_active ? "활성" : "비활성"}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleEdit(worker)}
                            className="text-sm font-medium text-blue-600 transition hover:text-blue-800"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(worker.id)}
                            className="text-sm font-medium text-red-600 transition hover:text-red-800"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
