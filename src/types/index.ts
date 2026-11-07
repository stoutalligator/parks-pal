// Bucket List lives on `Park.isFavorite` instead — it's an independent
// wishlist flag, not a lifecycle stage, so a park can be favorited at any
// status (e.g. favorited AND planned) rather than one excluding the other.
export type ParkStatus = 'visited' | 'planned' | 'notVisited';

export type ParkRegion =
  | 'Northeast'
  | 'Southeast'
  | 'Midwest'
  | 'SouthCentral'
  | 'Mountain'
  | 'Pacific'
  | 'Alaska'
  | 'Hawaii';

export interface Park {
  id: string;
  name: string;
  state: string;
  region: ParkRegion;
  description: string;
  establishedYear: number;
  acres: number;
  /** Certified International Dark Sky Park (DarkSky International). */
  darkSkyPark?: boolean;
  status: ParkStatus;
  isFavorite: boolean;
  /** Approximate latitude/longitude of the park, used to place its pin on the Explore map. */
  lat: number;
  lng: number;
}

/** 'park' links to a park, 'event' is dated (fee-free day), 'info' is a plain heads-up. */
export type EventNoticeKind = 'park' | 'event' | 'info';

/**
 * A Home-screen notice set remotely in Supabase `app_config` (key
 * `event_notice`) so it can change without an app update. Dismissals are
 * remembered per `id`, so a new id shows again to everyone.
 */
export interface EventNotice {
  id: string;
  kind: EventNoticeKind;
  eyebrow: string;
  title: string;
  body?: string;
  /** For kind 'park' (or any kind): the park the link opens. */
  parkId?: string;
  linkLabel?: string;
  /** Inclusive "YYYY-MM-DD" window; either end may be left open. */
  startsAt?: string;
  endsAt?: string;
}

export type ActivityType =
  | 'Hiking'
  | 'Camping'
  | 'Wildlife'
  | 'Kayaking'
  | 'Scenic Drive'
  | 'Photography'
  | 'Stargazing'
  | 'Sunrise'
  | 'Sunset'
  | 'Viewpoint'
  | 'Other';

/** Activities only offered at specific parks (see PARK_GUIDES), stored by
 * label the same way as standard activities. */
export type ParkActivityType = 'Apple Picking';

export type TripActivity = ActivityType | ParkActivityType;

export interface TripTrailEntry {
  trailId?: string;
  name: string;
  miles: number;
  elevationGainFt: number;
  dayNumber?: number;
}

export type TripType = 'planned' | 'logged';

export type WeatherType =
  | 'Sunny'
  | 'PartlyCloudy'
  | 'Cloudy'
  | 'Rainy'
  | 'Stormy'
  | 'Snowy'
  | 'FlashFlood'
  | 'ExtremeHeat'
  | 'Foggy'
  | 'Windy';

export interface TripDayActivity {
  activity: TripActivity;
  viewpoint?: string;
}

// One entry per calendar day of a trip — the day-by-day breakdown of what
// happened (or, for a planned trip, what's hoped for) where and when.
// `date` is always derived from `trip.startDate + (dayNumber - 1)`, never
// stored directly, so editing a trip's dates can't leave it out of sync.
export interface TripDayEntry {
  dayNumber: number;
  date: string;
  activities: TripDayActivity[];
  trailsHiked: TripTrailEntry[];
  wildlifeSightings: string[];
  /** Optional so trips saved before the Field Guide existed still load. */
  floraSightings?: string[];
  weather?: WeatherType;
}

export interface Trip {
  id: string;
  parkId: string;
  tripType: TripType;
  startDate: string;
  endDate: string;
  activities: TripActivity[];
  notes: string;
  photos: string[];
  /** Optional caption per photo, index-aligned with `photos` (missing or
   * empty = no caption). */
  photoCaptions?: string[];
  weather?: string;
  favoriteTrail?: string;
  wildlifeSightings?: string[];
  floraSightings?: string[];
  trailsHiked?: TripTrailEntry[];
  rating?: number;
  milesHiked?: number;
  elevationGainFt?: number;
  /** Per-day breakdown — only present for trips saved through the day-by-day
   * flow. Absent/empty for older trips, which fall back to the flat fields
   * above for display. */
  days?: TripDayEntry[];
}

export type DayPlanSlot = 'Morning' | 'Midday' | 'Afternoon' | 'Evening';

export interface DayPlanStop {
  when: DayPlanSlot;
  text: string;
}

/** Per-park guide content keyed by Park.id — staged alongside Park rather than
 * merged into it, same pattern as TrailDetail. */
export interface ParkGuide {
  /** nps.gov park code, e.g. 'care' for https://www.nps.gov/care */
  npsCode: string;
  oneDay: DayPlanStop[];
  parkActivities?: ParkActivityType[];
}

/** A live alert from the NPS API (developer.nps.gov), stored verbatim — this
 * is NPS's wording, kept separate from Parks Pal's own written content. */
export interface ParkAlert {
  id: string;
  parkCode: string;
  /** NPS category, usually 'Danger' | 'Caution' | 'Park Closure' | 'Information'. */
  category: string;
  title: string;
  description: string;
  url?: string;
  lastIndexedDate?: string;
}

export type TrailDifficulty = 'Easy' | 'Moderate' | 'Hard';

export interface Trail {
  id: string;
  parkId: string;
  name: string;
  description: string;
  miles: number;
  elevationGainFt: number;
  difficulty: TrailDifficulty;
}

export type AnimalRarity = 'Common' | 'Uncommon' | 'Rare';

export interface Animal {
  id: string;
  parkId: string;
  name: string;
  description: string;
  rarity: AnimalRarity;
}

/** One sampled point along a trail's stylized (non-GPS) elevation profile. */
export interface ElevationPoint {
  mile: number;
  elevationFt: number;
  label?: string;
}

/**
 * Researched enrichment data for a Trail, keyed by Trail.id — a superset staged
 * separately from the base Trail shape (see docs/compendium-research and the
 * compendium-research skill) rather than merged into it, so list screens that
 * only need the base shape are unaffected.
 */
export interface TrailDetail {
  id: string;
  estimatedTime: string;
  bestSeason: string;
  tags: string[];
  trailTip: string;
  didYouKnow: string;
  elevationProfile: ElevationPoint[];
  lastVerified?: string;
  /** Extra place names that tie a live NPS alert to this trail when the alert
   * doesn't name the trail itself (e.g. "Mowich Lake" for its access road). */
  alertKeywords?: string[];
}

/** Researched enrichment data for an Animal, keyed by Animal.id — same staging pattern as TrailDetail. */
export interface AnimalDetail {
  id: string;
  scientificName: string;
  bestTimeOfDay: string;
  bestSeason: string;
  whereToLook: string;
  tags: string[];
  viewingTip: string;
  didYouKnow: string;
  lastVerified?: string;
}

export type PlantRarity = AnimalRarity;

export type PlantType = 'Wildflower' | 'Tree' | 'Shrub' | 'Cactus' | 'Succulent' | 'Fern' | 'Grass' | 'Vine';

export interface Plant {
  id: string;
  parkId: string;
  name: string;
  description: string;
  rarity: PlantRarity;
  type: PlantType;
  /** Months it blooms, 1 = January. Empty for plants grown for leaves or cones rather than flowers. */
  bloomMonths: number[];
}

/** Researched enrichment data for a Plant, keyed by Plant.id — same staging pattern as AnimalDetail. */
export interface PlantDetail {
  id: string;
  scientificName: string;
  whereToLook: string;
  /** A named nature trail or exhibit where the park features this plant. */
  natureTrail?: string;
  tags: string[];
  idTip: string;
  didYouKnow: string;
  /** Spines, toxicity or protected status — shown as a warning on the plant page. */
  caution?: string;
  lastVerified?: string;
}

export type BadgeCategory = 'parks' | 'activity' | 'region' | 'memory' | 'special' | 'distance' | 'secret';

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  earned: boolean;
  earnedDate?: string;
  progress?: number;
  goal?: number;
  /** Secret badges show as "???" in the Collection screen until earned. */
  secret?: boolean;
}

export interface UserStats {
  /** Parks currently in the app — 63, or more once an upcoming park is switched on. */
  totalParks: number;
  totalVisited: number;
  totalRemaining: number;
  bucketListCount: number;
  completionPercentage: number;
  totalTrips: number;
  totalPhotos: number;
  totalMilesHiked: number;
  totalElevationGain: number;
  statesVisited: number;
  favoriteActivity: string;
}

export type ExplorerStyle =
  | 'Casual Explorer'
  | 'Road Tripper'
  | 'Hiker'
  | 'Photographer'
  | 'Camper'
  | 'Completionist';

export type ExplorerGoal =
  | 'Visit 5 parks this year'
  | 'Complete one region'
  | 'Track past trips'
  | 'Visit all 63 National Parks';

export type ProfileBackground =
  | 'mountain-lake'
  | 'forest'
  | 'arches'
  | 'mountain-gate'
  | 'night-camping'
  | 'angels-landing'
  | 'half-dome';

export type ProfileAvatar =
  | 'hiking'
  | 'camping'
  | 'wildlife-viewing'
  | 'kayaking'
  | 'scenic-drive'
  | 'photography'
  | 'backpacking'
  | 'stargazing'
  | 'fishing'
  | 'horseback-riding'
  | 'nature-walk'
  | 'waterfall-hike'
  | 'picnic'
  | 'rock-climbing'
  | 'winter-activity'
  | 'channel-islands-fox'
  | 'acadia-puffin'
  | 'yellowstone-wolf'
  | 'pinnacles-condor'
  | 'everglades-manatee'
  | 'capitol-reef-apples';

export type Units = 'mi' | 'km';

export type ContentEntryType = 'trail' | 'animal' | 'plant';

export type ContentReportReason =
  | 'distance_elevation'
  | 'closed_or_permit'
  | 'difficulty'
  | 'wrong_park'
  | 'not_found_here'
  | 'rarity'
  | 'tip_wrong'
  | 'other';

// Row shapes for the per-user trail-completion / animal-sighting tables, as
// held in AppContext state and in the on-device snapshot cache.
export interface TrailCompletionRow {
  trail_id: string | null;
  trip_id: string | null;
  park_id: string;
  name: string;
  miles: number;
  elevation_gain_ft: number;
  day_number?: number | null;
}

export interface AnimalSightingRow {
  animal_id: string | null;
  trip_id: string | null;
  park_id: string;
  name: string;
  day_number?: number | null;
}

export interface PlantSightingRow {
  plant_id: string | null;
  trip_id: string | null;
  park_id: string;
  name: string;
  day_number?: number | null;
}

export interface ContentReportInput {
  entryType: ContentEntryType;
  entryId: string;
  entryName: string;
  parkId: string;
  reason: ContentReportReason;
  note?: string;
}

export interface UserProfile {
  name: string;
  explorerStyle?: ExplorerStyle;
  goal?: ExplorerGoal;
  onboardingComplete: boolean;
  profileBackground: ProfileBackground;
  avatar: ProfileAvatar;
  units: Units;
}
