import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PROVIDER_TYPES } from "@/lib/provider-types";

export interface ProviderRecord {
  provider_type: string;
  api_key: string | null;
  is_default: boolean | null;
  name: string;
  default_model: string | null;
  enabled: boolean | null;
  api_base_url: string | null;
}

export interface ResolvedProvider {
  matchedProvider: ProviderRecord | undefined;
  effectiveProvider: string;
  currentApiKey: string;
  effectiveApiBaseUrl: string | undefined;
  effectiveActualModel: string | undefined;
  displayModelName: string;
}

/**
 * 统一加载用户模型提供商配置并解析当前生效的提供商。
 * 封装了 Generate.tsx 和 NovelView.tsx 中重复的 provider 匹配逻辑。
 */
export function useModelProviders(): ResolvedProvider {
  const { user } = useAuth();
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [defaultModel, setDefaultModel] = useState("deepseek");

  const loadProviders = useCallback(async () => {
    if (!user) return;
    const [{ data: profile }, { data: providerData }] = await Promise.all([
      supabase.from("profiles").select("default_llm_model").eq("user_id", user.id).single(),
      supabase.from("model_providers").select("provider_type, api_key, is_default, name, default_model, enabled, api_base_url").eq("user_id", user.id),
    ]);
    if (providerData) setProviders(providerData as ProviderRecord[]);
    if (profile) {
      let model = (profile as any).default_llm_model as string | null;
      if (!model && providerData && providerData.length > 0) {
        const def = providerData.find((p: any) => p.is_default && p.enabled !== false);
        const first = providerData.find((p: any) => p.enabled !== false);
        model = (def || first)?.provider_type || null;
      }
      setDefaultModel(model || "deepseek");
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadProviders();

    const onSettingsChanged = () => loadProviders();
    window.addEventListener("model-settings-changed", onSettingsChanged);

    const onVisible = () => {
      if (document.visibilityState === "visible") loadProviders();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("model-settings-changed", onSettingsChanged);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, loadProviders]);

  const resolved = useMemo<ResolvedProvider>(() => {
    const enabledProviders = providers.filter((p) => p.enabled !== false);
    const normalizedDefaultModel = defaultModel.toLowerCase();
    const hasApiKey = (provider: ProviderRecord) => Boolean(provider.api_key?.trim());

    const typeMatchedWithKey = enabledProviders.find(
      (p) => p.provider_type.toLowerCase() === normalizedDefaultModel && hasApiKey(p)
    );
    const defaultWithKey = enabledProviders.find((p) => p.is_default && hasApiKey(p));
    const firstWithKey = enabledProviders.find((p) => hasApiKey(p));
    const typeMatchedProvider = enabledProviders.find(
      (p) => p.provider_type.toLowerCase() === normalizedDefaultModel
    );
    const defaultProvider = enabledProviders.find((p) => p.is_default);

    const matchedProvider =
      typeMatchedWithKey ||
      defaultWithKey ||
      firstWithKey ||
      typeMatchedProvider ||
      defaultProvider ||
      enabledProviders[0];

    const currentApiKey = matchedProvider?.api_key?.trim() || "";
    const effectiveProvider = matchedProvider?.provider_type || defaultModel;
    const effectiveApiBaseUrl = matchedProvider?.api_base_url || undefined;
    const effectiveActualModel = matchedProvider?.default_model || undefined;
    const displayModelName =
      PROVIDER_TYPES.find((p) => p.value.toLowerCase() === effectiveProvider.toLowerCase())?.label ||
      matchedProvider?.name ||
      effectiveProvider;

    return {
      matchedProvider,
      effectiveProvider,
      currentApiKey,
      effectiveApiBaseUrl,
      effectiveActualModel,
      displayModelName,
    };
  }, [providers, defaultModel]);

  return resolved;
}
