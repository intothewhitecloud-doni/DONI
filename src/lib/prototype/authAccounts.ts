import { demoAccounts } from "../domain/auth-fixtures";
import type { AuthAccount } from "../domain/types";
import { normalizedEmail } from "./policy";

export type DemoAccount = AuthAccount;
export { demoAccounts };

export function findAuthAccount(accounts: AuthAccount[], loginId: string, password: string): AuthAccount | undefined {
  const normalizedLoginId = normalizedEmail(loginId);
  return accounts.find(
    (account) =>
      (account.loginId.trim().toLowerCase() === normalizedLoginId || normalizedEmail(account.email ?? "") === normalizedLoginId) &&
      account.password === password
  );
}
