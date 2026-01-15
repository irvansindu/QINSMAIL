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

## Production notes (Vercel)

### Admin domain/settings persistence

Vercel's filesystem is read-only in production. This project uses:

- File-based JSON storage for local development (`data/domains.json`, `data/settings.json`)
- Vercel KV for production persistence when KV env vars are present

To enable KV:

1. Create a KV store in your Vercel project
2. Add these environment variables in Vercel (Project Settings -> Environment Variables):

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

Alternatively, if you are using Upstash Redis from the Vercel Marketplace, you can set:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

The app will automatically seed default domains/settings into KV on first access if they are missing.

### Admin authentication

Set:

- `ADMIN_TOKEN`

This token is required to use `/admin` and the admin APIs.
