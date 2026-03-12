import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Users } from "lucide-react";

const Index = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ revenue: 0, expenses: 0, students: 0, classes: 0 });

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const [classesRes, expensesRes, studentsRes] = await Promise.all([
        supabase.from("classes").select("revenue").eq("user_id", user.id),
        supabase.from("expenses").select("amount").eq("user_id", user.id),
        supabase.from("students").select("id").eq("user_id", user.id),
      ]);

      const revenue = (classesRes.data || []).reduce((sum, c) => sum + Number(c.revenue), 0);
      const expenses = (expensesRes.data || []).reduce((sum, e) => sum + Number(e.amount), 0);

      setStats({
        revenue,
        expenses,
        students: studentsRes.data?.length || 0,
        classes: classesRes.data?.length || 0,
      });
    };
    fetchStats();
  }, [user]);

  const profit = stats.revenue - stats.expenses;

  const cards = [
    { title: "Total Revenue", value: `₹${stats.revenue.toLocaleString()}`, icon: DollarSign, color: "text-success" },
    { title: "Total Expenses", value: `₹${stats.expenses.toLocaleString()}`, icon: TrendingDown, color: "text-destructive" },
    { title: "Net Profit", value: `₹${profit.toLocaleString()}`, icon: TrendingUp, color: profit >= 0 ? "text-success" : "text-destructive" },
    { title: "Total Students", value: stats.students.toString(), icon: Users, color: "text-primary" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's your studio overview.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {card.title}
              </CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold font-display">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Classes</span>
              <span className="font-medium">{stats.classes}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg Revenue/Class</span>
              <span className="font-medium">
                ₹{stats.classes > 0 ? Math.round(stats.revenue / stats.classes).toLocaleString() : 0}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Profit Margin</span>
              <span className="font-medium">
                {stats.revenue > 0 ? Math.round((profit / stats.revenue) * 100) : 0}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. Add your studio locations</p>
            <p>2. Add instructors and their compensation</p>
            <p>3. Start recording classes and revenue</p>
            <p>4. Track expenses to see your profit</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
