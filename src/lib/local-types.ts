/**
 * 本地单机模式的类型定义。
 * 用于替代 `as any` 强制转换，为 local mode 下的 user/session 提供类型安全。
 */

export interface LocalUser {
  id: string;
  aud: string;
  role: string;
  email: string;
  created_at: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
}

export interface LocalSession {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  user: LocalUser;
}

export const LOCAL_USER_ID = "local-user-id";
export const LOCAL_USER_EMAIL = "local-user@ainovel.local";
export const LOCAL_BYPASS_TOKEN = "local-bypass-token";

export function createLocalUser(): LocalUser {
  return {
    id: LOCAL_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: LOCAL_USER_EMAIL,
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
  };
}

export function createLocalSession(): LocalSession {
  return {
    access_token: LOCAL_BYPASS_TOKEN,
    token_type: "bearer",
    expires_in: 3600,
    refresh_token: "local-bypass-refresh",
    user: createLocalUser(),
  };
}

export function isLocalMode(): boolean {
  // 登录系统已移除，始终使用本地模式
  return true;
}
