import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

interface StudioContextValue {
  studioName: string;
  logoUrl: string | null;
  ownerId: string | null;
  isOwner: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  uploadLogo: (file: File) => Promise<void>;
}

const StudioContext = createContext<StudioContextValue | undefined>(undefined);

export const StudioProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [studioName, setStudioName] = useState("TRINETRA");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("owner_id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    const owner = roleRow?.owner_id || user.id;
    setOwnerId(owner);
    setIsOwner(roleRow?.role === "owner" || !roleRow);
    const { data: settings } = await supabase
      .from("studio_settings")
      .select("studio_name, logo_url")
      .eq("owner_id", owner)
      .maybeSingle();
    if (settings) {
      setStudioName(settings.studio_name || "TRINETRA");
      setLogoUrl(settings.logo_url);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [user]);

  const updateName = async (name: string) => {
    if (!ownerId || !isOwner) return;
    const trimmed = name.trim().slice(0, 60) || "TRINETRA";
    const { error } = await supabase
      .from("studio_settings")
      .upsert({ owner_id: ownerId, studio_name: trimmed, updated_at: new Date().toISOString() });
    if (!error) setStudioName(trimmed);
  };

  const uploadLogo = async (file: File) => {
    if (!ownerId || !isOwner || !user) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user.id}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("studio-logos").upload(path, file, { upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("studio-logos").getPublicUrl(path);
    const url = pub.publicUrl;
    await supabase.from("studio_settings").upsert({ owner_id: ownerId, logo_url: url, updated_at: new Date().toISOString() });
    setLogoUrl(url);
  };

  return (
    <StudioContext.Provider value={{ studioName, logoUrl, ownerId, isOwner, loading, refresh, updateName, uploadLogo }}>
      {children}
    </StudioContext.Provider>
  );
};

export const useStudio = () => {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
};
