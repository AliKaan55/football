/**
 * Generates an SVG Data URL logo using the club's theme color, gradient, and short code.
 * This ensures that if the Logo URL is left empty, the generated club badge
 * with theme color and short name becomes its permanent, crisp vector logo.
 */
export function generateBadgeDataUrl(shortCode: string, primaryColor: string, secondaryColor = '#0f172a'): string {
  const code = (shortCode || 'KLP').toUpperCase().slice(0, 3);
  const color1 = primaryColor || '#10b981';
  const color2 = secondaryColor || '#0f172a';

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color1}" />
      <stop offset="100%" stop-color="${color2}" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- Modern Shield / Rounded Badge Container -->
  <rect x="6" y="6" width="108" height="108" rx="28" fill="url(#bgGrad)" stroke="rgba(255,255,255,0.25)" stroke-width="3" filter="url(#shadow)"/>
  
  <!-- Subtle inner stadium / field circle -->
  <circle cx="60" cy="60" r="42" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
  <line x1="18" y1="60" x2="102" y2="60" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>

  <!-- Short name initials text -->
  <text x="60" y="68" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="34" fill="#ffffff" text-anchor="middle" letter-spacing="-0.03em" filter="url(#shadow)">
    ${code}
  </text>

  <!-- Mini soccer ball icon at bottom -->
  <circle cx="60" cy="98" r="4" fill="#ffffff" opacity="0.6"/>
</svg>
`.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
