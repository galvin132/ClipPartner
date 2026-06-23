export type RuntimeMode = "mock" | "hybrid" | "real";

export function parseRuntimeMode(value: unknown): RuntimeMode {
  return value === "hybrid" || value === "real" || value === "mock" ? value : "mock";
}

export function getRuntimeMode(env: Record<string, unknown> = process.env): RuntimeMode {
  return parseRuntimeMode(env.NEXT_PUBLIC_RUNTIME_MODE);
}
