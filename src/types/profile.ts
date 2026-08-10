// src/types/profile.ts

export interface CodingPlatform {
  id: string;
  name: string;
  label: string;
  baseUrl: string;
  placeholder: string;
  color: string;
  icon: string; // emoji or URL
}

export const CODING_PLATFORMS: CodingPlatform[] = [
  {
    id: "leetcode",
    name: "leetcode",
    label: "LeetCode",
    baseUrl: "https://leetcode.com/u/",
    placeholder: "your-username",
    color: "#FFA116",
    icon: "⚡",
  },
  {
    id: "gfg",
    name: "gfg",
    label: "GeeksForGeeks",
    baseUrl: "https://www.geeksforgeeks.org/user/",
    placeholder: "your-username",
    color: "#2F8D46",
    icon: "🌿",
  },
  {
    id: "codeforces",
    name: "codeforces",
    label: "Codeforces",
    baseUrl: "https://codeforces.com/profile/",
    placeholder: "your-username",
    color: "#1F8ACB",
    icon: "🔵",
  },
  {
    id: "codechef",
    name: "codechef",
    label: "CodeChef",
    baseUrl: "https://www.codechef.com/users/",
    placeholder: "your-username",
    color: "#5B4638",
    icon: "👨‍🍳",
  },
  {
    id: "hackerrank",
    name: "hackerrank",
    label: "HackerRank",
    baseUrl: "https://www.hackerrank.com/",
    placeholder: "your-username",
    color: "#2EC866",
    icon: "🏆",
  },
  {
    id: "github",
    name: "github",
    label: "GitHub",
    baseUrl: "https://github.com/",
    placeholder: "your-username",
    color: "#333",
    icon: "🐙",
  },
  {
    id: "linkedin",
    name: "linkedin",
    label: "LinkedIn",
    baseUrl: "https://www.linkedin.com/in/",
    placeholder: "your-username",
    color: "#0A66C2",
    icon: "💼",
  },
];

export interface UserProfile {
  uid: string;
  displayName: string;
  bio: string;
  photoURL: string; // stored as low-quality base64 data URL or Firebase URL
  platforms: Record<string, string>; // platformId -> username
  isPublic: boolean;
  shareSlug: string; // unique slug for public URL, e.g. uid or custom
  createdAt: number;
  updatedAt: number;
}