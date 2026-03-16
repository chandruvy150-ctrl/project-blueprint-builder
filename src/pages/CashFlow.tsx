import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";

interface ClassRow { date: string; revenue: number; }
interface ExpenseRow { date: string; amount: number; is_recurring: boolean | null; }

const CashFlow = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [c, e] = await Promise.all([
        supabase.from("classes").select("date,revenue").eq("user_id", user.id),
        supabase.from("expenses").select("date,amount,is_recurring").eq("user_id", user.id),
      ]);
      setClasses((c.data as ClassRow[]) || []);
      setExpenses((e.data as ExpenseRow[]) || []);
    };
    fetch();
  }, [user]);

  // Historical + forecast data (6 past + 3 forecast)
  const chartData = useMemo(() => {
    const now = new Date();
    const data: { month: string; actual?: number; forecast?: number; type: string }[] = [];

    // Calculate monthly averages from last 6 months
    let totalMonthlyRevenue = 0;
    let totalMonthlyExpenses = 0;
    const recurringExpenses = expenses.filter(e => e.is_recurring).reduce((s, e) => s + Number(e.amount), 0);

    for (let i = 5; i >= 0; i--) {
      const m = subMonths(now, i);
      const start = startOfMonth(m);
      const end = endOfMonth(m);
      const rev = classes.filter(c => isWithinInterval(parseISO(c.date), { start, end })).reduce((s, c) => s + Number(c.revenue), 0);
      const exp = expenses.filter(e => isWithinInterval(parseISO(e.date), { start, end })).reduce((s, e) => s + Number(e.amount), 0);
      const net = rev - exp;
      totalMonthlyRevenue += rev;
      totalMonthlyExpenses += exp;
      data.push({ month: format(m, "MMM yy"), actual: net, type: "actual" });
    }

    const avgRevenue = totalMonthlyRevenue / 6;
    const avgExpenses = totalMonthlyExpenses / 6;

    // Forecast next 3 months
    for (let i = 1; i <= 3; i++) {
      const m = addMonths(now, i);
      const forecast = Math.round(avgRevenue - avgExpenses);
      data.push({ month: format(m, "MMM yy"), forecast, type: "forecast" });
    }

    return { data, avgRevenue, avgExpenses, recurringExpenses };
  }, [classes, expenses]);

  const tooltipStyle = { contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: 12 } };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Cash Flow</h1>
        <p className="text-muted-foreground mt-1">Track and forecast your cash flow</p>
      </div>

      {/* Forecast Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1">
              <TrendingUp className="h-3 w-3" />Avg Monthly Revenue
            </div>
            <div className="text-xl font-bold font-display text-success">₹{Math.round(chartData.avgRevenue).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1">
              <TrendingDown className="h-3 w-3" />Avg Monthly Expenses
            </div>
            <div className="text-xl font-bold font-display text-destructive">₹{Math.round(chartData.avgExpenses).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1">
              <ArrowRight className="h-3 w-3" />Forecasted Monthly Net
            </div>
            <div className={`text-xl font-bold font-display ${chartData.avgRevenue - chartData.avgExpenses >= 0 ? "text-success" : "text-destructive"}`}>
              ₹{Math.round(chartData.avgRevenue - chartData.avgExpenses).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Cash Flow Trend & Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.data}>
                <defs>
                  <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(158, 35%, 38%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(158, 35%, 38%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(28, 70%, 62%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(28, 70%, 62%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [`₹${v.toLocaleString()}`, name === "actual" ? "Actual" : "Forecast"]} />
                <Area type="monotone" dataKey="actual" name="Actual" stroke="hsl(158, 35%, 38%)" fill="url(#actualGrad)" strokeWidth={2} connectNulls={false} />
                <Area type="monotone" dataKey="forecast" name="Forecast" stroke="hsl(28, 70%, 62%)" fill="url(#forecastGrad)" strokeWidth={2} strokeDasharray="5 5" connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-primary rounded" />
              <span>Actual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-accent rounded" style={{ borderTop: "2px dashed" }} />
              <span>Forecast (based on 6-month avg)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recurring Expenses */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Recurring Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.filter(e => e.is_recurring).length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No recurring expenses. Mark expenses as recurring to improve forecasts.</p>
          ) : (
            <div className="space-y-2">
              {(() => {
                const recurring = expenses.filter(e => e.is_recurring);
                const cats: Record<string, number> = {};
                recurring.forEach(e => { cats["Recurring"] = (cats["Recurring"] || 0) + Number(e.amount); });
                return (
                  <div className="flex justify-between text-sm py-1">
                    <span className="text-muted-foreground">Total Recurring</span>
                    <span className="font-bold text-destructive">₹{chartData.recurringExpenses.toLocaleString()}</span>
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CashFlow;
