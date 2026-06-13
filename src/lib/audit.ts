import { supabase } from "@/integrations/supabase/client";

const deviceLabel = () => {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  const platform = (navigator as any).platform || "";
  return `${platform} • ${ua.slice(0, 120)}`;
};

export const logAudit = async (
  ownerId: string | null | undefined,
  action: string,
  details: Record<string, any> = {},
  entity?: { type?: string; id?: string },
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !ownerId) return;
    await supabase.from("payment_audit_logs" as any).insert({
      owner_id: ownerId,
      user_id: user.id,
      action,
      entity_type: entity?.type ?? null,
      entity_id: entity?.id ?? null,
      details,
      device: deviceLabel(),
    } as any);
  } catch {
    // best-effort; never block UX on logging failures
  }
};
