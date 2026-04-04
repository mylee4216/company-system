"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Menu = "dashboard" | "employees" | "daily" | "tax";

type Employee = {
  id: number;
  name: string;
  type: string;
  position: string;
  joinDate: string;
  status: string;
};

type EmployeeRow = {
  id: number;
  name: string;
  type: string | null;
  position: string;
  join_date: string;
  status: string | null;
};

type DailyWorker = {
  id: number;
  name: string;
  dailyWage: number;
  nonTaxable: number;
  createdAt: string;
};

type DailyWorkerRow = {
  id: number;
  name: string;
  daily_wage: number;
  non_taxable: number;
  created_at: string;
};

type WorkEntry = {
  date: string;
  units: number;
};

type MonthlyRecordRow = {
  daily_worker_id: number;
  target_month: string;
  work_dates: string[] | null;
  work_entries: WorkEntry[] | null;
  total_work_units: number | null;
  worked_days_count: number | null;
  gross_amount: number | null;
};

function normalizeEmployeeType(value: string | null | undefined) {
  return (value ?? "").includes("일용") ? "일용직" : "상용직";
}

function normalizeEmployeeStatus(value: string | null | undefined) {
  return (value ?? "").includes("퇴") ? "퇴사" : "재직";
}

function mapDailyWorkerRowToState(row: DailyWorkerRow): DailyWorker {
  return {
    id: row.id,
    name: row.name,
    dailyWage: Number(row.daily_wage ?? 0),
    nonTaxable: Number(row.non_taxable ?? 0),
    createdAt: row.created_at,
  };
}

function getTotalWorkUnits(entries: WorkEntry[]) {
  return entries.reduce((sum, entry) => sum + Number(entry.units || 0), 0);
}

function getWorkedDaysCount(entries: WorkEntry[]) {
  return entries.filter((entry) => entry.units > 0).length;
}

function mapMonthlyRowToEntries(row: MonthlyRecordRow): WorkEntry[] {
  if (Array.isArray(row.work_entries)) {
    return row.work_entries
      .map((entry) => ({
        date: String(entry.date),
        units: Number(entry.units || 0),
      }))
      .filter((entry) => entry.date && entry.units > 0);
  }

  return Array.isArray(row.work_dates)
    ? row.work_dates.map((date) => ({ date, units: 1 }))
    : [];
}

function getDatesOfMonth(targetMonth: string) {
  const [yearText, monthText] = targetMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!year || !month) return [];

  const totalDays = new Date(year, month, 0).getDate();
  return Array.from({ length: totalDays }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${targetMonth}-${day}`;
  });
}

function calculateTaxByGross(grossAmount: number, workedDaysCount: number, nonTaxable: number) {
  const deductionBase = 150000 * workedDaysCount + nonTaxable * workedDaysCount;
  const taxableAmount = Math.max(grossAmount - deductionBase, 0);
  const incomeTax = Math.floor((taxableAmount * 0.027) / 10) * 10;
  const localTax = Math.floor((incomeTax * 0.1) / 10) * 10;
  return {
    taxableAmount,
    incomeTax,
    localTax,
    totalTax: incomeTax + localTax,
  };
}

export default function Page() {
  const [currentMenu, setCurrentMenu] = useState<Menu>("dashboard");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeeSearchKeyword, setEmployeeSearchKeyword] = useState("");
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState("전체");
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState("전체");
  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    type: "상용직",
    position: "",
    joinDate: "",
    status: "재직",
  });
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);

  const [dailyWorkers, setDailyWorkers] = useState<DailyWorker[]>([]);
  const [loadingDailyWorkers, setLoadingDailyWorkers] = useState(false);
  const [dailyForm, setDailyForm] = useState({
    name: "",
    dailyWage: "",
    nonTaxable: "0",
  });
  const [editingDailyWorkerId, setEditingDailyWorkerId] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedWorkEntries, setSelectedWorkEntries] = useState<WorkEntry[]>([]);
  const [monthlyRecords, setMonthlyRecords] = useState<Record<number, WorkEntry[]>>({});

  const [taxPreviewWorkerId, setTaxPreviewWorkerId] = useState<number | "">("");

  const monthDates = useMemo(() => getDatesOfMonth(selectedMonth), [selectedMonth]);

  const selectedWorkMap = useMemo(() => {
    const map: Record<string, number> = {};
    selectedWorkEntries.forEach((entry) => {
      map[entry.date] = entry.units;
    });
    return map;
  }, [selectedWorkEntries]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const matchesName =
        employeeSearchKeyword.trim() === "" ||
        employee.name.toLowerCase().includes(employeeSearchKeyword.trim().toLowerCase());
      const matchesType = employeeTypeFilter === "전체" || normalizeEmployeeType(employee.type) === employeeTypeFilter;
      const matchesStatus =
        employeeStatusFilter === "전체" || normalizeEmployeeStatus(employee.status) === employeeStatusFilter;
      return matchesName && matchesType && matchesStatus;
    });
  }, [employees, employeeSearchKeyword, employeeTypeFilter, employeeStatusFilter]);

  const activeEmployeeCount = useMemo(
    () => employees.filter((employee) => normalizeEmployeeStatus(employee.status) === "재직").length,
    [employees]
  );

  const estimatedPayout = useMemo(() => {
    return dailyWorkers.reduce((sum, worker) => {
      const entries = monthlyRecords[worker.id] ?? [];
      return sum + worker.dailyWage * getTotalWorkUnits(entries);
    }, 0);
  }, [dailyWorkers, monthlyRecords]);

  const taxPreview = useMemo(() => {
    const worker = dailyWorkers.find((item) => item.id === taxPreviewWorkerId);
    if (!worker) return null;

    const entries = monthlyRecords[worker.id] ?? [];
    const totalWorkUnits = getTotalWorkUnits(entries);
    const workedDaysCount = getWorkedDaysCount(entries);
    const grossAmount = worker.dailyWage * totalWorkUnits;
    return {
      worker,
      totalWorkUnits,
      workedDaysCount,
      grossAmount,
      ...calculateTaxByGross(grossAmount, workedDaysCount, worker.nonTaxable),
    };
  }, [taxPreviewWorkerId, dailyWorkers, monthlyRecords]);

  async function fetchEmployees() {
    setLoadingEmployees(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id, name, type, position, join_date, status")
      .order("id", { ascending: true });

    if (error) {
      alert(`직원 목록 조회 실패: ${error.message}`);
      setLoadingEmployees(false);
      return;
    }

    const rows = (data ?? []) as EmployeeRow[];
    setEmployees(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: normalizeEmployeeType(row.type),
        position: row.position,
        joinDate: row.join_date,
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
      .order("created_at", { ascending: true });

    if (error) {
      alert(`일용직 목록 조회 실패: ${error.message}`);
      setLoadingDailyWorkers(false);
      return;
    }

    const rows = (data ?? []) as DailyWorkerRow[];
    setDailyWorkers(rows.map(mapDailyWorkerRowToState));
    setLoadingDailyWorkers(false);
  }

  async function fetchMonthlyRecords(targetMonth: string) {
    const { data, error } = await supabase
      .from("daily_worker_monthly_records")
      .select(
        "daily_worker_id, target_month, work_dates, work_entries, total_work_units, worked_days_count, gross_amount"
      )
      .eq("target_month", targetMonth);

    if (error) {
      alert(`월별 공수 조회 실패: ${error.message}`);
      return;
    }

    const rows = (data ?? []) as MonthlyRecordRow[];
    const recordMap: Record<number, WorkEntry[]> = {};

    rows.forEach((row) => {
      recordMap[row.daily_worker_id] = mapMonthlyRowToEntries(row);
    });

    setMonthlyRecords(recordMap);
  }

  useEffect(() => {
    fetchEmployees();
    fetchDailyWorkers();
  }, []);

  useEffect(() => {
    fetchMonthlyRecords(selectedMonth);
    if (editingDailyWorkerId !== null) {
      setSelectedWorkEntries(monthlyRecords[editingDailyWorkerId] ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  function resetEmployeeForm() {
    setEmployeeForm({
      name: "",
      type: "상용직",
      position: "",
      joinDate: "",
      status: "재직",
    });
    setEditingEmployeeId(null);
  }

  async function saveEmployee() {
    if (!employeeForm.name || !employeeForm.position || !employeeForm.joinDate) {
      alert("이름, 직급, 입사일을 입력해주세요.");
      return;
    }

    if (editingEmployeeId !== null) {
      const { data, error } = await supabase
        .from("employees")
        .update({
          name: employeeForm.name,
          type: normalizeEmployeeType(employeeForm.type),
          position: employeeForm.position,
          join_date: employeeForm.joinDate,
          status: normalizeEmployeeStatus(employeeForm.status),
        })
        .eq("id", editingEmployeeId)
        .select("id, name, type, position, join_date, status")
        .single();

      if (error) {
        alert(`직원 수정 실패: ${error.message}`);
        return;
      }

      const row = data as EmployeeRow;
      setEmployees((prev) =>
        prev.map((employee) =>
          employee.id === editingEmployeeId
            ? {
                id: row.id,
                name: row.name,
                type: normalizeEmployeeType(row.type),
                position: row.position,
                joinDate: row.join_date,
                status: normalizeEmployeeStatus(row.status),
              }
            : employee
        )
      );
      resetEmployeeForm();
      return;
    }

    const { data, error } = await supabase
      .from("employees")
      .insert({
        name: employeeForm.name,
        type: normalizeEmployeeType(employeeForm.type),
        position: employeeForm.position,
        join_date: employeeForm.joinDate,
        status: normalizeEmployeeStatus(employeeForm.status),
      })
      .select("id, name, type, position, join_date, status")
      .single();

    if (error) {
      alert(`직원 등록 실패: ${error.message}`);
      return;
    }

    const row = data as EmployeeRow;
    setEmployees((prev) => [
      ...prev,
      {
        id: row.id,
        name: row.name,
        type: normalizeEmployeeType(row.type),
        position: row.position,
        joinDate: row.join_date,
        status: normalizeEmployeeStatus(row.status),
      },
    ]);
    resetEmployeeForm();
  }

  function startEditEmployee(employee: Employee) {
    setEditingEmployeeId(employee.id);
    setEmployeeForm({
      name: employee.name,
      type: normalizeEmployeeType(employee.type),
      position: employee.position,
      joinDate: employee.joinDate,
      status: normalizeEmployeeStatus(employee.status),
    });
    setCurrentMenu("employees");
  }

  async function deleteEmployee(employee: Employee) {
    if (!confirm(`${employee.name} 직원을 삭제할까요?`)) return;

    const { error } = await supabase.from("employees").delete().eq("id", employee.id);
    if (error) {
      alert(`직원 삭제 실패: ${error.message}`);
      return;
    }

    setEmployees((prev) => prev.filter((item) => item.id !== employee.id));
    if (editingEmployeeId === employee.id) {
      resetEmployeeForm();
    }
  }

  function resetDailyWorkerForm() {
    setDailyForm({
      name: "",
      dailyWage: "",
      nonTaxable: "0",
    });
    setEditingDailyWorkerId(null);
    setSelectedWorkEntries([]);
  }

  function updateWorkEntry(date: string, units: number) {
    setSelectedWorkEntries((prev) => {
      const filtered = prev.filter((entry) => entry.date !== date);
      if (units <= 0) return filtered;
      return [...filtered, { date, units }].sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  async function saveDailyWorker() {
    if (!dailyForm.name || !dailyForm.dailyWage) {
      alert("이름과 일급을 입력해주세요.");
      return;
    }

    const wage = Number(dailyForm.dailyWage || 0);
    const nonTaxable = Number(dailyForm.nonTaxable || 0);

    let workerId = editingDailyWorkerId;

    if (editingDailyWorkerId !== null) {
      const { data, error } = await supabase
        .from("daily_workers")
        .update({
          name: dailyForm.name,
          daily_wage: wage,
          non_taxable: nonTaxable,
        })
        .eq("id", editingDailyWorkerId)
        .select("id, name, daily_wage, non_taxable, created_at")
        .single();

      if (error) {
        alert(`일용직 수정 실패: ${error.message}`);
        return;
      }

      const row = data as DailyWorkerRow;
      setDailyWorkers((prev) =>
        prev.map((worker) => (worker.id === editingDailyWorkerId ? mapDailyWorkerRowToState(row) : worker))
      );
      workerId = row.id;
    } else {
      const { data, error } = await supabase
        .from("daily_workers")
        .insert({
          name: dailyForm.name,
          daily_wage: wage,
          non_taxable: nonTaxable,
        })
        .select("id, name, daily_wage, non_taxable, created_at")
        .single();

      if (error) {
        alert(`일용직 등록 실패: ${error.message}`);
        return;
      }

      const row = data as DailyWorkerRow;
      setDailyWorkers((prev) => [...prev, mapDailyWorkerRowToState(row)]);
      workerId = row.id;
    }

    if (workerId === null) return;

    const workEntries = selectedWorkEntries.filter((entry) => entry.units > 0);
    const workDates = workEntries.map((entry) => entry.date);
    const totalWorkUnits = getTotalWorkUnits(workEntries);
    const workedDaysCount = getWorkedDaysCount(workEntries);
    const grossAmount = wage * totalWorkUnits;

    const { error: monthlyError } = await supabase.from("daily_worker_monthly_records").upsert(
      {
        daily_worker_id: workerId,
        target_month: selectedMonth,
        work_entries: workEntries,
        work_dates: workDates,
        total_work_units: totalWorkUnits,
        worked_days_count: workedDaysCount,
        gross_amount: grossAmount,
      },
      { onConflict: "daily_worker_id,target_month" }
    );

    if (monthlyError) {
      alert(`월별 공수 저장 실패: ${monthlyError.message}`);
      return;
    }

    setMonthlyRecords((prev) => ({ ...prev, [workerId]: workEntries }));
    resetDailyWorkerForm();
  }

  function startEditDailyWorker(worker: DailyWorker) {
    setEditingDailyWorkerId(worker.id);
    setDailyForm({
      name: worker.name,
      dailyWage: String(worker.dailyWage),
      nonTaxable: String(worker.nonTaxable),
    });
    setSelectedWorkEntries(monthlyRecords[worker.id] ?? []);
    setCurrentMenu("daily");
  }

  async function deleteDailyWorker(worker: DailyWorker) {
    if (!confirm(`${worker.name} 일용직 정보를 삭제할까요?`)) return;

    const { error } = await supabase.from("daily_workers").delete().eq("id", worker.id);
    if (error) {
      alert(`일용직 삭제 실패: ${error.message}`);
      return;
    }

    setDailyWorkers((prev) => prev.filter((item) => item.id !== worker.id));
    setMonthlyRecords((prev) => {
      const next = { ...prev };
      delete next[worker.id];
      return next;
    });

    if (editingDailyWorkerId === worker.id) {
      resetDailyWorkerForm();
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "8px" }}>회사 관리시스템</h1>
        <p style={{ color: "#475569", marginBottom: "24px" }}>
          직원관리와 일용직 월별 공수/세금 계산을 한 화면에서 처리합니다.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "24px" }}>
          <aside style={{ ...cardStyle, height: "fit-content" }}>
            <div style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "20px" }}>메뉴</div>
            <div style={{ display: "grid", gap: "10px" }}>
              <button style={currentMenu === "dashboard" ? activeMenuButtonStyle : menuButtonStyle} onClick={() => setCurrentMenu("dashboard")}>대시보드</button>
              <button style={currentMenu === "employees" ? activeMenuButtonStyle : menuButtonStyle} onClick={() => setCurrentMenu("employees")}>직원관리</button>
              <button style={currentMenu === "daily" ? activeMenuButtonStyle : menuButtonStyle} onClick={() => setCurrentMenu("daily")}>일용직관리</button>
              <button style={currentMenu === "tax" ? activeMenuButtonStyle : menuButtonStyle} onClick={() => setCurrentMenu("tax")}>세금계산</button>
            </div>
          </aside>

          <section style={{ display: "grid", gap: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
              <div style={cardStyle}>
                <div style={cardTitleStyle}>재직 직원 수</div>
                <div style={cardNumberStyle}>{activeEmployeeCount}명</div>
                <div style={cardDescStyle}>employees 테이블 기준</div>
              </div>
              <div style={cardStyle}>
                <div style={cardTitleStyle}>일용직 인원</div>
                <div style={cardNumberStyle}>{dailyWorkers.length}명</div>
                <div style={cardDescStyle}>daily_workers 테이블 기준</div>
              </div>
              <div style={cardStyle}>
                <div style={cardTitleStyle}>예상 지급액</div>
                <div style={cardNumberStyle}>{estimatedPayout.toLocaleString()}원</div>
                <div style={cardDescStyle}>{selectedMonth} 월 기준</div>
              </div>
            </div>

            {currentMenu === "dashboard" && (
              <div style={cardStyle}>
                <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "12px" }}>직원 요약</h2>
                <div style={{ color: "#64748b", marginBottom: "12px" }}>
                  등록 직원: {employees.length}명 / 재직: {activeEmployeeCount}명 / 퇴사: {employees.length - activeEmployeeCount}명
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={thStyle}>이름</th>
                      <th style={thStyle}>구분</th>
                      <th style={thStyle}>직급</th>
                      <th style={thStyle}>입사일</th>
                      <th style={thStyle}>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((employee) => (
                      <tr key={employee.id}>
                        <td style={tdStyle}>{employee.name}</td>
                        <td style={tdStyle}>{normalizeEmployeeType(employee.type)}</td>
                        <td style={tdStyle}>{employee.position}</td>
                        <td style={tdStyle}>{employee.joinDate}</td>
                        <td style={tdStyle}>{normalizeEmployeeStatus(employee.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {currentMenu === "employees" && (
              <>
                <div style={cardStyle}>
                  <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>
                    {editingEmployeeId !== null ? "직원 수정" : "직원 등록"}
                  </h2>
                  <div style={formGridStyle}>
                    <div>
                      <div style={labelStyle}>이름</div>
                      <input style={inputStyle} value={employeeForm.name} onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })} placeholder="이름 입력" />
                    </div>
                    <div>
                      <div style={labelStyle}>구분</div>
                      <select style={inputStyle} value={employeeForm.type} onChange={(e) => setEmployeeForm({ ...employeeForm, type: e.target.value })}>
                        <option value="상용직">상용직</option>
                        <option value="일용직">일용직</option>
                      </select>
                    </div>
                    <div>
                      <div style={labelStyle}>직급</div>
                      <input style={inputStyle} value={employeeForm.position} onChange={(e) => setEmployeeForm({ ...employeeForm, position: e.target.value })} placeholder="직급 입력" />
                    </div>
                    <div>
                      <div style={labelStyle}>입사일</div>
                      <input type="date" style={inputStyle} value={employeeForm.joinDate} onChange={(e) => setEmployeeForm({ ...employeeForm, joinDate: e.target.value })} />
                    </div>
                    <div>
                      <div style={labelStyle}>상태</div>
                      <select style={inputStyle} value={employeeForm.status} onChange={(e) => setEmployeeForm({ ...employeeForm, status: e.target.value })}>
                        <option value="재직">재직</option>
                        <option value="퇴사">퇴사</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                    <button style={primaryButtonStyle} onClick={saveEmployee}>{editingEmployeeId !== null ? "수정 저장" : "직원 등록하기"}</button>
                    {editingEmployeeId !== null && (
                      <button style={secondaryButtonStyle} onClick={resetEmployeeForm}>취소</button>
                    )}
                  </div>
                </div>

                <div style={cardStyle}>
                  <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "12px" }}>직원 목록</h2>
                  {loadingEmployees && <div style={{ color: "#64748b", marginBottom: "10px" }}>직원 데이터를 불러오는 중입니다...</div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                    <input style={inputStyle} value={employeeSearchKeyword} onChange={(e) => setEmployeeSearchKeyword(e.target.value)} placeholder="이름 검색" />
                    <select style={inputStyle} value={employeeTypeFilter} onChange={(e) => setEmployeeTypeFilter(e.target.value)}>
                      <option value="전체">전체</option>
                      <option value="상용직">상용직</option>
                      <option value="일용직">일용직</option>
                    </select>
                    <select style={inputStyle} value={employeeStatusFilter} onChange={(e) => setEmployeeStatusFilter(e.target.value)}>
                      <option value="전체">전체</option>
                      <option value="재직">재직</option>
                      <option value="퇴사">퇴사</option>
                    </select>
                  </div>
                  <div style={{ color: "#64748b", marginBottom: "10px" }}>검색 결과: {filteredEmployees.length}명</div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        <th style={thStyle}>이름</th>
                        <th style={thStyle}>구분</th>
                        <th style={thStyle}>직급</th>
                        <th style={thStyle}>입사일</th>
                        <th style={thStyle}>상태</th>
                        <th style={thStyle}>관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map((employee) => (
                        <tr key={employee.id}>
                          <td style={tdStyle}>{employee.name}</td>
                          <td style={tdStyle}>{normalizeEmployeeType(employee.type)}</td>
                          <td style={tdStyle}>{employee.position}</td>
                          <td style={tdStyle}>{employee.joinDate}</td>
                          <td style={tdStyle}>{normalizeEmployeeStatus(employee.status)}</td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button style={secondaryButtonStyle} onClick={() => startEditEmployee(employee)}>수정</button>
                              <button style={dangerButtonStyle} onClick={() => deleteEmployee(employee)}>삭제</button>
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
                  <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>
                    {editingDailyWorkerId !== null ? "일용직 수정" : "일용직 등록"}
                  </h2>
                  <div style={formGridStyle}>
                    <div>
                      <div style={labelStyle}>이름</div>
                      <input style={inputStyle} value={dailyForm.name} onChange={(e) => setDailyForm({ ...dailyForm, name: e.target.value })} placeholder="이름 입력" />
                    </div>
                    <div>
                      <div style={labelStyle}>일급</div>
                      <input type="number" style={inputStyle} value={dailyForm.dailyWage} onChange={(e) => setDailyForm({ ...dailyForm, dailyWage: e.target.value })} placeholder="예: 180000" />
                    </div>
                    <div>
                      <div style={labelStyle}>비과세</div>
                      <input type="number" style={inputStyle} value={dailyForm.nonTaxable} onChange={(e) => setDailyForm({ ...dailyForm, nonTaxable: e.target.value })} placeholder="없으면 0" />
                    </div>
                    <div>
                      <div style={labelStyle}>기준 월</div>
                      <input type="month" style={inputStyle} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ marginTop: "16px" }}>
                    <div style={{ ...labelStyle, marginBottom: "8px" }}>날짜별 공수 입력</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "8px" }}>
                      {monthDates.map((date) => (
                        <div key={date} style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "8px" }}>
                          <div style={{ fontSize: "12px", color: "#475569", marginBottom: "6px" }}>{date.slice(8, 10)}일</div>
                          <select
                            style={{ ...inputStyle, padding: "8px", fontSize: "13px" }}
                            value={String(selectedWorkMap[date] ?? 0)}
                            onChange={(e) => updateWorkEntry(date, Number(e.target.value))}
                          >
                            <option value="0">0</option>
                            <option value="0.5">0.5</option>
                            <option value="1">1</option>
                            <option value="1.5">1.5</option>
                            <option value="2">2</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
                    <button style={primaryButtonStyle} onClick={saveDailyWorker}>{editingDailyWorkerId !== null ? "수정 저장" : "일용직 등록하기"}</button>
                    {editingDailyWorkerId !== null && (
                      <button style={secondaryButtonStyle} onClick={resetDailyWorkerForm}>취소</button>
                    )}
                  </div>
                </div>

                <div style={cardStyle}>
                  <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "12px" }}>일용직 목록 ({selectedMonth})</h2>
                  {loadingDailyWorkers && <div style={{ color: "#64748b", marginBottom: "10px" }}>일용직 데이터를 불러오는 중입니다...</div>}
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        <th style={thStyle}>이름</th>
                        <th style={thStyle}>일급</th>
                        <th style={thStyle}>근무일수</th>
                        <th style={thStyle}>총 공수</th>
                        <th style={thStyle}>지급총액</th>
                        <th style={thStyle}>비과세</th>
                        <th style={thStyle}>소득세</th>
                        <th style={thStyle}>주민세</th>
                        <th style={thStyle}>총 공제세액</th>
                        <th style={thStyle}>관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyWorkers.map((worker) => {
                        const entries = monthlyRecords[worker.id] ?? [];
                        const totalWorkUnits = getTotalWorkUnits(entries);
                        const workedDaysCount = getWorkedDaysCount(entries);
                        const grossAmount = worker.dailyWage * totalWorkUnits;
                        const tax = calculateTaxByGross(grossAmount, workedDaysCount, worker.nonTaxable);

                        return (
                          <tr key={worker.id}>
                            <td style={tdStyle}>{worker.name}</td>
                            <td style={tdStyle}>{worker.dailyWage.toLocaleString()}원</td>
                            <td style={tdStyle}>{workedDaysCount}일</td>
                            <td style={tdStyle}>{totalWorkUnits.toLocaleString()}</td>
                            <td style={tdStyle}>{grossAmount.toLocaleString()}원</td>
                            <td style={tdStyle}>{worker.nonTaxable.toLocaleString()}원</td>
                            <td style={tdStyle}>{tax.incomeTax.toLocaleString()}원</td>
                            <td style={tdStyle}>{tax.localTax.toLocaleString()}원</td>
                            <td style={tdStyle}>{tax.totalTax.toLocaleString()}원</td>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", gap: "8px" }}>
                                <button style={secondaryButtonStyle} onClick={() => startEditDailyWorker(worker)}>수정</button>
                                <button style={dangerButtonStyle} onClick={() => deleteDailyWorker(worker)}>삭제</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {currentMenu === "tax" && (
              <div style={cardStyle}>
                <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "12px" }}>세금 계산</h2>
                <div style={{ marginBottom: "12px" }}>
                  <div style={labelStyle}>일용직 선택</div>
                  <select style={inputStyle} value={taxPreviewWorkerId} onChange={(e) => setTaxPreviewWorkerId(e.target.value ? Number(e.target.value) : "") }>
                    <option value="">선택하세요</option>
                    {dailyWorkers.map((worker) => (
                      <option key={worker.id} value={worker.id}>{worker.name}</option>
                    ))}
                  </select>
                </div>

                {taxPreview ? (
                  <div style={{ display: "grid", gap: "10px" }}>
                    <div style={resultRowStyle}><span>기준 월</span><strong>{selectedMonth}</strong></div>
                    <div style={resultRowStyle}><span>근무일수</span><strong>{taxPreview.workedDaysCount}일</strong></div>
                    <div style={resultRowStyle}><span>총 공수</span><strong>{taxPreview.totalWorkUnits}</strong></div>
                    <div style={resultRowStyle}><span>지급총액 (gross)</span><strong>{taxPreview.grossAmount.toLocaleString()}원</strong></div>
                    <div style={resultRowStyle}><span>과세금액</span><strong>{taxPreview.taxableAmount.toLocaleString()}원</strong></div>
                    <div style={resultRowStyle}><span>소득세</span><strong>{taxPreview.incomeTax.toLocaleString()}원</strong></div>
                    <div style={resultRowStyle}><span>주민세</span><strong>{taxPreview.localTax.toLocaleString()}원</strong></div>
                    <div style={{ ...resultRowStyle, background: "#0f172a", color: "#fff" }}><span>총 공제세액</span><strong>{taxPreview.totalTax.toLocaleString()}원</strong></div>
                  </div>
                ) : (
                  <div style={{ color: "#64748b" }}>일용직을 선택하면 {selectedMonth} 기준 세금을 계산합니다.</div>
                )}
              </div>
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

const resultRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px",
  borderRadius: "12px",
  background: "#f8fafc",
};
