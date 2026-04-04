"use client";

console.log("코덱스 연결 확인");

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type EmployeeType = "상용직" | "일용직";
type EmployeeStatus = "재직" | "퇴사";
type Menu = "dashboard" | "employees" | "daily";

type Employee = {
  id: number;
  name: string;
  type: EmployeeType;
  position: string;
  join_date: string;
  status: EmployeeStatus;
};

type DailyWorker = {
  id: number;
  name: string;
  daily_wage: number;
  non_taxable: number;
  created_at: string;
};

type WorkEntry = {
  date: string;
  work_days: number | null;
};

type DailyWorkerMonthlyRecord = {
  daily_worker_id: number;
  target_month: string;
  work_dates: string[];
  work_entries: WorkEntry[];
  total_work_units: number;
  worked_days_count: number;
  gross_amount: number;
};

function getMonthDates(targetMonth: string): string[] {
  const [yearText, monthText] = targetMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return [];

  const lastDay = new Date(year, month, 0).getDate();
  return Array.from({ length: lastDay }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    return `${targetMonth}-${day}`;
  });
}

function normalizeEmployeeType(value: string | null): EmployeeType {
  return value === "일용직" ? "일용직" : "상용직";
}

function normalizeEmployeeStatus(value: string | null): EmployeeStatus {
  return value === "퇴사" ? "퇴사" : "재직";
}

function mapRecordRowToWorkMap(row: {
  work_dates: string[] | null;
  work_entries: WorkEntry[] | null;
}): Record<string, number> {
  const mapped: Record<string, number> = {};

  if (Array.isArray(row.work_entries) && row.work_entries.length > 0) {
    row.work_entries.forEach((entry) => {
      if (entry?.date && entry?.work_days !== null && entry?.work_days !== undefined) {
        mapped[entry.date] = Math.max(0, Number(entry.work_days) || 0);
      }
    });
    return mapped;
  }

  if (Array.isArray(row.work_dates)) {
    row.work_dates.forEach((date) => {
      mapped[date] = 1;
    });
  }

  return mapped;
}

function buildSelectedWorkEntries(monthDates: string[], workMap: Record<string, number> = {}): WorkEntry[] {
  return monthDates.map((date) => ({
    date,
    work_days: workMap[date] ?? null,
  }));
}

export default function Page() {
  const [currentMenu, setCurrentMenu] = useState<Menu>("dashboard");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dailyWorkers, setDailyWorkers] = useState<DailyWorker[]>([]);
  const [records, setRecords] = useState<Record<number, Record<string, number>>>({});

  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingDailyWorkers, setLoadingDailyWorkers] = useState(false);
  const [savingMonthlyRecord, setSavingMonthlyRecord] = useState(false);

  const [employeeNameQuery, setEmployeeNameQuery] = useState("");
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState<"전체" | EmployeeType>("전체");
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<"전체" | EmployeeStatus>("전체");

  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    type: "상용직" as EmployeeType,
    position: "",
    join_date: "",
    status: "재직" as EmployeeStatus,
  });
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);

  const [dailyWorkerForm, setDailyWorkerForm] = useState({
    name: "",
    daily_wage: "",
    non_taxable: "0",
  });
  const [editingDailyWorkerId, setEditingDailyWorkerId] = useState<number | null>(null);

  const [targetMonth, setTargetMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedDailyWorkerId, setSelectedDailyWorkerId] = useState<number | null>(null);
  const [selectedWorkEntries, setSelectedWorkEntries] = useState<WorkEntry[]>([]);

  const monthDates = useMemo(() => getMonthDates(targetMonth), [targetMonth]);

  const selectedWorker = useMemo(
    () => dailyWorkers.find((worker) => worker.id === selectedDailyWorkerId) ?? null,
    [dailyWorkers, selectedDailyWorkerId]
  );
  const safeEntries = Array.isArray(selectedWorkEntries) ? selectedWorkEntries : [];

  const selectedWorkMap = useMemo(() => {
    const map: Record<string, number | null> = {};
    safeEntries.forEach((entry) => {
      map[entry.date] = entry.work_days ?? null;
    });
    return map;
  }, [safeEntries]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const byName =
        employeeNameQuery.trim() === "" ||
        employee.name.toLowerCase().includes(employeeNameQuery.trim().toLowerCase());
      const byType = employeeTypeFilter === "전체" || employee.type === employeeTypeFilter;
      const byStatus = employeeStatusFilter === "전체" || employee.status === employeeStatusFilter;
      return byName && byType && byStatus;
    });
  }, [employees, employeeNameQuery, employeeTypeFilter, employeeStatusFilter]);

  const activeEmployeeCount = useMemo(
    () => employees.filter((employee) => employee.status === "재직").length,
    [employees]
  );

  const dailyWorkerCount = dailyWorkers.length;

  const expectedPayout = useMemo(() => {
    return dailyWorkers.reduce((sum, worker) => {
      const map = records[worker.id] ?? {};
      const totalWorkDays = Object.values(map).reduce((acc, value) => acc + Number(value), 0);
      return sum + totalWorkDays * worker.daily_wage;
    }, 0);
  }, [dailyWorkers, records]);

  function selectDailyWorker(workerId: number | null) {
    setCurrentMenu("daily");
    setSelectedDailyWorkerId(workerId);
    if (!workerId) {
      setSelectedWorkEntries([]);
      return;
    }
    setSelectedWorkEntries(buildSelectedWorkEntries(monthDates, records[workerId] ?? {}));
  }

  async function fetchEmployees() {
    setLoadingEmployees(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id, name, type, position, join_date, status")
      .order("id", { ascending: true });

    if (error) {
      alert(`직원 조회 실패: ${error.message}`);
      setLoadingEmployees(false);
      return;
    }

    const rows = (data ?? []) as {
      id: number;
      name: string;
      type: string | null;
      position: string;
      join_date: string;
      status: string | null;
    }[];

    setEmployees(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: normalizeEmployeeType(row.type),
        position: row.position,
        join_date: row.join_date,
        status: normalizeEmployeeStatus(row.status),
      }))
    );
    setLoadingEmployees(false);
  }

  async function fetchDailyWorkers() {
    setLoadingDailyWorkers(true);
    const { data, error } = await supabase
      .from("daily_workers")
      .select("id, name, daily_wage, non_taxable, created_at")
      .order("id", { ascending: true });

    if (error) {
      alert(`일용직 조회 실패: ${error.message}`);
      setLoadingDailyWorkers(false);
      return;
    }

    const rows = (data ?? []) as DailyWorker[];
    setDailyWorkers(rows);
    setLoadingDailyWorkers(false);
  }

  async function fetchMonthlyRecords(month: string) {
    const { data, error } = await supabase
      .from("daily_worker_monthly_records")
      .select(
        "daily_worker_id, target_month, work_dates, work_entries, total_work_units, worked_days_count, gross_amount"
      )
      .eq("target_month", month);

    if (error) {
      alert(`월별 기록 조회 실패: ${error.message}`);
      return;
    }

    const rows = (data ?? []) as {
      daily_worker_id: number;
      target_month: string;
      work_dates: string[] | null;
      work_entries: WorkEntry[] | null;
      total_work_units: number | null;
      worked_days_count: number | null;
      gross_amount: number | null;
    }[];

    const next: Record<number, Record<string, number>> = {};
    rows.forEach((row) => {
      next[row.daily_worker_id] = mapRecordRowToWorkMap(row);
    });

    setRecords(next);
    if (selectedDailyWorkerId) {
      setSelectedWorkEntries(buildSelectedWorkEntries(monthDates, next[selectedDailyWorkerId] ?? {}));
    } else {
      setSelectedWorkEntries([]);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => {
      fetchEmployees();
      fetchDailyWorkers();
    });
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      fetchMonthlyRecords(targetMonth);
    });
  }, [targetMonth]);

  async function submitEmployee(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!employeeForm.name.trim()) {
      alert("이름을 입력하세요.");
      return;
    }

    if (editingEmployeeId) {
      const { error } = await supabase
        .from("employees")
        .update({
          name: employeeForm.name.trim(),
          type: employeeForm.type,
          position: employeeForm.position.trim(),
          join_date: employeeForm.join_date,
          status: employeeForm.status,
        })
        .eq("id", editingEmployeeId);

      if (error) {
        alert(`직원 수정 실패: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("employees").insert({
        name: employeeForm.name.trim(),
        type: employeeForm.type,
        position: employeeForm.position.trim(),
        join_date: employeeForm.join_date,
        status: employeeForm.status,
      });

      if (error) {
        alert(`직원 등록 실패: ${error.message}`);
        return;
      }
    }

    setEmployeeForm({
      name: "",
      type: "상용직",
      position: "",
      join_date: "",
      status: "재직",
    });
    setEditingEmployeeId(null);
    fetchEmployees();
  }

  function startEditEmployee(employee: Employee) {
    setCurrentMenu("employees");
    setEditingEmployeeId(employee.id);
    setEmployeeForm({
      name: employee.name,
      type: employee.type,
      position: employee.position,
      join_date: employee.join_date,
      status: employee.status,
    });
  }

  async function deleteEmployee(id: number) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) {
      alert(`직원 삭제 실패: ${error.message}`);
      return;
    }
    fetchEmployees();
  }

  async function saveDailyWorker(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const dailyWage = Number(dailyWorkerForm.daily_wage || 0);
    const nonTaxable = Number(dailyWorkerForm.non_taxable || 0);

    if (!dailyWorkerForm.name.trim()) {
      alert("이름을 입력하세요.");
      return;
    }
    if (dailyWage <= 0) {
      alert("일당은 0보다 커야 합니다.");
      return;
    }

    if (editingDailyWorkerId) {
      const { error } = await supabase
        .from("daily_workers")
        .update({
          name: dailyWorkerForm.name.trim(),
          daily_wage: dailyWage,
          non_taxable: nonTaxable,
        })
        .eq("id", editingDailyWorkerId);

      if (error) {
        alert(`일용직 수정 실패: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("daily_workers").insert({
        name: dailyWorkerForm.name.trim(),
        daily_wage: dailyWage,
        non_taxable: nonTaxable,
      });

      if (error) {
        alert(`일용직 등록 실패: ${error.message}`);
        return;
      }
    }

    setDailyWorkerForm({ name: "", daily_wage: "", non_taxable: "0" });
    setEditingDailyWorkerId(null);
    fetchDailyWorkers();
  }

  function startEditDailyWorker(worker: DailyWorker) {
    setCurrentMenu("daily");
    setEditingDailyWorkerId(worker.id);
    setDailyWorkerForm({
      name: worker.name,
      daily_wage: String(worker.daily_wage),
      non_taxable: String(worker.non_taxable),
    });
    selectDailyWorker(worker.id);
  }

  async function deleteDailyWorker(id: number) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("daily_workers").delete().eq("id", id);
    if (error) {
      alert(`일용직 삭제 실패: ${error.message}`);
      return;
    }
    if (selectedDailyWorkerId === id) {
      selectDailyWorker(null);
    }
    fetchDailyWorkers();
    fetchMonthlyRecords(targetMonth);
  }

  function updateWorkUnit(date: string, workDays: number | null) {
    setSelectedWorkEntries((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const exists = safePrev.some((entry) => entry.date === date);

      if (exists) {
        return safePrev.map((entry) =>
          entry.date === date
            ? { ...entry, work_days: workDays }
            : entry
        );
      }

      return [...safePrev, { date, work_days: workDays }];
    });
  }

  async function saveMonthlyRecord() {
    if (!selectedWorker) {
      alert("일용직을 선택하세요.");
      return;
    }

    setSavingMonthlyRecord(true);
    const normalizedEntries = safeEntries
      .map((entry) => ({
        date: entry.date,
        work_days: entry.work_days === null || entry.work_days === undefined ? null : Number(entry.work_days),
      }))
      .map((entry) => ({
        ...entry,
        work_days:
          entry.work_days === null || Number.isNaN(entry.work_days)
            ? null
            : Math.max(0, Number(entry.work_days)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const paidEntries = normalizedEntries.filter((entry) => entry.work_days !== null && entry.work_days > 0);
    const workDates = paidEntries.map((entry) => entry.date);
    const totalWorkUnits = paidEntries.reduce((sum, entry) => sum + Number(entry.work_days), 0);
    const workedDaysCount = paidEntries.length;
    const grossAmount = Number(selectedWorker.daily_wage) * totalWorkUnits;

    const payload: DailyWorkerMonthlyRecord = {
      daily_worker_id: selectedWorker.id,
      target_month: targetMonth,
      work_dates: workDates,
      work_entries: normalizedEntries,
      total_work_units: totalWorkUnits,
      worked_days_count: workedDaysCount,
      gross_amount: grossAmount,
    };

    const { error } = await supabase
      .from("daily_worker_monthly_records")
      .upsert(payload, { onConflict: "daily_worker_id,target_month" });

    if (error) {
      alert(`월별 기록 저장 실패: ${error.message}`);
      setSavingMonthlyRecord(false);
      return;
    }

    setSavingMonthlyRecord(false);
    fetchMonthlyRecords(targetMonth);
    alert("저장되었습니다.");
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "8px" }}>회사 관리시스템</h1>
        <p style={{ color: "#475569", marginBottom: "24px" }}>직원관리와 일용직 월별 공수 입력을 한 화면에서 처리합니다.</p>

        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "24px" }}>
          <aside style={{ ...cardStyle, height: "fit-content" }}>
            <div style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "20px" }}>메뉴</div>
            <div style={{ display: "grid", gap: "10px" }}>
              <button style={currentMenu === "dashboard" ? activeMenuButtonStyle : menuButtonStyle} onClick={() => setCurrentMenu("dashboard")}>대시보드</button>
              <button style={currentMenu === "employees" ? activeMenuButtonStyle : menuButtonStyle} onClick={() => setCurrentMenu("employees")}>직원관리</button>
              <button style={currentMenu === "daily" ? activeMenuButtonStyle : menuButtonStyle} onClick={() => setCurrentMenu("daily")}>일용직관리</button>
            </div>
          </aside>

          <section style={{ display: "grid", gap: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
              <div style={cardStyle}>
                <div style={cardTitleStyle}>재직 직원 수</div>
                <div style={cardNumberStyle}>{activeEmployeeCount}명</div>
              </div>
              <div style={cardStyle}>
                <div style={cardTitleStyle}>일용직 인원</div>
                <div style={cardNumberStyle}>{dailyWorkerCount}명</div>
              </div>
              <div style={cardStyle}>
                <div style={cardTitleStyle}>예상 지급액</div>
                <div style={cardNumberStyle}>{expectedPayout.toLocaleString()}원</div>
                <div style={cardDescStyle}>{targetMonth} 월 기준</div>
              </div>
            </div>

            {currentMenu === "dashboard" && (
              <div style={cardStyle}>
                <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "12px" }}>요약</h2>
                <div style={{ color: "#64748b", marginBottom: "12px" }}>
                  등록 직원: {employees.length}명 / 재직: {activeEmployeeCount}명 / 일용직: {dailyWorkerCount}명
                </div>
              </div>
            )}

            {currentMenu === "employees" && (
              <>
                <div style={cardStyle}>
                  <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>{editingEmployeeId ? "직원 수정" : "직원 등록"}</h2>
                  <form onSubmit={submitEmployee} style={formGridStyle}>
                    <input style={inputStyle} placeholder="이름" value={employeeForm.name} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, name: e.target.value }))} />
                    <select style={inputStyle} value={employeeForm.type} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, type: e.target.value as EmployeeType }))}>
                      <option value="상용직">상용직</option>
                      <option value="일용직">일용직</option>
                    </select>
                    <input style={inputStyle} placeholder="직책" value={employeeForm.position} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, position: e.target.value }))} />
                    <input style={inputStyle} type="date" value={employeeForm.join_date} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, join_date: e.target.value }))} />
                    <select style={inputStyle} value={employeeForm.status} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, status: e.target.value as EmployeeStatus }))}>
                      <option value="재직">재직</option>
                      <option value="퇴사">퇴사</option>
                    </select>
                    <button type="submit" style={primaryButtonStyle}>{editingEmployeeId ? "수정 저장" : "직원 등록하기"}</button>
                  </form>
                </div>

                <div style={cardStyle}>
                  <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "12px" }}>직원 목록</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                    <input style={inputStyle} placeholder="이름 검색" value={employeeNameQuery} onChange={(e) => setEmployeeNameQuery(e.target.value)} />
                    <select style={inputStyle} value={employeeTypeFilter} onChange={(e) => setEmployeeTypeFilter(e.target.value as "전체" | EmployeeType)}>
                      <option value="전체">전체</option>
                      <option value="상용직">상용직</option>
                      <option value="일용직">일용직</option>
                    </select>
                    <select style={inputStyle} value={employeeStatusFilter} onChange={(e) => setEmployeeStatusFilter(e.target.value as "전체" | EmployeeStatus)}>
                      <option value="전체">전체</option>
                      <option value="재직">재직</option>
                      <option value="퇴사">퇴사</option>
                    </select>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        <th style={thStyle}>이름</th>
                        <th style={thStyle}>구분</th>
                        <th style={thStyle}>직책</th>
                        <th style={thStyle}>입사일</th>
                        <th style={thStyle}>상태</th>
                        <th style={thStyle}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingEmployees ? (
                        <tr><td style={tdStyle} colSpan={6}>불러오는 중...</td></tr>
                      ) : filteredEmployees.length === 0 ? (
                        <tr><td style={tdStyle} colSpan={6}>데이터가 없습니다.</td></tr>
                      ) : filteredEmployees.map((employee) => (
                        <tr key={employee.id}>
                          <td style={tdStyle}>{employee.name}</td>
                          <td style={tdStyle}>{employee.type}</td>
                          <td style={tdStyle}>{employee.position}</td>
                          <td style={tdStyle}>{employee.join_date}</td>
                          <td style={tdStyle}>{employee.status}</td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button type="button" style={secondaryButtonStyle} onClick={() => startEditEmployee(employee)}>수정</button>
                              <button type="button" style={dangerButtonStyle} onClick={() => deleteEmployee(employee.id)}>삭제</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {currentMenu === "daily" && (
              <>
                <div style={cardStyle}>
                  <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>일용직 공수 입력</h2>
                  <form onSubmit={saveDailyWorker} style={formGridStyle}>
                    <input style={inputStyle} placeholder="이름" value={dailyWorkerForm.name} onChange={(e) => setDailyWorkerForm((prev) => ({ ...prev, name: e.target.value }))} />
                    <input style={inputStyle} type="number" min={0} step={1} placeholder="일당" value={dailyWorkerForm.daily_wage} onChange={(e) => setDailyWorkerForm((prev) => ({ ...prev, daily_wage: e.target.value }))} />
                    <input style={inputStyle} type="number" min={0} placeholder="비과세" value={dailyWorkerForm.non_taxable} onChange={(e) => setDailyWorkerForm((prev) => ({ ...prev, non_taxable: e.target.value }))} />
                    <input style={inputStyle} type="month" value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} />
                    <select style={inputStyle} value={selectedDailyWorkerId ?? ""} onChange={(e) => selectDailyWorker(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">일용직 선택</option>
                      {dailyWorkers.map((worker) => (<option key={worker.id} value={worker.id}>{worker.name}</option>))}
                    </select>
                    <button type="submit" style={primaryButtonStyle}>{editingDailyWorkerId ? "수정 저장" : "일용직 등록하기"}</button>
                  </form>

                  <div style={{ marginTop: "16px" }}>
                    <div style={{ ...labelStyle, marginBottom: "8px" }}>일용직 공수 입력 달력</div>
                    {!selectedWorker ? (
                      <p style={{ color: "#64748b" }}>일용직을 선택하면 날짜별 공수 입력이 표시됩니다.</p>
                    ) : (
                      <>
                        <p style={{ color: "#334155", marginBottom: "8px" }}>
                          {selectedWorker.name} / 일당 {selectedWorker.daily_wage.toLocaleString()}원
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "8px" }}>
                          {monthDates.map((date) => (
                            <div key={date} style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "8px" }}>
                              <div style={{ fontSize: "12px", color: "#475569", marginBottom: "6px" }}>{date.slice(8, 10)}일</div>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={selectedWorkMap[date] ?? ""}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  updateWorkUnit(date, raw === "" ? null : Number(raw));
                                }}
                                style={{ ...inputStyle, padding: "8px", fontSize: "13px" }}
                              />
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: "12px" }}>
                          <button type="button" style={primaryButtonStyle} onClick={saveMonthlyRecord} disabled={savingMonthlyRecord}>
                            {savingMonthlyRecord ? "저장 중..." : "월 기록 저장"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div style={cardStyle}>
                  <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "12px" }}>일용직 목록</h2>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        <th style={thStyle}>이름</th>
                        <th style={thStyle}>일당</th>
                        <th style={thStyle}>비과세</th>
                        <th style={thStyle}>생성일</th>
                        <th style={thStyle}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingDailyWorkers ? (
                        <tr><td style={tdStyle} colSpan={5}>불러오는 중...</td></tr>
                      ) : dailyWorkers.length === 0 ? (
                        <tr><td style={tdStyle} colSpan={5}>데이터가 없습니다.</td></tr>
                      ) : dailyWorkers.map((worker) => (
                        <tr key={worker.id}>
                          <td style={tdStyle}>{worker.name}</td>
                          <td style={tdStyle}>{worker.daily_wage.toLocaleString()}원</td>
                          <td style={tdStyle}>{worker.non_taxable.toLocaleString()}원</td>
                          <td style={tdStyle}>{worker.created_at.slice(0, 10)}</td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button type="button" style={secondaryButtonStyle} onClick={() => startEditDailyWorker(worker)}>수정</button>
                              <button type="button" style={dangerButtonStyle} onClick={() => deleteDailyWorker(worker.id)}>삭제</button>
                              <button type="button" style={secondaryButtonStyle} onClick={() => selectDailyWorker(worker.id)}>공수입력</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

const menuButtonStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  cursor: "pointer",
  fontSize: "15px",
  textAlign: "left" as const,
};

const activeMenuButtonStyle = {
  ...menuButtonStyle,
  background: "#dbeafe",
  border: "1px solid #93c5fd",
  fontWeight: "bold",
};

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  padding: "20px",
};

const cardTitleStyle = {
  fontSize: "14px",
  color: "#64748b",
  marginBottom: "10px",
};

const cardNumberStyle = {
  fontSize: "28px",
  fontWeight: "bold",
  marginBottom: "6px",
};

const cardDescStyle = {
  fontSize: "13px",
  color: "#64748b",
};

const thStyle = {
  padding: "12px",
  borderBottom: "1px solid #cbd5e1",
  textAlign: "left" as const,
};

const tdStyle = {
  padding: "12px",
  borderBottom: "1px solid #e2e8f0",
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "16px",
};

const labelStyle = {
  marginBottom: "6px",
  fontSize: "14px",
  color: "#334155",
  fontWeight: "bold",
};

const inputStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  fontSize: "15px",
  boxSizing: "border-box" as const,
};

const primaryButtonStyle = {
  padding: "12px 18px",
  borderRadius: "10px",
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const dangerButtonStyle = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "none",
  background: "#dc2626",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #94a3b8",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: "bold",
  cursor: "pointer",
};
