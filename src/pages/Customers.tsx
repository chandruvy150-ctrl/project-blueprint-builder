import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Copy, QrCode, Users, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
}

interface Batch {
  id: string;
  name: string;
  token: string;
  is_open: boolean;
  registrations_count: number;
  created_at: string;
}

const phoneRegex = /^[+\d][\d\s\-()]{6,19}$/;

const Customers = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", notes: "" });

  const [batches, setBatches] = useState<Batch[]>([]);
  const [newBatchOpen, setNewBatchOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [batchQr, setBatchQr] = useState<Batch | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const joinUrl = user ? `${window.location.origin}/join/${user.id}` : "";

  const fetchAll = async () => {
    if (!user) return;
    const { data } = await supabase.from("students").select("*").eq("user_id", user.id).order("name");
    setCustomers((data as Customer[]) || []);
  };
  const fetchBatches = async () => {
    if (!user) return;
    const { data } = await supabase.from("registration_batches").select("*").order("created_at", { ascending: false });
    setBatches((data as Batch[]) || []);
  };
  useEffect(() => { fetchAll(); fetchBatches(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (form.phone && !phoneRegex.test(form.phone.trim())) { toast.error("Enter a valid phone"); return; }
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editingId) {
      const { error } = await supabase.from("students").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Customer updated");
    } else {
      const { error } = await supabase.from("students").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Customer added");
    }
    resetForm(); fetchAll();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("students").delete().eq("id", id);
    toast.success("Customer removed"); fetchAll();
  };

  const handleEdit = (c: Customer) => {
    setEditingId(c.id);
    setForm({ name: c.name, email: c.email || "", phone: c.phone || "", address: c.address || "", notes: c.notes || "" });
    setOpen(true);
  };

  const resetForm = () => {
    setForm({ name: "", email: "", phone: "", address: "", notes: "" });
    setEditingId(null); setOpen(false);
  };

  // Batch
  const createBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const name = newBatchName.trim();
    if (!name) { toast.error("Name required"); return; }
    const { data, error } = await supabase.from("registration_batches").insert({ owner_id: user.id, name }).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success("Batch QR ready"); setNewBatchName(""); setNewBatchOpen(false);
    setBatchQr(data as Batch); fetchBatches();
  };
  const toggleBatch = async (b: Batch) => {
    await supabase.from("registration_batches").update({ is_open: !b.is_open, closed_at: b.is_open ? new Date().toISOString() : null }).eq("id", b.id);
    toast.success(b.is_open ? "Closed" : "Reopened"); fetchBatches();
  };
  const deleteBatch = async (id: string) => {
    await supabase.from("registration_batches").delete().eq("id", id);
    toast.success("Deleted"); fetchBatches();
  };
  const batchUrl = (token: string) => `${window.location.origin}/b/${token}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Customers</h1>
          <p className="text-muted-foreground mt-1">Your student database — name, phone, email, address</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setQrOpen(true)}><QrCode className="h-4 w-4 mr-2" />Public Link</Button>
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Customer</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">{editingId ? "Edit" : "Add"} Customer</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} /></div>
                </div>
                <div className="space-y-2"><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={300} rows={2} /></div>
                <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} /></div>
                <Button type="submit" className="w-full">{editingId ? "Update" : "Add"} Customer</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Batch QR card */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-primary flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Batch Sign-Up</p>
              <h2 className="font-display text-xl font-semibold mt-1">One QR per batch</h2>
              <p className="text-sm text-muted-foreground mt-1">Customers scan and fill name, phone, email, address themselves.</p>
            </div>
            <Dialog open={newBatchOpen} onOpenChange={setNewBatchOpen}>
              <DialogTrigger asChild><Button><QrCode className="h-4 w-4 mr-2" />New Batch QR</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">Create batch</DialogTitle>
                  <DialogDescription>Name the batch so you can find it later.</DialogDescription>
                </DialogHeader>
                <form onSubmit={createBatch} className="space-y-4">
                  <div className="space-y-2"><Label>Batch name</Label><Input autoFocus value={newBatchName} onChange={(e) => setNewBatchName(e.target.value)} maxLength={80} required /></div>
                  <Button type="submit" className="w-full">Generate QR</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No batches yet.</p>
          ) : (
            <div className="grid gap-2">
              {batches.map((b) => (
                <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border border-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{b.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${b.is_open ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{b.is_open ? "Open" : "Closed"}</span>
                      <span className="text-xs text-muted-foreground">{b.registrations_count} registered</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{batchUrl(b.token)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setBatchQr(b)} aria-label="QR" className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10"><QrCode className="h-4 w-4" /></button>
                    <button onClick={() => { navigator.clipboard.writeText(batchUrl(b.token)); toast.success("Copied"); }} aria-label="Copy" className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><Copy className="h-4 w-4" /></button>
                    <button onClick={() => toggleBatch(b)} aria-label="Toggle" className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted">{b.is_open ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}</button>
                    <button onClick={() => deleteBatch(b.id)} aria-label="Delete" className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {customers.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No customers yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {customers.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between p-4 gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{c.name}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {c.phone || "—"}{c.email ? ` · ${c.email}` : ""}
                  </p>
                  {c.address && <p className="text-xs text-muted-foreground truncate mt-0.5">{c.address}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleEdit(c)} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(c.id)} className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Public Link QR */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Public sign-up link</DialogTitle>
            <DialogDescription>Anyone with this link can register their details.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {joinUrl && <div className="p-4 bg-background rounded-lg border"><QRCodeSVG value={joinUrl} size={200} /></div>}
            <p className="text-xs text-muted-foreground break-all text-center">{joinUrl}</p>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(joinUrl); toast.success("Copied"); }}><Copy className="h-4 w-4 mr-2" />Copy Link</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch QR view */}
      <Dialog open={!!batchQr} onOpenChange={(v) => !v && setBatchQr(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{batchQr?.name}</DialogTitle>
            <DialogDescription>Show or share this QR with the batch.</DialogDescription>
          </DialogHeader>
          {batchQr && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="p-4 bg-background rounded-lg border"><QRCodeSVG value={batchUrl(batchQr.token)} size={220} /></div>
              <p className="text-xs text-muted-foreground break-all text-center">{batchUrl(batchQr.token)}</p>
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(batchUrl(batchQr.token)); toast.success("Copied"); }}><Copy className="h-4 w-4 mr-2" />Copy Link</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
