import type { AuthAccount } from "./types";

export const demoAccounts: AuthAccount[] = [
  { email: "owner@next.example", loginId: "owner01", password: "owner01!", role: "owner", userId: "user-owner" },
  { email: "manager@next.example", loginId: "test", password: "test", role: "manager", userId: "user-manager" }
];
