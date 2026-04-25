import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const phoneRegex = /^[+\d][\d\s\-()]{6,19}$/;

const Join = () => {
  const { ownerId } = useParams<{ ownerId: string }>();
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId) return;
    if (!form.name.trim()) { toast.error("Please enter your name"); return; }
    if (!phoneRegex.test(form.phone.trim())) { toast.error("Enter a valid phone number"); return; }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("public-register-student", {
      body: { ownerId, ...form },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || "Registration failed. Try again.");
      return;
    }
    setDone(true);
  };

  if (!ownerId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full"><CardContent className="py-10 text-center text-muted-foreground">Invalid registration link.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <Card className="w-full max-w-md shadow-xl">
        <CardContent className="p-6 sm:p-8">
          {done ? (
            <div className="text-center space-y-4 py-6 animate-fade-in">
              <CheckCircle2 className="h-14 w-14 text-success mx-auto" />
              <h1 className="font-display text-2xl font-bold">You're registered!</h1>
              <p className="text-muted-foreground">The studio will reach out to you shortly. Namaste 🙏</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-primary mb-1">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">TRINETRA Yoga</span>
              </div>
              <h1 className="font-display text-2xl font-bold">Join the studio</h1>
              <p className="text-muted-foreground text-sm mt-1 mb-6">Fill in your details and we'll be in touch about classes.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Your name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} required autoFocus />
                </div>
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input type="tel" inputMode="tel" placeholder="+91 98765 43210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} required />
                </div>
                <div className="space-y-2">
                  <Label>Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
                </div>
                <div className="space-y-2">
                  <Label>Anything we should know? <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} placeholder="Experience, preferred class times, injuries…" />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Registering…" : "Register"}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Join;
