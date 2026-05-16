import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Upload,
  Download,
  Users,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Search,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react";

type StudentResult = {
  name: string;
  email: string;
  rollNumber: string;
  department: string;
  communicationScore: number;
  codingScore: number;
  aptitudeScore: number;
  performancePrediction: number;
  placementProbability: number;
  placementEligibility: boolean;
  recommendedDomain: string;
  domainConfidence: number;
};

type BulkUploadResponse = {
  id: number;
  filename: string;
  studentCount: number;
  eligibleCount: number;
  notEligibleCount: number;
  eligibilityRate: number;
  results: StudentResult[];
  createdAt: string;
};

type BulkUploadSummary = {
  id: number;
  filename: string;
  studentCount: number;
  eligibleCount: number;
  notEligibleCount: number;
  eligibilityRate: number;
  createdAt: string;
};

const SAMPLE_CSV = `name,email,rollNumber,department,communicationScore,codingScore,aptitudeScore
Alice Johnson,alice@example.com,CS001,Computer Science,82,78,75
Bob Smith,bob@example.com,CS002,Computer Science,55,48,52
Carol White,carol@example.com,EC003,Electronics,74,65,80
David Brown,david@example.com,ME004,Mechanical,60,40,55
Eva Martinez,eva@example.com,CS005,Computer Science,88,92,85
Frank Lee,frank@example.com,IT006,Information Technology,45,38,42
Grace Kim,grace@example.com,CS007,Computer Science,76,84,79`;

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function resultsToCSV(results: StudentResult[], filename: string): string {
  const headers = [
    "Name", "Email", "Roll Number", "Department",
    "Communication Score", "Coding Score", "Aptitude Score",
    "Performance Prediction", "Placement Probability (%)",
    "Placement Eligibility", "Recommended Domain", "Domain Confidence (%)",
  ];
  const rows = results.map((r) => [
    r.name, r.email, r.rollNumber, r.department,
    r.communicationScore, r.codingScore, r.aptitudeScore,
    r.performancePrediction, r.placementProbability,
    r.placementEligibility ? "Eligible" : "Not Eligible",
    r.recommendedDomain, r.domainConfidence,
  ]);
  return [headers, ...rows].map((row) => row.map(String).join(",")).join("\n");
}

export default function BulkPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<BulkUploadResponse | null>(null);
  const [search, setSearch] = useState("");
  const [filterEligible, setFilterEligible] = useState<"all" | "eligible" | "not-eligible">("all");
  const [sortField, setSortField] = useState<keyof StudentResult>("placementProbability");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<number | null>(null);

  function authFetch<T>(url: string): Promise<T> {
    const token = localStorage.getItem("token");
    return fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then((r) => r.json() as Promise<T>);
  }

  const { data: history } = useQuery<BulkUploadSummary[]>({
    queryKey: ["bulk-history"],
    queryFn: () => authFetch<BulkUploadSummary[]>("/api/bulk/history"),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("token");
      const resp = await fetch("/api/bulk/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Upload failed");
      }
      return resp.json() as Promise<BulkUploadResponse>;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["bulk-history"] });
      toast({ title: "Analysis complete", description: `${data.studentCount} students analyzed.` });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast({ title: "Invalid file", description: "Please upload a CSV file.", variant: "destructive" });
        return;
      }
      uploadMutation.mutate(file);
    },
    [uploadMutation, toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleSort = (field: keyof StudentResult) => {
    if (sortField === field) {
      setSortAsc((v) => !v);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filteredResults = (result?.results ?? [])
    .filter((r) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.rollNumber.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q);
      const matchesFilter =
        filterEligible === "all" ||
        (filterEligible === "eligible" && r.placementEligibility) ||
        (filterEligible === "not-eligible" && !r.placementEligibility);
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === "number" && typeof bv === "number") {
        return sortAsc ? av - bv : bv - av;
      }
      return sortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });

  const SortIcon = ({ field }: { field: keyof StudentResult }) =>
    sortField === field ? (
      sortAsc ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />
    ) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bulk Student Analysis</h1>
        <p className="text-muted-foreground mt-1">
          Upload a CSV with student scores to run ML-powered placement eligibility analysis across your entire batch.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Upload Student CSV
            </CardTitle>
            <CardDescription>
              Required columns: name, communicationScore, codingScore, aptitudeScore.
              Optional: email, rollNumber, department.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              {uploadMutation.isPending ? (
                <p className="text-sm font-medium">Analyzing students...</p>
              ) : (
                <>
                  <p className="text-sm font-medium">Drop your CSV here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Supports up to 1,000 students per upload</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => downloadCsv(SAMPLE_CSV, "sample_students.csv")}
            >
              <Download className="h-4 w-4" />
              Download Sample CSV Template
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Analysis Summary</CardTitle>
              <CardDescription>{result.filename}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/40">
                  <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{result.studentCount}</p>
                  <p className="text-xs text-muted-foreground">Total Students</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-600 dark:text-green-400" />
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{result.eligibleCount}</p>
                  <p className="text-xs text-muted-foreground">Eligible</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-500/10">
                  <XCircle className="h-5 w-5 mx-auto mb-1 text-red-600 dark:text-red-400" />
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{result.notEligibleCount}</p>
                  <p className="text-xs text-muted-foreground">Not Eligible</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-primary/10">
                  <p className="text-2xl font-bold text-primary">{result.eligibilityRate}%</p>
                  <p className="text-xs text-muted-foreground">Eligibility Rate</p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 mt-4"
                onClick={() =>
                  downloadCsv(
                    resultsToCSV(result.results, result.filename),
                    `analysis_${result.filename}`
                  )
                }
              >
                <Download className="h-4 w-4" />
                Export Results as CSV
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {result && result.results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <CardTitle className="text-base">Student Results</CardTitle>
                <CardDescription>{filteredResults.length} of {result.results.length} students shown</CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search students..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-9 w-44"
                  />
                </div>
                <div className="flex rounded-md border overflow-hidden">
                  {(["all", "eligible", "not-eligible"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilterEligible(f)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                        filterEligible === f
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {f === "all" ? "All" : f === "eligible" ? "Eligible" : "Not Eligible"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Student
                    </th>
                    <th
                      className="text-center px-3 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap"
                      onClick={() => handleSort("communicationScore")}
                    >
                      Comm <SortIcon field="communicationScore" />
                    </th>
                    <th
                      className="text-center px-3 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap"
                      onClick={() => handleSort("codingScore")}
                    >
                      Coding <SortIcon field="codingScore" />
                    </th>
                    <th
                      className="text-center px-3 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap"
                      onClick={() => handleSort("aptitudeScore")}
                    >
                      Aptitude <SortIcon field="aptitudeScore" />
                    </th>
                    <th
                      className="text-center px-3 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap"
                      onClick={() => handleSort("performancePrediction")}
                    >
                      Performance <SortIcon field="performancePrediction" />
                    </th>
                    <th
                      className="text-center px-3 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap"
                      onClick={() => handleSort("placementProbability")}
                    >
                      Placement % <SortIcon field="placementProbability" />
                    </th>
                    <th className="text-center px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Status
                    </th>
                    <th
                      className="text-left px-3 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap"
                      onClick={() => handleSort("recommendedDomain")}
                    >
                      Recommended Domain <SortIcon field="recommendedDomain" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((r, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[r.rollNumber, r.department].filter(Boolean).join(" · ") || r.email || "—"}
                        </p>
                      </td>
                      <td className="text-center px-3 py-3 tabular-nums">{r.communicationScore}</td>
                      <td className="text-center px-3 py-3 tabular-nums">{r.codingScore}</td>
                      <td className="text-center px-3 py-3 tabular-nums">{r.aptitudeScore}</td>
                      <td className="text-center px-3 py-3 tabular-nums font-medium">{r.performancePrediction}</td>
                      <td className="text-center px-3 py-3 tabular-nums">
                        <span
                          className={`font-semibold ${
                            r.placementProbability >= 60
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {r.placementProbability}%
                        </span>
                      </td>
                      <td className="text-center px-3 py-3">
                        <Badge
                          variant={r.placementEligibility ? "default" : "destructive"}
                          className={r.placementEligibility ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                        >
                          {r.placementEligibility ? "Eligible" : "Not Eligible"}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div>
                          <p className="text-xs font-medium">{r.recommendedDomain}</p>
                          <p className="text-xs text-muted-foreground">{r.domainConfidence}% confidence</p>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredResults.length === 0 && (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No students match your search or filter.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {history && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Upload History
            </CardTitle>
            <CardDescription>Past bulk analyses for your account</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {history.map((h) => (
                <div key={h.id} className="px-6 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{h.filename}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(h.createdAt), "MMM d, yyyy · h:mm a")}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm shrink-0">
                      <div className="text-center">
                        <p className="font-semibold">{h.studentCount}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-green-600 dark:text-green-400">{h.eligibleCount}</p>
                        <p className="text-xs text-muted-foreground">Eligible</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-primary">{h.eligibilityRate}%</p>
                        <p className="text-xs text-muted-foreground">Rate</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (expandedHistory === h.id) {
                            setExpandedHistory(null);
                            return;
                          }
                          const data = await authFetch<BulkUploadResponse>(`/api/bulk/${h.id}`);
                          setResult(data);
                          setExpandedHistory(h.id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        {expandedHistory === h.id ? "Hide" : "View"}
                      </Button>
                    </div>
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
