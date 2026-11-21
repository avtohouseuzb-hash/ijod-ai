import type { EduLiveBoardPayload, EduWhiteboardCommand, WhiteboardColor } from "./types";

const MAX_COMMANDS = 150;
const MAX_TEXT_LENGTH = 600;
const MAX_DELAY_MS = 8_000;
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 700;
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const PATH_PATTERN = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+\-]+$/;

export type WhiteboardValidationResult =
  | { ok: true; payload: EduLiveBoardPayload }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown, max = MAX_TEXT_LENGTH): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[<>\u0000-\u0008]/.test(value);
}

function isColor(value: unknown): value is WhiteboardColor {
  return typeof value === "string" && COLOR_PATTERN.test(value);
}

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function optionalDelay(value: unknown): value is number | undefined {
  return value === undefined || isNumberInRange(value, 0, MAX_DELAY_MS);
}

function validBase(command: Record<string, unknown>): boolean {
  return typeof command.id === "string" && ID_PATTERN.test(command.id) && optionalDelay(command.delayMs);
}

function validateCommand(value: unknown): EduWhiteboardCommand | null {
  if (!isRecord(value) || !validBase(value) || typeof value.type !== "string") return null;
  const base = { id: value.id as string, ...(value.delayMs === undefined ? {} : { delayMs: value.delayMs as number }) };

  switch (value.type) {
    case "clear":
    case "finish":
      return { ...base, type: value.type };

    case "title":
      if (!isText(value.text, 100) || (value.color !== undefined && !isColor(value.color))) return null;
      return { ...base, type: "title", text: value.text.trim(), ...(value.color ? { color: value.color } : {}) };

    case "text":
      if (!isNumberInRange(value.x, 0, CANVAS_WIDTH) ||
          !isNumberInRange(value.y, 0, CANVAS_HEIGHT) ||
          !isText(value.text) ||
          (value.fontSize !== undefined && !isNumberInRange(value.fontSize, 10, 56)) ||
          (value.color !== undefined && !isColor(value.color))) return null;
      return {
        ...base, type: "text", x: value.x, y: value.y, text: value.text.trim(),
        ...(value.fontSize === undefined ? {} : { fontSize: value.fontSize as number }),
        ...(value.color ? { color: value.color } : {}),
      };

    case "shape": {
      const shapes = ["circle", "ellipse", "rect", "line", "arrow", "triangle"];
      if (!shapes.includes(String(value.shape)) ||
          !isNumberInRange(value.x, 0, CANVAS_WIDTH) ||
          !isNumberInRange(value.y, 0, CANVAS_HEIGHT) ||
          !isNumberInRange(value.width, 0, CANVAS_WIDTH) ||
          !isNumberInRange(value.height, 0, CANVAS_HEIGHT) ||
          !isColor(value.stroke) ||
          (value.fill !== undefined && value.fill !== "none" && !isColor(value.fill)) ||
          (value.strokeWidth !== undefined && !isNumberInRange(value.strokeWidth, 1, 16))) return null;
      if (value.x + value.width > CANVAS_WIDTH || value.y + value.height > CANVAS_HEIGHT) return null;
      return {
        ...base, type: "shape", shape: value.shape as "circle" | "ellipse" | "rect" | "line" | "arrow" | "triangle",
        x: value.x, y: value.y, width: value.width, height: value.height, stroke: value.stroke,
        ...(value.fill === undefined ? {} : { fill: value.fill as WhiteboardColor | "none" }),
        ...(value.strokeWidth === undefined ? {} : { strokeWidth: value.strokeWidth as number }),
      };
    }

    case "path":
      if (typeof value.d !== "string" || value.d.length > 1200 || !PATH_PATTERN.test(value.d) ||
          !/[Mm]/.test(value.d) || !isColor(value.stroke) ||
          (value.fill !== undefined && value.fill !== "none" && !isColor(value.fill)) ||
          (value.strokeWidth !== undefined && !isNumberInRange(value.strokeWidth, 1, 16))) return null;
      return {
        ...base, type: "path", d: value.d, stroke: value.stroke,
        ...(value.fill === undefined ? {} : { fill: value.fill as WhiteboardColor | "none" }),
        ...(value.strokeWidth === undefined ? {} : { strokeWidth: value.strokeWidth as number }),
      };

    case "formula":
      if (!isNumberInRange(value.x, 0, CANVAS_WIDTH) ||
          !isNumberInRange(value.y, 0, CANVAS_HEIGHT) ||
          !isText(value.expression, 400) ||
          (value.color !== undefined && !isColor(value.color))) return null;
      return { ...base, type: "formula", x: value.x, y: value.y, expression: value.expression.trim(), ...(value.color ? { color: value.color } : {}) };

    case "highlight":
      if (typeof value.targetId !== "string" || !ID_PATTERN.test(value.targetId) ||
          (value.color !== undefined && !isColor(value.color))) return null;
      return { ...base, type: "highlight", targetId: value.targetId, ...(value.color ? { color: value.color } : {}) };

    case "reveal_step":
      if (typeof value.stepId !== "string" || !ID_PATTERN.test(value.stepId)) return null;
      return { ...base, type: "reveal_step", stepId: value.stepId };

    default:
      return null;
  }
}

export function validateWhiteboardPayload(value: unknown): WhiteboardValidationResult {
  if (!isRecord(value) || value.version !== 1 || value.width !== CANVAS_WIDTH || value.height !== CANVAS_HEIGHT || !Array.isArray(value.commands)) {
    return { ok: false, error: "Doska ma’lumoti noto‘g‘ri formatda." };
  }
  if (value.commands.length > MAX_COMMANDS) {
    return { ok: false, error: "Bitta doska uchun buyruqlar soni belgilangan chegaradan oshdi." };
  }

  const commands: EduWhiteboardCommand[] = [];
  for (const rawCommand of value.commands) {
    const command = validateCommand(rawCommand);
    if (!command) return { ok: false, error: "Doska buyruqlaridan biri xavfsiz yoki to‘g‘ri formatda emas." };
    commands.push(command);
  }
  return { ok: true, payload: { version: 1, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, commands } };
}
