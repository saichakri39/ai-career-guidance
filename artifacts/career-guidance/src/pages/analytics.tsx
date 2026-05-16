import { useState } from "react";
import {
  useGetSkillTrends, getGetSkillTrendsQueryKey,
  useGetScoreHistory, getGetScoreHistoryQueryKey,
  useGetPredictionHistory, getGetPredictionHistoryQueryKey,
  useMlAnalyze, useGetMlHistory, getGetMlHistoryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, LineChart, Line, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell,
} from "recharts";
import { format } from "date-fns";
import { BrainCircuit, TrendingUp, Target, Layers, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DOMAIN_COLORS = [
  "hsl(var(--primary))",
  "#60a5fa",
  "#34d399",
  "#f59e0b",
  "#a78bfa",
  "#f87171",
  "#38bdf8",
];

function ScoreSlider({ label, value, onChange, description }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium">{label}</label>
        <span
          className="text-2xl font-bold tabular-nums"
          style={{ color: value >= 70 ? "hsl(var(--primary))" : value >= 50 ? "#f59e0b" : "#f87171" }}
          data-testid={`score-value-${label.toLowerCase().replace(/\s/g, "-")}`}
        >
          {value}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: "hsl(var(--primary))" }}
        data-testid={`slider-${label.toLowerCase().replace(/\s/g, "-")}`}
      />
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [commScore, setCommScore] = useState(65);
  const [codingScore, setCodingScore] = useState(72);
  const [aptitudeScore, setAptitudeScore] = useState(68);
  const [mlResult, setMlResult] = useState<ReturnType<typeof useMlAnalyze>["data"] | null>(null);

  const mlAnalyzeMutation = useMlAnalyze({
    mutation: {
      onSuccess: (data) => {
        setMlResult(data);
        queryClient.invalidateQueries({ queryKey: getGetMlHistoryQueryKey() });
        toast({ title: "Analysis complete", description: `${data.recommendedDomain} identified as your best fit domain.` });
      },
      onError: () => {
        toast({ title: "Analysis failed", description: "Please try again.", variant: "destructive" });
      },
    },
  });

  const { data: skillTrends, isLoading: isLoadingSkills } = useGetSkillTrends({
    query: { queryKey: getGetSkillTrendsQueryKey() }
  });

  const { data: scoreHistory, isLoading: isLoadingScores } = useGetScoreHistory({
    query: { queryKey: getGetScoreHistoryQueryKey() }
  });

  const { data: predictions, isLoading: isLoadingPredictions } = useGetPredictionHistory({
    query: { queryKey: getGetPredictionHistoryQueryKey() }
  });

  const { data: mlHistory } = useGetMlHistory({
    query: { queryKey: getGetMlHistoryQueryKey() }
  });

  const radarData = mlResult ? [
    { subject: "Communication", value: mlResult.communicationScore, fullMark: 100 },
    { subject: "Coding", value: mlResult.codingScore, fullMark: 100 },
    { subject: "Aptitude", value: mlResult.aptitudeScore, fullMark: 100 },
    { subject: "Performance", value: mlResult.performancePrediction, fullMark: 100 },
    { subject: "Placement Fit", value: Math.round(mlResult.placementProbability * 100), fullMark: 100 },
  ] : [];

  const handleAnalyze = () => {
    mlAnalyzeMutation.mutate({
      data: {
        communicationScore: commScore,
        codingScore: codingScore,
        aptitudeScore: aptitudeScore,
      }
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">ML-powered analysis using Linear Regression, Logistic Regression, and SVM.</p>
      </div>

      {/* ─── ML Analysis Input ─── */}
      <Card className="border-primary/20 bg-card/50 backdrop-blur" data-testid="ml-input-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><BrainCircuit className="h-5 w-5 text-primary" /></div>
            <div>
              <CardTitle>ML Score Analysis</CardTitle>
              <CardDescription>
                Enter your scores to run Linear Regression (performance), Logistic Regression (placement), and SVM (domain)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <ScoreSlider
              label="Communication Score"
              value={commScore}
              onChange={setCommScore}
              description="Verbal, written, and interpersonal skills"
            />
            <ScoreSlider
              label="Coding Score"
              value={codingScore}
              onChange={setCodingScore}
              description="Programming proficiency and problem solving"
            />
            <ScoreSlider
              label="Aptitude Score"
              value={aptitudeScore}
              onChange={setAptitudeScore}
              description="Logical reasoning, quantitative, and analytical ability"
            />
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={mlAnalyzeMutation.isPending}
            className="w-full sm:w-auto"
            data-testid="button-run-ml-analysis"
          >
            {mlAnalyzeMutation.isPending ? "Running ML Analysis..." : "Run ML Analysis"}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* ─── ML Results ─── */}
      {mlResult && (
        <div className="space-y-6" data-testid="ml-results">

          {/* Summary row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="bg-card/50 backdrop-blur border-white/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10"><TrendingUp className="h-5 w-5 text-blue-500" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Linear Regression</p>
                    <p className="text-2xl font-bold" data-testid="text-performance-score">{mlResult.performancePrediction}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
                    <p className="text-xs text-muted-foreground">Predicted Performance</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-white/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${mlResult.placementEligibility ? "bg-green-500/10" : "bg-red-500/10"}`}>
                    <Target className={`h-5 w-5 ${mlResult.placementEligibility ? "text-green-500" : "text-red-400"}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Logistic Regression</p>
                    <p className="text-2xl font-bold" data-testid="text-placement-prob">{Math.round(mlResult.placementProbability * 100)}<span className="text-sm font-normal text-muted-foreground">%</span></p>
                    <p className="text-xs text-muted-foreground">
                      {mlResult.placementEligibility
                        ? <span className="text-green-500 font-medium">Placement Eligible</span>
                        : <span className="text-red-400 font-medium">Not Yet Eligible</span>}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-white/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/10"><Layers className="h-5 w-5 text-violet-500" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">SVM Domain</p>
                    <p className="text-lg font-bold leading-tight" data-testid="text-recommended-domain">{mlResult.recommendedDomain}</p>
                    <p className="text-xs text-muted-foreground">{mlResult.domainConfidence}% confidence</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Radar + Domain bar charts side by side */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-card/50 backdrop-blur border-white/5">
              <CardHeader>
                <CardTitle className="text-base">Score Profile</CardTitle>
                <CardDescription>Your composite ML feature radar</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                      <Radar name="You" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} strokeWidth={2} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-white/5">
              <CardHeader>
                <CardTitle className="text-base">SVM Domain Scores</CardTitle>
                <CardDescription>Confidence % across all career domains</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={mlResult.allDomainScores}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} unit="%" />
                      <YAxis dataKey="domain" type="category" width={130} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <RechartsTooltip
                        formatter={(v: number) => [`${v}%`, "Confidence"]}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                      />
                      <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={18}>
                        {mlResult.allDomainScores.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? "hsl(var(--primary))" : DOMAIN_COLORS[i % DOMAIN_COLORS.length]} opacity={i === 0 ? 1 : 0.55} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Algorithm detail cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Linear Regression detail */}
            <Card className="bg-card/50 backdrop-blur border-blue-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  Linear Regression
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/40 font-mono text-xs break-all">
                  {mlResult.linearRegressionDetails.equation}
                </div>
                <div className="space-y-1.5">
                  {Object.entries(mlResult.linearRegressionDetails.coefficients).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-muted-foreground capitalize">{k === "intercept" ? "Intercept (β₀)" : `${k} (β)`}</span>
                      <span className="font-mono font-medium">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-white/5">
                  <span className="text-muted-foreground">R² Score</span>
                  <span className="font-medium text-blue-400">{mlResult.linearRegressionDetails.rSquared}</span>
                </div>
              </CardContent>
            </Card>

            {/* Logistic Regression detail */}
            <Card className="bg-card/50 backdrop-blur border-green-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Logistic Regression
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/40 font-mono text-xs break-all">
                  {mlResult.logisticRegressionDetails.equation}
                </div>
                <div className="space-y-1.5">
                  {Object.entries(mlResult.logisticRegressionDetails.weights).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-muted-foreground capitalize">{k === "intercept" ? "Intercept (w₀)" : `${k} (w)`}</span>
                      <span className="font-mono font-medium">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-white/5">
                  <span className="text-muted-foreground">Decision Boundary</span>
                  <span className="font-medium text-green-400">p ≥ {mlResult.logisticRegressionDetails.decisionBoundary}</span>
                </div>
              </CardContent>
            </Card>

            {/* SVM detail */}
            <Card className="bg-card/50 backdrop-blur border-violet-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  SVM (One-vs-Rest)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/40 font-mono text-xs">
                  score = w · x + b<br />
                  domain = argmax(score)
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Kernel</span>
                    <span className="font-mono font-medium">{mlResult.svmDetails.kernelType}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Support Vectors</span>
                    <span className="font-mono font-medium">{mlResult.svmDetails.supportVectors}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Margin Width</span>
                    <span className="font-mono font-medium">{mlResult.svmDetails.marginWidth}</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-white/5">
                  <span className="text-muted-foreground">Predicted Domain</span>
                  <span className="font-medium text-violet-400 truncate max-w-[120px] text-right">{mlResult.recommendedDomain}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Placement probability progress bar */}
          <Card className="bg-card/50 backdrop-blur border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Placement Probability Breakdown</CardTitle>
              <CardDescription>Logistic Regression sigmoid output — contribution of each feature</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Communication contribution</span>
                  <span className="font-mono text-muted-foreground">{Math.round(mlResult.communicationScore * 0.030 * 1000) / 1000}</span>
                </div>
                <Progress value={mlResult.communicationScore * 0.030 / 0.042 * 100} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Coding contribution</span>
                  <span className="font-mono text-muted-foreground">{Math.round(mlResult.codingScore * 0.042 * 1000) / 1000}</span>
                </div>
                <Progress value={mlResult.codingScore} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Aptitude contribution</span>
                  <span className="font-mono text-muted-foreground">{Math.round(mlResult.aptitudeScore * 0.033 * 1000) / 1000}</span>
                </div>
                <Progress value={mlResult.aptitudeScore * 0.033 / 0.042 * 100} className="h-2" />
              </div>
              <div className="mt-4 p-4 rounded-lg bg-muted/30 flex items-center justify-between">
                <span className="font-medium">Overall Placement Probability</span>
                <div className="flex items-center gap-3">
                  <Progress value={mlResult.placementProbability * 100} className="h-3 w-32" />
                  <Badge variant={mlResult.placementEligibility ? "default" : "destructive"}>
                    {Math.round(mlResult.placementProbability * 100)}% — {mlResult.placementEligibility ? "Eligible" : "Not Eligible"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── ML History ─── */}
      {mlHistory && mlHistory.length > 0 && (
        <Card className="bg-card/50 backdrop-blur border-white/5">
          <CardHeader>
            <CardTitle>ML Analysis History</CardTitle>
            <CardDescription>Previous score analyses and predictions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-ml-history">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Date</th>
                    <th className="text-right py-2 px-4 text-muted-foreground font-medium">Comm.</th>
                    <th className="text-right py-2 px-4 text-muted-foreground font-medium">Coding</th>
                    <th className="text-right py-2 px-4 text-muted-foreground font-medium">Aptitude</th>
                    <th className="text-right py-2 px-4 text-muted-foreground font-medium">Performance</th>
                    <th className="text-right py-2 px-4 text-muted-foreground font-medium">Placement</th>
                    <th className="text-left py-2 pl-4 text-muted-foreground font-medium">Domain (SVM)</th>
                  </tr>
                </thead>
                <tbody>
                  {[...mlHistory].reverse().map((rec) => (
                    <tr key={rec.id} className="border-b border-white/5 hover:bg-muted/20 transition-colors" data-testid={`row-ml-history-${rec.id}`}>
                      <td className="py-2.5 pr-4 text-muted-foreground">{format(new Date(rec.createdAt), "MMM d, yyyy HH:mm")}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{rec.communicationScore}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{rec.codingScore}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{rec.aptitudeScore}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-medium">{rec.performancePrediction}</td>
                      <td className="py-2.5 px-4 text-right">
                        <Badge variant={rec.placementEligibility ? "default" : "destructive"} className="text-xs">
                          {Math.round(rec.placementProbability * 100)}%
                        </Badge>
                      </td>
                      <td className="py-2.5 pl-4 text-primary text-xs font-medium">{rec.recommendedDomain}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Existing charts ─── */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-white/5 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle>Resume Skill Trends</CardTitle>
            <CardDescription>Most frequently extracted skills from your resumes</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSkills ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground">Loading...</div>
            ) : !skillTrends || skillTrends.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground">Upload a resume to see skill trends</div>
            ) : (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={skillTrends} layout="vertical" margin={{ top: 0, right: 24, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis dataKey="skill" type="category" width={110} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      cursor={{ fill: "hsl(var(--muted))" }}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle>Resume Score History</CardTitle>
            <CardDescription>Your resume scores over time</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingScores ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground">Loading...</div>
            ) : !scoreHistory || scoreHistory.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground">No score history yet</div>
            ) : (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scoreHistory} margin={{ top: 5, right: 24, left: 4, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => format(new Date(val), "MMM d")}
                    />
                    <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      labelFormatter={(val) => format(new Date(val), "MMM d, yyyy")}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                    />
                    <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--background))", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Prediction history table */}
      {!isLoadingPredictions && predictions && predictions.length > 0 && (
        <Card className="border-white/5 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle>Resume Prediction History</CardTitle>
            <CardDescription>Past AI evaluations from your uploaded resumes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {predictions.map(pred => (
                <div key={pred.id} className="p-4 rounded-lg border border-white/5 bg-muted/30 flex items-start gap-4" data-testid={`card-prediction-${pred.id}`}>
                  <div className="mt-1 bg-primary/20 p-2 rounded-full"><BrainCircuit className="h-4 w-4 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium">{pred.careerDomain}</h4>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Score: <span className="text-foreground font-medium">{pred.resumeScore}</span>
                      {" "}&middot;{" "}
                      Placement: <span className={pred.placementEligibility ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
                        {pred.placementEligibility ? "Eligible" : "Not eligible"}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(pred.createdAt), "MMM d, yyyy")}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
