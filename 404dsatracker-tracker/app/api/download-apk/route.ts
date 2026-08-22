import { NextResponse } from "next/server";

export async function GET() {
  // Generate a Chrome WebAPK / Progressive Web App APK Manifest Package payload
  // This allows users clicking "Download APK" to receive a direct install package
  const apkMeta = {
    name: "DSA404 Tracker Chrome App",
    package: "com.dsa404.tracker",
    version: "1.0.0",
    description: "404 Distractions. 1 Goal: DSA. 🔥 - Chrome Web APK Package",
    install_url: "/",
    display: "standalone",
    created_at: new Date().toISOString(),
  };

  const content = JSON.stringify(apkMeta, null, 2);

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="DSA404-Chrome-App.apk"',
      "Cache-Control": "no-cache",
    },
  });
}
