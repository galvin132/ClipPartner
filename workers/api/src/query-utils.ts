export type PlatformValue = "douyin" | "wechat_channels";

export type ListOptions = {
  limit: number;
  offset: number;
  q?: string;
  status?: string;
  platform?: PlatformValue;
};

export type ListMeta = {
  limit: number;
  offset: number;
  count: number;
  nextOffset: number | null;
};

export function eq(column: string, value: string) {
  return `${column}=eq.${encodeURIComponent(value)}`;
}

export function inList(column: string, values: string[]) {
  return `${column}=in.(${values.map((value) => encodeURIComponent(value)).join(",")})`;
}

export function first<T>(rows: T[]) {
  return rows[0];
}

export function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const key = getKey(item);
    if (!key) return;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

export function listOptions(params: URLSearchParams): ListOptions {
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 100);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);
  const q = params.get("q")?.trim().slice(0, 80) || undefined;
  const status = params.get("status")?.trim().slice(0, 40) || undefined;
  const platformParam = params.get("platform")?.trim();
  const platform =
    platformParam === "douyin" || platformParam === "抖音"
      ? "douyin"
      : platformParam === "wechat_channels" || platformParam === "视频号"
        ? "wechat_channels"
        : undefined;

  return { limit, offset, q, status, platform };
}

export function listMeta<T>(items: T[], options: ListOptions): ListMeta {
  return {
    limit: options.limit,
    offset: options.offset,
    count: items.length,
    nextOffset: items.length === options.limit ? options.offset + options.limit : null
  };
}

export async function safeRows<T>(read: () => Promise<T[]>) {
  try {
    return await read();
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        message: "Optional Supabase table or view is unavailable",
        detail: error instanceof Error ? error.message : "Unknown error"
      })
    );
    return [] as T[];
  }
}

export async function safeList<T>(read: () => Promise<{ items: T[]; meta: ListMeta }>) {
  try {
    return await read();
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        message: "Optional list endpoint failed",
        detail: error instanceof Error ? error.message : "Unknown error"
      })
    );
    const options = listOptions(new URLSearchParams());
    return { items: [] as T[], meta: listMeta([], options) };
  }
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return new Date().toLocaleString("zh-CN", { hour12: false });
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

export function dateOnly(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

export function isUuid(value: string | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export function nextExpiry(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export function filterParam(column: string, operator: string, value: string) {
  return `${column}=${operator}.${encodeURIComponent(value)}`;
}

function rangeQuery(options: ListOptions) {
  return `limit=${options.limit}&offset=${options.offset}`;
}

export function searchQuery(columns: string[], value: string | undefined) {
  if (!value) return undefined;
  const safeValue = value.replace(/[*,()]/g, " ").replace(/\s+/g, " ").trim();
  if (!safeValue) return undefined;

  return `or=${encodeURIComponent(`(${columns.map((column) => `${column}.ilike.*${safeValue}*`).join(",")})`)}`;
}

export function buildListQuery(select: string, order: string, options: ListOptions, filters: Array<string | undefined>) {
  return [select, order, rangeQuery(options), ...filters].filter(Boolean).join("&");
}
