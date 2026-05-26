import type { AuthAccount } from "./types";

export const demoAccounts: AuthAccount[] = [
  { email: "owner@next.example", loginId: "owner01", password: "owner01!", role: "owner", userId: "user-admin" },
  { email: "manager@next.example", loginId: "test", password: "test", role: "manager", userId: "user-manager" },
  { email: "member@next.example", loginId: "member01", password: "member01!", role: "member", userId: "user-member" }
];
