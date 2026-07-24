// A comprehensive list of known digital/software subscription services.
// We match using UPPERCASE keywords so "Netflix" matches "NETFLIX INDIA".
export const KNOWN_SUBSCRIPTIONS = new Set<string>([
  // Streaming & Entertainment
  'NETFLIX', 'DISNEY', 'HBO MAX', 'HULU', 'PRIME VIDEO', 'APPLE TV', 'SPOTIFY',
  'YOUTUBE PREMIUM', 'AUDIBLE', 'CRUNCHYROLL',
  // AI & Productivity
  'OPENAI', 'CHATGPT', 'ANTHROPIC', 'CLAUDE', 'GEMINI', 'PERPLEXITY', 'MIDJOURNEY',
  'ELEVENLABS', 'NOTION', 'GRAMMARLY', 'CANVA', 'ADOBE', 'CREATIVE CLOUD',
  // SaaS
  'MICROSOFT 365', 'GOOGLE WORKSPACE', 'SALESFORCE', 'HUBSPOT', 'SLACK', 'ZOOM',
  'DROPBOX', 'BOX', 'ATLASSIAN', 'JIRA', 'CONFLUENCE', 'FIGMA', 'GITHUB', 'GITLAB',
  'LINEAR', 'MONDAY', 'CLICKUP', 'ASANA', 'TRELLO',
  // Finance & Accounting
  'QUICKBOOKS', 'XERO', 'FRESHBOOKS', 'ZOHO', 'STRIPE', 'CHARGEBEE',
  // Music
  'APPLE MUSIC', 'YOUTUBE MUSIC', 'AMAZON MUSIC', 'TIDAL', 'DEEZER',
  // Learning
  'COURSERA', 'UDEMY', 'MASTERCLASS', 'SKILLSHARE', 'DUOLINGO', 'BRILLIANT',
  'CODECADEMY', 'DATACAMP', 'LINKEDIN LEARNING',
  // Cloud & Developer
  'AWS', 'AZURE', 'GOOGLE CLOUD', 'DIGITALOCEAN', 'VERCEL', 'NETLIFY', 'RAILWAY',
  'RENDER', 'MONGODB', 'SUPABASE', 'PLANETSCALE',
  // E-commerce
  'SHOPIFY', 'BIGCOMMERCE', 'WIX', 'SQUARESPACE', 'WEBFLOW', 'MAILCHIMP', 'KLAVIYO',
  // Fitness & Health
  'STRAVA', 'MYFITNESSPAL', 'CALM', 'HEADSPACE', 'FITBIT', 'PELOTON',
  // Gaming
  'XBOX', 'PLAYSTATION', 'NINTENDO', 'EA PLAY', 'UBISOFT', 'GEFORCE NOW',
  // Physical Subscriptions
  'DOLLAR SHAVE', 'HELLOFRESH', 'BLUE APRON', 'BARKBOX', 'BIRCHBOX', 'FABFITFUN',
  'STITCH FIX', 'NATUREBOX',
  // Mobility
  'TESLA', 'UBER ONE', 'LYFT PINK', 'ZIPCAR',
  // News & Media
  'NEW YORK TIMES', 'WALL STREET JOURNAL', 'WASHINGTON POST', 'ECONOMIST',
  'BLOOMBERG', 'FINANCIAL TIMES', 'MEDIUM',
  // Consumer Apps
  'TINDER', 'BUMBLE', 'DISCORD', 'SNAPCHAT', 'TELEGRAM', 'LINKEDIN', 'REDDIT'
]);

// Helper function to check if a merchant is a known subscription
export function isKnownSubscription(merchant: string): boolean {
  const m = merchant.toUpperCase();
  for (const sub of KNOWN_SUBSCRIPTIONS) {
    if (m.includes(sub)) return true;
  }
  return false;
}