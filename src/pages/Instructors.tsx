import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Instructor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  specialization: string | null;
  compensation_type: string;
  compensation_value: number;
  is_active: boolean;
}

const Instructors = () => {
  const { user } = useAuth();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", specialization: "", compensation_type: "percentage", compensation_value: "" });

  const fetch = async () => {
    if (!user) return;
    const { data } = await supabase.from("instructors").select("*").eq("user_id", user.id).order("name");
    setInstructors((data as Instructor[]) || []);
  };

  useEffect(() => { fetch(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const payload = { user_id: user.id, name: form.name, email: form.email || null, phone: form.phone || null, specialization: form.specialization || null, compensation_type: form.compensation_type, compensation_value: parseFloat(form.compensation_value) || 0 };

    if (editingId) {
      const { error } = await supabase.from("instructors").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Instructor updated!");
    } else {
      const { error } = await supabase.from("instructors").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Instructor added!");
    }
    resetForm();
    fetch();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("instructors").delete().eq("id", id);
    toast.success("Instructor deleted!");
    fetch();
  };

  const handleEdit = (i: Instructor) => {
    setEditingId(i.id);
    setForm({ name: i.name, email: i.email || "", phone: i.phone || "", specialization: i.specialization || "", compensation_type: i.compensation_type, compensation_value: String(i.compensation_value) });
    setOpen(true);
  };

  const resetForm = () => { setForm({ name: "", email: "", phone: "", specialization: "", compensation_type: "percentage", compensation_value: "" }); setEditingId(null); setOpen(false); };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Instructors</h1>
          <p className="text-muted-foreground mt-1">Manage instructors and compensation</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Instructor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">{editingId ? "Edit" : "Add"} Instructor</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Specialization</Label><Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="e.g., Hatha, Vinyasa, Ashtanga" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Compensation Type</Label>
                  <Select value={form.compensation_type} onValueChange={(v) => setForm({ ...form, compensation_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="flat_rate">Flat Rate</SelectItem>
                      <SelectItem value="sliding_scale">Sliding Scale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Value {form.compensation_type === "percentage" ? "(%)" : "(₹)"}</Label>
                  <Input type="number" step="0.01" value={form.compensation_value} onChange={(e) => setForm({ ...form, compensation_value: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full">{editingId ? "Update" : "Add"} Instructor</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {instructors.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No instructors yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {instructors.map((i) => (
            <Card key={i.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{i.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {i.specialization || "General"} · {i.compensation_type === "percentage" ? `${i.compensation_value}%` : `₹${Number(i.compensation_value).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(i)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(i.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Instructors;
