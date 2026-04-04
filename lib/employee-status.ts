export const EMPLOYEE_STATUSES = ["재직", "퇴사", "휴직", "전출", "파견"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const ASSIGNMENT_TYPES = ["정규소속", "법인전출", "임시파견"] as const;
export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];
