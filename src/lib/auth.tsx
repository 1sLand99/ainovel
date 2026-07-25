import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createLocalUser, createLocalSession, LocalUser, LocalSession } from "@/lib/local-types";

interface AuthContextType {
  session: LocalSession | null;
  user: LocalUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LocalSession | null>(null);
  const [user, setUser] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 无需登录，直接使用本地用户身份
    setSession(createLocalSession());
    setUser(createLocalUser());
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

/** @deprecated 登录系统已移除，此组件仅保留为兼容层，直接渲染 children */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return <>{children}</>;
}
