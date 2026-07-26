import { createLocalSession } from '@/lib/local-types';

// 本地单机数据库 Fluent API 模拟实现
//
// 对外保持与 supabase-js 一致的 { data, error } 契约：调用方的
// `if (error) ...` 分支必须真的会被触发，否则写入失败（最常见的是
// localStorage 配额溢出）会被静默吞掉，界面还提示「保存成功」。

export interface LocalDbError {
  message: string;
  code: string;
}

export interface LocalDbResult<T = any> {
  data: T | null;
  error: LocalDbError | null;
}

const tableKey = (table: string) => `local_db_${table}`;

const toError = (e: unknown, fallback: string, code: string): LocalDbError => {
  if (e instanceof Error) {
    // 配额溢出在各浏览器下的 name 不一致，统一给出可操作的提示
    if (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED") {
      return {
        message: "本地存储空间已满，无法保存。请先在书库中导出并删除部分小说以释放空间。",
        code: "storage_quota_exceeded",
      };
    }
    return { message: e.message || fallback, code };
  }
  return { message: fallback, code };
};

/** 读取整张表；解析失败时返回错误而不是抛出 */
function readTable(table: string): { rows: any[]; error: LocalDbError | null } {
  try {
    const raw = localStorage.getItem(tableKey(table));
    if (!raw) return { rows: [], error: null };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { rows: [], error: { message: `本地数据表 ${table} 结构已损坏`, code: "corrupt_table" } };
    }
    return { rows: parsed, error: null };
  } catch (e) {
    return { rows: [], error: toError(e, `读取本地数据表 ${table} 失败`, "read_failed") };
  }
}

/** 写入整张表；配额溢出等失败会作为 error 返回 */
function writeTable(table: string, rows: any[]): LocalDbError | null {
  try {
    localStorage.setItem(tableKey(table), JSON.stringify(rows));
    return null;
  } catch (e) {
    return toError(e, `写入本地数据表 ${table} 失败`, "write_failed");
  }
}

const newId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;

const DEFAULT_ROWS: Record<string, any[]> = {
  model_providers: [
    {
      id: "mp-deepseek",
      user_id: "local-user-id",
      provider_type: "deepseek",
      name: "DeepSeek",
      default_model: "deepseek-chat",
      api_base_url: "https://api.deepseek.com/v1",
      enabled: true,
      is_default: true,
      api_key: "",
    },
    {
      id: "mp-claude",
      user_id: "local-user-id",
      provider_type: "claude",
      name: "Claude",
      default_model: "claude-3-5-sonnet-20241022",
      api_base_url: "https://api.anthropic.com/v1",
      enabled: true,
      is_default: false,
      api_key: "",
    },
    {
      id: "mp-grok",
      user_id: "local-user-id",
      provider_type: "grok",
      name: "Grok",
      default_model: "grok-3",
      api_base_url: "https://api.x.ai/v1",
      enabled: true,
      is_default: false,
      api_key: "",
    },
    {
      id: "mp-qwen",
      user_id: "local-user-id",
      provider_type: "qwen",
      name: "通义千问 (Qwen)",
      default_model: "qwen-plus",
      api_base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      enabled: true,
      is_default: false,
      api_key: "",
    },
  ],
  profiles: [
    {
      id: "prof-local",
      user_id: "local-user-id",
      default_llm_model: "deepseek",
      nsfw_enabled: false,
    },
  ],
};

/** 已完成初始化的表，避免每次 from() 都重复读写 localStorage */
const initializedTables = new Set<string>();

function ensureDefaultData(table: string) {
  if (initializedTables.has(table)) return;
  initializedTables.add(table);
  try {
    if (localStorage.getItem(tableKey(table)) === null) {
      writeTable(table, DEFAULT_ROWS[table] ?? []);
    }
  } catch {
    // localStorage 完全不可用（隐私模式等），后续查询会给出具体错误
  }
}

class LocalQueryBuilder implements PromiseLike<LocalDbResult> {
  private table: string;
  private filters: Array<{ column: string; value: any }> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private isSingle = false;
  private limitCount: number | null = null;
  private action: () => Promise<LocalDbResult>;

  constructor(table: string) {
    this.table = table;
    ensureDefaultData(table);
    this.action = () => this.runSelect();
  }

  private matches(item: any) {
    return this.filters.every((f) => item[f.column] === f.value);
  }

  private async runSelect(): Promise<LocalDbResult> {
    const { rows, error } = readTable(this.table);
    if (error) return { data: null, error };

    let data = rows.filter((item) => this.matches(item));

    if (this.orderCol) {
      const col = this.orderCol;
      data.sort((a: any, b: any) => {
        const valA = a[col];
        const valB = b[col];
        if (valA < valB) return this.orderAsc ? -1 : 1;
        if (valA > valB) return this.orderAsc ? 1 : -1;
        return 0;
      });
    }

    if (this.limitCount !== null) {
      data = data.slice(0, this.limitCount);
    }

    if (this.isSingle) {
      return { data: data[0] ?? null, error: null };
    }
    return { data, error: null };
  }

  select(_fields?: string) {
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCol = column;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  limit(num: number) {
    this.limitCount = num;
    return this;
  }

  insert(values: any) {
    this.action = async () => {
      const { rows, error } = readTable(this.table);
      if (error) return { data: null, error };

      const rowsToInsert = Array.isArray(values) ? values : [values];
      const inserted = rowsToInsert.map((row) => ({
        id: newId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...row,
      }));

      const writeError = writeTable(this.table, [...rows, ...inserted]);
      if (writeError) return { data: null, error: writeError };

      return { data: Array.isArray(values) ? inserted : inserted[0], error: null };
    };
    return this;
  }

  update(values: any) {
    this.action = async () => {
      const { rows, error } = readTable(this.table);
      if (error) return { data: null, error };

      let lastUpdated: any = null;
      const next = rows.map((item: any) => {
        if (!this.matches(item)) return item;
        const newItem = { ...item, ...values, updated_at: new Date().toISOString() };
        lastUpdated = newItem;
        return newItem;
      });

      const writeError = writeTable(this.table, next);
      if (writeError) return { data: null, error: writeError };

      return { data: this.isSingle ? lastUpdated : next, error: null };
    };
    return this;
  }

  delete() {
    this.action = async () => {
      // 没有任何过滤条件时 every() 恒为 true，会清空整张表。
      // 这在真实 supabase 中也是要显式绕过的危险操作，这里直接拒绝。
      if (this.filters.length === 0) {
        return {
          data: null,
          error: { message: "delete() 必须搭配至少一个 eq() 过滤条件", code: "unfiltered_delete" },
        };
      }

      const { rows, error } = readTable(this.table);
      if (error) return { data: null, error };

      const remaining = rows.filter((item: any) => !this.matches(item));
      const writeError = writeTable(this.table, remaining);
      if (writeError) return { data: null, error: writeError };

      return { data: null, error: null };
    };
    return this;
  }

  then<TResult1 = LocalDbResult, TResult2 = never>(
    onfulfilled?: ((value: LocalDbResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.action().then(onfulfilled, onrejected);
  }

  catch(onrejected?: (reason: any) => any) {
    return this.action().catch(onrejected);
  }

  finally(onfinally?: () => void) {
    return this.action().finally(onfinally);
  }
}

// 本地数据库 Fluent API 代理对象
export const supabase = {
  from(table: string) {
    return new LocalQueryBuilder(table) as any;
  },
  get auth() {
    const localSession = createLocalSession();
    return {
      getSession: async () => ({ data: { session: localSession }, error: null }),
      onAuthStateChange: (callback: any) => {
        setTimeout(() => callback("SIGNED_IN", localSession), 0);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    } as any;
  },
};
