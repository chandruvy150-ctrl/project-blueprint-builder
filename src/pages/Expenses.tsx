import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const categories = ["Rent", "Utilities", "Equipment", "Marketing", "Supplies", "Insurance", "Maintenance", "Instructor Pay", "Other"];

interface Expense {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  date: string;
  is_recurring: boolean | null;
  tax_deductible: boolean | null;
}

const Expenses = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ category: "Rent", description: "", amount: "", date: "", is_recurring: false, tax_deductible: false });

  const fetchExpenses = async () => {
    if (!user) return;
    const { data } = await supabase.from("expenses").select("*").eq("user_id", user.id).order("date", { ascending: false });
    setExpenses((data as Expense[]) || []);
  };

  useEffect(() => { fetchExpenses(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const payload = { user_id: user.id, category: form.category, description: form.description || null, amount: parseFloat(form.amount), date: form.date, is_recurring: form.is_recurring, tax_deductible: form.tax_deductible };

    if (editingId) {
      const { error } = await supabase.from("expenses").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Expense updated!");
    } else {
      const { error } = await supabase.from("expenses").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Expense added!");
    }
    resetForm();
    fetchExpenses();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("expenses").delete().eq("id", id);
    toast.success("Expense deleted!");
    fetchExpenses();
  };

  const handleEdit = (e: Expense) => {
    setEditingId(e.id);
    setForm({ category: e.category, description: e.description || "", amount: String(e.amount), date: e.date, is_recurring: e.is_recurring || false, tax_deductible: e.tax_deductible || false });
    setOpen(true);
  };

  const resetForm = () => { setForm({ category: "Rent", description: "", amount: "", date: "", is_recurring: false, tax_deductible: false }); setEditingId(null); setOpen(false); };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground mt-1">Track studio expenses</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Expense</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">{editingId ? "Edit" : "Add"} Expense</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox checked={form.is_recurring} onCheckedChange={(v) => setForm({ ...form, is_recurring: !!v })} />
                  <Label className="text-sm">Recurring</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={form.tax_deductible} onCheckedChange={(v) => setForm({ ...form, tax_deductible: !!v })} />
                  <Label className="text-sm">Tax Deductible</Label>
                </div>
              </div>
              <Button type="submit" className="w-full">{editingId ? "Update" : "Add"} Expense</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {expenses.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No expenses yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {expenses.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{e.category}</h3>
                    {e.is_recurring && <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">Recurring</span>}
                    {e.tax_deductible && <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full">Tax Ded.</span>}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{e.description || "No description"} · {new Date(e.date).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display font-bold text-lg text-destructive">-₹{Number(e.amount).toLocaleString()}</span>
                  <button onClick={() => handleEdit(e)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(e.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Expenses;
