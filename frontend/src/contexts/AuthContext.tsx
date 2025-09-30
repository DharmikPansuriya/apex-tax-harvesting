"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { UserProfile } from "@/types";

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface WealthManager {
  id: number;
  firm_name: string;
  license_number: string;
  phone: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  wealthManager: WealthManager | null;
  client: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  register: (data: any) => Promise<void>;
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [wealthManager, setWealthManager] = useState<WealthManager | null>(
    null
  );
  const [client, setClient] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();

    // Listen for storage changes (when login happens in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === "access_token" ||
        e.key === "user" ||
        e.key === "user_profile" ||
        e.key === "wealth_manager" ||
        e.key === "client"
      ) {
        checkAuth();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const userData = localStorage.getItem("user");
      const userProfileData = localStorage.getItem("user_profile");
      const wealthManagerData = localStorage.getItem("wealth_manager");
      const clientData = localStorage.getItem("client");

      if (!token || !userData || !userProfileData) {
        setIsLoading(false);
        return;
      }

      // Set token in API client
      apiClient.setAuthToken(token);

      // Set user data from localStorage first
      setUser(JSON.parse(userData));
      setUserProfile(JSON.parse(userProfileData));

      // Set wealth manager data if it exists
      if (wealthManagerData) {
        setWealthManager(JSON.parse(wealthManagerData));
      }

      // Set client data if it exists
      if (clientData) {
        setClient(JSON.parse(clientData));
      }

      // Verify token by getting user profile
      try {
        const response = await apiClient.getMe();
        // Update with fresh data from server
        setUser(response.user);
        setUserProfile(response.user_profile);
        if (response.wealth_manager) {
          setWealthManager(response.wealth_manager);
        }
        if (response.client) {
          setClient(response.client);
        }
      } catch (error) {
        console.warn("Token verification failed:", error);
        // Don't automatically logout on verification failure during initialization
        // Let the user stay logged in with cached data and try again later
        console.warn(
          "Keeping cached authentication data, will retry verification"
        );
      }
    } catch (error) {
      console.error("Authentication check failed:", error);
      // Only clear data if there's a critical error
      if (error instanceof SyntaxError) {
        // JSON parse error - clear corrupted data
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        localStorage.removeItem("user_profile");
        localStorage.removeItem("wealth_manager");
        localStorage.removeItem("client");
        apiClient.clearAuthToken();
        setUser(null);
        setUserProfile(null);
        setWealthManager(null);
        setClient(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await apiClient.login({ username, password });

      // Store tokens and user data
      localStorage.setItem("access_token", response.access);
      localStorage.setItem("refresh_token", response.refresh);
      localStorage.setItem("user", JSON.stringify(response.user));
      localStorage.setItem(
        "user_profile",
        JSON.stringify(response.user_profile)
      );
      localStorage.setItem(
        "wealth_manager",
        JSON.stringify(response.wealth_manager)
      );
      if (response.client) {
        localStorage.setItem("client", JSON.stringify(response.client));
      }

      // Set token in API client
      apiClient.setAuthToken(response.access);

      // Update state
      setUser(response.user);
      setUserProfile(response.user_profile);
      setWealthManager(response.wealth_manager);
      if (response.client) {
        setClient(response.client);
      }

      // Redirect to dashboard
      router.push("/");
    } catch (error) {
      throw error;
    }
  };

  const register = async (data: any) => {
    try {
      const response = await apiClient.register(data);

      // Store tokens and user data
      localStorage.setItem("access_token", response.access);
      localStorage.setItem("refresh_token", response.refresh);
      localStorage.setItem("user", JSON.stringify(response.user));
      localStorage.setItem(
        "user_profile",
        JSON.stringify(response.user_profile)
      );
      localStorage.setItem(
        "wealth_manager",
        JSON.stringify(response.wealth_manager)
      );
      if (response.client) {
        localStorage.setItem("client", JSON.stringify(response.client));
      }

      // Set token in API client
      apiClient.setAuthToken(response.access);

      // Update state
      setUser(response.user);
      setUserProfile(response.user_profile);
      setWealthManager(response.wealth_manager);
      if (response.client) {
        setClient(response.client);
      }

      // Redirect to dashboard
      router.push("/");
    } catch (error) {
      throw error;
    }
  };

  const logout = useCallback(() => {
    // Clear local storage
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    localStorage.removeItem("user_profile");
    localStorage.removeItem("wealth_manager");
    localStorage.removeItem("client");

    // Clear API client token
    apiClient.clearAuthToken();

    // Clear state
    setUser(null);
    setUserProfile(null);
    setWealthManager(null);
    setClient(null);

    // Redirect to login
    router.push("/login");
  }, [router]);

  // Set up the unauthorized callback after logout function is defined
  useEffect(() => {
    apiClient.setOnUnauthorized(logout);
  }, [logout]);

  const refreshAuth = () => {
    checkAuth();
  };

  const value = {
    user,
    userProfile,
    wealthManager,
    client,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    register,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
