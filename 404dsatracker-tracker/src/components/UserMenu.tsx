// src/components/UserMenu.tsx
// Top-right avatar button with dropdown: Profile | Settings | Logout
// Drop-in replacement for your existing UserMenu / top-right menu.
// Only this file changes — AppShell just renders <UserMenu />.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";
import { useAuth } from "../hooks/useAuth"; // adjust path

export default function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  const initials = (user.displayName || user.email || "?")[0].toUpperCase();

  return (
    <div ref={ref} className="relative">
      {/* Avatar button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full overflow-hidden border-2 border-purple-500/50 hover:border-purple-400 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50 bg-gray-800 flex items-center justify-center"
        title="Account"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt="avatar"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-sm font-bold text-white">{initials}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-[#1a1a2e] shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* User info */}
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-sm font-semibold text-white truncate">
              {user.displayName || "Coder"}
            </p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <User className="w-4 h-4" />
              Profile
            </Link>

            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>

            <div className="border-t border-white/10 mt-1 pt-1">
              <button
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}