import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";

interface Location {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  is_active: boolean;
}

const Locations = () => {
  const { user } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "", city: "", phone: "" });

  const fetch = async () => {
    if (!user) return;
    const { data } = await supabase.from("locations").select("*").eq("user_id", user.id).order("name");
    setLocations((data as Location[]) || []);
  };

  useEffect(() => { fetch(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const payload = { user_id: user.id, name: form.name, address: form.address || null, city: form.city || null, phone: form.phone || null };

    if (editingId) {
      const { error } = await supabase.from("locations").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Location updated!");
    } else {
      const { error } = await supabase.from("locations").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Location added!");
    }
    resetForm();
    fetch();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("locations").delete().eq("id", id);
    toast.success("Location deleted!");
    fetch();
  };

  const handleEdit = (l: Location) => {
    setEditingId(l.id);
    setForm({ name: l.name, address: l.address || "", city: l.city || "", phone: l.phone || "" });
    setOpen(true);
  };

  const resetForm = () => { setForm({ name: "", address: "", city: "", phone: "" }); setEditingId(null); setOpen(false); };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Locations</h1>
          <p className="text-muted-foreground mt-1">Manage your studio locations</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Location</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">{editingId ? "Edit" : "Add"} Location</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g., Main Studio" /></div>
              <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <Button type="submit" className="w-full">{editingId ? "Update" : "Add"} Location</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {locations.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No locations yet. Add your first studio!</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {locations.map((l) => (
            <Card key={l.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{l.name}</h3>
                    <p className="text-sm text-muted-foreground">{[l.address, l.city].filter(Boolean).join(", ") || "No address"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(l)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(l.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Locations;
