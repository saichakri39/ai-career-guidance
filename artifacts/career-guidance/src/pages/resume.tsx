import { useListResumes, getListResumesQueryKey, useUploadResume, useScoreResume } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useRef } from "react";
import { FileUp, FileText, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function ResumePage() {
  const { data: resumes, isLoading } = useListResumes({
    query: { queryKey: getListResumesQueryKey() },
  });
  
  const uploadMutation = useUploadResume();
  const scoreMutation = useScoreResume();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [file, setFile] = useState<File | null>(null);
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {resumes?.map((resume) => (
              <Card key={resume.id} className="border-white/5 bg-card flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base truncate pr-2 flex-1" title={resume.filename}>
                      {resume.filename}
                    </CardTitle>
                    {resume.score ? (
                      <div className="flex items-center text-green-500 bg-green-500/10 px-2 py-1 rounded text-xs font-bold">
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
                <CardContent className="pb-3 flex-1">
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-semibold mb-1 flex items-center gap-1 text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3" /> Extracted Skills ({resume.skills.length})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {resume.skills.slice(0, 5).map(s => (
                          <span key={s} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            {s}
                          </span>
                        ))}
                        {resume.skills.length > 5 && (
                          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            +{resume.skills.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}