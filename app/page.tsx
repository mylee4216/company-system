"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Employee = {
  id: number;
  name: string;
  type: string;
  position: string;
  joinDate: string;
  status: string;
};

type DailyWorker = {
  id: number;
  name: string;
  dailyWage: number;
  workDays: number;
  nonTaxable: number;
};

type DailyWorkerRow = {
  id: number;
  name: string;
  daily_wage: number;
  work_days: number;
  non_taxable: number;
  created_at: string;
};

function normalizeEmployeeType(value: string | null | undefined) {
  const text = (value ?? "").trim();
  return text.includes("일용직") ? "일용직" : "상용직";
}

function normalizeEmployeeStatus(value: string | null | undefined) {
  const text = (value ?? "").trim();
  return text.includes("재직") ? "재직" : "퇴사";
}

function calculateTax(dailyWage: number, workDays: number, nonTaxable: number) {
  const taxablePerDay = Math.max(dailyWage - nonTaxable - 150000, 0);
  const taxableAmount = taxablePerDay * workDays;
  const incomeTax = Math.floor((taxableAmount * 0.027) / 10) * 10;
  const localTax = Math.floor((incomeTax * 0.1) / 10) * 10;
  const totalTax = incomeTax + localTax;

  return {
    taxableAmount,
    incomeTax,
    localTax,
    totalTax,
  };
}

function mapDailyWorkerRowToState(item: DailyWorkerRow): DailyWorker {
  return {
    id: item.id,
    name: item.name,
    dailyWage: item.daily_wage,
    workDays: item.work_days,
    nonTaxable: item.non_taxable,
  };
}

export default function Home() {
  const [currentMenu, setCurrentMenu] = useState("dashboard");
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  const [employees, setEmployees] = useState<Employee[]>([]);
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
  const [dailyForm, setDailyForm] = useState({
    name: "",
    dailyWage: "",
    workDays: "",
    nonTaxable: "0",
  });
  const [editingDailyWorkerId, setEditingDailyWorkerId] = useState<number | null>(null);

  const [taxForm, setTaxForm] = useState({
    dailyWage: "180000",
    workDays: "10",
    nonTaxable: "0",
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoadingEmployees(true);

      const { data, error } = await supabase
        .from("employees")
        .select("id, name, type, position, join_date, status")
        .order("id", { ascending: true });

      if (error) {
        alert("직원 불러오기 실패: " + error.message);
        setLoadingEmployees(false);
        return;
      }

      const converted = (data || []).map((item) => ({
        id: item.id,
        name: item.name,
        type: normalizeEmployeeType(item.type),
        position: item.position,
        joinDate: item.join_date,
        status: normalizeEmployeeStatus(item.status),
      }));

      setEmployees(converted);
      setLoadingEmployees(false);
    };

    const fetchDailyWorkers = async () => {
      const { data, error } = await supabase
        .from("daily_workers")
        .select("id, name, daily_wage, work_days, non_taxable, created_at")
        .order("created_at", { ascending: true });

      if (error) {
        alert("일용직 불러오기 실패: " + error.message);
        return;
      }

      const converted = (data || []).map((item) => mapDailyWorkerRowToState(item));
      setDailyWorkers(converted);
    };

    fetchEmployees();
    fetchDailyWorkers();
  }, []);

  const activeEmployees = useMemo(
    () => employees.filter((item) => normalizeEmployeeStatus(item.status) === "재직").length,
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const normalizedName = employee.name.toLowerCase();
      const searchKeyword = employeeSearchKeyword.trim().toLowerCase();
      const matchesName = searchKeyword === "" || normalizedName.includes(searchKeyword);

      const employeeType = normalizeEmployeeType(employee.type);
      const matchesType = employeeTypeFilter === "전체" || employeeType === employeeTypeFilter;

      const employeeStatus = normalizeEmployeeStatus(employee.status);
      const matchesStatus = employeeStatusFilter === "전체" || employeeStatus === employeeStatusFilter;

      return matchesName && matchesType && matchesStatus;
    });
  }, [employees, employeeSearchKeyword, employeeTypeFilter, employeeStatusFilter]);

  const dailyEmployeeCount = useMemo(
    () => dailyWorkers.length,
    [dailyWorkers]
  );

  const estimatedPayout = useMemo(
    () => dailyWorkers.reduce((sum, item) => sum + item.dailyWage * item.workDays, 0),
    [dailyWorkers]
  );

  const taxPreview = calculateTax(
    Number(taxForm.dailyWage || 0),
    Number(taxForm.workDays || 0),
    Number(taxForm.nonTaxable || 0)
  );

  const resetEmployeeForm = () => {
    setEmployeeForm({
      name: "",
      type: "상용직",
      position: "",
      joinDate: "",
      status: "재직",
    });
    setEditingEmployeeId(null);
  };

  const saveEmployee = async () => {
    if (!employeeForm.name || !employeeForm.position || !employeeForm.joinDate) {
      alert("직원 이름, 직급, 입사일을 입력해주세요.");
      return;
    }

    const normalizedType = normalizeEmployeeType(employeeForm.type);
    const normalizedStatus = normalizeEmployeeStatus(employeeForm.status);

    if (editingEmployeeId !== null) {
      const { data, error } = await supabase
        .from("employees")
        .update({
          name: employeeForm.name,
          type: normalizedType,
          position: employeeForm.position,
          join_date: employeeForm.joinDate,
          status: normalizedStatus,
        })
        .eq("id", editingEmployeeId)
        .select("id, name, type, position, join_date, status")
        .single();

      if (error) {
        alert("수정 실패: " + error.message);
        return;
      }

      setEmployees((prev) =>
        prev.map((item) =>
          item.id === editingEmployeeId
            ? {
                id: data.id,
                name: data.name,
                type: normalizeEmployeeType(data.type),
                position: data.position,
                joinDate: data.join_date,
                status: normalizeEmployeeStatus(data.status),
              }
            : item
        )
      );

      resetEmployeeForm();
      alert("직원 정보가 수정되었습니다.");
      return;
    }

    const { data, error } = await supabase
      .from("employees")
      .insert([
        {
          name: employeeForm.name,
          type: normalizedType,
          position: employeeForm.position,
          join_date: employeeForm.joinDate,
          status: normalizedStatus,
        },
      ])
      .select("id, name, type, position, join_date, status")
      .single();

    if (error) {
      alert("저장 실패: " + error.message);
      return;
    }

    setEmployees((prev) => [
      ...prev,
      {
        id: data.id,
        name: data.name,
        type: normalizeEmployeeType(data.type),
        position: data.position,
        joinDate: data.join_date,
        status: normalizeEmployeeStatus(data.status),
      },
    ]);

    resetEmployeeForm();

    alert("직원이 저장되었습니다.");
  };

  const startEditEmployee = (employee: Employee) => {
    setEditingEmployeeId(employee.id);
    setEmployeeForm({
      name: employee.name,
      type: normalizeEmployeeType(employee.type),
      position: employee.position,
      joinDate: employee.joinDate,
      status: normalizeEmployeeStatus(employee.status),
    });
    setCurrentMenu("employees");
  };

  const deleteEmployee = async (employee: Employee) => {
    const ok = confirm(`${employee.name} 직원을 삭제할까요?`);
    if (!ok) return;

    const { error } = await supabase.from("employees").delete().eq("id", employee.id);

    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }

    setEmployees((prev) => prev.filter((item) => item.id !== employee.id));

    if (editingEmployeeId === employee.id) {
      resetEmployeeForm();
    }

    alert("직원이 삭제되었습니다.");
  };

  const resetDailyWorkerForm = () => {
    setDailyForm({
      name: "",
      dailyWage: "",
      workDays: "",
      nonTaxable: "0",
    });
    setEditingDailyWorkerId(null);
  };

  const saveDailyWorker = async () => {
    if (!dailyForm.name || !dailyForm.dailyWage || !dailyForm.workDays) {
      alert("이름, 일급, 근무일수를 입력해주세요.");
      return;
    }

    if (editingDailyWorkerId !== null) {
      const { data, error } = await supabase
        .from("daily_workers")
        .update({
          name: dailyForm.name,
          daily_wage: Number(dailyForm.dailyWage),
          work_days: Number(dailyForm.workDays),
          non_taxable: Number(dailyForm.nonTaxable || 0),
        })
        .eq("id", editingDailyWorkerId)
        .select("id, name, daily_wage, work_days, non_taxable, created_at")
        .single();

      if (error) {
        alert("일용직 수정 실패: " + error.message);
        return;
      }

      setDailyWorkers((prev) =>
        prev.map((item) => (item.id === editingDailyWorkerId ? mapDailyWorkerRowToState(data) : item))
      );
      resetDailyWorkerForm();
      alert("일용직 정보가 수정되었습니다.");
      return;
    }

    const { data, error } = await supabase
      .from("daily_workers")
      .insert([
        {
          name: dailyForm.name,
          daily_wage: Number(dailyForm.dailyWage),
          work_days: Number(dailyForm.workDays),
          non_taxable: Number(dailyForm.nonTaxable || 0),
        },
      ])
      .select("id, name, daily_wage, work_days, non_taxable, created_at")
      .single();

    if (error) {
      alert("일용직 저장 실패: " + error.message);
      return;
    }

    setDailyWorkers((prev) => [...prev, mapDailyWorkerRowToState(data)]);
    resetDailyWorkerForm();
    alert("일용직 정보가 등록되었습니다.");
  };

  const startEditDailyWorker = (worker: DailyWorker) => {
    setEditingDailyWorkerId(worker.id);
    setDailyForm({
      name: worker.name,
      dailyWage: String(worker.dailyWage),
      workDays: String(worker.workDays),
      nonTaxable: String(worker.nonTaxable),
    });
  };

  const deleteDailyWorker = async (worker: DailyWorker) => {
    const ok = confirm(`${worker.name} 일용직 정보를 삭제할까요?`);
    if (!ok) return;

    const { error } = await supabase.from("daily_workers").delete().eq("id", worker.id);

    if (error) {
      alert("일용직 삭제 실패: " + error.message);
      return;
    }

    setDailyWorkers((prev) => prev.filter((item) => item.id !== worker.id));

    if (editingDailyWorkerId === worker.id) {
      resetDailyWorkerForm();
    }

    alert("일용직 정보가 삭제되었습니다.");
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "8px" }}>회사 관리시스템</h1>
        <p style={{ color: "#475569", marginBottom: "24px" }}>직원 등록, 조회, 삭제와 간단한 일용직 계산까지 가능한 첫 실전 버전입니다.</p>

        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "24px" }}>
          <aside
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "20px",
              height: "fit-content",
            }}
          >
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
                <div style={cardNumberStyle}>{activeEmployees}명</div>
                <div style={cardDescStyle}>현재 등록 데이터 기준</div>
              </div>

              <div style={cardStyle}>
                <div style={cardTitleStyle}>일용직 인원</div>
                <div style={cardNumberStyle}>{dailyEmployeeCount}명</div>
                <div style={cardDescStyle}>직원 목록 기준</div>
              </div>

              <div style={cardStyle}>
                <div style={cardTitleStyle}>예상 지급액</div>
                <div style={cardNumberStyle}>{estimatedPayout.toLocaleString()}원</div>
                <div style={cardDescStyle}>일용직 입력 합계</div>
              </div>
            </div>

            {currentMenu === "dashboard" && (
              <>
                <div style={cardStyle}>
                  <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "12px" }}>직원 목록</h2>
                  {loadingEmployees && <div style={{ marginBottom: "12px", color: "#64748b" }}>직원 데이터를 불러오는 중입니다...</div>}
                  <div style={{ marginBottom: "12px", color: "#64748b", fontSize: "14px" }}>
                    현재 검색/필터 결과: {filteredEmployees.length}명
                  </div>
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
                            <button style={dangerButtonStyle} onClick={() => deleteEmployee(employee)}>삭제</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                  <div style={cardStyle}>
                    <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "12px" }}>일용직 세금 계산 예시</h2>
                    <div style={{ display: "grid", gap: "10px" }}>
                      <div>일급: 180,000원</div>
                      <div>근무일수: 10일</div>
                      <div>비과세: 0원</div>
                      <div>과세금액: 300,000원</div>
                      <div>소득세: 8,100원</div>
                      <div>주민세: 810원</div>
                      <div style={{ fontWeight: "bold" }}>총 공제세액: 8,910원</div>
                    </div>
                  </div>

                  <div style={cardStyle}>
                    <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "12px" }}>다음 단계</h2>
                    <div style={{ display: "grid", gap: "10px", color: "#334155" }}>
                      <div>1. 직원 등록 완료</div>
                      <div>2. 직원 불러오기 완료</div>
                      <div>3. 직원 삭제 완료</div>
                      <div>4. 다음은 직원 수정 기능 추가</div>
                      <div>5. 그 다음은 일용직 DB 연결</div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {currentMenu === "employees" && (
              <>
                <div style={cardStyle}>
                  <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>직원 등록</h2>
                  <div style={formGridStyle}>
                    <div>
                      <div style={labelStyle}>이름</div>
                      <input style={inputStyle} value={employeeForm.name} onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })} placeholder="이름 입력" />
                    </div>
                    <div>
                      <div style={labelStyle}>구분</div>
                      <select
                        style={inputStyle}
                        value={employeeForm.type}
                        onChange={(e) =>
                          setEmployeeForm({
                            ...employeeForm,
                            type: normalizeEmployeeType(e.target.value),
                          })
                        }
                      >
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
                      <select
                        style={inputStyle}
                        value={employeeForm.status}
                        onChange={(e) =>
                          setEmployeeForm({
                            ...employeeForm,
                            status: normalizeEmployeeStatus(e.target.value),
                          })
                        }
                      >
                        <option value="재직">재직</option>
                        <option value="퇴사">퇴사</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop: "16px" }}>
                    <button style={primaryButtonStyle} onClick={saveEmployee}>
                      {editingEmployeeId !== null ? "수정 저장" : "직원 등록하기"}
                    </button>
                  </div>
                </div>

                <div style={cardStyle}>
                  <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "12px" }}>직원 목록</h2>
                  {loadingEmployees && <div style={{ marginBottom: "12px", color: "#64748b" }}>직원 데이터를 불러오는 중입니다...</div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                    <input
                      style={inputStyle}
                      value={employeeSearchKeyword}
                      onChange={(e) => setEmployeeSearchKeyword(e.target.value)}
                      placeholder="이름 검색 (부분일치)"
                    />
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
                  <div style={{ marginBottom: "12px", color: "#64748b", fontSize: "14px" }}>
                    검색/필터 적용 결과: {filteredEmployees.length}명
                  </div>
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
                  <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>일용직 등록</h2>
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
                      <div style={labelStyle}>근무일수</div>
                      <input type="number" style={inputStyle} value={dailyForm.workDays} onChange={(e) => setDailyForm({ ...dailyForm, workDays: e.target.value })} placeholder="예: 10" />
                    </div>
                    <div>
                      <div style={labelStyle}>비과세</div>
                      <input type="number" style={inputStyle} value={dailyForm.nonTaxable} onChange={(e) => setDailyForm({ ...dailyForm, nonTaxable: e.target.value })} placeholder="없으면 0" />
                    </div>
                  </div>
                  <div style={{ marginTop: "16px" }}>
                    <button style={primaryButtonStyle} onClick={saveDailyWorker}>
                      {editingDailyWorkerId !== null ? "수정 저장" : "일용직 등록하기"}
                    </button>
                  </div>
                </div>

                <div style={cardStyle}>
                  <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "12px" }}>일용직 목록</h2>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        <th style={thStyle}>이름</th>
                        <th style={thStyle}>일급</th>
                        <th style={thStyle}>근무일수</th>
                        <th style={thStyle}>비과세</th>
                        <th style={thStyle}>소득세</th>
                        <th style={thStyle}>주민세</th>
                        <th style={thStyle}>총 공제세액</th>
                        <th style={thStyle}>관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyWorkers.map((worker) => {
                        const result = calculateTax(worker.dailyWage, worker.workDays, worker.nonTaxable);
                        return (
                          <tr key={worker.id}>
                            <td style={tdStyle}>{worker.name}</td>
                            <td style={tdStyle}>{worker.dailyWage.toLocaleString()}원</td>
                            <td style={tdStyle}>{worker.workDays}일</td>
                            <td style={tdStyle}>{worker.nonTaxable.toLocaleString()}원</td>
                            <td style={tdStyle}>{result.incomeTax.toLocaleString()}원</td>
                            <td style={tdStyle}>{result.localTax.toLocaleString()}원</td>
                            <td style={tdStyle}>{result.totalTax.toLocaleString()}원</td>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div style={cardStyle}>
                  <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>세금 계산 입력</h2>
                  <div style={{ display: "grid", gap: "14px" }}>
                    <div>
                      <div style={labelStyle}>일급</div>
                      <input type="number" style={inputStyle} value={taxForm.dailyWage} onChange={(e) => setTaxForm({ ...taxForm, dailyWage: e.target.value })} />
                    </div>
                    <div>
                      <div style={labelStyle}>근무일수</div>
                      <input type="number" style={inputStyle} value={taxForm.workDays} onChange={(e) => setTaxForm({ ...taxForm, workDays: e.target.value })} />
                    </div>
                    <div>
                      <div style={labelStyle}>비과세</div>
                      <input type="number" style={inputStyle} value={taxForm.nonTaxable} onChange={(e) => setTaxForm({ ...taxForm, nonTaxable: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div style={cardStyle}>
                  <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>세금 계산 결과</h2>
                  <div style={{ display: "grid", gap: "12px" }}>
                    <div style={resultRowStyle}><span>과세금액</span><strong>{taxPreview.taxableAmount.toLocaleString()}원</strong></div>
                    <div style={resultRowStyle}><span>소득세</span><strong>{taxPreview.incomeTax.toLocaleString()}원</strong></div>
                    <div style={resultRowStyle}><span>주민세</span><strong>{taxPreview.localTax.toLocaleString()}원</strong></div>
                    <div style={{ ...resultRowStyle, background: "#0f172a", color: "white" }}><span>총 공제세액</span><strong>{taxPreview.totalTax.toLocaleString()}원</strong></div>
                  </div>
                  <div style={{ marginTop: "16px", color: "#475569", fontSize: "14px" }}>
                    계산식: (일급 - 비과세 - 150,000원) × 근무일수 → 2.7% → 주민세 10%
                  </div>
                </div>
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
