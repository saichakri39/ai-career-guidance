import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

export function useAuth() {
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
    },
  });

  const login = (token: string) => {
    localStorage.setItem("token", token);
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    setLocation("/dashboard");
  };

  const logout = () => {
    localStorage.removeItem("token");
    queryClient.setQueryData(getGetMeQueryKey(), null);
    setLocation("/login");
  };

  return {
    user: error ? null : user,
    isLoading,
    login,
    logout,
    isAuthenticated: !!user && !error,
  };
}