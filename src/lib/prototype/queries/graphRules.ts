export const workflowSequence = ["event-order", "event-order-p08", "event-outbound", "event-delivery", "event-claim", "event-compensation"] as const;

const workflowOrder = new Map<string, number>(workflowSequence.map((eventId, index) => [eventId, index]));

export function sortEventsByWorkflowSequence<T extends { id: string }>(events: T[]): T[] {
  return [...events].sort((left, right) => (workflowOrder.get(left.id) ?? 99) - (workflowOrder.get(right.id) ?? 99));
}
