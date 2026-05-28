import { useListResumes, getListResumesQueryKey, useUploadResume, useScoreResume } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useRef } from "react";
import { FileUp, FileText, CheckCircle2, AlertCircle, RefreshCw, TrendingUp, Wrench, Star } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function getStrengths(skills: string[], score: number): string[] {
  const strengths: string[] = [];
  if (skills.length >= 8) strengths.push("Strong technical skill set with broad coverage");
  if (skills.includes("Git")) strengths.push("Version control experience with Git");
  if (skills.some(s => ["React", "Vue", "Angular"].includes(s))) strengths.push("Modern frontend framework knowledge");
  if (skills.some(s => ["Node.js", "Express", "Django", "FastAPI", "Flask", "Spring"].includes(s))) strengths.push("Backend development experience");
  if (skills.some(s => ["Docker", "Kubernetes", "AWS", "Azure", "GCP"].includes(s))) strengths.push("Cloud/DevOps skills present");
  if (skills.some(s => ["Machine Learning", "Deep Learning", "TensorFlow", "PyTorch"].includes(s))) strengths.push("AI/ML knowledge detected");
  if (skills.some(s => ["SQL", "PostgreSQL", "MySQL", "MongoDB"].includes(s))) strengths.push("Database management skills");
  if (skills.includes("Communication")) strengths.push("Communication skills highlighted");
  if (score >= 70) strengths.push("Well-structured resume with good content density");
  if (skills.length >= 5) strengths.push(`${skills.length} relevant skills identified`);
  return strengths.slice(0, 4);
}

function getIssues(skills: string[], missingSkills: string[], score: number): string[] {
  const issues: string[] = [];
  if (score < 50) issues.push("Resume score is low — needs more content and detail");
  if (missingSkills.includes("SQL")) issues.push("Missing SQL/database knowledge");
  if (missingSkills.includes("Git")) issues.push("No version control (Git) mentioned");
  if (missingSkills.includes("Communication")) issues.push("Soft skills not highlighted");
  if (missingSkills.includes("REST API")) issues.push("REST API experience not mentioned");
  if (missingSkills.includes("Problem Solving")) issues.push("Problem-solving skills not demonstrated");
  if (skills.length < 5) issues.push("Too few skills listed — expand technical section");
  if (score < 70) issues.push("Resume content could be more comprehensive");
  return issues.slice(0, 4);
}

function getChanges(missingSkills: string[], score: number, skills: string[]): string[] {
  const changes: string[] = [];
  if (missingSkills.includes("Git")) changes.push("Add Git/version control to your skills section");
  if (missingSkills.includes("SQL")) changes.push("Include SQL or database experience");
  if (missingSkills.includes("Communication")) changes.push("Add a section highlighting communication or teamwork");
  if (missingSkills.includes("REST API")) changes.push("Mention REST API projects or experience");
  if (score < 60) changes.push("Add more project descriptions with quantifiable results");
  if (skills.length < 8) changes.push("Expand your skills section with more relevant technologies");
  changes.push("Include links to GitHub, portfolio, or LinkedIn");
  changes.push("Add measurable achievements (e.g. 'improved performance by 30%')");
  return changes.slice(0, 4);
}

export default function ResumePage() {
  const { data: resumes, isLoading } = useListResumes({
    query: { queryKey: getListResumesQueryKey() },
  });

  const uploadMutation = useUploadResume();
  const scoreMutation = useScoreResume();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!file) return;
    uploadMutation.mutate({ data: { file } }, {
      onSuccess: () => {
        toast({ title: "Resume uploaded successfully" });
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        queryClient.invalidateQueries({ queryKey: getListResumesQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to upload resume", variant: "destructive" });
      }
    });
  };

  const handleScore = (resumeId: number) => {
    scoreMutation.mutate({ data: { resumeId } }, {
      onSuccess: () => {
        toast({ title: "Resume scored successfully" });
        queryClient.invalidateQueries({ queryKey: getListResumesQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to score resume", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Resumes</h1>
        <p className="text-muted-foreground mt-1">Upload and manage your resumes.</p>
      </div>

      <Card className="border-white/5 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Upload New Resume</CardTitle>
          <CardDescription>Upload a PDF or TXT file to extract skills and analyze fit.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid w-full max-w-sm items-center gap-4">
            <Label htmlFor="resume-file">Resume File</Label>
            <div className="flex gap-2">
              <Input
                id="resume-file"
                type="file"
                accept=".pdf,.txt"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="bg-muted/50 cursor-pointer"
              />
              <Button
                onClick={handleUpload}
                disabled={!file || uploadMutation.isPending}
                className="gap-2"
              >
                {uploadMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                Upload
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Your Resumes</h2>

        {isLoading ? (
          <div className="text-muted-foreground">Loading resumes...</div>
        ) : resumes?.length === 0 ? (
          <div className="text-center py-12 border rounded-lg border-white/5 bg-card/30 border-dashed">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No resumes found</h3>
            <p className="text-sm text-muted-foreground">Upload your first resume to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
            {resumes?.map((resume) => {
              const strengths = getStrengths(resume.skills ?? [], resume.score ?? 0);
              const issues = getIssues(resume.skills ?? [], resume.missingSkills ?? [], resume.score ?? 0);
              const changes = getChanges(resume.missingSkills ?? [], resume.score ?? 0, resume.skills ?? []);
              const isExpanded = expandedId === resume.id;

              return (
                <Card key={resume.id} className="border-white/5 bg-card flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base truncate pr-2 flex-1" title={resume.filename}>
                        {resume.filename}
                      </CardTitle>
                      {resume.score ? (
                        <div className={`flex items-center px-2 py-1 rounded text-xs font-bold ${
                          resume.score >= 70 ? "text-green-500 bg-green-500/10" :
                          resume.score >= 50 ? "text-yellow-500 bg-yellow-500/10" :
                          "text-red-500 bg-red-500/10"
                        }`}>
                          {resume.score} / 100
                        </div>
                      ) : (
                        <div className="flex items-center text-muted-foreground bg-muted px-2 py-1 rounded text-xs font-medium">
                          Unscored
                        </div>
                      )}
                    </div>
                    <CardDescription className="text-xs">
                      {format(new Date(resume.createdAt), 'MMM d, yyyy h:mm a')}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pb-3 flex-1 space-y-4">
                    {/* Skills */}
                    <div>
                      <div className="text-xs font-semibold mb-1 flex items-center gap-1 text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3" /> Extracted Skills ({resume.skills?.length ?? 0})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(resume.skills ?? []).slice(0, 5).map(s => (
                          <span key={s} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            {s}
                          </span>
                        ))}
                        {(resume.skills?.length ?? 0) > 5 && (
                          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            +{(resume.skills?.length ?? 0) - 5} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Toggle Analysis Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-7 border-white/10"
                      onClick={() => setExpandedId(isExpanded ? null : resume.id)}
                    >
                      {isExpanded ? "Hide Analysis" : "Show Analysis"}
                    </Button>

                    {/* Analysis Sections */}
                    {isExpanded && (
                      <div className="space-y-3 pt-1">

                        {/* Strengths */}
                        <div className="rounded-md bg-green-500/5 border border-green-500/20 p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Star className="h-3.5 w-3.5 text-green-500" />
                            <span className="text-xs font-semibold text-green-500">Strengths</span>
                          </div>
                          {strengths.length > 0 ? (
                            <ul className="space-y-1">
                              {strengths.map((s, i) => (
                                <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                                  <span className="text-green-500 mt-0.5">✓</span>
                                  {s}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">Upload more details to identify strengths.</p>
                          )}
                        </div>

                        {/* Issues Found */}
                        <div className="rounded-md bg-red-500/5 border border-red-500/20 p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                            <span className="text-xs font-semibold text-red-400">Issues Found</span>
                          </div>
                          {issues.length > 0 ? (
                            <ul className="space-y-1">
                              {issues.map((s, i) => (
                                <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                                  <span className="text-red-400 mt-0.5">✗</span>
                                  {s}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">No major issues found.</p>
                          )}
                        </div>

                        {/* Changes to Make */}
                        <div className="rounded-md bg-blue-500/5 border border-blue-500/20 p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Wrench className="h-3.5 w-3.5 text-blue-400" />
                            <span className="text-xs font-semibold text-blue-400">Changes to Make</span>
                          </div>
                          {changes.length > 0 ? (
                            <ul className="space-y-1">
                              {changes.map((s, i) => (
                                <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                                  <span className="text-blue-400 mt-0.5">→</span>
                                  {s}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">No changes needed.</p>
                          )}
                        </div>

                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="pt-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full text-xs h-8"
                      onClick={() => handleScore(resume.id)}
                      disabled={scoreMutation.isPending}
                    >
                      {scoreMutation.isPending && scoreMutation.variables?.data.resumeId === resume.id
                        ? "Scoring..."
                        : resume.score ? "Rescore" : "Generate Score"}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
