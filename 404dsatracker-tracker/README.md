# DSA⁴⁰⁴

**404 Distractions. 1 Goal: DSA.**

Welcome to **DSA⁴⁰⁴**, an intelligent, dynamic, and cloud-synced companion designed to help you conquer Striver's 120-Day A2Z Data Structures and Algorithms sheet without the guilt of rigid schedules.

## ðŸŒŸ Why this Tracker?

Most static spreadsheets or basic trackers fail because "life happens". If you miss a few days on a rigid schedule, you fall behind and lose motivation. 

**This tracker adapts to you.** 
It maintains the integrity of the 474-problem syllabus but allows you to set your own daily pace, postpone days, skip days, or combine days. The system automatically recalculates your remaining schedule and projected finish dateâ€”so you always have a realistic, actionable plan.

---

## âœ¨ Key Features

- ðŸš€ **Dynamic Daily Pace**: Choose how many Easy, Medium, and Hard problems you want to tackle each day. The platform instantly restructures your remaining problems to fit your preferred pace.
- ðŸ“… **Flexible Scheduling**: 
  - **Postpone**: Push a day back if you are busy.
  - **Merge Tomorrow**: Pull tomorrow's topics into today if you have extra time.
  - **Skip**: Remove a day entirely if you already know the topic.
- ðŸ§  **AI Topic Explainer**: Every single day features an AI Explainer that provides a short intuition guide for the day's topic and gentle hints (not full solutions) for the harder problems.
- ðŸ”„ **Smart Revision Days**: If you miss a week, the system automatically inserts a "Revision Day". It uses spaced repetition to pull 6 past problems for you to recap, getting you back into the groove without disrupting your main plan.
- ðŸ�† **Live Contest Sync**: A dedicated dashboard that fetches live and upcoming contests from Codeforces, LeetCode, CodeChef, and GeeksforGeeks so you never miss a coding round.
- â˜�ï¸� **Cloud Sync**: Fully backed by Firebase. Your checkmarks, submitted code, and chat histories are saved to the cloud and instantly sync across your phone and laptop.

---

## ðŸš€ Getting Started (For Users)

1. **Sign Up / Log In**: Create an account using your email or Google. This ensures your progress is safely stored in the cloud.
2. **Set Your Pace**: Head over to the **Settings** tab immediately. 
   - Set your **Daily problem pace** (e.g., 2 Easy, 1 Medium, 1 Hard).
   - Set your **Plan start date**. 
3. **Start Coding**: Navigate to the **Today** tab to see your assigned topic, checklist, and problems.
4. **Submit Your Code**: To fully mark a problem as completed, click on a problem row, paste your solution code in the modal, and click **Submit**. Checking it off is not enoughâ€”you must submit your code to maintain a reviewable record!

---

## ðŸ—ºï¸� Platform Navigation (Tabs)

The application is structured into several core tabs to keep your preparation organized:

- ðŸŽ¯ **Today**: Your daily command center. Here you will find your assigned topic for the day, your problem list, a 12-step study checklist, the AI explainer, and any contests happening today.
- ðŸ—“ï¸� **Week View**: A bird's-eye view of your entire roadmap. It groups all days into weeks, showing your completion status (pending, done, postponed, skipped). You can also jump into future days from here.
- ðŸ“¦ **Backlog**: Nothing silently disappears. If you fall behind, incomplete days pile up here. You can use this tab to catch up, postpone past days, or insert a "Revision Day".
- ðŸ”– **Review**: A dedicated space for problems you've bookmarked. Tap the bookmark icon on any difficult problem in your daily list to send it here for another look later.
- ðŸ“š **Topics**: Want to see how you are doing in Dynamic Programming or Graphs? This tab groups all 474 problems into the 18 official Striver A2Z sections, complete with progress bars for each.
- ðŸ�† **Contests**: A dedicated dashboard for competitive programming. It tracks live and upcoming contests from LeetCode, Codeforces, CodeChef, and GeeksforGeeks.
- ðŸ“Š **Progress**: Your personal analytics hub. View your overall completion percentage, current streak, submission heatmap, difficulty breakdowns, and earned badges.
- ðŸ‘¤ **Profile**: Your gamified public showcase. Customize your profile with links to your GitHub, Codeforces, or LinkedIn, and share your unique **Public URL** to show off your progress to recruiters or friends.
- âš™ï¸� **Settings**: Customize the platform. Set your daily problem pace, reset your start date, change the theme (light/dark and accent colors), or toggle email notifications.

---

## ðŸ’» Local Development Setup (For Developers)

Want to run this tracker locally or contribute to the code? It is built with a modern stack featuring **Next.js**, **React**, **Tailwind CSS v4**, and **Firebase**.

### Prerequisites
- Node.js (v18 or higher recommended)
- A Firebase project (for Authentication and Firestore)

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Variables:**
   Create a `.env.local` file in the root directory and add your Firebase configuration credentials:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the app running locally.

---

## ðŸ›  Tech Stack

- **Frontend Framework**: [Next.js](https://nextjs.org/) (App Router)
- **UI Components**: [Radix UI](https://www.radix-ui.com/) & custom Shadcn-like components
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Backend & Auth**: [Firebase](https://firebase.google.com/) (Firestore & Authentication)
- **Icons**: [Lucide React](https://lucide.dev/)
- **State Management & Routing**: React Hooks & TanStack Router

---

## ðŸ“� Disclaimer
This project is an independent educational tracker. The problem roadmaps (like Striver's A-Z DSA Sheet) belong to their respective authors and communities. This platform does not claim ownership of the educational content and redirects users to original platforms (Take U Forward, LeetCode, etc.) for solving.
"# 404dsatracker" 
