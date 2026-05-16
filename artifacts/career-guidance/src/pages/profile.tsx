import { useGetProfile, getGetProfileQueryKey, useUpdateProfile, useGetSuggestionHistory, getGetSuggestionHistoryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function ProfilePage() {
  const { data: profile, isLoading } = useGetProfile({
    query: { queryKey: getGetProfileQueryKey() }
  });

  const { data: suggestions, isLoading: isLoadingSuggestions } = useGetSuggestionHistory({
    query: { queryKey: getGetSuggestionHistoryQueryKey() }
  });
  
  const updateMutation = useUpdateProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    currentRole: "",
    targetRole: ""
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        bio: profile.bio || "",
        currentRole: profile.currentRole || "",
        targetRole: profile.targetRole || ""
      });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ data: formData }, {
      onSuccess: () => {
        toast({ title: "Profile updated successfully" });
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to update profile", variant: "destructive" });
      }
    });
  };

  if (isLoading) return <div>Loading...</div>;
  if (!profile) return <div>Failed to load profile</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card className="border-white/5 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your personal details and current status.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" value={formData.name} onChange={handleChange} className="bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={profile.email} disabled className="bg-muted/30 opacity-50" />
                  <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="currentRole">Current Role</Label>
                    <Input id="currentRole" value={formData.currentRole} onChange={handleChange} className="bg-muted/50" placeholder="e.g. Junior Developer" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetRole">Target Role</Label>
                    <Input id="targetRole" value={formData.targetRole} onChange={handleChange} className="bg-muted/50" placeholder="e.g. Senior Developer" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea 
                    id="bio" 
                    value={formData.bio} 
                    onChange={handleChange} 
                    className="bg-muted/50 min-h-[100px]" 
                    placeholder="Tell us a bit about your career journey..."
                  />
                </div>
                <Button type="submit" disabled={updateMutation.isPending} className="w-full sm:w-auto">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-white/5 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle>Suggestion History</CardTitle>
              <CardDescription>Your recently generated career suggestions.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSuggestions ? (
                <div className="text-muted-foreground text-sm">Loading suggestions...</div>
              ) : !suggestions || suggestions.length === 0 ? (
                <div className="text-muted-foreground text-sm">No suggestions generated yet.</div>
              ) : (
                <div className="space-y-4">
                  {suggestions.slice(0, 5).map(sugg => (
                    <div key={sugg.id} className="p-3 border border-white/5 rounded bg-muted/30 text-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-primary">{sugg.type}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(sugg.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                      <p className="line-clamp-2 text-muted-foreground">{sugg.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-white/5 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg">Account Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-muted-foreground">Member Since</span>
                <span className="font-medium text-sm">{format(new Date(profile.createdAt), 'MMM yyyy')}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-muted-foreground">Resumes Uploaded</span>
                <span className="font-medium text-sm">{profile.resumeCount || 0}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-muted-foreground">Predictions Generated</span>
                <span className="font-medium text-sm">{profile.predictionCount || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}