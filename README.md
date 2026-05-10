# Exam Marker Auditor

A mobile-first Next.js web application that uses Gemini 1.5 Flash to audit marked exam papers.

## Features
- **Mobile-First Design**: Optimized for capturing photos directly from your phone.
- **AI-Powered Auditing**: Extracts max points, awarded points, marker ID, and signature presence.
- **Native Logic Verification**:
  - Automatically sums awarded points.
  - Checks if awarded points exceed max points per question.
  - Flags addition errors (Native Sum vs. Written Total).
  - Calculates grade conversion (Sum/100 * 20).
- **Green/Red Status**: Clear visual indicators for passing or failing audits.

## Tech Stack
- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS
- **AI**: Gemini 1.5 Flash via `@google/generative-ai`
- **Icons**: Lucide React

## Setup Instructions

### 1. Environment Variables
Create a `.env.local` file in the root directory and add your Google Gemini API Key:
```env
GEMINI_API_KEY=your_api_key_here
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Usage
1. Open the app on your mobile device (use a tool like ngrok or local network IP if testing on a physical phone).
2. **Setup Phase**: Tap "Capture Template" and take a photo of the reference exam key/blank paper.
3. **Audit Phase**: Tap the camera icon to take photos of student-marked papers.
4. View the results instantly in the dashboard below.
