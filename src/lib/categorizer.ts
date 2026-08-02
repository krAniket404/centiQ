export function categorizeMerchant(merchant: string): string {
  const m = merchant.toUpperCase();

  // 1. Groceries
  if (m.includes('INSTAMART') || m.includes('BLINKIT') || m.includes('ZEPTO') || m.includes('BIGBASKET') || m.includes('GROCER') || m.includes('DMART') || m.includes('FRESH') || m.includes('RELIANCE SMART') || m.includes('MORE SUPER') || m.includes('SPENCER') || m.includes('NATURES BASKET')) return 'Groceries';

  // 2. Food & Dining
  if (m.includes('SWIGGY') || m.includes('ZOMATO') || m.includes('DOMINOS') || m.includes('PIZZA') || m.includes('MCDONALD') || m.includes('KFC') || m.includes('BIRYANI') || m.includes('RESTAURANT') || m.includes('EATS') || m.includes('BURGER') || m.includes('CAFE') || m.includes('KITCHEN') || m.includes('DHABA') || m.includes('FOOD') || m.includes('BEVERAGE') || m.includes('COFFEE') || m.includes('TEA')) return 'Food';

  // 3. Shopping
  if (m.includes('AMAZON') || m.includes('FLIPKART') || m.includes('NYKAA') || m.includes('MEESHO') || m.includes('MYNTRA') || m.includes('AJIO') || m.includes('JIO MART') || m.includes('RELIANCE') || m.includes('MART') || m.includes('STORE') || m.includes('SHOP') || m.includes('BAZAAR') || m.includes('LIFESTYLE') || m.includes('PANTALOON') || m.includes('WESTSIDE')) return 'Shopping';

  // 4. Travel
  if (m.includes('UBER') || m.includes('RAPIDO') || m.includes('OLA') || m.includes('IRCTC') || m.includes('METRO') || m.includes('FUEL') || m.includes('PETROL') || m.includes('INDIAN OIL') || m.includes('FLIGHT') || m.includes('INDIGO') || m.includes('MAKEMYTRIP') || m.includes('REDBUS') || m.includes('TAXI') || m.includes('CAB') || m.includes('TRAIN') || m.includes('AIRLINE')) return 'Travel';

  // 5. Entertainment & Subscriptions
  if (m.includes('NETFLIX') || m.includes('SPOTIFY') || m.includes('HOTSTAR') || m.includes('PRIME') || m.includes('YOUTUBE') || m.includes('SONY') || m.includes('BOOKMYSHOW') || m.includes('PVR') || m.includes('CINEMA') || m.includes('GAMING')) return 'Entertainment';

  // 6. Bills & Utilities
  if (m.includes('AIRTEL') || m.includes('JIO') || m.includes('VODAFONE') || m.includes('IDEA') || m.includes('BSNL') || m.includes('ELECTRICITY') || m.includes('WATER') || m.includes('BROADBAND') || m.includes('GAS') || m.includes('DTH') || m.includes('TATA POWER') || m.includes('ADANI') || m.includes('RECHARGE')) return 'Bills';

  // 7. Health
  if (m.includes('PHARMACY') || m.includes('HOSPITAL') || m.includes('APOLLO') || m.includes('MEDPLUS') || m.includes('DOCTOR') || m.includes('HEALTH') || m.includes('CLINIC') || m.includes('MEDICAL') || m.includes('LAB')) return 'Health';

  // 8. Personal Care
  if (m.includes('SALON') || m.includes('SPA') || m.includes('BARBER') || m.includes('HAIR') || m.includes('BEAUTY') || m.includes('NAILS') || m.includes('GROOMING')) return 'Personal Care';

  return 'Other';
}