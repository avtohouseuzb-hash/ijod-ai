export type EduLiveSessionMode = "guided" | "voice";
export type EduLiveSessionStatus = "active" | "paused" | "completed" | "abandoned";
export type EduLiveTurnRole = "student" | "tutor" | "system";
export type EduLiveModality = "text" | "audio" | "image" | "multimodal";

export type WhiteboardColor = `#${string}`;
export type WhiteboardShape = "circle" | "ellipse" | "rect" | "line" | "arrow" | "triangle";

type TimedCommand = {
  id: string;
  delayMs?: number;
};

export type EduWhiteboardCommand =
  | (TimedCommand & { type: "clear" })
  | (TimedCommand & { type: "title"; text: string; color?: WhiteboardColor })
  | (TimedCommand & { type: "text"; x: number; y: number; text: string; fontSize?: number; color?: WhiteboardColor })
  | (TimedCommand & { type: "shape"; shape: WhiteboardShape; x: number; y: number; width: number; height: number; stroke: WhiteboardColor; fill?: WhiteboardColor | "none"; strokeWidth?: number })
  | (TimedCommand & { type: "path"; d: string; stroke: WhiteboardColor; fill?: WhiteboardColor | "none"; strokeWidth?: number })
  | (TimedCommand & { type: "formula"; x: number; y: number; expression: string; color?: WhiteboardColor })
  | (TimedCommand & { type: "highlight"; targetId: string; color?: WhiteboardColor })
  | (TimedCommand & { type: "reveal_step"; stepId: string })
  | (TimedCommand & { type: "finish" });

export type EduLiveBoardPayload = {
  version: 1;
  width: 1000;
  height: 700;
  commands: EduWhiteboardCommand[];
};

export type EduLiveSessionSummary = {
  id: string;
  subject: string;
  grade: number;
  topic: string;
  mode: EduLiveSessionMode;
  status: EduLiveSessionStatus;
  started_at: string;
  ended_at: string | null;
};

export type EduLiveLessonTurn = {
  id: string;
  session_id: string;
  sequence: number;
  role: EduLiveTurnRole;
  modality: EduLiveModality;
  content: string;
  lesson_payload: Record<string, unknown>;
  created_at: string;
};
