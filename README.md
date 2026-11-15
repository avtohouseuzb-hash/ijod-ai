This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


## IJOD EDU hybrid textbook and curriculum system

- Configure `EDU_ADMIN_EMAILS` in Vercel as a comma-separated allowlist of administrator account email addresses. Only these accounts can upload and index textbooks at `/edu/admin/textbooks`.
- Keep `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` configured on the server.
- The grade-specific subject catalogue is maintained in `src/lib/edu-subjects.ts`. It is an initial curriculum catalogue and should be checked against the current official curriculum before being labelled fully verified.
- PDF originals are stored in the private Supabase Storage bucket `edu-textbooks` (up to 150 MB) and indexed into a separate OpenAI File Search collection for each grade and subject.
- When an indexed textbook is available, AI Tutor and homework checking search only the selected grade and subject's collection.
- When no matching PDF has been indexed, AI Tutor still teaches using general subject knowledge. It must not claim to quote the official textbook or invent book pages, chapters, or exercise numbers.
- Only indexed (`ready`) PDFs appear as official textbooks in the student library. The curriculum/subject catalogue remains available even while PDF materials are not yet uploaded.
