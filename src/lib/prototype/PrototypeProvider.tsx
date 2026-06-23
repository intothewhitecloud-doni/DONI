"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type PropsWithChildren } from "react";
import type { CandidateType, DomainTypeScope, LinkTarget, PrototypeState, Role, Screen, StructureMapNodePatch, StructureMapRelationInput, StructureMapRelationPatch, StructureMapViewState, VoteChoice } from "../domain/types";
import { advanceAnalysisJob, confirmCandidates, editCandidate, excludeCandidate, setCandidateType, startAnalysisJob } from "./commands/analysisCommands";
import { LOGIN_FAILED_MESSAGE, loginWithCredentials, logout, signup } from "./commands/authCommands";
import { addSourceFiles, applySourceFileToCurrentStandard, removeSourceFile, updateSourceFile, uploadSampleFiles } from "./commands/fileCommands";
import { createProposalFromInsight } from "./commands/insightCommands";
import {
  addOrganizationCategory,
  approveCompanyUser,
  deleteCompanyUserAccount,
  deleteOrganizationCategory,
  regenerateCompanyCode,
  rejectCompanyUser,
  updateCompanyProfile,
  updateCompanyUser,
  updateOrganizationCategory
} from "./commands/organizationCommands";
import { recordOutcome } from "./commands/outcomeCommands";
import { castVote, finalizeProposal } from "./commands/proposalCommands";
import {
  addStructureMapRelation,
  deleteStructureMapRelation,
  hideStructureMapItem,
  setStructureMapView,
  unhideStructureMapItem,
  updateStructureMapNode,
  updateStructureMapRelation
} from "./commands/structureMapCommands";
import { addDomainType, deleteDomainType, updateDomainType } from "./commands/typeCommands";
import { generateVerificationRecord } from "./commands/verificationCommands";
import { findAuthAccount } from "./authAccounts";
import { createPersistenceEffectController } from "./persistenceEffect";
import { loadCompanyDirectoryState, loadUserState, persistedStateSignature, saveUserState, screenAfterUserRestore } from "./persistence";
import { pathForScreen } from "./routes";
import { createInitialState, reducer } from "./store";

interface PrototypeCommands {
  navigate(screen: Screen): void;
  navigateToTarget(target: LinkTarget): void;
  login(loginId: string, password: string): boolean;
  signup(payload: { code: string; email: string; name: string; password: string }): boolean;
  logout(): void;
  updateCompanyProfile(payload: { name: string }): boolean;
  regenerateCompanyCode(): boolean;
  updateCompanyUser(payload: { companyUserId: string; role: Role; title: string; organizationCategoryId: string }): boolean;
  approveCompanyUser(companyUserId: string): boolean;
  rejectCompanyUser(companyUserId: string): boolean;
  deleteCompanyUserAccount(companyUserId: string): boolean;
  addOrganizationCategory(name: string): boolean;
  updateOrganizationCategory(organizationCategoryId: string, name: string): boolean;
  deleteOrganizationCategory(organizationCategoryId: string): boolean;
  addDomainType(scope: DomainTypeScope, label: string, color?: string): boolean;
  updateDomainType(scope: DomainTypeScope, typeId: string, label: string, color?: string): boolean;
  deleteDomainType(scope: DomainTypeScope, typeId: string): boolean;
  addSourceFiles(
    files: Array<{ name: string; size: number; description?: string; organizationCategoryId?: string; mimeType?: string; dataUrl?: string; textContent?: string; previewColumns?: string[]; previewRows?: string[][]; rowCount?: number }>,
    organizationCategoryId?: string
  ): boolean;
  updateSourceFile(fileId: string, patch: { name: string; kind: string; description?: string; organizationCategoryId?: string }): boolean;
  applySourceFileToCurrentStandard(fileId: string): boolean;
  removeSourceFile(fileId: string): boolean;
  setStructureMapView(patch: Partial<StructureMapViewState>): void;
  updateStructureMapNode(nodeId: string, patch: StructureMapNodePatch): boolean;
  updateStructureMapRelation(relationId: string, patch: StructureMapRelationPatch): boolean;
  addStructureMapRelation(relation: StructureMapRelationInput): boolean;
  deleteStructureMapRelation(relationId: string): boolean;
  hideStructureMapItem(itemId: string, kind: "node" | "edge"): void;
  unhideStructureMapItem(itemId: string, kind: "node" | "edge"): void;
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
  const [state, dispatch] = useReducer(reducer, undefined, () => loadCompanyDirectoryState(createInitialState()));
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
          dispatch({ type: "SET_PERMISSION_DENIED", message: LOGIN_FAILED_MESSAGE });
          return false;
        }

        const savedState = loadUserState(account.userId, createInitialState());
        if (savedState) {
          const restoredScreen = screenAfterUserRestore(savedState.screen);
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
          router.push(pathForScreen(savedState.session.loggedIn ? restoredScreen : "login"));
          return true;
        }

        const activeCompanyUser = state.companyUsers.find((companyUser) => companyUser.userId === account.userId && companyUser.status === "active");
        const loggedIn = loginWithCredentials(state, dispatch, loginId, password);
        if (loggedIn) {
          router.push(pathForScreen(activeCompanyUser ? "dashboard" : "login"));
        }
        return loggedIn;
      },
      signup: (payload) => {
        const requested = signup(state, dispatch, payload);
        if (requested) {
          router.push(pathForScreen("login"));
        }
        return requested;
      },
      logout: () => {
        logout(state, dispatch);
        router.push(pathForScreen("login"));
      },
      updateCompanyProfile: (payload) => updateCompanyProfile(state, dispatch, payload),
      regenerateCompanyCode: () => regenerateCompanyCode(state, dispatch),
      updateCompanyUser: (payload) => updateCompanyUser(state, dispatch, payload),
      approveCompanyUser: (companyUserId) => approveCompanyUser(state, dispatch, companyUserId),
      rejectCompanyUser: (companyUserId) => rejectCompanyUser(state, dispatch, companyUserId),
      deleteCompanyUserAccount: (companyUserId) => deleteCompanyUserAccount(state, dispatch, companyUserId),
      addOrganizationCategory: (name) => addOrganizationCategory(state, dispatch, name),
      updateOrganizationCategory: (organizationCategoryId, name) => updateOrganizationCategory(state, dispatch, organizationCategoryId, name),
      deleteOrganizationCategory: (organizationCategoryId) => deleteOrganizationCategory(state, dispatch, organizationCategoryId),
      addDomainType: (scope, label, color) => addDomainType(state, dispatch, scope, label, color),
      updateDomainType: (scope, typeId, label, color) => updateDomainType(state, dispatch, scope, typeId, label, color),
      deleteDomainType: (scope, typeId) => deleteDomainType(state, dispatch, scope, typeId),
      addSourceFiles: (files, organizationCategoryId) => addSourceFiles(state, dispatch, files, organizationCategoryId),
      updateSourceFile: (fileId, patch) => updateSourceFile(state, dispatch, fileId, patch),
      applySourceFileToCurrentStandard: (fileId) => applySourceFileToCurrentStandard(state, dispatch, fileId),
      removeSourceFile: (fileId) => removeSourceFile(state, dispatch, fileId),
      setStructureMapView: (patch) => setStructureMapView(dispatch, patch),
      updateStructureMapNode: (nodeId, patch) => updateStructureMapNode(state, dispatch, nodeId, patch),
      updateStructureMapRelation: (relationId, patch) => updateStructureMapRelation(state, dispatch, relationId, patch),
      addStructureMapRelation: (relation) => addStructureMapRelation(state, dispatch, relation),
      deleteStructureMapRelation: (relationId) => deleteStructureMapRelation(state, dispatch, relationId),
      hideStructureMapItem: (itemId, kind) => hideStructureMapItem(dispatch, itemId, kind),
      unhideStructureMapItem: (itemId, kind) => unhideStructureMapItem(dispatch, itemId, kind),
      uploadSampleFiles: () => {
        return uploadSampleFiles(state, dispatch);
      },
      startAnalysisJob: () => {
        return startAnalysisJob(state, dispatch);
      },
      advanceAnalysisJob: () => {
        advanceAnalysisJob(dispatch);
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
