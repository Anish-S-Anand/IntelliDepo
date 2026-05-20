/**
 * Dummy Data Generator Service
 *
 * Generates realistic dummy data for incident analysis reports using deterministic seeding.
 * Ensures consistent data generation across multiple views of the same incident.
 */

// ---------------------------------------------------------------------------
// Data Template Constants
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  'James', 'Michael', 'Robert', 'John', 'David',
  'William', 'Richard', 'Joseph', 'Thomas', 'Christopher',
  'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald',
  'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones',
  'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'
];

const THEFT_ITEMS = [
  { item: 'Copper wire spool', valueRange: [200, 800] },
  { item: 'Power tools set', valueRange: [300, 1200] },
  { item: 'Electronic components', valueRange: [150, 600] },
  { item: 'Steel pipes bundle', valueRange: [400, 1500] },
  { item: 'Industrial equipment parts', valueRange: [500, 2000] },
  { item: 'Warehouse supplies', valueRange: [100, 500] },
  { item: 'Construction materials', valueRange: [250, 900] },
  { item: 'Electrical wiring', valueRange: [180, 700] },
];

const DIRECTIONS = [
  'North', 'South', 'East', 'West',
  'Northeast', 'Northwest', 'Southeast', 'Southwest'
];

const EXIT_POINTS = [
  'perimeter fence',
  'loading dock',
  'service gate',
  'maintenance entrance',
  'rear access point',
  'side entrance'
];

const BEHAVIOR_PATTERNS = [
  'Observed loitering near high-value storage area, frequent glances at security cameras',
  'Suspicious movement pattern, attempting to avoid camera coverage zones',
  'Prolonged presence without clear purpose, examining security infrastructure',
  'Erratic behavior, multiple attempts to access restricted areas',
  'Coordinated movement with potential accomplice, signaling behavior observed',
  'Unusual interest in warehouse layout, photographing facility',
  'Repeated circling of perimeter, testing security response times',
];

const HEIGHTS = ['5\'6"', '5\'8"', '5\'10"', '6\'0"', '6\'2"', '5\'7"', '5\'9"', '5\'11"', '6\'1"'];

const BUILDS = ['slim', 'average', 'athletic', 'heavy', 'stocky', 'lean'];

const CLOTHING = [
  'dark hoodie and jeans',
  'blue jacket and cargo pants',
  'black t-shirt and shorts',
  'gray sweatshirt and track pants',
  'red windbreaker and khakis',
  'green jacket and denim jeans',
  'white shirt and dark pants',
  'brown coat and work pants',
];

// ---------------------------------------------------------------------------
// Deterministic Random Number Generation
// ---------------------------------------------------------------------------

/**
 * Hash an incident ID to generate a numeric seed
 * @param incidentId - The incident ID to hash
 * @returns A positive integer seed value
 */
export function hashIncidentId(incidentId: string): number {
  let hash = 0;
  for (let i = 0; i < incidentId.length; i++) {
    const char = incidentId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a deterministic pseudo-random number between 0 and 1
 * @param seed - The base seed value
 * @param index - An index to vary the output for the same seed
 * @returns A pseudo-random number between 0 and 1
 */
export function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index) * 10000;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------------------
// Data Generation Functions
// ---------------------------------------------------------------------------

/**
 * Generate a realistic perpetrator name
 * @param seed - The seed value for deterministic generation
 * @returns A full name (first + last)
 */
export function generatePerpetratorName(seed: number): string {
  const firstIndex = Math.floor(seededRandom(seed, 0) * FIRST_NAMES.length);
  const lastIndex = Math.floor(seededRandom(seed, 1) * LAST_NAMES.length);
  return `${FIRST_NAMES[firstIndex]} ${LAST_NAMES[lastIndex]}`;
}

/**
 * Generate an identification number in format XX######
 * @param seed - The seed value for deterministic generation
 * @returns An identification number (e.g., "AB123456")
 */
export function generateIdentificationNumber(seed: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const letter1 = letters[Math.floor(seededRandom(seed, 2) * 26)];
  const letter2 = letters[Math.floor(seededRandom(seed, 3) * 26)];
  const numbers = Math.floor(seededRandom(seed, 4) * 1000000)
    .toString()
    .padStart(6, '0');
  return `${letter1}${letter2}${numbers}`;
}

/**
 * Generate a security officer badge ID in format SO-####
 * @param seed - The seed value for deterministic generation
 * @returns A badge ID (e.g., "SO-1234")
 */
export function generateBadgeId(seed: number): string {
  const badgeNumber = Math.floor(seededRandom(seed, 5) * 10000)
    .toString()
    .padStart(4, '0');
  return `SO-${badgeNumber}`;
}

/**
 * Generate a theft item with description and estimated value
 * @param seed - The seed value for deterministic generation
 * @returns An object with item description and formatted value
 */
export function generateTheftItem(seed: number): { description: string; value: string } {
  const itemIndex = Math.floor(seededRandom(seed, 6) * THEFT_ITEMS.length);
  const item = THEFT_ITEMS[itemIndex];
  const valueRange = item.valueRange[1] - item.valueRange[0];
  const value = item.valueRange[0] + Math.floor(seededRandom(seed, 7) * valueRange);
  return {
    description: item.item,
    value: `$${value.toLocaleString()}`,
  };
}

/**
 * Generate an escape route description
 * @param zoneId - The zone ID to reference in the route
 * @param seed - The seed value for deterministic generation
 * @returns An escape route description
 */
export function generateEscapeRoute(zoneId: string, seed: number): string {
  const directionIndex = Math.floor(seededRandom(seed, 8) * DIRECTIONS.length);
  const exitIndex = Math.floor(seededRandom(seed, 9) * EXIT_POINTS.length);
  const targetZone = String.fromCharCode(65 + Math.floor(seededRandom(seed, 10) * 6)); // A-F
  return `${DIRECTIONS[directionIndex]} via ${EXIT_POINTS[exitIndex]} toward Zone ${targetZone}`;
}

/**
 * Generate a behavior pattern description
 * @param seed - The seed value for deterministic generation
 * @returns A behavior pattern description
 */
export function generateBehaviorPattern(seed: number): string {
  const patternIndex = Math.floor(seededRandom(seed, 11) * BEHAVIOR_PATTERNS.length);
  return BEHAVIOR_PATTERNS[patternIndex];
}

/**
 * Generate a physical description of a perpetrator
 * @param seed - The seed value for deterministic generation
 * @returns A physical description string
 */
export function generatePhysicalDescription(seed: number): string {
  const heightIndex = Math.floor(seededRandom(seed, 12) * HEIGHTS.length);
  const buildIndex = Math.floor(seededRandom(seed, 13) * BUILDS.length);
  const clothingIndex = Math.floor(seededRandom(seed, 14) * CLOTHING.length);
  
  return `Approximately ${HEIGHTS[heightIndex]}, ${BUILDS[buildIndex]} build, wearing ${CLOTHING[clothingIndex]}`;
}

/**
 * Generate a timestamp with variance from a base time
 * @param baseTime - The base timestamp to offset from
 * @param offsetMinutes - The number of minutes to offset (can be negative)
 * @param seed - The seed value for deterministic generation
 * @returns A formatted timestamp string
 */
export function generateTimestamp(baseTime: Date, offsetMinutes: number, seed: number): string {
  const variance = Math.floor(seededRandom(seed, 15) * 10) - 5; // ±5 minutes variance
  const adjustedOffset = offsetMinutes + variance;
  const timestamp = new Date(baseTime.getTime() + adjustedOffset * 60000);
  
  return timestamp.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Generate a security officer name
 * @param seed - The seed value for deterministic generation
 * @returns A full name for a security officer
 */
export function generateOfficerName(seed: number): string {
  const firstIndex = Math.floor(seededRandom(seed, 16) * FIRST_NAMES.length);
  const lastIndex = Math.floor(seededRandom(seed, 17) * LAST_NAMES.length);
  return `${FIRST_NAMES[firstIndex]} ${LAST_NAMES[lastIndex]}`;
}

/**
 * Generate an entry point description
 * @param zoneId - The zone ID to reference
 * @param seed - The seed value for deterministic generation
 * @returns An entry point description
 */
export function generateEntryPoint(zoneId: string, seed: number): string {
  const directionIndex = Math.floor(seededRandom(seed, 18) * DIRECTIONS.length);
  const entryTypes = ['Gate', 'Fence Section', 'Access Point', 'Entrance'];
  const entryIndex = Math.floor(seededRandom(seed, 19) * entryTypes.length);
  return `${DIRECTIONS[directionIndex]} ${entryTypes[entryIndex]} - Zone ${zoneId}`;
}

/**
 * Generate loitering duration in minutes
 * @param seed - The seed value for deterministic generation
 * @returns A formatted duration string
 */
export function generateLoiteringDuration(seed: number): string {
  const minutes = 5 + Math.floor(seededRandom(seed, 20) * 55); // 5-60 minutes
  if (minutes < 60) {
    return `${minutes} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
}

/**
 * Generate camera coverage area description
 * @param seed - The seed value for deterministic generation
 * @returns A coverage area description
 */
export function generateCoverageArea(seed: number): string {
  const areas = [
    'Main warehouse entrance and loading bay',
    'North perimeter and storage yard',
    'East side parking and access road',
    'South loading docks and truck bay',
    'West perimeter fence line',
    'Central warehouse floor',
    'Equipment storage area',
    'Vehicle maintenance zone',
  ];
  const areaIndex = Math.floor(seededRandom(seed, 21) * areas.length);
  return areas[areaIndex];
}

/**
 * Generate proximity to assets description
 * @param seed - The seed value for deterministic generation
 * @returns A proximity description
 */
export function generateProximityToAssets(seed: number): string {
  const distance = 10 + Math.floor(seededRandom(seed, 22) * 90); // 10-100 meters
  const assets = [
    'high-value equipment storage',
    'inventory warehouse',
    'vehicle fleet parking',
    'fuel storage area',
    'electronics depot',
    'tool and parts storage',
  ];
  const assetIndex = Math.floor(seededRandom(seed, 23) * assets.length);
  return `Approximately ${distance}m from ${assets[assetIndex]}`;
}
