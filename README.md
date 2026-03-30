# Sporting News Carousel

A shareable Next.js sports carousel that combines:

- a rotating ESPN RSS sports story feed
- a top odds bar sourced from ESPN's DraftKings-powered odds page

## Stack

- Next.js 15
- React 19
- TypeScript
- Vitest + Testing Library

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production build

```bash
npm run build
npm start
```

## Deploying To Vercel

No environment variables are required for the ESPN RSS story feed.

### Option 1: Vercel dashboard

1. Push this project to GitHub, GitLab, or Bitbucket.
2. Go to [https://vercel.com/new](https://vercel.com/new).
3. Import the repository.
4. Keep the default Next.js framework settings.
5. Click `Deploy`.

### Option 2: Vercel CLI

```bash
npm install -g vercel
vercel
```

For production deployment after the first setup:

```bash
vercel --prod
```

## Notes

- Story cards open the original ESPN article in a new tab so the carousel stays open.
- Headlines and summaries are taken directly from ESPN's RSS feeds.
- The top games bar depends on ESPN's public odds page continuing to expose the same embedded data shape.
