import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Student {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  membership_type: string | null;
  membership_status: string | null;
  notes: string | null;
}

const membershipTypes = ["drop-in", "monthly", "quarterly", "annual", "package"];
const membershipStatuses = ["active", "inactive", "expired"];

const Students = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", membership_type: "drop-in", membership_status: "active", notes: "" });

  const fetch = async () => {
    if (!user) return;
    const { data } = await supabase.from("students").select("*").eq("user_id", user.id).order("name");
    setStudents((data as Student[]) || []);
  };

  useEffect(() => { fetch(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const payload = { user_id: user.id, name: form.name, email: form.email || null, phone: form.phone || null, membership_type: form.membership_type, membership_status: form.membership_status, notes: form.notes || null };

    if (editingId) {
      const { error } = await supabase.from("students").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Student updated!");
    } else {
      const { error } = await supabase.from("students").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Student added!");
    }
    resetForm();
    fetch();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("students").delete().eq("id", id);
    toast.success("Student deleted!");
    fetch();
  };

  const handleEdit = (s: Student) => {
    setEditingId(s.id);
    setForm({ name: s.name, email: s.email || "", phone: s.phone || "", membership_type: s.membership_type || "drop-in", membership_status: s.membership_status || "active", notes: s.notes || "" });
    setOpen(true);
  };

  const resetForm = () => { setForm({ name: "", email: "", phone: "", membership_type: "drop-in", membership_status: "active", notes: "" }); setEditingId(null); setOpen(false); };

  const statusColor = (s: string | null) => {
    if (s === "active") return "bg-success/10 text-success";
    if (s === "expired") return "bg-destructive/10 text-destructive";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Students</h1>
          <p className="text-muted-foreground mt-1">Manage your student database</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Student</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">{editingId ? "Edit" : "Add"} Student</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Membership</Label>
                  <Select value={form.membership_type} onValueChange={(v) => setForm({ ...form, membership_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{membershipTypes.map((t) => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.membership_status} onValueChange={(v) => setForm({ ...form, membership_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{membershipStatuses.map((s) => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button type="submit" className="w-full">{editingId ? "Update" : "Add"} Student</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {students.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No students yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {students.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{s.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(s.membership_status)}`}>{s.membership_status}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{s.membership_type} · {s.email || s.phone || "No contact"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(s)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(s.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Students;
