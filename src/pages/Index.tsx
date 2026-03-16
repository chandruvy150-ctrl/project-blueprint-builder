import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, TrendingDown, Users, Calendar } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";

interface ClassRow { date: string; revenue: number; class_type: string; attendees: number | null; capacity: number | null; }
interface ExpenseRow { date: string; amount: number; category: string; tax_deductible: boolean | null; }

const CHART_COLORS = [
  "hsl(158, 35%, 38%)", "hsl(28, 70%, 62%)", "hsl(38, 90%, 55%)",
  "hsl(0, 65%, 55%)", "hsl(200, 50%, 50%)", "hsl(270, 40%, 55%)",
  "hsl(120, 30%, 45%)", "hsl(340, 50%, 55%)", "hsl(180, 40%, 45%)",
];

const Index = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [students, setStudents] = useState(0);
  const [period, setPeriod] = useState("6");

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [cRes, eRes, sRes] = await Promise.all([
        supabase.from("classes").select("date,revenue,class_type,attendees,capacity").eq("user_id", user.id),
        supabase.from("expenses").select("date,amount,category,tax_deductible").eq("user_id", user.id),
        supabase.from("students").select("id").eq("user_id", user.id),
      ]);
      setClasses((cRes.data as ClassRow[]) || []);
      setExpenses((eRes.data as ExpenseRow[]) || []);
      setStudents(sRes.data?.length || 0);
    };
    fetch();
  }, [user]);

  const months = parseInt(period);
  const now = new Date();
  const rangeStart = startOfMonth(subMonths(now, months - 1));
  const rangeEnd = endOfMonth(now);

  const filteredClasses = useMemo(() => classes.filter(c => {
    const d = parseISO(c.date);
    return isWithinInterval(d, { start: rangeStart, end: rangeEnd });
  }), [classes, rangeStart, rangeEnd]);

  const filteredExpenses = useMemo(() => expenses.filter(e => {
    const d = parseISO(e.date);
    return isWithinInterval(d, { start: rangeStart, end: rangeEnd });
  }), [expenses, rangeStart, rangeEnd]);

  const totalRevenue = filteredClasses.reduce((s, c) => s + Number(c.revenue), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const profit = totalRevenue - totalExpenses;
  const taxDeductible = filteredExpenses.filter(e => e.tax_deductible).reduce((s, e) => s + Number(e.amount), 0);

  // Monthly trend data
  const trendData = useMemo(() => {
    const map: Record<string, { month: string; revenue: number; expenses: number; profit: number }> = {};
    for (let i = 0; i < months; i++) {
      const m = subMonths(now, months - 1 - i);
      const key = format(m, "yyyy-MM");
      map[key] = { month: format(m, "MMM yy"), revenue: 0, expenses: 0, profit: 0 };
    }
    filteredClasses.forEach(c => { const k = c.date.slice(0, 7); if (map[k]) map[k].revenue += Number(c.revenue); });
    filteredExpenses.forEach(e => { const k = e.date.slice(0, 7); if (map[k]) map[k].expenses += Number(e.amount); });
    Object.values(map).forEach(m => m.profit = m.revenue - m.expenses);
    return Object.values(map);
  }, [filteredClasses, filteredExpenses, months]);

  // Expense by category
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach(e => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  // Class type breakdown
  const classTypeData = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    filteredClasses.forEach(c => {
      if (!map[c.class_type]) map[c.class_type] = { count: 0, revenue: 0 };
      map[c.class_type].count++;
      map[c.class_type].revenue += Number(c.revenue);
    });
    return Object.entries(map).map(([name, v]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), ...v }));
  }, [filteredClasses]);

  const cards = [
    { title: "Revenue", value: `₹${totalRevenue.toLocaleString()}`, icon: DollarSign, color: "text-success" },
    { title: "Expenses", value: `₹${totalExpenses.toLocaleString()}`, icon: TrendingDown, color: "text-destructive" },
    { title: "Net Profit", value: `₹${profit.toLocaleString()}`, icon: TrendingUp, color: profit >= 0 ? "text-success" : "text-destructive" },
    { title: "Students", value: students.toString(), icon: Users, color: "text-primary" },
    { title: "Classes", value: filteredClasses.length.toString(), icon: Calendar, color: "text-accent" },
    { title: "Tax Deductible", value: `₹${taxDeductible.toLocaleString()}`, icon: DollarSign, color: "text-warning" },
  ];

  const tooltipStyle = { contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: 12 } };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Your studio at a glance</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Last 3 months</SelectItem>
            <SelectItem value="6">Last 6 months</SelectItem>
            <SelectItem value="12">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {card.title}
              </CardTitle>
              <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-lg md:text-xl font-bold font-display">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue & Expense Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Revenue & Expense Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(158, 35%, 38%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(158, 35%, 38%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0, 65%, 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(0, 65%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`₹${v.toLocaleString()}`, undefined]} />
                <Legend />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(158, 35%, 38%)" fill="url(#revGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(0, 65%, 55%)" fill="url(#expGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Expense Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No expenses recorded</p>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                      {categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...tooltipStyle} formatter={(v: number) => [`₹${v.toLocaleString()}`, undefined]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Class Type Revenue */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Revenue by Class Type</CardTitle>
          </CardHeader>
          <CardContent>
            {classTypeData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No classes recorded</p>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classTypeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                    <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [name === "revenue" ? `₹${v.toLocaleString()}` : v, name === "revenue" ? "Revenue" : "Classes"]} />
                    <Bar dataKey="revenue" name="Revenue" fill="hsl(158, 35%, 38%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="count" name="Classes" fill="hsl(28, 70%, 62%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Profit Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Monthly Profit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`₹${v.toLocaleString()}`, "Profit"]} />
                <Bar dataKey="profit" name="Profit" radius={[4, 4, 0, 0]}>
                  {trendData.map((entry, i) => (
                    <Cell key={i} fill={entry.profit >= 0 ? "hsl(158, 45%, 42%)" : "hsl(0, 65%, 55%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Performance</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg Revenue/Class</span>
              <span className="font-medium">₹{filteredClasses.length > 0 ? Math.round(totalRevenue / filteredClasses.length).toLocaleString() : 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Profit Margin</span>
              <span className="font-medium">{totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg Attendance</span>
              <span className="font-medium">
                {filteredClasses.length > 0 ? Math.round(filteredClasses.reduce((s, c) => s + (c.attendees || 0), 0) / filteredClasses.length) : 0}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Capacity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Capacity</span>
              <span className="font-medium">{filteredClasses.reduce((s, c) => s + (c.capacity || 0), 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Attended</span>
              <span className="font-medium">{filteredClasses.reduce((s, c) => s + (c.attendees || 0), 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Fill Rate</span>
              <span className="font-medium">
                {(() => {
                  const cap = filteredClasses.reduce((s, c) => s + (c.capacity || 0), 0);
                  const att = filteredClasses.reduce((s, c) => s + (c.attendees || 0), 0);
                  return cap > 0 ? Math.round((att / cap) * 100) : 0;
                })()}%
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Tax Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Income</span>
              <span className="font-medium">₹{totalRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Deductible Expenses</span>
              <span className="font-medium text-success">₹{taxDeductible.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxable Income</span>
              <span className="font-medium">₹{(totalRevenue - taxDeductible).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
