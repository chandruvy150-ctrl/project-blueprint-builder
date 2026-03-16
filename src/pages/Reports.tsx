import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileText, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subQuarters, subYears } from "date-fns";
import { toast } from "sonner";

interface ClassRow { date: string; revenue: number; class_type: string; name: string; attendees: number | null; instructor_id: string | null; }
interface ExpenseRow { date: string; amount: number; category: string; description: string | null; tax_deductible: boolean | null; }
interface InstructorRow { id: string; name: string; compensation_type: string; compensation_value: number; }

const Reports = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [instructors, setInstructors] = useState<InstructorRow[]>([]);
  const [reportType, setReportType] = useState("monthly");
  const [periodCount, setPeriodCount] = useState("6");

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [c, e, i] = await Promise.all([
        supabase.from("classes").select("date,revenue,class_type,name,attendees,instructor_id").eq("user_id", user.id),
        supabase.from("expenses").select("date,amount,category,description,tax_deductible").eq("user_id", user.id),
        supabase.from("instructors").select("id,name,compensation_type,compensation_value").eq("user_id", user.id),
      ]);
      setClasses((c.data as ClassRow[]) || []);
      setExpenses((e.data as ExpenseRow[]) || []);
      setInstructors((i.data as InstructorRow[]) || []);
    };
    fetch();
  }, [user]);

  const instructorMap = useMemo(() => {
    const m: Record<string, InstructorRow> = {};
    instructors.forEach(i => m[i.id] = i);
    return m;
  }, [instructors]);

  // Generate period ranges
  const periods = useMemo(() => {
    const count = parseInt(periodCount);
    const now = new Date();
    const result: { label: string; start: Date; end: Date }[] = [];
    for (let i = count - 1; i >= 0; i--) {
      if (reportType === "monthly") {
        const m = subMonths(now, i);
        result.push({ label: format(m, "MMM yyyy"), start: startOfMonth(m), end: endOfMonth(m) });
      } else if (reportType === "quarterly") {
        const q = subQuarters(now, i);
        result.push({ label: `Q${Math.ceil((q.getMonth() + 1) / 3)} ${format(q, "yyyy")}`, start: startOfQuarter(q), end: endOfQuarter(q) });
      } else {
        const y = subYears(now, i);
        result.push({ label: format(y, "yyyy"), start: startOfYear(y), end: endOfYear(y) });
      }
    }
    return result;
  }, [reportType, periodCount]);

  const reportData = useMemo(() => periods.map(p => {
    const pClasses = classes.filter(c => isWithinInterval(parseISO(c.date), { start: p.start, end: p.end }));
    const pExpenses = expenses.filter(e => isWithinInterval(parseISO(e.date), { start: p.start, end: p.end }));
    const revenue = pClasses.reduce((s, c) => s + Number(c.revenue), 0);
    const expense = pExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const taxDed = pExpenses.filter(e => e.tax_deductible).reduce((s, e) => s + Number(e.amount), 0);
    return { period: p.label, revenue, expenses: expense, profit: revenue - expense, classes: pClasses.length, taxDeductible: taxDed };
  }), [periods, classes, expenses]);

  // Instructor payment calculations
  const instructorPayments = useMemo(() => {
    const allStart = periods[0]?.start;
    const allEnd = periods[periods.length - 1]?.end;
    if (!allStart || !allEnd) return [];

    const filtered = classes.filter(c => c.instructor_id && isWithinInterval(parseISO(c.date), { start: allStart, end: allEnd }));
    const byInstructor: Record<string, { classes: number; totalRevenue: number }> = {};

    filtered.forEach(c => {
      if (!c.instructor_id) return;
      if (!byInstructor[c.instructor_id]) byInstructor[c.instructor_id] = { classes: 0, totalRevenue: 0 };
      byInstructor[c.instructor_id].classes++;
      byInstructor[c.instructor_id].totalRevenue += Number(c.revenue);
    });

    return Object.entries(byInstructor).map(([id, data]) => {
      const inst = instructorMap[id];
      if (!inst) return null;
      let payment = 0;
      if (inst.compensation_type === "percentage") payment = data.totalRevenue * (inst.compensation_value / 100);
      else if (inst.compensation_type === "flat_rate") payment = data.classes * inst.compensation_value;
      else payment = data.totalRevenue * (inst.compensation_value / 100); // sliding scale fallback
      return { name: inst.name, classes: data.classes, revenue: data.totalRevenue, payment: Math.round(payment), type: inst.compensation_type, rate: inst.compensation_value };
    }).filter(Boolean);
  }, [classes, instructorMap, periods]);

  const exportCSV = (type: "financial" | "tax" | "payments") => {
    let csv = "";
    if (type === "financial") {
      csv = "Period,Revenue,Expenses,Profit,Classes\n" + reportData.map(r => `${r.period},${r.revenue},${r.expenses},${r.profit},${r.classes}`).join("\n");
    } else if (type === "tax") {
      csv = "Period,Total Income,Tax Deductible Expenses,Taxable Income\n" + reportData.map(r => `${r.period},${r.revenue},${r.taxDeductible},${r.revenue - r.taxDeductible}`).join("\n");
    } else {
      csv = "Instructor,Classes,Revenue Generated,Payment Due,Compensation Type,Rate\n" + instructorPayments.map(p => `${p!.name},${p!.classes},${p!.revenue},${p!.payment},${p!.type},${p!.rate}`).join("\n");
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trinetra-${type}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded!");
  };

  const tooltipStyle = { contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: 12 } };

  const totals = reportData.reduce((acc, r) => ({ revenue: acc.revenue + r.revenue, expenses: acc.expenses + r.expenses, profit: acc.profit + r.profit, classes: acc.classes + r.classes, taxDeductible: acc.taxDeductible + r.taxDeductible }), { revenue: 0, expenses: 0, profit: 0, classes: 0, taxDeductible: 0 });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground mt-1">Financial reports and analytics</p>
        </div>
        <div className="flex gap-2">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
          <Select value={periodCount} onValueChange={setPeriodCount}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 periods</SelectItem>
              <SelectItem value="6">6 periods</SelectItem>
              <SelectItem value="12">12 periods</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1"><DollarSign className="h-3 w-3" />Total Revenue</div>
            <div className="text-xl font-bold font-display text-success">₹{totals.revenue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1"><TrendingDown className="h-3 w-3" />Total Expenses</div>
            <div className="text-xl font-bold font-display text-destructive">₹{totals.expenses.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1"><TrendingUp className="h-3 w-3" />Net Profit</div>
            <div className={`text-xl font-bold font-display ${totals.profit >= 0 ? "text-success" : "text-destructive"}`}>₹{totals.profit.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1"><FileText className="h-3 w-3" />Tax Deductible</div>
            <div className="text-xl font-bold font-display text-warning">₹{totals.taxDeductible.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="financial" className="space-y-4">
        <TabsList>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="tax">Tax Report</TabsTrigger>
          <TabsTrigger value="payments">Instructor Payments</TabsTrigger>
        </TabsList>

        {/* Financial Report */}
        <TabsContent value="financial" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display">Profit & Loss</CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportCSV("financial")}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                    <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip {...tooltipStyle} formatter={(v: number) => [`₹${v.toLocaleString()}`, undefined]} />
                    <Bar dataKey="revenue" name="Revenue" fill="hsl(158, 35%, 38%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="hsl(0, 65%, 55%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Period</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Revenue</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Expenses</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Profit</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Classes</th>
                  </tr></thead>
                  <tbody>
                    {reportData.map(r => (
                      <tr key={r.period} className="border-b border-border/50">
                        <td className="py-2 font-medium">{r.period}</td>
                        <td className="py-2 text-right text-success">₹{r.revenue.toLocaleString()}</td>
                        <td className="py-2 text-right text-destructive">₹{r.expenses.toLocaleString()}</td>
                        <td className={`py-2 text-right font-medium ${r.profit >= 0 ? "text-success" : "text-destructive"}`}>₹{r.profit.toLocaleString()}</td>
                        <td className="py-2 text-right">{r.classes}</td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td className="py-2">Total</td>
                      <td className="py-2 text-right text-success">₹{totals.revenue.toLocaleString()}</td>
                      <td className="py-2 text-right text-destructive">₹{totals.expenses.toLocaleString()}</td>
                      <td className={`py-2 text-right ${totals.profit >= 0 ? "text-success" : "text-destructive"}`}>₹{totals.profit.toLocaleString()}</td>
                      <td className="py-2 text-right">{totals.classes}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tax Report */}
        <TabsContent value="tax" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display">Tax Preparation Report</CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportCSV("tax")}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Period</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Total Income</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Deductible Expenses</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Taxable Income</th>
                  </tr></thead>
                  <tbody>
                    {reportData.map(r => (
                      <tr key={r.period} className="border-b border-border/50">
                        <td className="py-2 font-medium">{r.period}</td>
                        <td className="py-2 text-right">₹{r.revenue.toLocaleString()}</td>
                        <td className="py-2 text-right text-success">₹{r.taxDeductible.toLocaleString()}</td>
                        <td className="py-2 text-right font-medium">₹{(r.revenue - r.taxDeductible).toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td className="py-2">Total</td>
                      <td className="py-2 text-right">₹{totals.revenue.toLocaleString()}</td>
                      <td className="py-2 text-right text-success">₹{totals.taxDeductible.toLocaleString()}</td>
                      <td className="py-2 text-right">₹{(totals.revenue - totals.taxDeductible).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Expense categories for tax */}
              <div className="mt-6">
                <h3 className="font-display font-semibold text-base mb-3">Deductible Expenses by Category</h3>
                <div className="space-y-2">
                  {(() => {
                    const allStart = periods[0]?.start;
                    const allEnd = periods[periods.length - 1]?.end;
                    if (!allStart || !allEnd) return null;
                    const filtered = expenses.filter(e => e.tax_deductible && isWithinInterval(parseISO(e.date), { start: allStart, end: allEnd }));
                    const cats: Record<string, number> = {};
                    filtered.forEach(e => { cats[e.category] = (cats[e.category] || 0) + Number(e.amount); });
                    return Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
                      <div key={cat} className="flex justify-between text-sm py-1 border-b border-border/30">
                        <span>{cat}</span>
                        <span className="font-medium text-success">₹{amount.toLocaleString()}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Instructor Payments */}
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display">Instructor Payment Summary</CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportCSV("payments")}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
            </CardHeader>
            <CardContent>
              {instructorPayments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No instructor payments to calculate. Assign instructors to classes first.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Instructor</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Classes</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Revenue</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Comp. Type</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Rate</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Payment Due</th>
                    </tr></thead>
                    <tbody>
                      {instructorPayments.map(p => (
                        <tr key={p!.name} className="border-b border-border/50">
                          <td className="py-2 font-medium">{p!.name}</td>
                          <td className="py-2 text-right">{p!.classes}</td>
                          <td className="py-2 text-right">₹{p!.revenue.toLocaleString()}</td>
                          <td className="py-2 text-right capitalize">{p!.type.replace("_", " ")}</td>
                          <td className="py-2 text-right">{p!.type === "percentage" ? `${p!.rate}%` : `₹${p!.rate}`}</td>
                          <td className="py-2 text-right font-bold text-accent">₹{p!.payment.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className="py-2">Total</td>
                        <td className="py-2 text-right">{instructorPayments.reduce((s, p) => s + p!.classes, 0)}</td>
                        <td className="py-2 text-right">₹{instructorPayments.reduce((s, p) => s + p!.revenue, 0).toLocaleString()}</td>
                        <td className="py-2" colSpan={2}></td>
                        <td className="py-2 text-right text-accent">₹{instructorPayments.reduce((s, p) => s + p!.payment, 0).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
