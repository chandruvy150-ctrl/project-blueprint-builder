import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ClassItem {
  id: string;
  name: string;
  class_type: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  capacity: number | null;
  attendees: number | null;
  revenue: number;
  instructor_id: string | null;
  location_id: string | null;
}

const classTypes = ["regular", "workshop", "private", "drop-in"];

const Classes = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", class_type: "regular", date: "", start_time: "", end_time: "", capacity: "20", attendees: "0", revenue: "0" });

  const fetchClasses = async () => {
    if (!user) return;
    const { data } = await supabase.from("classes").select("*").eq("user_id", user.id).order("date", { ascending: false });
    setClasses((data as ClassItem[]) || []);
  };

  useEffect(() => { fetchClasses(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const payload = {
      user_id: user.id,
      name: form.name,
      class_type: form.class_type,
      date: form.date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      capacity: parseInt(form.capacity) || 20,
      attendees: parseInt(form.attendees) || 0,
      revenue: parseFloat(form.revenue) || 0,
    };

    if (editingId) {
      const { error } = await supabase.from("classes").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Class updated!");
    } else {
      const { error } = await supabase.from("classes").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Class added!");
    }
    resetForm();
    fetchClasses();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Class deleted!");
    fetchClasses();
  };

  const handleEdit = (c: ClassItem) => {
    setEditingId(c.id);
    setForm({ name: c.name, class_type: c.class_type, date: c.date, start_time: c.start_time || "", end_time: c.end_time || "", capacity: String(c.capacity || 20), attendees: String(c.attendees || 0), revenue: String(c.revenue) });
    setOpen(true);
  };

  const resetForm = () => {
    setForm({ name: "", class_type: "regular", date: "", start_time: "", end_time: "", capacity: "20", attendees: "0", revenue: "0" });
    setEditingId(null);
    setOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Classes</h1>
          <p className="text-muted-foreground mt-1">Track your yoga classes and revenue</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Class</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editingId ? "Edit" : "Add"} Class</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Class Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.class_type} onValueChange={(v) => setForm({ ...form, class_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {classTypes.map((t) => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Attendees</Label>
                  <Input type="number" value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Revenue (₹)</Label>
                  <Input type="number" step="0.01" value={form.revenue} onChange={(e) => setForm({ ...form, revenue: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full">{editingId ? "Update" : "Add"} Class</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {classes.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No classes yet. Add your first class!</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {classes.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{c.name}</h3>
                    <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{c.class_type}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {new Date(c.date).toLocaleDateString()} · {c.attendees}/{c.capacity} students
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display font-bold text-lg">₹{Number(c.revenue).toLocaleString()}</span>
                  <button onClick={() => handleEdit(c)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Classes;
