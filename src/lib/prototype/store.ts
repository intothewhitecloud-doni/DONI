import { initialPrototypeState } from "../domain/mock-data";
import { reducer, type PrototypeAction } from "../domain/state-machine";
import type { PrototypeState } from "../domain/types";

export type { PrototypeAction };

export function createInitialState(): PrototypeState {
  return {
    ...structuredClone(initialPrototypeState),
    screen: "home",
    structureMapView: structuredClone(initialPrototypeState.structureMapView),
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
  };
}

export { reducer };
