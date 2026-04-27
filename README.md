# ATM Investors Pulse Check

Internal team pulse survey with intelligence dashboard.

## Stack
- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- Supabase (database)
- Lucide icons

## Local development

\`\`\`bash
npm install
npm run dev
\`\`\`

Open http://localhost:3000

## Deploy
Already configured for Vercel. Push to main and it deploys.

## Admin access
Click "Admin" link on welcome screen, enter the passcode set in \`app/PulseSurvey.tsx\` (\`ADMIN_PASSCODE\`).

## Backend
Responses POST to Supabase table \`atm_pulse_responses\`.
URL and publishable key are at the top of \`app/PulseSurvey.tsx\`.
