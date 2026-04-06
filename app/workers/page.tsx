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
  if (!isBrowser()) return false;
  return window.localStorage.getItem(AUTH_STORAGE_KEY) === "true";
}

function setStoredAuthStatus(auth: boolean): void {
  if (!isBrowser()) return;
  if (auth) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
  } else {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatPhoneNumber(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function formatResidentId(value: string) {
  const digits = onlyDigits(value).slice(0, 13);
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

function validateWorkerData(data: FormData): string | null {
  if (!data.name.trim()) return "성명을 입력해주세요.";
  if (data.name.trim().length > 50) return "성명은 50자 이내여야 합니다.";
  if (data.phone && onlyDigits(data.phone).length > 0 && onlyDigits(data.phone).length < 10) {
    return "전화번호는 최소 10자 이상이어야 합니다.";
  }
  if (data.resident_number && onlyDigits(data.resident_number).length > 0) {
    if (onlyDigits(data.resident_number).length !== 13) {
      return "주민번호는 13자여야 합니다.";
    }
  }
  return null;
}

// Supabase CRUD operations
async function fetchWorkers(): Promise<Worker[]> {
  const { data, error } = await supabase
    .from("workers")
    .select("id, name, phone, resident_number, job_type, category, is_active, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`조회 실패: ${error.message}`);
  return (data ?? []) as Worker[];
}

async function createWorker(formData: FormData): Promise<Worker> {
  const { data, error } = await supabase
    .from("workers")
    .insert([formData])
    .select()
    .single();

  if (error) throw new Error(`등록 실패: ${error.message}`);
  return data as Worker;
}

async function updateWorkerRecord(id: number, formData: Partial<FormData>): Promise<Worker> {
  const { data, error } = await supabase
    .from("workers")
    .update({ ...formData, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`수정 실패: ${error.message}`);
  return data as Worker;
}

async function deleteWorkerRecord(id: number): Promise<void> {
  const { error } = await supabase.from("workers").delete().eq("id", id);
  if (error) throw new Error(`삭제 실패: ${error.message}`);
}

// Edit Modal Component
type EditModalProps = {
  isOpen: boolean;
  worker: Worker | null;
  onClose: () => void;
  onSave: (formData: FormData) => Promise<void>;
  isSaving: boolean;
};

function EditModal({ isOpen, worker, onClose, onSave, isSaving }: EditModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    resident_number: "",
    job_type: "",
    category: null,
    is_active: true,
  });
  const [error, setError] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (worker && isOpen) {
      setFormData({
        name: worker.name,
        phone: worker.phone || "",
        resident_number: worker.resident_number || "",
        job_type: worker.job_type || "",
        category: worker.category as typeof CATEGORY_OPTIONS[number] | null,
        is_active: worker.is_active,
      });
      setError("");
      setTimeout(() => nameInputRef.current?.focus(), 0);
    }
  }, [worker, isOpen]);

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setError("");
    if (field === "phone") {
      setFormData((prev) => ({ ...prev, [field]: formatPhoneNumber(value as string) }));
    } else if (field === "resident_number") {
      setFormData((prev) => ({ ...prev, [field]: formatResidentId(value as string) }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateWorkerData(formData);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
        <div className="border-b border-stone-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-stone-900">근로자 정보 수정</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">성명 *</label>
            <input
              ref={nameInputRef}
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              disabled={isSaving}
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400 disabled:bg-stone-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">전화번호</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="010-0000-0000"
              inputMode="numeric"
              disabled={isSaving}
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400 disabled:bg-stone-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">주민번호</label>
            <input
              type="text"
              value={formData.resident_number}
              onChange={(e) => handleChange("resident_number", e.target.value)}
              placeholder="000000-0000000"
              inputMode="numeric"
              disabled={isSaving}
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400 disabled:bg-stone-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">직종</label>
            <input
              type="text"
              value={formData.job_type}
              onChange={(e) => handleChange("job_type", e.target.value)}
              placeholder="직종 입력"
              disabled={isSaving}
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400 disabled:bg-stone-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">구분</label>
            <select
              value={formData.category || ""}
              onChange={(e) => handleChange("category", e.target.value || null)}
              disabled={isSaving}
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400 disabled:bg-stone-50"
            >
              <option value="">선택 안 함</option>
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => handleChange("is_active", e.target.checked)}
              disabled={isSaving}
              className="h-4 w-4 rounded border-stone-300"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-stone-700">
              활성화
            </label>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:bg-emerald-400 disabled:cursor-not-allowed"
            >
              {isSaving ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 rounded border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:bg-stone-50 disabled:cursor-not-allowed"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WorkersPage() {
  // Auth
  const [authStatus, setAuthStatus] = useState<"checking" | "authenticated" | "unauthenticated">("checking");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  // Data
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Create form
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    resident_number: "",
    job_type: "",
    category: null,
    is_active: true,
  });
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit modal
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalSaving, setIsModalSaving] = useState(false);

  // Delete
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

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
      try {
        const data = await fetchWorkers();
        if (active) setWorkers(data);
      } catch (err) {
        if (active) {
          const msg = err instanceof Error ? err.message : "목록 조회 실패";
          console.error("fetchWorkers error:", msg);
          showToast(msg, "error");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadWorkers();
    return () => { active = false; };
  }, [authStatus]);

  const showToast = (text: string, type: "success" | "error") => {
    setToastMessage({ text, type });
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  };

  const handlePasswordSubmit = () => {
    if (passwordInput === APP_PASSWORD) {
      setStoredAuthStatus(true);
      setAuthError("");
      setPasswordInput("");
      setAuthStatus("authenticated");
      return;
    }
    setAuthError("비밀번호가 올바르지 않습니다.");
  };

  const handlePasswordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handlePasswordSubmit();
    }
  };

  const handleFormChange = (field: keyof FormData, value: string | boolean) => {
    setFormError("");
    if (field === "phone") {
      setFormData((prev) => ({ ...prev, [field]: formatPhoneNumber(value as string) }));
    } else if (field === "resident_number") {
      setFormData((prev) => ({ ...prev, [field]: formatResidentId(value as string) }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
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
    setFormError("");
  };

  const handleCreateWorker = async () => {
    const validationError = validateWorkerData(formData);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const newWorker = await createWorker(formData);
      setWorkers((prev) => [newWorker, ...prev]);
      showToast("근로자가 등록되었습니다.", "success");
      resetForm();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "등록 실패";
      console.error("createWorker error:", msg);
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = (worker: Worker) => {
    setSelectedWorker(worker);
    setIsModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setSelectedWorker(null);
    setIsModalOpen(false);
  };

  const handleSaveEditModal = async (updatedData: FormData) => {
    if (!selectedWorker) return;

    setIsModalSaving(true);
    try {
      const updated = await updateWorkerRecord(selectedWorker.id, updatedData);
      setWorkers((prev) => prev.map((w) => (w.id === selectedWorker.id ? updated : w)));
      showToast("근로자 정보가 수정되었습니다.", "success");
      handleCloseEditModal();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "수정 실패";
      console.error("updateWorker error:", msg);
      throw err;
    } finally {
      setIsModalSaving(false);
    }
  };

  const handleDeleteWorker = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    setIsDeleting(id);
    try {
      await deleteWorkerRecord(id);
      setWorkers((prev) => prev.filter((w) => w.id !== id));
      showToast("근로자가 삭제되었습니다.", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "삭제 실패";
      console.error("deleteWorker error:", msg);
      showToast(msg, "error");
    } finally {
      setIsDeleting(null);
    }
  };

  // Auth check
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
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (authError) setAuthError("");
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

        {/* Toast notifications */}
        {toastMessage && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              toastMessage.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {toastMessage.text}
          </div>
        )}

        {/* Create form */}
        <section className="mb-8 rounded-lg border border-stone-300 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-stone-800">새 근로자 등록</h2>

          {formError && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700">성명 *</label>
              <input
                ref={nameInputRef}
                type="text"
                value={formData.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                placeholder="성명 입력"
                disabled={isSubmitting}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400 disabled:bg-stone-50"
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
                disabled={isSubmitting}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400 disabled:bg-stone-50"
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
                disabled={isSubmitting}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400 disabled:bg-stone-50"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700">직종</label>
              <input
                type="text"
                value={formData.job_type}
                onChange={(e) => handleFormChange("job_type", e.target.value)}
                placeholder="직종 입력"
                disabled={isSubmitting}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400 disabled:bg-stone-50"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700">구분</label>
              <select
                value={formData.category || ""}
                onChange={(e) => handleFormChange("category", e.target.value || null)}
                disabled={isSubmitting}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-400 disabled:bg-stone-50"
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
                  disabled={isSubmitting}
                  className="h-4 w-4 rounded border-stone-300 disabled:bg-stone-50"
                />
                활성화
              </label>
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <button
              onClick={handleCreateWorker}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded bg-emerald-700 px-6 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:bg-emerald-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "등록 중..." : "등록"}
            </button>
            <button
              onClick={resetForm}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded border border-stone-300 px-6 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed"
            >
              초기화
            </button>
          </div>
        </section>

        {/* List table */}
        <section className="rounded-lg border border-stone-300 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200">
            <h2 className="text-lg font-semibold text-stone-800">근로자 목록</h2>
            <p className="mt-1 text-sm text-stone-500">
              {isLoading ? "로드 중..." : `총 ${workers.length}명`}
            </p>
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
                      <td className="px-6 py-3 text-stone-900 font-medium">{worker.name}</td>
                      <td className="px-6 py-3 text-stone-600">{worker.phone || "-"}</td>
                      <td className="px-6 py-3 text-stone-600">{worker.resident_number || "-"}</td>
                      <td className="px-6 py-3 text-stone-600">{worker.job_type || "-"}</td>
                      <td className="px-6 py-3 text-stone-600">{worker.category || "-"}</td>
                      <td className="px-6 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded text-xs font-medium ${
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
                            onClick={() => handleOpenEditModal(worker)}
                            className="text-sm font-medium text-blue-600 transition hover:text-blue-800 disabled:text-stone-400 disabled:cursor-not-allowed"
                            disabled={isDeleting === worker.id}
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDeleteWorker(worker.id)}
                            className="text-sm font-medium text-red-600 transition hover:text-red-800 disabled:text-stone-400 disabled:cursor-not-allowed"
                            disabled={isDeleting !== null}
                          >
                            {isDeleting === worker.id ? "삭제 중..." : "삭제"}
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

      <EditModal
        isOpen={isModalOpen}
        worker={selectedWorker}
        onClose={handleCloseEditModal}
        onSave={handleSaveEditModal}
        isSaving={isModalSaving}
      />
    </main>
  );
}
