import { useGetSkillTrends, getGetSkillTrendsQueryKey, useGetScoreHistory, getGetScoreHistoryQueryKey, useGetPredictionHistory, getGetPredictionHistoryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, LineChart, Line } from "recharts";
import { format } from "date-fns";
import { BrainCircuit } from "lucide-react";

export default function AnalyticsPage() {
  const { data: skillTrends, isLoading: isLoadingSkills } = useGetSkillTrends({
    query: { queryKey: getGetSkillTrendsQueryKey() }
  });
  
  const { data: scoreHistory, isLoading: isLoadingScores } = useGetScoreHistory({
    query: { queryKey: getGetScoreHistoryQueryKey() }
  });

  const { data: predictions, isLoading: isLoadingPredictions } = useGetPredictionHistory({
    query: { queryKey: getGetPredictionHistoryQueryKey() }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Deep dive into your career data.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-white/5 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle>Skill Trends</CardTitle>
            <CardDescription>Most frequently extracted skills from your resumes</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSkills ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading...</div>
            ) : !skillTrends || skillTrends.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">No skill data available</div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={skillTrends} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis dataKey="skill" type="category" width={100} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <RechartsTooltip 
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--primary))' }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle>Score History</CardTitle>
            <CardDescription>Your resume scores over time</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingScores ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading...</div>
            ) : !scoreHistory || scoreHistory.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">No score history available</div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scoreHistory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(val) => format(new Date(val), 'MMM d')}
                    />
                    <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <RechartsTooltip 
                      labelFormatter={(val) => format(new Date(val), 'MMM d, yyyy')}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--primary))' }}
                    />
                    <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--background))', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card className="border-white/5 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Prediction History</CardTitle>
          <CardDescription>Past AI evaluations of your career trajectory</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPredictions ? (
            <div className="py-8 text-center text-muted-foreground">Loading predictions...</div>
          ) : !predictions || predictions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No prediction history available.</div>
          ) : (
            <div className="space-y-4">
              {predictions.map(pred => (
                <div key={pred.id} className="p-4 rounded-lg border border-white/5 bg-muted/30 flex items-start gap-4">
                  <div className="mt-1 bg-primary/20 p-2 rounded-full"><BrainCircuit className="h-4 w-4 text-primary" /></div>
                  <div>
                    <h4 className="font-medium">Domain: {pred.careerDomain}</h4>
                    <p className="text-sm text-muted-foreground mt-1">Score: {pred.resumeScore} | Probability: {pred.placementProbability}%</p>
                    <p className="text-xs text-muted-foreground mt-2">{format(new Date(pred.createdAt), 'MMM d, yyyy')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}