"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type PropsWithChildren } from "react";
import type { CandidateType, DomainTypeScope, LinkTarget, PrototypeState, Role, Screen, VoteChoice } from "../domain/types";
import { advanceAnalysisJob, confirmCandidates, editCandidate, excludeCandidate, setCandidateType, startAnalysisJob } from "./commands/analysisCommands";
import { loginWithCredentials, logout, signup } from "./commands/authCommands";
import { addSourceFiles, removeSourceFile, updateSourceFile, uploadSampleFiles } from "./commands/fileCommands";
import { createProposalFromInsight } from "./commands/insightCommands";
import {
  deactivateWorkspaceMember,
  approveWorkspaceMember,
  rejectWorkspaceMember,
  regenerateInviteCode,
  transferWorkspaceOwnership,
  updateWorkspaceMember,
  updateWorkspaceProfile
} from "./commands/organizationCommands";
import { recordOutcome } from "./commands/outcomeCommands";
import { castVote, finalizeProposal } from "./commands/proposalCommands";
import { addDomainType, deleteDomainType, updateDomainType } from "./commands/typeCommands";
import { generateVerificationRecord } from "./commands/verificationCommands";
import { createWorkspace, joinWorkspaceByInviteCode, leaveWorkspace, selectWorkspace } from "./commands/workspaceCommands";
import { findAuthAccount } from "./authAccounts";
import { createPersistenceEffectController } from "./persistenceEffect";
import { loadUserState, persistedStateSignature, saveUserState, screenAfterUserRestore } from "./persistence";
import { pathForScreen } from "./routes";
import { createInitialState, reducer } from "./store";

interface PrototypeCommands {
  navigate(screen: Screen): void;
  navigateToTarget(target: LinkTarget): void;
  login(loginId: string, password: string): boolean;
  signup(payload: { code?: string; email: string; name: string; password: string }): boolean;
  requestWorkspaceAccess(payload: { code?: string; email: string; name: string; password: string }): boolean;
  logout(): void;
  selectWorkspace(workspaceId: string): boolean;
  joinWorkspaceByInviteCode(inviteCode: string): boolean;
  leaveWorkspace(workspaceId: string): boolean;
  createWorkspace(payload: { name: string }): boolean;
  updateWorkspaceProfile(payload: { workspaceId: string; name: string }): boolean;
  regenerateInviteCode(workspaceId: string): boolean;
  updateWorkspaceMember(payload: { memberId: string; role: Role; title: string }): boolean;
  approveWorkspaceMember(memberId: string): boolean;
  rejectWorkspaceMember(memberId: string): boolean;
  deactivateWorkspaceMember(memberId: string): boolean;
  transferWorkspaceOwnership(memberId: string): boolean;
  addDomainType(scope: DomainTypeScope, label: string, color?: string): boolean;
  updateDomainType(scope: DomainTypeScope, typeId: string, label: string, color?: string): boolean;
  deleteDomainType(scope: DomainTypeScope, typeId: string): boolean;
  setRole(role: Role): void;
  addSourceFiles(files: Array<{ name: string; size: number; mimeType?: string; dataUrl?: string; textContent?: string; previewColumns?: string[]; previewRows?: string[][]; rowCount?: number }>): boolean;
  updateSourceFile(fileId: string, patch: { name: string; kind: string }): boolean;
  removeSourceFile(fileId: string): boolean;
  uploadSampleFiles(): boolean;
  startAnalysisJob(): boolean;
  advanceAnalysisJob(): void;
  setCandidateType(candidateType: CandidateType): void;
  editCandidate(candidateId: string, title: string, note: string, description?: string): boolean;
  excludeCandidate(candidateId: string): boolean;
  confirmCandidates(selectedCandidateIds?: string[]): boolean;
  createProposalFromInsight(insightId: string): boolean;
  castVote(proposalId: string, choice: VoteChoice, reason: string): boolean;
  finalizeProposal(proposalId: string): boolean;
  generateVerificationRecord(decisionId: string): Promise<boolean>;
  recordOutcome(decisionId: string): boolean;
  clearNotice(): void;
}

interface PrototypeContextValue {
  state: PrototypeState;
  commands: PrototypeCommands;
}

const PrototypeContext = createContext<PrototypeContextValue | undefined>(undefined);

export function PrototypeProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const persistenceEffectControllerRef = useRef(createPersistenceEffectController());

  useEffect(() => {
    persistenceEffectControllerRef.current.persist(state, { dispatch, save: saveUserState, signatureForState: persistedStateSignature });
  }, [state]);

  const commands = useMemo<PrototypeCommands>(
    () => ({
      navigate: (screen) => {
        dispatch({ type: "NAVIGATE", screen });
        router.push(pathForScreen(screen));
      },
      navigateToTarget: (target) => {
        dispatch({ type: "NAVIGATE_TO_TARGET", target });
        router.push(pathForScreen(target.screen));
      },
      login: (loginId, password) => {
        const account = findAuthAccount(state.authAccounts, loginId, password);
        if (!account) {
          return false;
        }

        const savedState = loadUserState(account.userId, createInitialState());
        if (savedState) {
          const restoredScreen = screenAfterUserRestore(savedState.screen, savedState.session.workspaceId);
          dispatch({
            type: "RESTORE_USER_STATE",
            role: account.role,
            screen: restoredScreen,
            state: savedState,
            userId: account.userId,
            auditLog: {
              id: `audit-login-restore-${Date.now()}`,
              action: "로그인",
              actorId: account.userId,
              at: new Date().toISOString(),
              summary: "저장된 사용자 상태를 불러왔습니다.",
              targetId: account.userId,
              targetType: "session"
            }
          });
          router.push(pathForScreen(restoredScreen));
          return true;
        }

        const loggedIn = loginWithCredentials(state, dispatch, loginId, password);
        if (loggedIn) {
          router.push(pathForScreen("workspace"));
        }
        return loggedIn;
      },
      signup: (payload) => {
        const requested = signup(state, dispatch, payload);
        if (requested) {
          router.push(pathForScreen("workspace"));
        }
        return requested;
      },
      requestWorkspaceAccess: (payload) => {
        const requested = signup(state, dispatch, payload);
        if (requested) {
          router.push(pathForScreen("workspace"));
        }
        return requested;
      },
      logout: () => {
        logout(state, dispatch);
        router.push(pathForScreen("login"));
      },
      selectWorkspace: (workspaceId) => {
        const selected = selectWorkspace(state, dispatch, workspaceId);
        if (selected) {
          router.push(pathForScreen("dashboard"));
        }
        return selected;
      },
      joinWorkspaceByInviteCode: (inviteCode) => {
        const joined = joinWorkspaceByInviteCode(state, dispatch, inviteCode);
        if (joined) {
          router.push(pathForScreen("workspace"));
        }
        return joined;
      },
      leaveWorkspace: (workspaceId) => {
        const left = leaveWorkspace(state, dispatch, workspaceId);
        if (left) {
          router.push(pathForScreen("workspace"));
        }
        return left;
      },
      createWorkspace: (payload) => {
        createWorkspace(state, dispatch, payload);
        router.push(pathForScreen("workspace"));
        return true;
      },
      updateWorkspaceProfile: (payload) => updateWorkspaceProfile(state, dispatch, payload),
      regenerateInviteCode: (workspaceId) => regenerateInviteCode(state, dispatch, workspaceId),
      updateWorkspaceMember: (payload) => updateWorkspaceMember(state, dispatch, payload),
      approveWorkspaceMember: (memberId) => approveWorkspaceMember(state, dispatch, memberId),
      rejectWorkspaceMember: (memberId) => rejectWorkspaceMember(state, dispatch, memberId),
      deactivateWorkspaceMember: (memberId) => deactivateWorkspaceMember(state, dispatch, memberId),
      transferWorkspaceOwnership: (memberId) => transferWorkspaceOwnership(state, dispatch, memberId),
      addDomainType: (scope, label, color) => addDomainType(state, dispatch, scope, label, color),
      updateDomainType: (scope, typeId, label, color) => updateDomainType(state, dispatch, scope, typeId, label, color),
      deleteDomainType: (scope, typeId) => deleteDomainType(state, dispatch, scope, typeId),
      setRole: (role) => dispatch({ type: "SET_ROLE", role }),
      addSourceFiles: (files) => addSourceFiles(state, dispatch, files),
      updateSourceFile: (fileId, patch) => updateSourceFile(state, dispatch, fileId, patch),
      removeSourceFile: (fileId) => removeSourceFile(state, dispatch, fileId),
      uploadSampleFiles: () => {
        const uploaded = uploadSampleFiles(state, dispatch);
        if (uploaded) {
          router.push(pathForScreen("analysis"));
        }
        return uploaded;
      },
      startAnalysisJob: () => {
        const started = startAnalysisJob(state, dispatch);
        if (started) {
          router.push(pathForScreen("analysis"));
        }
        return started;
      },
      advanceAnalysisJob: () => {
        const job = state.analysisJobs[0];
        const willComplete = job?.progress === 78;
        advanceAnalysisJob(dispatch);
        if (willComplete) {
          router.push(pathForScreen("review"));
        }
      },
      setCandidateType: (candidateType) => setCandidateType(dispatch, candidateType),
      editCandidate: (candidateId, title, note, description) => editCandidate(state, dispatch, candidateId, title, note, description),
      excludeCandidate: (candidateId) => excludeCandidate(state, dispatch, candidateId),
      confirmCandidates: (selectedCandidateIds) => {
        const confirmed = confirmCandidates(state, dispatch, selectedCandidateIds);
        if (confirmed) {
          router.push(pathForScreen("dashboard"));
        }
        return confirmed;
      },
      createProposalFromInsight: (insightId) => {
        const created = createProposalFromInsight(state, dispatch, insightId);
        if (created) {
          router.push(pathForScreen("proposalVote"));
        }
        return created;
      },
      castVote: (proposalId, choice, reason) => castVote(state, dispatch, proposalId, choice, reason),
      finalizeProposal: (proposalId) => {
        const finalized = finalizeProposal(state, dispatch, proposalId);
        if (finalized) {
          router.push(pathForScreen("decisionConfirm"));
        }
        return finalized;
      },
      generateVerificationRecord: async (decisionId) => {
        const generated = await generateVerificationRecord(state, dispatch, decisionId);
        if (generated) {
          router.push(pathForScreen("verificationDetail"));
        }
        return generated;
      },
      recordOutcome: (decisionId) => {
        const recorded = recordOutcome(state, dispatch, decisionId);
        if (recorded) {
          router.push(pathForScreen("outcome"));
        }
        return recorded;
      },
      clearNotice: () => {
        dispatch({ type: "SET_PERMISSION_DENIED" });
        dispatch({ type: "SET_SIMULATED_ERROR" });
      }
    }),
    [router, state]
  );

  const value = useMemo(() => ({ state, commands }), [commands, state]);

  return <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>;
}

export function usePrototype() {
  const context = useContext(PrototypeContext);

  if (!context) {
    throw new Error("PrototypeProvider 안에서만 usePrototype을 사용할 수 있습니다.");
  }

  return context;
}
