import { useListResumes, getListResumesQueryKey, useGetCareerSuggestions, useGetLearningRoadmap } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Lightbulb, BookOpen, MessageSquare, FileEdit, Compass, ArrowRight, Route } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Target } from "lucide-react";

export default function SuggestionsPage() {
  const { data: resumes } = useListResumes({ query: { queryKey: getListResumesQueryKey() } });
  const suggestMutation = useGetCareerSuggestions();
  const roadmapMutation = useGetLearningRoadmap();
  
  const [selectedResume, setSelectedResume] = useState<string>("");
  const [targetRole, setTargetRole] = useState<string>("");

  const handleGenerate = () => {
    if (!selectedResume) return;
    suggestMutation.mutate({ 
      data: { 
        resumeId: parseInt(selectedResume), 
        targetRole: targetRole || undefined 
      } 
    });
  };

  const handleGenerateRoadmap = () => {
    if (!selectedResume || !targetRole) return;
    const resume = resumes?.find(r => r.id.toString() === selectedResume);
    if (!resume) return;
    
    roadmapMutation.mutate({
      data: {
        skills: resume.skills,
        targetRole: targetRole
      }
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Suggestions</h1>
        <p className="text-muted-foreground mt-1">Get personalized, data-driven career advice.</p>
      </div>

      <Card className="border-white/5 bg-card/50 backdrop-blur">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-2 flex-1 w-full">
              <Label htmlFor="resume-select">Select Baseline Resume</Label>
              <Select value={selectedResume} onValueChange={setSelectedResume}>
                <SelectTrigger id="resume-select" className="bg-muted/50">
                  <SelectValue placeholder="Select a resume..." />
                </SelectTrigger>
                <SelectContent>
                  {resumes?.map(r => (
                    <SelectItem key={r.id} value={r.id.toString()}>{r.filename}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex-1 w-full">
              <Label htmlFor="target-role">Target Role (Required for Roadmap)</Label>
              <Input 
                id="target-role" 
                placeholder="e.g. Senior Frontend Engineer" 
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="bg-muted/50"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleGenerate}
                disabled={!selectedResume || suggestMutation.isPending}
              >
                {suggestMutation.isPending ? "Generating..." : "Generate Insights"}
              </Button>
              <Button 
                variant="secondary"
                onClick={handleGenerateRoadmap}
                disabled={!selectedResume || !targetRole || roadmapMutation.isPending}
              >
                {roadmapMutation.isPending ? "Mapping..." : "Generate Roadmap"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {roadmapMutation.data && (
        <Card className="border-white/5 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5 text-primary" /> Learning Roadmap
            </CardTitle>
            <CardDescription>Estimated Time: {roadmapMutation.data.estimatedMonths} months to {roadmapMutation.data.targetRole}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              {roadmapMutation.data.phases.map((phase, index) => (
                <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-muted group-[.is-active]:bg-primary group-[.is-active]:text-primary-foreground shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                    {phase.phase}
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-lg border border-white/5 bg-card shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-lg">{phase.title}</h3>
                      <span className="text-xs font-medium text-muted-foreground px-2 py-1 bg-muted rounded-full">{phase.duration}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {phase.skills.map(skill => (
                        <span key={skill} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{skill}</span>
                      ))}
                    </div>
                    {phase.resources && phase.resources.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {phase.resources.map((res, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <ArrowRight className="h-3 w-3" /> {res}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {suggestMutation.isPending && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="col-span-2"><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
        </div>
      )}

      {suggestMutation.data && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="col-span-2 border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-primary">
                <Compass className="h-5 w-5" /> Career Guidance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-relaxed text-sm">{suggestMutation.data.careerGuidance}</p>
            </CardContent>
          </Card>

          <Card className="border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-4 w-4 text-blue-400" /> Skill Gaps & Improvements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {suggestMutation.data.skillImprovements.map((skill, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span>{skill}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-4 w-4 text-purple-400" /> Interview Prep
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {suggestMutation.data.interviewTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileEdit className="h-4 w-4 text-emerald-400" /> Resume Refinements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {suggestMutation.data.resumeTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-4 w-4 text-orange-400" /> Recommended Courses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {suggestMutation.data.courses.map((course, i) => (
                  <div key={i} className="p-3 rounded-lg border border-white/5 bg-muted/30">
                    <h4 className="font-medium text-sm">{course.title}</h4>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-muted-foreground">{course.provider} • {course.level}</span>
                      <a href={course.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                        View Course
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}