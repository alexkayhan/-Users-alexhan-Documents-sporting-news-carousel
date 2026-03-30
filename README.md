# Sporting News Carousel

A shareable Next.js sports carousel that combines:

- a rotating Reddit-based sports story feed
- autoplaying Reddit-hosted video on active cards
- a top odds bar sourced from ESPN's DraftKings-powered odds page

## Stack

- Next.js 15
- React 19
- TypeScript
- Vitest + Testing Library
- `hls.js` for Reddit video audio playback in browsers that do not support HLS natively

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

This project does not require any environment variables right now.

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

- Story cards link out in a new tab so the carousel stays open.
- The Reddit feed depends on Reddit availability and rate limits.
- The top games bar depends on ESPN's public odds page continuing to expose the same embedded data shape.
