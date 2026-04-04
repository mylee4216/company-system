"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ASSIGNMENT_TYPES, EMPLOYEE_STATUSES, type AssignmentType, type EmployeeStatus } from "@/lib/employee-status";

type EmployeeType = "상용직" | "일용직";
type Menu = "dashboard" | "employees" | "daily";

type Employee = {
  id: number;
  name: string;
  type: EmployeeType;
  position: string;
  join_date: string;
  status: EmployeeStatus;
  resignation_date: string | null;
};

type Company = {
  id: number;
  name: string;
  business_number: string;
  address: string;
};

type Site = {
  id: number;
  name: string;
  company_id: number;
  client_name: string;
  contract_type: "원도급" | "하도급" | null;
  construction_start_date: string;
  construction_end_date: string | null;
};

type EmployeeAssignment = {
  id: number;
  employee_id: number;
  company_id: number;
  site_id: number | null;
  assignment_type: AssignmentType;
  start_date: string;
  end_date: string | null;
  memo: string | null;
  is_current: boolean;
};

type DailyWorker = {
  id: number;
  name: string;
  daily_wage: number;
  non_taxable: number;
  first_work_date: string | null;
  phone: string;
  resident_number: string;
  address: string;
  bank_name: string;
  account_number: string;
  job_type: string;
  company_id: number | null;
};

type WorkEntry = {
  date: string;
  work_days: number | null;
};

type DailyWorkerMonthlyRecord = {
  daily_worker_id: number;
  site_id: number;
  target_month: string;
  work_entries: WorkEntry[];
  total_work_units: number;
  worked_days_count: number;
  gross_amount: number;
};

type JobCategoryFilter = "전체" | "직영" | "용역";

function maskResidentNumber(rn: string) {
  if (!rn) return "";
  return rn.slice(0, 8) + "******";
}

function formatDateInput(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 8);

  if (numbers.length <= 4) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 4)}-${numbers.slice(4)}`;
  return `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6, 8)}`;
}

function formatResidentNumber(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 13);

  if (numbers.length <= 6) return numbers;
  return `${numbers.slice(0, 6)}-${numbers.slice(6, 13)}`;
}

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
  if (value === "퇴사" || value === "휴직" || value === "전출" || value === "파견") return value;
  return "재직";
}

function normalizeJobCategory(jobType: string): Exclude<JobCategoryFilter, "전체"> | null {
  if (jobType.includes("직영")) return "직영";
  if (jobType.includes("용역")) return "용역";
  return null;
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
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [dailyWorkers, setDailyWorkers] = useState<DailyWorker[]>([]);
  const [records, setRecords] = useState<Record<string, Record<string, number>>>({});

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
    resignation_date: "",
    company_id: "",
    site_id: "",
    assignment_type: "정규소속" as AssignmentType,
    assignment_start_date: "",
    assignment_end_date: "",
  });
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    business_number: "",
    address: "",
  });
  const [siteForm, setSiteForm] = useState({
    name: "",
    company_id: "",
    client_name: "",
    contract_type: "",
    construction_start_date: "",
    construction_end_date: "",
  });
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);

  const [dailyWorkerForm, setDailyWorkerForm] = useState({
    name: "",
    daily_wage: "",
    non_taxable: "0",
    first_work_date: "",
    address: "",
    resident_number: "",
    phone: "",
    bank_name: "",
    account_number: "",
    job_type: "",
    company_id: "",
  });
  const [editingDailyWorkerId, setEditingDailyWorkerId] = useState<number | null>(null);

  const [targetMonth, setTargetMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [selectedJobCategory, setSelectedJobCategory] = useState<JobCategoryFilter>("전체");
  const [selectedTargetMonth, setSelectedTargetMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedDailyWorkerId, setSelectedDailyWorkerId] = useState<number | null>(null);
  const [selectedWorkEntries, setSelectedWorkEntries] = useState<WorkEntry[]>([]);

  const monthDates = useMemo(() => getMonthDates(targetMonth), [targetMonth]);

  const filteredSites = useMemo(() => {
    if (!selectedCompanyId) return sites;
    return sites.filter((site) => site.company_id === selectedCompanyId);
  }, [sites, selectedCompanyId]);

  const selectedSite = useMemo(() => sites.find((site) => site.id === selectedSiteId) ?? null, [sites, selectedSiteId]);

  const selectedDailyWorker = useMemo(
    () => dailyWorkers.find((worker) => worker.id === selectedDailyWorkerId) ?? null,
    [dailyWorkers, selectedDailyWorkerId]
  );

  const safeEntries = useMemo(() => (Array.isArray(selectedWorkEntries) ? selectedWorkEntries : []), [selectedWorkEntries]);

  const totalWorkUnits = useMemo(
    () => safeEntries.reduce((sum, entry) => sum + (entry.work_days ?? 0), 0),
    [safeEntries]
  );

  const workedDaysCount = useMemo(
    () => safeEntries.filter((entry) => (entry.work_days ?? 0) > 0).length,
    [safeEntries]
  );

  const expectedAmount = useMemo(
    () => totalWorkUnits * (selectedDailyWorker?.daily_wage ?? 0),
    [totalWorkUnits, selectedDailyWorker]
  );

  const selectedWorkMap = useMemo(() => {
    const map: Record<string, number | null> = {};
    safeEntries.forEach((entry) => {
      map[entry.date] = entry.work_days ?? null;
    });
    return map;
  }, [safeEntries]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const byName = employeeNameQuery.trim() === "" || employee.name.toLowerCase().includes(employeeNameQuery.trim().toLowerCase());
      const byType = employeeTypeFilter === "전체" || employee.type === employeeTypeFilter;
      const byStatus = employeeStatusFilter === "전체" || employee.status === employeeStatusFilter;
      return byName && byType && byStatus;
    });
  }, [employees, employeeNameQuery, employeeTypeFilter, employeeStatusFilter]);

  const payrollSummary = useMemo(() => {
    const filtered = dailyWorkers.filter((worker) => {
      if (selectedCompanyId && worker.company_id !== selectedCompanyId) return false;
      if (selectedJobCategory !== "전체" && normalizeJobCategory(worker.job_type ?? "") !== selectedJobCategory) return false;
      return true;
    });

    const grouped = new Map<string, { workers: Array<{ worker: DailyWorker; work_units: number; amount: number }>; total_work_units: number; total_amount: number }>();

    filtered.forEach((worker) => {
      const key = `${worker.id}:${selectedSiteId ?? 0}`;
      const workMap = records[key] ?? {};
      const workUnits = Object.values(workMap).reduce((sum, value) => sum + value, 0);
      const amount = workUnits * worker.daily_wage;
      const jobType = worker.job_type || "미분류";
      const existing = grouped.get(jobType) ?? { workers: [], total_work_units: 0, total_amount: 0 };
      existing.workers.push({ worker, work_units: workUnits, amount });
      existing.total_work_units += workUnits;
      existing.total_amount += amount;
      grouped.set(jobType, existing);
    });

    const groups = Array.from(grouped.entries()).map(([job_type, data]) => ({ job_type, ...data }));
    const total_work_units = groups.reduce((sum, group) => sum + group.total_work_units, 0);
    const total_amount = groups.reduce((sum, group) => sum + group.total_amount, 0);
    return { groups, total_work_units, total_amount };
  }, [dailyWorkers, records, selectedCompanyId, selectedSiteId, selectedJobCategory]);

  const activeEmployeeCount = useMemo(() => employees.filter((employee) => employee.status === "재직").length, [employees]);

  function selectDailyWorker(workerId: number | null) {
    setCurrentMenu("daily");
    setSelectedDailyWorkerId(workerId);
    if (!workerId) {
      setSelectedWorkEntries([]);
      return;
    }

    const key = `${workerId}:${selectedSiteId ?? 0}`;
    setSelectedWorkEntries(buildSelectedWorkEntries(monthDates, records[key] ?? {}));
  }

  async function fetchEmployees() {
    setLoadingEmployees(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id, name, type, position, join_date, status, resignation_date")
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
      resignation_date: string | null;
    }[];

    setEmployees(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: normalizeEmployeeType(row.type),
        position: row.position,
        join_date: row.join_date,
        status: normalizeEmployeeStatus(row.status),
        resignation_date: row.resignation_date,
      }))
    );
    setLoadingEmployees(false);
  }

  async function fetchCompanies() {
    const { data, error } = await supabase.from("companies").select("id, name, business_number, address").order("id", { ascending: true });
    if (error) {
      alert(`회사 조회 실패: ${error.message}`);
      return;
    }
    setCompanies((data ?? []) as Company[]);
  }

  async function fetchSites() {
    const { data, error } = await supabase
      .from("sites")
      .select("id, name, company_id, client_name, contract_type, construction_start_date, construction_end_date")
      .order("id", { ascending: true });
    if (error) {
      alert(`현장 조회 실패: ${error.message}`);
      return;
    }
    setSites((data ?? []) as Site[]);
  }

  async function fetchDailyWorkers() {
    setLoadingDailyWorkers(true);
    const { data, error } = await supabase
      .from("daily_workers")
      .select("id, name, daily_wage, non_taxable, first_work_date, phone, resident_number, address, bank_name, account_number, job_type, company_id")
      .order("id", { ascending: true });

    if (error) {
      alert(`일용직 조회 실패: ${error.message}`);
      setLoadingDailyWorkers(false);
      return;
    }

    setDailyWorkers((data ?? []) as DailyWorker[]);
    setLoadingDailyWorkers(false);
  }

  async function fetchMonthlyRecords(month: string, siteId: number | null) {
    if (!siteId) {
      setRecords({});
      setSelectedWorkEntries([]);
      return;
    }

    const { data, error } = await supabase
      .from("daily_worker_monthly_records")
      .select("daily_worker_id, site_id, target_month, work_entries")
      .eq("target_month", month)
      .eq("site_id", siteId);

    if (error) {
      alert(`월별 기록 조회 실패: ${error.message}`);
      return;
    }

    const rows = (data ?? []) as { daily_worker_id: number; site_id: number; target_month: string; work_entries: WorkEntry[] | null }[];

    const next: Record<string, Record<string, number>> = {};
    rows.forEach((row) => {
      const key = `${row.daily_worker_id}:${row.site_id}`;
      const map: Record<string, number> = {};
      (row.work_entries ?? []).forEach((entry) => {
        if (entry?.date && entry.work_days !== null && entry.work_days !== undefined) {
          map[entry.date] = Math.max(0, Number(entry.work_days) || 0);
        }
      });
      next[key] = map;
    });

    setRecords(next);

    if (selectedDailyWorkerId) {
      const key = `${selectedDailyWorkerId}:${siteId}`;
      setSelectedWorkEntries(buildSelectedWorkEntries(monthDates, next[key] ?? {}));
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => {
      fetchEmployees();
      fetchCompanies();
      fetchSites();
      fetchDailyWorkers();
    });
  }, []);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    void Promise.resolve().then(() => {
      fetchMonthlyRecords(targetMonth, selectedSiteId);
    });
  }, [targetMonth, selectedSiteId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  async function submitEmployee(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!employeeForm.name.trim()) {
      alert("이름을 입력하세요.");
      return;
    }

    const normalizedResignationDate = employeeForm.status === "퇴사" ? (employeeForm.resignation_date || null) : null;

    let targetEmployeeId = editingEmployeeId;
    if (editingEmployeeId) {
      const { error } = await supabase
        .from("employees")
        .update({
          name: employeeForm.name.trim(),
          type: employeeForm.type,
          position: employeeForm.position.trim(),
          join_date: employeeForm.join_date,
          status: employeeForm.status,
          resignation_date: normalizedResignationDate,
        })
        .eq("id", editingEmployeeId);

      if (error) {
        alert(`직원 수정 실패: ${error.message}`);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("employees")
        .insert({
          name: employeeForm.name.trim(),
          type: employeeForm.type,
          position: employeeForm.position.trim(),
          join_date: employeeForm.join_date,
          status: employeeForm.status,
          resignation_date: normalizedResignationDate,
        })
        .select("id")
        .single();

      if (error) {
        alert(`직원 등록 실패: ${error.message}`);
        return;
      }
      targetEmployeeId = data.id;
    }

    if (targetEmployeeId && employeeForm.company_id && employeeForm.assignment_start_date) {
      const payload = {
        employee_id: targetEmployeeId,
        company_id: Number(employeeForm.company_id),
        site_id: employeeForm.site_id ? Number(employeeForm.site_id) : null,
        assignment_type: employeeForm.assignment_type,
        start_date: employeeForm.assignment_start_date,
        end_date: employeeForm.assignment_end_date || null,
        is_current: !employeeForm.assignment_end_date,
      };

      const { error: closeError } = await supabase
        .from("employee_assignments")
        .update({ is_current: false })
        .eq("employee_id", targetEmployeeId)
        .eq("is_current", true);

      if (closeError) {
        alert(`기존 소속 이력 종료 실패: ${closeError.message}`);
        return;
      }

      const { error: assignmentError } = await supabase.from("employee_assignments").insert(payload);
      if (assignmentError) {
        alert(`소속 이력 저장 실패: ${assignmentError.message}`);
        return;
      }
    }

    setEmployeeForm({
      name: "",
      type: "상용직",
      position: "",
      join_date: "",
      status: "재직",
      resignation_date: "",
      company_id: "",
      site_id: "",
      assignment_type: "정규소속",
      assignment_start_date: "",
      assignment_end_date: "",
    });
    setEditingEmployeeId(null);
    fetchEmployees();
  }

  async function startEditEmployee(employee: Employee) {
    setCurrentMenu("employees");
    setEditingEmployeeId(employee.id);
    const { data } = await supabase
      .from("employee_assignments")
      .select("id, employee_id, company_id, site_id, assignment_type, start_date, end_date, memo, is_current")
      .eq("employee_id", employee.id)
      .eq("is_current", true)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentAssignment = (data as EmployeeAssignment | null) ?? null;
    setEmployeeForm({
      name: employee.name,
      type: employee.type,
      position: employee.position,
      join_date: employee.join_date,
      status: employee.status,
      resignation_date: employee.resignation_date ?? "",
      company_id: currentAssignment ? String(currentAssignment.company_id) : "",
      site_id: currentAssignment?.site_id ? String(currentAssignment.site_id) : "",
      assignment_type: currentAssignment?.assignment_type ?? "정규소속",
      assignment_start_date: currentAssignment?.start_date ?? "",
      assignment_end_date: currentAssignment?.end_date ?? "",
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

    const payload = {
      name: dailyWorkerForm.name.trim(),
      daily_wage: dailyWage,
      non_taxable: nonTaxable,
      first_work_date: dailyWorkerForm.first_work_date || null,
      address: dailyWorkerForm.address.trim(),
      resident_number: dailyWorkerForm.resident_number.trim(),
      phone: dailyWorkerForm.phone.trim(),
      bank_name: dailyWorkerForm.bank_name.trim(),
      account_number: dailyWorkerForm.account_number.trim(),
      job_type: dailyWorkerForm.job_type.trim(),
      company_id: dailyWorkerForm.company_id ? Number(dailyWorkerForm.company_id) : null,
    };

    if (editingDailyWorkerId) {
      const { error } = await supabase.from("daily_workers").update(payload).eq("id", editingDailyWorkerId);
      if (error) {
        alert(`일용직 수정 실패: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("daily_workers").insert(payload);
      if (error) {
        alert(`일용직 등록 실패: ${error.message}`);
        return;
      }
    }

    setDailyWorkerForm({
      name: "",
      daily_wage: "",
      non_taxable: "0",
      first_work_date: "",
      address: "",
      resident_number: "",
      phone: "",
      bank_name: "",
      account_number: "",
      job_type: "",
      company_id: "",
    });
    setEditingDailyWorkerId(null);
    fetchDailyWorkers();
  }

  async function submitCompany(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!companyForm.name.trim()) {
      alert("회사명을 입력하세요.");
      return;
    }

    const { error } = await supabase.from("companies").insert({
      name: companyForm.name.trim(),
      business_number: companyForm.business_number.trim(),
      address: companyForm.address.trim(),
    });

    if (error) {
      alert(`회사 등록 실패: ${error.message}`);
      return;
    }

    setCompanyForm({ name: "", business_number: "", address: "" });
    fetchCompanies();
  }

  async function createSite() {
    const { error } = await supabase.from("sites").insert({
      name: siteForm.name.trim(),
      company_id: Number(siteForm.company_id),
      client_name: siteForm.client_name.trim(),
      contract_type: siteForm.contract_type,
      construction_start_date: siteForm.construction_start_date,
      construction_end_date: siteForm.construction_end_date || null,
    });

    if (error) {
      alert(`현장 등록 실패: ${error.message}`);
      return false;
    }

    return true;
  }

  async function updateSite() {
    if (!editingSiteId) return false;

    const { error } = await supabase
      .from("sites")
      .update({
        name: siteForm.name.trim(),
        company_id: Number(siteForm.company_id),
        client_name: siteForm.client_name.trim(),
        contract_type: siteForm.contract_type,
        construction_start_date: siteForm.construction_start_date,
        construction_end_date: siteForm.construction_end_date || null,
      })
      .eq("id", editingSiteId);

    if (error) {
      alert(`현장 수정 실패: ${error.message}`);
      return false;
    }

    return true;
  }

  async function submitSite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!siteForm.name.trim()) {
      alert("현장명을 입력하세요.");
      return;
    }
    if (!siteForm.company_id) {
      alert("회사를 선택하세요.");
      return;
    }
    if (!siteForm.client_name.trim()) {
      alert("발주자를 입력하세요.");
      return;
    }
    if (!siteForm.contract_type) {
      alert("구분을 선택하세요.");
      return;
    }
    if (!siteForm.construction_start_date) {
      alert("착공일을 입력하세요.");
      return;
    }

    const isSuccess = editingSiteId ? await updateSite() : await createSite();
    if (!isSuccess) {
      return;
    }

    setSiteForm({
      name: "",
      company_id: "",
      client_name: "",
      contract_type: "",
      construction_start_date: "",
      construction_end_date: "",
    });
    setEditingSiteId(null);
    fetchSites();
  }

  function startEditSite(site: Site) {
    setCurrentMenu("dashboard");
    setEditingSiteId(site.id);
    setSiteForm({
      name: site.name,
      company_id: String(site.company_id),
      client_name: site.client_name ?? "",
      contract_type: site.contract_type ?? "",
      construction_start_date: site.construction_start_date ?? "",
      construction_end_date: site.construction_end_date ?? "",
    });
  }

  function startEditDailyWorker(worker: DailyWorker) {
    setCurrentMenu("daily");
    setEditingDailyWorkerId(worker.id);
    setDailyWorkerForm({
      name: worker.name,
      daily_wage: String(worker.daily_wage),
      non_taxable: String(worker.non_taxable),
      first_work_date: worker.first_work_date ?? "",
      address: worker.address ?? "",
      resident_number: worker.resident_number ?? "",
      phone: worker.phone ?? "",
      bank_name: worker.bank_name ?? "",
      account_number: worker.account_number ?? "",
      job_type: worker.job_type ?? "",
      company_id: worker.company_id ? String(worker.company_id) : "",
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
    fetchMonthlyRecords(targetMonth, selectedSiteId);
  }

  function updateWorkUnit(date: string, workDays: number | null) {
    setSelectedWorkEntries((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const exists = safePrev.some((entry) => entry.date === date);

      if (exists) {
        return safePrev.map((entry) => (entry.date === date ? { ...entry, work_days: workDays } : entry));
      }

      return [...safePrev, { date, work_days: workDays }];
    });
  }

  async function saveMonthlyRecord() {
    if (!selectedDailyWorker) {
      alert("일용직을 선택하세요.");
      return;
    }
    if (!selectedSiteId) {
      alert("현장을 선택하세요.");
      return;
    }

    setSavingMonthlyRecord(true);
    const normalizedEntries = safeEntries
      .map((entry) => {
        if (entry.work_days === null || entry.work_days === undefined) {
          return { ...entry, work_days: null };
        }

        const workDays = Number(entry.work_days);
        if (Number.isNaN(workDays)) {
          return { ...entry, work_days: null };
        }

        return { ...entry, work_days: Math.max(0, workDays) };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const paidEntries = normalizedEntries.filter((entry) => entry.work_days !== null && entry.work_days > 0);
    const totalWorkUnits = paidEntries.reduce((sum, entry) => sum + (entry.work_days ?? 0), 0);
    const workedDaysCount = paidEntries.length;
    const grossAmount = Number(selectedDailyWorker.daily_wage) * totalWorkUnits;

    const payload: DailyWorkerMonthlyRecord = {
      daily_worker_id: selectedDailyWorker.id,
      site_id: selectedSiteId,
      target_month: targetMonth,
      work_entries: normalizedEntries,
      total_work_units: totalWorkUnits,
      worked_days_count: workedDaysCount,
      gross_amount: grossAmount,
    };

    const { error } = await supabase
      .from("daily_worker_monthly_records")
      .upsert(payload, { onConflict: "daily_worker_id,site_id,target_month" });

    if (error) {
      alert(`월별 기록 저장 실패: ${error.message}`);
      setSavingMonthlyRecord(false);
      return;
    }

    setSavingMonthlyRecord(false);
    fetchMonthlyRecords(targetMonth, selectedSiteId);
    alert("저장되었습니다.");
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "8px" }}>회사 관리시스템</h1>
        <p style={{ color: "#475569", marginBottom: "24px" }}>회사/현장/직종/근로자 공수/노무비 명세표까지 확장된 통합 화면입니다.</p>

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
                <div style={cardTitleStyle}>총 공수</div>
                <div style={cardNumberStyle}>{totalWorkUnits}</div>
              </div>
              <div style={cardStyle}>
                <div style={cardTitleStyle}>예상 지급액</div>
                <div style={cardNumberStyle}>{expectedAmount.toLocaleString()}원</div>
                <div style={cardDescStyle}>{targetMonth} / {selectedSite?.name ?? "현장 미선택"}</div>
              </div>
            </div>

            {currentMenu === "dashboard" && (
              <>
                <div style={cardStyle}>
                  <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>회사 / 현장 등록</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                    <form onSubmit={submitCompany} style={{ ...formGridStyle, gridTemplateColumns: "1fr" }}>
                      <div style={labelStyle}>회사 등록</div>
                      <input style={inputStyle} placeholder="회사명" value={companyForm.name} onChange={(e) => setCompanyForm((prev) => ({ ...prev, name: e.target.value }))} />
                      <input style={inputStyle} placeholder="사업자번호" value={companyForm.business_number} onChange={(e) => setCompanyForm((prev) => ({ ...prev, business_number: e.target.value }))} />
                      <input style={inputStyle} placeholder="주소" value={companyForm.address} onChange={(e) => setCompanyForm((prev) => ({ ...prev, address: e.target.value }))} />
                      <button type="submit" style={primaryButtonStyle}>회사 등록</button>
                    </form>

                    <form onSubmit={submitSite} style={{ ...formGridStyle, gridTemplateColumns: "1fr" }}>
                      <div style={labelStyle}>{editingSiteId ? "현장 수정" : "현장 등록"}</div>
                      <input style={inputStyle} placeholder="현장명" value={siteForm.name} onChange={(e) => setSiteForm((prev) => ({ ...prev, name: e.target.value }))} />
                      <select style={inputStyle} value={siteForm.company_id} onChange={(e) => setSiteForm((prev) => ({ ...prev, company_id: e.target.value }))}>
                        <option value="">회사 선택</option>
                        {companies.map((company) => (<option key={company.id} value={company.id}>{company.name}</option>))}
                      </select>
                      <input style={inputStyle} placeholder="발주자" value={siteForm.client_name} onChange={(e) => setSiteForm((prev) => ({ ...prev, client_name: e.target.value }))} />
                      <select style={inputStyle} value={siteForm.contract_type} onChange={(e) => setSiteForm((prev) => ({ ...prev, contract_type: e.target.value }))}>
                        <option value="">구분 선택</option>
                        <option value="원도급">원도급</option>
                        <option value="하도급">하도급</option>
                      </select>
                      <div>
                        <div style={labelStyle}>착공일</div>
                        <input
                          style={inputStyle}
                          type="text"
                          placeholder="예: 20260404"
                          value={siteForm.construction_start_date}
                          onChange={(e) =>
                            setSiteForm((prev) => ({ ...prev, construction_start_date: formatDateInput(e.target.value) }))
                          }
                        />
                      </div>
                      <div>
                        <div style={labelStyle}>준공일</div>
                        <input
                          style={inputStyle}
                          type="text"
                          placeholder="예: 20260404"
                          value={siteForm.construction_end_date}
                          onChange={(e) =>
                            setSiteForm((prev) => ({ ...prev, construction_end_date: formatDateInput(e.target.value) }))
                          }
                        />
                      </div>
                      <button type="submit" style={primaryButtonStyle}>{editingSiteId ? "현장 수정" : "현장 등록"}</button>
                      {editingSiteId && (
                        <button
                          type="button"
                          style={secondaryButtonStyle}
                          onClick={() => {
                            setEditingSiteId(null);
                            setSiteForm({
                              name: "",
                              company_id: "",
                              client_name: "",
                              contract_type: "",
                              construction_start_date: "",
                              construction_end_date: "",
                            });
                          }}
                        >
                          수정 취소
                        </button>
                      )}
                    </form>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                    <div>
                      <div style={{ ...labelStyle, marginBottom: "8px" }}>회사 선택</div>
                      <select style={inputStyle} value={selectedCompanyId ?? ""} onChange={(e) => {
                        const nextCompanyId = e.target.value ? Number(e.target.value) : null;
                        setSelectedCompanyId(nextCompanyId);
                        setSelectedSiteId(null);
                      }}>
                        <option value="">전체 회사</option>
                        {companies.map((company) => (<option key={company.id} value={company.id}>{company.name}</option>))}
                      </select>
                    </div>
                    <div>
                      <div style={{ ...labelStyle, marginBottom: "8px" }}>현장 선택</div>
                      <select style={inputStyle} value={selectedSiteId ?? ""} onChange={(e) => setSelectedSiteId(e.target.value ? Number(e.target.value) : null)}>
                        <option value="">현장 선택</option>
                        {filteredSites.map((site) => (<option key={site.id} value={site.id}>{site.name}</option>))}
                      </select>
                    </div>
                  </div>

                  <div style={{ color: "#475569", fontSize: "14px" }}>
                    회사 목록: {companies.map((company) => company.name).join(", ") || "없음"}<br />
                    현장 목록: {sites.map((site) => site.name).join(", ") || "없음"}
                  </div>
                  <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
                    {sites.map((site) => (
                      <button key={site.id} type="button" style={secondaryButtonStyle} onClick={() => startEditSite(site)}>
                        {site.name} 수정
                      </button>
                    ))}
                  </div>
                </div>

                <div style={cardStyle}>
                  <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "12px" }}>요약</h2>
                  <div style={{ color: "#64748b", marginBottom: "12px" }}>
                    등록 직원: {employees.length}명 / 일용직: {dailyWorkers.length}명 / 회사: {companies.length}개 / 현장: {sites.length}개
                  </div>
                </div>

                <div style={cardStyle}>
                  <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>노무비 명세표</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px", marginBottom: "12px" }}>
                    <select
                      style={inputStyle}
                      value={selectedCompanyId ?? ""}
                      onChange={(e) => {
                        const nextCompanyId = e.target.value ? Number(e.target.value) : null;
                        setSelectedCompanyId(nextCompanyId);
                        setSelectedSiteId(null);
                      }}
                    >
                      <option value="">회사 선택</option>
                      {companies.map((company) => (<option key={company.id} value={company.id}>{company.name}</option>))}
                    </select>
                    <select style={inputStyle} value={selectedSiteId ?? ""} onChange={(e) => setSelectedSiteId(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">현장 선택</option>
                      {filteredSites.map((site) => (<option key={site.id} value={site.id}>{site.name}</option>))}
                    </select>
                    <select style={inputStyle} value={selectedJobCategory} onChange={(e) => setSelectedJobCategory(e.target.value as JobCategoryFilter)}>
                      <option value="전체">전체</option>
                      <option value="직영">직영</option>
                      <option value="용역">용역</option>
                    </select>
                    <input
                      style={inputStyle}
                      type="month"
                      value={selectedTargetMonth}
                      onChange={(e) => {
                        setSelectedTargetMonth(e.target.value);
                        setTargetMonth(e.target.value);
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: "12px", color: "#334155" }}>
                    회사명: {companies.find((company) => company.id === selectedCompanyId)?.name ?? "전체"} / 현장명: {selectedSite?.name ?? "미선택"} / 직종 구분: {selectedJobCategory}
                  </div>
                  {!selectedSiteId && (
                    <p style={{ color: "#64748b", marginBottom: "12px" }}>회사, 현장, 직종 구분을 선택하면 해당 조건 기준으로 명세표를 확인할 수 있습니다.</p>
                  )}
                  {payrollSummary.groups.map((group) => (
                    <div key={group.job_type} style={{ marginBottom: "16px" }}>
                      <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "8px" }}>직종: {group.job_type}</h3>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9" }}>
                            <th style={thStyle}>근로자명</th>
                            <th style={thStyle}>주민번호</th>
                            <th style={thStyle}>공수</th>
                            <th style={thStyle}>일당</th>
                            <th style={thStyle}>금액</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.workers.map((item) => (
                            <tr key={item.worker.id}>
                              <td style={tdStyle}>{item.worker.name}</td>
                              <td style={tdStyle}>{item.worker.resident_number}</td>
                              <td style={tdStyle}>{item.work_units}</td>
                              <td style={tdStyle}>{item.worker.daily_wage.toLocaleString()}원</td>
                              <td style={tdStyle}>{item.amount.toLocaleString()}원</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                  <div style={{ fontWeight: "bold", color: "#0f172a" }}>
                    합계 - 총 공수: {payrollSummary.total_work_units} / 총 지급액: {payrollSummary.total_amount.toLocaleString()}원
                  </div>
                </div>
              </>
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
                    <div>
                      <div style={labelStyle}>입사일</div>
                      <input
                        style={inputStyle}
                        type="text"
                        placeholder="예: 20260404"
                        value={employeeForm.join_date}
                        onChange={(e) => setEmployeeForm((prev) => ({ ...prev, join_date: formatDateInput(e.target.value) }))}
                      />
                    </div>
                    <select style={inputStyle} value={employeeForm.status} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, status: e.target.value as EmployeeStatus }))}>
                      {EMPLOYEE_STATUSES.map((status) => (<option key={status} value={status}>{status}</option>))}
                    </select>
                    <div>
                      <div style={labelStyle}>퇴사일</div>
                      <input
                        style={inputStyle}
                        type="text"
                        placeholder="예: 20260404"
                        value={employeeForm.resignation_date}
                        disabled={employeeForm.status !== "퇴사"}
                        onChange={(e) =>
                          setEmployeeForm((prev) => ({ ...prev, resignation_date: formatDateInput(e.target.value) }))
                        }
                      />
                    </div>
                    <select style={inputStyle} value={employeeForm.company_id} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, company_id: e.target.value }))}>
                      <option value="">현재 법인 선택</option>
                      {companies.map((company) => (<option key={company.id} value={company.id}>{company.name}</option>))}
                    </select>
                    <select style={inputStyle} value={employeeForm.site_id} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, site_id: e.target.value }))}>
                      <option value="">현재 현장 선택</option>
                      {sites
                        .filter((site) => !employeeForm.company_id || site.company_id === Number(employeeForm.company_id))
                        .map((site) => (<option key={site.id} value={site.id}>{site.name}</option>))}
                    </select>
                    <select style={inputStyle} value={employeeForm.assignment_type} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, assignment_type: e.target.value as AssignmentType }))}>
                      {ASSIGNMENT_TYPES.map((type) => (<option key={type} value={type}>{type}</option>))}
                    </select>
                    <div>
                      <div style={labelStyle}>소속 시작일</div>
                      <input
                        style={inputStyle}
                        type="text"
                        placeholder="예: 20260404"
                        value={employeeForm.assignment_start_date}
                        onChange={(e) =>
                          setEmployeeForm((prev) => ({ ...prev, assignment_start_date: formatDateInput(e.target.value) }))
                        }
                      />
                    </div>
                    <div>
                      <div style={labelStyle}>소속 종료일</div>
                      <input
                        style={inputStyle}
                        type="text"
                        placeholder="예: 20260404"
                        value={employeeForm.assignment_end_date}
                        onChange={(e) =>
                          setEmployeeForm((prev) => ({ ...prev, assignment_end_date: formatDateInput(e.target.value) }))
                        }
                      />
                    </div>
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
                      {EMPLOYEE_STATUSES.map((status) => (<option key={status} value={status}>{status}</option>))}
                    </select>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        <th style={thStyle}>이름</th>
                        <th style={thStyle}>구분</th>
                        <th style={thStyle}>직책</th>
                        <th style={thStyle}>입사일</th>
                        <th style={thStyle}>퇴사일</th>
                        <th style={thStyle}>상태</th>
                        <th style={thStyle}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingEmployees ? (
                        <tr><td style={tdStyle} colSpan={7}>불러오는 중...</td></tr>
                      ) : filteredEmployees.length === 0 ? (
                        <tr><td style={tdStyle} colSpan={7}>데이터가 없습니다.</td></tr>
                      ) : filteredEmployees.map((employee) => (
                        <tr key={employee.id}>
                          <td style={tdStyle}>{employee.name}</td>
                          <td style={tdStyle}>{employee.type}</td>
                          <td style={tdStyle}>{employee.position}</td>
                          <td style={tdStyle}>{employee.join_date}</td>
                          <td style={tdStyle}>{employee.status === "퇴사" ? (employee.resignation_date ?? "-") : ""}</td>
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
                  <form onSubmit={saveDailyWorker} style={{ ...formGridStyle, gridTemplateColumns: "repeat(3, 1fr)" }}>
                    <input style={inputStyle} placeholder="이름" value={dailyWorkerForm.name} onChange={(e) => setDailyWorkerForm((prev) => ({ ...prev, name: e.target.value }))} />
                    <input style={inputStyle} type="number" min={0} step={1} placeholder="일당" value={dailyWorkerForm.daily_wage} onChange={(e) => setDailyWorkerForm((prev) => ({ ...prev, daily_wage: e.target.value }))} />
                    <input style={inputStyle} type="number" min={0} placeholder="비과세" value={dailyWorkerForm.non_taxable} onChange={(e) => setDailyWorkerForm((prev) => ({ ...prev, non_taxable: e.target.value }))} />
                    <input
                      style={inputStyle}
                      type="text"
                      placeholder="최초근무일 (YYYY-MM-DD)"
                      value={dailyWorkerForm.first_work_date}
                      onChange={(e) => setDailyWorkerForm((prev) => ({ ...prev, first_work_date: formatDateInput(e.target.value) }))}
                    />
                    <input style={inputStyle} placeholder="주소" value={dailyWorkerForm.address} onChange={(e) => setDailyWorkerForm((prev) => ({ ...prev, address: e.target.value }))} />
                    <input
                      style={inputStyle}
                      type="text"
                      placeholder="예: 9001011234567"
                      value={dailyWorkerForm.resident_number}
                      onChange={(e) =>
                        setDailyWorkerForm((prev) => ({ ...prev, resident_number: formatResidentNumber(e.target.value) }))
                      }
                    />
                    <input style={inputStyle} placeholder="전화번호" value={dailyWorkerForm.phone} onChange={(e) => setDailyWorkerForm((prev) => ({ ...prev, phone: e.target.value }))} />
                    <input style={inputStyle} placeholder="은행명" value={dailyWorkerForm.bank_name} onChange={(e) => setDailyWorkerForm((prev) => ({ ...prev, bank_name: e.target.value }))} />
                    <input style={inputStyle} placeholder="계좌번호" value={dailyWorkerForm.account_number} onChange={(e) => setDailyWorkerForm((prev) => ({ ...prev, account_number: e.target.value }))} />
                    <input style={inputStyle} placeholder="직종" value={dailyWorkerForm.job_type} onChange={(e) => setDailyWorkerForm((prev) => ({ ...prev, job_type: e.target.value }))} />
                    <select style={inputStyle} value={dailyWorkerForm.company_id} onChange={(e) => setDailyWorkerForm((prev) => ({ ...prev, company_id: e.target.value }))}>
                      <option value="">소속 회사 선택</option>
                      {companies.map((company) => (<option key={company.id} value={company.id}>{company.name}</option>))}
                    </select>
                    <input
                      style={inputStyle}
                      type="month"
                      value={targetMonth}
                      onChange={(e) => {
                        setTargetMonth(e.target.value);
                        setSelectedTargetMonth(e.target.value);
                      }}
                    />
                    <select style={inputStyle} value={selectedCompanyId ?? ""} onChange={(e) => {
                      const nextCompanyId = e.target.value ? Number(e.target.value) : null;
                      setSelectedCompanyId(nextCompanyId);
                      setSelectedSiteId(null);
                    }}>
                      <option value="">공수 대상 회사 선택</option>
                      {companies.map((company) => (<option key={company.id} value={company.id}>{company.name}</option>))}
                    </select>
                    <select style={inputStyle} value={selectedSiteId ?? ""} onChange={(e) => setSelectedSiteId(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">현장 선택</option>
                      {filteredSites.map((site) => (<option key={site.id} value={site.id}>{site.name}</option>))}
                    </select>
                    <select style={inputStyle} value={selectedDailyWorkerId ?? ""} onChange={(e) => selectDailyWorker(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">일용직 선택</option>
                      {dailyWorkers.map((worker) => (<option key={worker.id} value={worker.id}>{worker.name}</option>))}
                    </select>
                    <button type="submit" style={primaryButtonStyle}>{editingDailyWorkerId ? "수정 저장" : "일용직 등록하기"}</button>
                  </form>

                  <div style={{ marginTop: "16px" }}>
                    <div style={{ ...labelStyle, marginBottom: "8px" }}>일용직 공수 입력 달력</div>
                    {!selectedDailyWorker ? (
                      <p style={{ color: "#64748b" }}>일용직을 선택하면 날짜별 공수 입력이 표시됩니다.</p>
                    ) : !selectedSiteId ? (
                      <p style={{ color: "#64748b" }}>공수 입력 전에 현장을 선택하세요.</p>
                    ) : (
                      <>
                        <p style={{ color: "#334155", marginBottom: "8px" }}>
                          {selectedDailyWorker.name} / 주민번호 {selectedDailyWorker.resident_number} / 일당 {selectedDailyWorker.daily_wage.toLocaleString()}원
                        </p>
                        <p style={{ color: "#334155", marginBottom: "12px", fontWeight: "bold" }}>
                          총 공수: {totalWorkUnits} / 일한 날짜 수: {workedDaysCount} / 예상 지급액: {expectedAmount.toLocaleString()}원
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
                        <th style={thStyle}>주민번호(마스킹)</th>
                        <th style={thStyle}>직종</th>
                        <th style={thStyle}>일당</th>
                        <th style={thStyle}>최초근무일</th>
                        <th style={thStyle}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingDailyWorkers ? (
                        <tr><td style={tdStyle} colSpan={6}>불러오는 중...</td></tr>
                      ) : dailyWorkers.length === 0 ? (
                        <tr><td style={tdStyle} colSpan={6}>데이터가 없습니다.</td></tr>
                      ) : dailyWorkers.map((worker) => (
                        <tr key={worker.id}>
                          <td style={tdStyle}>{worker.name}</td>
                          <td style={tdStyle}>{maskResidentNumber(worker.resident_number)}</td>
                          <td style={tdStyle}>{worker.job_type}</td>
                          <td style={tdStyle}>{worker.daily_wage.toLocaleString()}원</td>
                          <td style={tdStyle}>{worker.first_work_date ? worker.first_work_date.slice(0, 10) : "-"}</td>
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
