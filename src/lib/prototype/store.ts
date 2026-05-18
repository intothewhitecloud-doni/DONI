import { initialPrototypeState } from "../domain/mock-data";
import { createEmptyWorkspaceData, projectWorkspaceData, reducer, type PrototypeAction } from "../domain/state-machine";
import type { PrototypeState } from "../domain/types";

export type { PrototypeAction };

export function createInitialState(): PrototypeState {
  const state = structuredClone(initialPrototypeState);
  const workspaceDataById = Object.fromEntries(
    state.workspaces.map((workspace) => [workspace.id, createEmptyWorkspaceData(workspace)])
  );

  return projectWorkspaceData({
    ...state,
    screen: "home",
    workspaceDataById,
    sourceFiles: [],
    analysisJobs: [],
    evidence: [],
    candidates: [],
    managedObjectTypes: [],
    workflowTypes: [],
    entities: [],
    events: [],
    relations: [],
    metricDefinitions: [],
    metricValues: [],
    workflowMetricBindings: [],
    insights: [],
    proposals: [],
    votes: [],
    decisions: [],
    verificationRecords: [],
    outcomes: [],
    auditLogs: [],
    notifications: [],
    activeInsightId: "",
    activeProposalId: "",
    selection: undefined,
    scope: undefined
  });
}

export { reducer };
