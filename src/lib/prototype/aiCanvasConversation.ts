export const AI_CANVAS_PENDING_PHASES = ["loading", "reasoning", "generating", "typing"] as const;

export type AiCanvasPendingPhase = (typeof AI_CANVAS_PENDING_PHASES)[number];

export type AiCanvasConversationTurn<TScenario, TGuide> =
  | {
      id: string;
      kind: "answer";
      question: string;
      scenario: TScenario;
      createdAtLabel: string;
    }
  | {
      id: string;
      kind: "fallback";
      question: string;
      guide: TGuide;
      createdAtLabel: string;
    }
  | {
      id: string;
      kind: "pending";
      question: string;
      createdAtLabel: string;
      phase: AiCanvasPendingPhase;
      result:
        | {
            kind: "answer";
            scenario: TScenario;
          }
        | {
            kind: "fallback";
            guide: TGuide;
          };
    }
  | {
      id: string;
      kind: "canceled";
      question: string;
      createdAtLabel: string;
    };

export type AiCanvasPendingTurn<TScenario, TGuide> = Extract<AiCanvasConversationTurn<TScenario, TGuide>, { kind: "pending" }>;

export function createAiCanvasPendingTurn<TScenario, TGuide>({
  createdAtLabel,
  id,
  question,
  result
}: {
  createdAtLabel: string;
  id: string;
  question: string;
  result: AiCanvasPendingTurn<TScenario, TGuide>["result"];
}): AiCanvasPendingTurn<TScenario, TGuide> {
  return {
    id,
    kind: "pending",
    question,
    createdAtLabel,
    phase: "loading",
    result
  };
}

export function resolveAiCanvasPendingTurn<TScenario, TGuide>(
  turn: AiCanvasPendingTurn<TScenario, TGuide>
): AiCanvasConversationTurn<TScenario, TGuide> {
  return turn.result.kind === "answer"
    ? {
        id: turn.id,
        kind: "answer",
        question: turn.question,
        createdAtLabel: turn.createdAtLabel,
        scenario: turn.result.scenario
      }
    : {
        id: turn.id,
        kind: "fallback",
        question: turn.question,
        createdAtLabel: turn.createdAtLabel,
        guide: turn.result.guide
      };
}

export function cancelAiCanvasPendingTurn<TScenario, TGuide>(
  turn: AiCanvasPendingTurn<TScenario, TGuide>
): AiCanvasConversationTurn<TScenario, TGuide> {
  return {
    id: turn.id,
    kind: "canceled",
    question: turn.question,
    createdAtLabel: turn.createdAtLabel
  };
}

export function hasPendingAiCanvasTurn<TScenario, TGuide>(
  turns: Array<AiCanvasConversationTurn<TScenario, TGuide>>
): boolean {
  return turns.some((turn) => turn.kind === "pending");
}
