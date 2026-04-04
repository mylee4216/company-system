"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type EmployeeType = "상용직" | "일용직";
type EmployeeStatus = "재직" | "퇴사";

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
  work_entries: Array<{ date: string; units?: number | null; work_days?: number | null }> | null;
}): Record<string, number> {
  const mapped: Record<string, number> = {};

  if (Array.isArray(row.work_entries) && row.work_entries.length > 0) {
    row.work_entries.forEach((entry) => {
      const rawWorkDays = entry?.work_days ?? entry?.units;
      if (entry?.date && rawWorkDays !== null && rawWorkDays !== undefined) {
        mapped[entry.date] = Math.max(0, Number(rawWorkDays) || 0);
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
  const safeSelectedWorkEntries = Array.isArray(selectedWorkEntries) ? selectedWorkEntries : [];
  const selectedWorkMap = useMemo(
    () =>
      safeSelectedWorkEntries.reduce<Record<string, number | null>>((acc, entry) => {
        acc[entry.date] = entry.work_days ?? null;
        return acc;
      }, {}),
    [safeSelectedWorkEntries]
  );

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
      const units = Object.values(map).reduce((acc, value) => acc + Number(value), 0);
      return sum + units * worker.daily_wage;
    }, 0);
  }, [dailyWorkers, records]);

  function selectDailyWorker(workerId: number | null) {
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
      work_entries: Array<{ date: string; units?: number | null; work_days?: number | null }> | null;
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
    setEditingDailyWorkerId(worker.id);
    setDailyWorkerForm({
      name: worker.name,
      daily_wage: String(worker.daily_wage),
      non_taxable: String(worker.non_taxable),
    });
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
    setSelectedWorkEntries((prev) =>
      prev.map((entry) =>
        entry.date === date
          ? {
              ...entry,
              work_days:
                workDays === null
                  ? null
                  : Number.isFinite(workDays)
                    ? Math.max(0, workDays)
                    : null,
            }
          : entry
      )
    );
  }

  async function saveMonthlyRecord() {
    if (!selectedWorker) {
      alert("일용직을 선택하세요.");
      return;
    }

    setSavingMonthlyRecord(true);
    const normalizedEntries = safeSelectedWorkEntries
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
    <main style={{ padding: 24, maxWidth: 1280, margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 20 }}>회사 관리 시스템</h1>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 24 }}>
        <article style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 14, color: "#666" }}>재직 직원 수</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{activeEmployeeCount}명</div>
        </article>
        <article style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 14, color: "#666" }}>일용직 인원</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{dailyWorkerCount}명</div>
        </article>
        <article style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 14, color: "#666" }}>예상 지급액 ({targetMonth})</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{expectedPayout.toLocaleString()}원</div>
        </article>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>직원관리</h2>

        <form onSubmit={submitEmployee} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 12 }}>
          <input
            placeholder="이름"
            value={employeeForm.name}
            onChange={(e) => setEmployeeForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <select
            value={employeeForm.type}
            onChange={(e) => setEmployeeForm((prev) => ({ ...prev, type: e.target.value as EmployeeType }))}
          >
            <option value="상용직">상용직</option>
            <option value="일용직">일용직</option>
          </select>
          <input
            placeholder="직책"
            value={employeeForm.position}
            onChange={(e) => setEmployeeForm((prev) => ({ ...prev, position: e.target.value }))}
          />
          <input
            type="date"
            value={employeeForm.join_date}
            onChange={(e) => setEmployeeForm((prev) => ({ ...prev, join_date: e.target.value }))}
          />
          <select
            value={employeeForm.status}
            onChange={(e) => setEmployeeForm((prev) => ({ ...prev, status: e.target.value as EmployeeStatus }))}
          >
            <option value="재직">재직</option>
            <option value="퇴사">퇴사</option>
          </select>
          <button type="submit">{editingEmployeeId ? "수정" : "등록"}</button>
        </form>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          <input
            placeholder="이름 검색"
            value={employeeNameQuery}
            onChange={(e) => setEmployeeNameQuery(e.target.value)}
          />
          <select
            value={employeeTypeFilter}
            onChange={(e) => setEmployeeTypeFilter(e.target.value as "전체" | EmployeeType)}
          >
            <option value="전체">전체</option>
            <option value="상용직">상용직</option>
            <option value="일용직">일용직</option>
          </select>
          <select
            value={employeeStatusFilter}
            onChange={(e) => setEmployeeStatusFilter(e.target.value as "전체" | EmployeeStatus)}
          >
            <option value="전체">전체</option>
            <option value="재직">재직</option>
            <option value="퇴사">퇴사</option>
          </select>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>이름</th>
              <th>구분</th>
              <th>직책</th>
              <th>입사일</th>
              <th>상태</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {loadingEmployees ? (
              <tr>
                <td colSpan={6}>불러오는 중...</td>
              </tr>
            ) : filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={6}>데이터가 없습니다.</td>
              </tr>
            ) : (
              filteredEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.name}</td>
                  <td>{employee.type}</td>
                  <td>{employee.position}</td>
                  <td>{employee.join_date}</td>
                  <td>{employee.status}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => startEditEmployee(employee)}>
                      수정
                    </button>
                    <button type="button" onClick={() => deleteEmployee(employee.id)}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>일용직관리</h2>

        <form
          onSubmit={saveDailyWorker}
          style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginBottom: 12 }}
        >
          <input
            placeholder="이름"
            value={dailyWorkerForm.name}
            onChange={(e) => setDailyWorkerForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            type="number"
            min={0}
            step={1}
            placeholder="일당"
            value={dailyWorkerForm.daily_wage}
            onChange={(e) => setDailyWorkerForm((prev) => ({ ...prev, daily_wage: e.target.value }))}
          />
          <input
            type="number"
            min={0}
            placeholder="비과세"
            value={dailyWorkerForm.non_taxable}
            onChange={(e) => setDailyWorkerForm((prev) => ({ ...prev, non_taxable: e.target.value }))}
          />
          <button type="submit">{editingDailyWorkerId ? "수정" : "등록"}</button>
        </form>

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
          <thead>
            <tr>
              <th>이름</th>
              <th>일당</th>
              <th>비과세</th>
              <th>생성일</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {loadingDailyWorkers ? (
              <tr>
                <td colSpan={5}>불러오는 중...</td>
              </tr>
            ) : dailyWorkers.length === 0 ? (
              <tr>
                <td colSpan={5}>데이터가 없습니다.</td>
              </tr>
            ) : (
              dailyWorkers.map((worker) => (
                <tr key={worker.id}>
                  <td>{worker.name}</td>
                  <td>{worker.daily_wage.toLocaleString()}</td>
                  <td>{worker.non_taxable.toLocaleString()}</td>
                  <td>{worker.created_at.slice(0, 10)}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => startEditDailyWorker(worker)}>
                      수정
                    </button>
                    <button type="button" onClick={() => deleteDailyWorker(worker.id)}>
                      삭제
                    </button>
                    <button type="button" onClick={() => selectDailyWorker(worker.id)}>
                      공수입력
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <label>기준 월(target_month)</label>
            <input type="month" value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} />
            <select
              value={selectedDailyWorkerId ?? ""}
              onChange={(e) => selectDailyWorker(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">일용직 선택</option>
              {dailyWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={saveMonthlyRecord} disabled={!selectedWorker || savingMonthlyRecord}>
              {savingMonthlyRecord ? "저장 중..." : "월 기록 저장"}
            </button>
          </div>

          {!selectedWorker ? (
            <p>일용직을 선택하면 날짜별 공수 입력이 표시됩니다.</p>
          ) : (
            <>
              <p style={{ marginBottom: 8 }}>
                {selectedWorker.name} / 일당 {selectedWorker.daily_wage.toLocaleString()}원
              </p>
              <div style={{ maxHeight: 360, overflow: "auto", border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th>날짜</th>
                      <th>공수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthDates.map((date) => (
                      <tr key={date}>
                        <td className="whitespace-nowrap px-2 py-2">{date}</td>
                        <td className="whitespace-nowrap px-2 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={selectedWorkMap[date] ?? ""}
                            onChange={(e) => updateWorkUnit(date, e.target.value === "" ? null : Number(e.target.value))}
                            className="w-20 min-w-[80px] rounded-md border px-2 py-1 text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
