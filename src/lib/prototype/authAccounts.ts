import type { Role } from "../domain/types";

export type DemoAccount = {
  loginId: string;
  password: string;
  role: Role;
  userId: string;
};

export const demoAccounts: DemoAccount[] = [
  { loginId: "admin01", password: "admin01!", role: "admin", userId: "user-admin" },
  { loginId: "test", password: "test", role: "manager", userId: "user-manager" },
  { loginId: "member01", password: "member01!", role: "member", userId: "user-member" }
];

export function findDemoAccount(loginId: string, password: string): DemoAccount | undefined {
  return demoAccounts.find((account) => account.loginId === loginId.trim() && account.password === password);
}
