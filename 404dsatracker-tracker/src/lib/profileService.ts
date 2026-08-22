// src/lib/profileService.ts
// Handles profile CRUD in Firestore.
// Profile photo is compressed to ≤50KB base64 and stored as a string field
// (avoids Firebase Storage bucket; keeps storage cheap).

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import type { UserProfile } from "./db";

// ─── Image compression ────────────────────────────────────────────────────────

/**
 * Compresses an image File to a low-quality JPEG data-URL (≤50 KB by default).
 * Stored as a plain string field in Firestore — no Storage bucket needed.
 */
export async function compressImageToDataURL(
  file: File,
  maxSizeKB = 50,
  maxDim = 200
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Start at quality 0.7, drop until under maxSizeKB
        let quality = 0.7;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length > maxSizeKB * 1024 * 1.37 && quality > 0.1) {
          quality -= 0.05;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

function profileRef(uid: string) {
  return doc(db, "profiles", uid);
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(profileRef(uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export async function upsertProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  const ref = profileRef(uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { ...data, updatedAt: Date.now() });
  } else {
    await setDoc(ref, {
      uid,
      displayName: "",
      bio: "",
      photoURL: "",
      platforms: {},
      isPublic: true,
      shareSlug: uid, // default slug = uid; user can keep it
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...data,
    });
  }
}

/** Look up a profile by shareSlug (for public profile page). */
export async function getProfileBySlug(
  slug: string
): Promise<UserProfile | null> {
  // Fast path: slug is usually the uid
  const byUid = await getProfile(slug);
  if (byUid) return byUid;

  // Fallback: query by shareSlug field
  const q = query(
    collection(db, "profiles"),
    where("shareSlug", "==", slug),
    where("isPublic", "==", true)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as UserProfile;
}