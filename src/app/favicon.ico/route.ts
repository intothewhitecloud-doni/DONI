const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#020617"/>
  <path d="M17 17h16c9.4 0 16 6.2 16 15s-6.6 15-16 15H17V17Z" fill="#2563eb"/>
  <path d="M27 25h5.3c4.5 0 7.7 2.9 7.7 7s-3.2 7-7.7 7H27V25Z" fill="#ffffff"/>
</svg>`;

export const dynamic = "force-static";

export function GET() {
  return new Response(iconSvg, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/svg+xml"
    }
  });
}
