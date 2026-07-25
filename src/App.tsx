import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// 路由级代码分割：按需加载较重的页面组件
const Generate = lazy(() => import("./pages/Generate"));
const Library = lazy(() => import("./pages/Library"));
const NovelView = lazy(() => import("./pages/NovelView"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-muted-foreground text-sm">加载中...</div>
    </div>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" storageKey="theme">
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<AppLayout><Index /></AppLayout>} />
                  <Route path="/generate" element={<AppLayout><Generate /></AppLayout>} />
                  <Route path="/library" element={<AppLayout><Library /></AppLayout>} />
                  <Route path="/novel/:id" element={<AppLayout><NovelView /></AppLayout>} />
                  <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
