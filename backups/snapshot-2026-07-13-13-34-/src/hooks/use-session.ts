"use client";

import { useState, useEffect, useCallback } from "react";
import { createSession, destroySession, getSession, isSessionValid, startActivityTracking } from "@/lib/security";

export interface SessionUser {
  id?: string;
  username: string;
  fullName: string;
  role: string;
  permissions?: any;
}

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load on mount
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const session = getSession();
    if (session && isSessionValid()) {
      setUser(session.user);
    } else {
      setUser(null);
    }
    setLoading(false);

    // Start activity tracking to keep session alive
    const stop = startActivityTracking();
    return stop;
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Periodic validity check
  useEffect(() => {
    const interval = setInterval(() => {
      if (user && !isSessionValid()) {
        setUser(null);
      }
    }, 60000); // every minute
    return () => clearInterval(interval);
  }, [user]);

  const login = useCallback((u: SessionUser) => {
    createSession(u);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    destroySession();
    setUser(null);
  }, []);

  const hasPermission = useCallback((perm: string): boolean => {
    if (!user) return false;
    if (user.role === "admin") return true;
    return user.permissions?.[perm] === true;
  }, [user]);

  return { user, loading, login, logout, hasPermission };
}
