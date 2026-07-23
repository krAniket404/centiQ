export function categorizeMerchant(merchant: string): string {
  const m = merchant.toUpperCase();

  // Groceries
  if (m.includes('INSTAMART') || m.includes('BLINKIT') || m.includes('ZEPTO') || m.includes('BIGBASKET') || m.includes('GROCER') || m.includes('DMART') || m.includes('FRESH') || m.includes('RELIANCE SMART')) return 'Groceries';

  // Food & Dining
  if (m.includes('SWIGGY') || m.includes('ZOMATO') || m.includes('DOMINOS') || m.includes('PIZZA') || m.includes('MCDONALD') || m.includes('KFC') || m.includes('BIRYANI') || m.includes('RESTAURANT') || m.includes('EATS')) return 'Food';

  // Shopping
  if (m.includes('AMAZON') || m.includes('FLIPKART') || m.includes('NYKAA') || m.includes('MEESHO') || m.includes('MYNTRA') || m.includes('AJIO') || m.includes('JIO MART') || m.includes('RELIANCE')) return 'Shopping';

  // Travel
  if (m.includes('UBER') || m.includes('RAPIDO') || m.includes('OLA') || m.includes('IRCTC') || m.includes('METRO') || m.includes('FUEL') || m.includes('PETROL') || m.includes('INDIAN OIL') || m.includes('FLIGHT') || m.includes('INDIGO')) return 'Travel';

  // Entertainment & Subscriptions
  if (m.includes('NETFLIX') || m.includes('SPOTIFY') || m.includes('HOTSTAR') || m.includes('PRIME') || m.includes('YOUTUBE') || m.includes('SONY')) return 'Entertainment';

  // Bills & Utilities
  if (m.includes('AIRTEL') || m.includes('JIO') || m.includes('VODAFONE') || m.includes('BSNL') || m.includes('ELECTRICITY') || m.includes('WATER') || m.includes('BROADBAND') || m.includes('GAS')) return 'Bills';

  // Health
  if (m.includes('PHARMACY') || m.includes('HOSPITAL') || m.includes('APOLLO') || m.includes('MEDPLUS') || m.includes('DOCTOR') || m.includes('HEALTH')) return 'Health';

  return 'Other';
}