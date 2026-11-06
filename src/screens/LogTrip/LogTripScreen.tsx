import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, Polygon, Circle, Line, Polyline } from 'react-native-svg';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useApp } from '@/context/AppContext';
import { colors, spacing, radius, shadows, typography } from '@/theme';
import {
  ActivityType,
  ParkActivityType,
  TripActivity,
  TripTrailEntry,
  TrailDifficulty,
  AnimalRarity,
  TripDayActivity,
  TripDayEntry,
  WeatherType,
  Trail,
  Animal,
  Units,
} from '@/types';
import { getParkGuide } from '@/data/parkGuides';
import PrimaryButton from '@/components/PrimaryButton';
import PhotoCaptionSheet from '@/components/PhotoCaptionSheet';
import DateRangePicker from '@/components/DateRangePicker';
import { showToast } from '@/components/Toast';
import { convertMiles, convertFeet, toMiles, toFeet, distanceLabel, elevationLabel } from '@/utils/units';
import { formatDateRange, addDays, dayCountBetween, parseLocalDate } from '@/utils/dates';
import { successHaptic } from '@/utils/haptics';

type FormMode = 'plan' | 'log' | 'complete';

const HERO_ACTIVITY_IMAGES: number[] = [
  require('@/assets/activities/pal-hiking.png'),
  require('@/assets/activities/pal-camping.png'),
  require('@/assets/activities/pal-wildlife-viewing.png'),
  require('@/assets/activities/pal-kayaking.png'),
  require('@/assets/activities/pal-scenic-drive.png'),
  require('@/assets/activities/pal-photography.png'),
  require('@/assets/activities/pal-backpacking.png'),
  require('@/assets/activities/pal-stargazing.png'),
  require('@/assets/activities/pal-fishing.png'),
  require('@/assets/activities/pal-horseback-riding.png'),
  require('@/assets/activities/pal-nature-walk.png'),
  require('@/assets/activities/pal-waterfall-hike.png'),
  require('@/assets/activities/pal-picnic.png'),
  require('@/assets/activities/pal-rock-climbing.png'),
  require('@/assets/activities/pal-winter-activity.png'),
];

function randomHeroImage(): number {
  return HERO_ACTIVITY_IMAGES[Math.floor(Math.random() * HERO_ACTIVITY_IMAGES.length)];
}

function BackArrowIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path d="M10 2 4 8l6 6" fill="none" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BootIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 4H11V9L19 12Q21 12.8 21 15V17H4Z"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M4 14.5h17" stroke={color} strokeWidth={1.1} strokeLinecap="round" />
      <Path d="M5.3 5.5h4M5.3 7.5h4" stroke={color} strokeWidth={1} strokeLinecap="round" />
    </Svg>
  );
}

function TentIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3.3 2.6 19.5h18.8L12 3.3z" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M12 3.3 8.5 19.5" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <Path d="M12 3.3 15.5 19.5" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <Path d="M10.2 19.5 12 12.3l1.8 7.2" fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M1.5 19.5h21" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function PawIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="15.7" r="5" fill={color} />
      <Circle cx="5.3" cy="9.6" r="2.3" fill={color} />
      <Circle cx="10.6" cy="5.3" r="2.2" fill={color} />
      <Circle cx="15.6" cy="5.3" r="2.2" fill={color} />
      <Circle cx="18.7" cy="9.6" r="2.3" fill={color} />
    </Svg>
  );
}

function PaddleIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5.2 18.8 18.8 5.2" stroke={color} strokeWidth={2.1} strokeLinecap="round" />
      <Path
        d="M2.3 21.7c1.7 0 3.8-.8 4.9-1.9s1.9-3.2 1.9-4.9"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M21.7 2.3c0 1.7-.8 3.8-1.9 4.9s-3.2 1.9-4.9 1.9"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="1.3" fill={color} />
    </Svg>
  );
}

function CarIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4.4 14.6 5.9 9.4a2.2 2.2 0 0 1 2.1-1.6h7.9a2.2 2.2 0 0 1 2.1 1.6l1.5 5.2"
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M2.7 18.9h-.9a1 1 0 0 1-1-1v-2.3a1 1 0 0 1 1-1h20.4a1 1 0 0 1 1 1v2.3a1 1 0 0 1-1 1h-.9"
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M7.9 11.1h8.2" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx="7" cy="18.9" r="1.9" fill="none" stroke={color} strokeWidth={1.7} />
      <Circle cx="17" cy="18.9" r="1.9" fill="none" stroke={color} strokeWidth={1.7} />
    </Svg>
  );
}

function CameraIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3 8.3A1.8 1.8 0 0 1 4.8 6.5h2.1l1-1.6a1.6 1.6 0 0 1 1.4-.8h5.4a1.6 1.6 0 0 1 1.4.8l1 1.6h2.1A1.8 1.8 0 0 1 21 8.3v9A1.8 1.8 0 0 1 19.2 19H4.8A1.8 1.8 0 0 1 3 17.3z"
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12.8" r="3.5" fill="none" stroke={color} strokeWidth={1.7} />
      <Circle cx="17.3" cy="9" r="0.6" fill={color} />
    </Svg>
  );
}

function StarIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2.4c.4 3.3 1.1 5.4 2.1 6.4s3.1 1.7 6.5 2.1c-3.4.4-5.5 1.1-6.5 2.1s-1.7 3.1-2.1 6.5c-.4-3.4-1.1-5.5-2.1-6.5s-3.1-1.7-6.5-2.1c3.4-.4 5.5-1.1 6.5-2.1s1.7-3.1 2.1-6.4z"
        fill={color}
      />
      <Circle cx="19.3" cy="5" r="1.1" fill={color} />
      <Circle cx="4.3" cy="16.7" r="0.9" fill={color} />
    </Svg>
  );
}

function SunriseIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2 18.6h20" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M6 18.6a6 6 0 0 1 12 0" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path
        d="M12 3.4v3.1M5.6 8 7.7 10.1M18.4 8 16.3 10.1"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path d="M9.2 15.3 12 12.5l2.8 2.8" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SunsetIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2 18.6h20" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M6 18.6a6 6 0 0 1 12 0" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path
        d="M12 3.4v3.1M5.6 8 7.7 10.1M18.4 8 16.3 10.1"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path d="M9.2 12.5 12 15.3l2.8-2.8" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CompassIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth={1.8} />
      <Path d="M15.3 8.7 13 13l-4.3 2.3L11 11z" fill={color} />
      <Circle cx="12" cy="12" r="1.1" fill={color} />
    </Svg>
  );
}

function BinocularsIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="6.5" cy="15.5" r="4" fill="none" stroke={color} strokeWidth={1.8} />
      <Circle cx="17.5" cy="15.5" r="4" fill="none" stroke={color} strokeWidth={1.8} />
      <Path d="M10.5 15.2h3" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M3.2 13.2 5.6 5.4a1.6 1.6 0 0 1 3.1.5v5.8M20.8 13.2l-2.4-7.8a1.6 1.6 0 0 0-3.1.5v5.8" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function AppleIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 7.6c-1.3-1-3.9-1.5-5.6.2-2 2-1.6 6 .3 9.2 1.3 2.2 2.9 3.6 4.1 3 .7-.3 1.7-.3 2.4 0 1.2.6 2.8-.8 4.1-3 1.9-3.2 2.3-7.2.3-9.2-1.7-1.7-4.3-1.2-5.6-.2z"
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path d="M12 7.6c0-1.8.6-3.4 1.8-4.6" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M12.6 5.4c1.6-1.4 3.6-1.5 4.8-1-.6 1.6-2.6 2.6-4.8 1z" fill={color} />
    </Svg>
  );
}

const WEATHER_CLOUD_PATH = 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z';

export function WeatherSunnyIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="4.2" fill="none" stroke={color} strokeWidth={1.6} />
      <Path
        d="M18.3 12h2.1M16.45 16.45l1.49 1.49M12 18.3v2.1M7.55 16.45l-1.49 1.49M5.7 12H3.6M7.55 7.55 6.06 6.06M12 5.7V3.6M16.45 7.55l1.49-1.49"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function WeatherPartlyCloudyIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="8.5" cy="8" r="3.2" fill="none" stroke={color} strokeWidth={1.5} />
      <Path
        d="M5.53 10.97 4.4 12.1M4.3 8H2.7M5.53 5.03 4.4 3.9M8.5 3.8V2.2"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d={WEATHER_CLOUD_PATH}
        transform="translate(4,4) scale(0.8)"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function WeatherCloudyIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={WEATHER_CLOUD_PATH}
        transform="translate(-1,-4) scale(0.55)"
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={WEATHER_CLOUD_PATH}
        transform="translate(4,3) scale(0.85)"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function WeatherRainyIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={WEATHER_CLOUD_PATH}
        transform="translate(3,-2) scale(0.75)"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 15 6.5 19M12 15l-1.5 4M16 15l-1.5 4"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function WeatherStormyIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={WEATHER_CLOUD_PATH}
        transform="translate(3,-2) scale(0.75)"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M13 14 9.5 18.5h2.3L10.8 22 15 16.5h-2.4z" fill={color} />
    </Svg>
  );
}

export function WeatherSnowyIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={WEATHER_CLOUD_PATH}
        transform="translate(3,-2) scale(0.75)"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7.5 15.4v2.2M6.4 16.5h2.2M6.62 15.62l1.76 1.76M8.38 15.62 6.62 17.38M12 16.7v2.6M10.7 18h2.6M10.86 16.86l1.28 1.28M12.14 16.86l-1.28 1.28M16.5 15.4v2.2M15.4 16.5h2.2M15.62 15.62l1.76 1.76M17.38 15.62l-1.76 1.76"
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function WeatherFlashFloodIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={WEATHER_CLOUD_PATH}
        transform="translate(3,-3) scale(0.7)"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M8.5 11.2 7.7 13M12.5 11.2l-.8 1.8M16.5 11.2l-.8 1.8" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <Path
        d="M2.5 17c1.6 0 1.6-1.2 3.2-1.2s1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3 1.2M2.5 20.6c1.6 0 1.6-1.2 3.2-1.2s1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3 1.2"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function WeatherExtremeHeatIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M8 4.5a2 2 0 0 1 4 0v9.3a3.8 3.8 0 1 1-4 0z"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Circle cx="10" cy="17" r="1.7" fill={color} />
      <Path d="M10 15.3V8" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M15.5 6.5h2.5M15.5 10h4M15.5 13.5h2.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

export function WeatherFoggyIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={WEATHER_CLOUD_PATH}
        transform="translate(3,-3) scale(0.7)"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M3 15h13M6 18.2h15M3 21.4h12" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function WeatherWindyIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M2.5 9h11.3a2.7 2.7 0 1 0-2.6-3.3M2.5 13h16.2a2.8 2.8 0 1 1-2.6 3.6M2.5 17h8.5"
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TreeIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Polygon points="10,2 4,10 7,10 3,15 8,15 8,18 12,18 12,15 17,15 13,10 16,10" fill={color} />
    </Svg>
  );
}

function CloseIcon({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      <Line x1="1" y1="1" x2="9" y2="9" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1="9" y1="1" x2="1" y2="9" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function CheckIcon({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12">
      <Polyline points="2,6 5,9 10,3" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" style={expanded ? styles.chevronExpanded : undefined}>
      <Path d="M3 5l4 4 4-4" fill="none" stroke={colors.textSecondary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

interface AccordionProps {
  title: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

// Each field group (Park, Dates, Activities, Trails, Wildlife, Notes,
// Photos) collapses into a one-line summary until tapped — the form used to
// show everything at once, which made it feel long and hard to scan.
function Accordion({ title, summary, expanded, onToggle, children }: AccordionProps) {
  return (
    <View style={styles.accordionCard}>
      <TouchableOpacity style={styles.accordionHeader} onPress={onToggle} activeOpacity={0.75}>
        <View style={styles.accordionHeaderText}>
          <Text style={styles.accordionTitle}>{title}</Text>
          <Text style={styles.accordionSummary} numberOfLines={1}>{summary}</Text>
        </View>
        <ChevronIcon expanded={expanded} />
      </TouchableOpacity>
      {expanded && <View style={styles.accordionBody}>{children}</View>}
    </View>
  );
}

const MAX_PHOTOS = 3;

const DIFFICULTY_RANK: Record<TrailDifficulty, number> = { Easy: 0, Moderate: 1, Hard: 2 };
const RARITY_RANK: Record<AnimalRarity, number> = { Common: 0, Uncommon: 1, Rare: 2 };

const ACTIVITIES: { label: ActivityType; render: (color: string) => React.ReactElement }[] = [
  { label: 'Hiking', render: (c) => <BootIcon color={c} /> },
  { label: 'Camping', render: (c) => <TentIcon color={c} /> },
  { label: 'Wildlife', render: (c) => <PawIcon color={c} /> },
  { label: 'Kayaking', render: (c) => <PaddleIcon color={c} /> },
  { label: 'Scenic Drive', render: (c) => <CarIcon color={c} /> },
  { label: 'Photography', render: (c) => <CameraIcon color={c} /> },
  { label: 'Stargazing', render: (c) => <StarIcon color={c} /> },
  { label: 'Sunrise', render: (c) => <SunriseIcon color={c} /> },
  { label: 'Sunset', render: (c) => <SunsetIcon color={c} /> },
  { label: 'Viewpoint', render: (c) => <BinocularsIcon color={c} /> },
  { label: 'Other', render: (c) => <CompassIcon color={c} /> },
];

const WEATHER_OPTIONS: { type: WeatherType; label: string; render: (color: string) => React.ReactElement }[] = [
  { type: 'Sunny', label: 'Sunny', render: (c) => <WeatherSunnyIcon color={c} /> },
  { type: 'PartlyCloudy', label: 'Partly Cloudy', render: (c) => <WeatherPartlyCloudyIcon color={c} /> },
  { type: 'Cloudy', label: 'Cloudy', render: (c) => <WeatherCloudyIcon color={c} /> },
  { type: 'Rainy', label: 'Rainy', render: (c) => <WeatherRainyIcon color={c} /> },
  { type: 'Stormy', label: 'Stormy', render: (c) => <WeatherStormyIcon color={c} /> },
  { type: 'Snowy', label: 'Snowy', render: (c) => <WeatherSnowyIcon color={c} /> },
  { type: 'FlashFlood', label: 'Flash Flood', render: (c) => <WeatherFlashFloodIcon color={c} /> },
  { type: 'ExtremeHeat', label: 'Extreme Heat', render: (c) => <WeatherExtremeHeatIcon color={c} /> },
  { type: 'Foggy', label: 'Foggy / Smoky', render: (c) => <WeatherFoggyIcon color={c} /> },
  { type: 'Windy', label: 'Windy', render: (c) => <WeatherWindyIcon color={c} /> },
];

const PARK_ACTIVITY_ICONS: Record<ParkActivityType, (color: string) => React.ReactElement> = {
  'Apple Picking': (c) => <AppleIcon color={c} />,
};

function viewpointPlaceholder(activity: TripActivity): string {
  if (activity === 'Other') return 'What did you do? (optional)';
  if (activity === 'Viewpoint') return 'Which viewpoints? e.g. Sunset Point (optional)';
  return 'Where? (optional)';
}

function RatingStarIcon({ filled, size = 26 }: { filled: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon
        points="12,2 14.9,9 22.5,9.3 16.4,14 18.5,21.3 12,17.1 5.5,21.3 7.6,14 1.5,9.3 9.1,9"
        fill={filled ? colors.orange : colors.divider}
      />
    </Svg>
  );
}

// Per-day form state — one of these per calendar day of the trip, lifted up
// into LogTripScreen's `dayEntries` map so Save can assemble the full
// TripDayEntry[] the same shape AppContext expects.
interface DayFormState {
  activities: TripDayActivity[];
  trails: TripTrailEntry[];
  wildlife: string[];
  weather?: WeatherType;
}

function emptyDay(): DayFormState {
  return { activities: [], trails: [], wildlife: [] };
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const PAGE_WIDTH = SCREEN_WIDTH - spacing.xl * 2;

interface DayPageProps {
  dayNumber: number;
  dateLabel: string;
  mode: FormMode;
  units: Units;
  parkTrails: Trail[];
  parkAnimals: Animal[];
  parkActivities: ParkActivityType[];
  value: DayFormState;
  onChange: (next: DayFormState) => void;
  width: number;
}

// The day pager's per-page content — this is the same picker UI the flat
// form used to show once for the whole trip (activity chips + viewpoint,
// trail picker with custom-add, wildlife picker with custom-add, weather),
// just scoped to a single day's DayFormState instead of the whole trip.
function DayPage({ dayNumber, dateLabel, mode, units, parkTrails, parkAnimals, parkActivities, value, onChange, width }: DayPageProps) {
  const [wildlifeInput, setWildlifeInput] = useState('');
  const [customTrailName, setCustomTrailName] = useState('');
  const [customTrailMiles, setCustomTrailMiles] = useState('');
  const [customTrailElevation, setCustomTrailElevation] = useState('');
  const [editingTrailKey, setEditingTrailKey] = useState<string | null>(null);
  const [editMiles, setEditMiles] = useState('');
  const [editElevation, setEditElevation] = useState('');

  const pageScrollRef = useRef<ScrollView>(null);
  const pageScrollY = useRef(0);
  const trailCardRefs = useRef<Record<string, View | null>>({});

  const trailKeyOf = (entry: { trailId?: string; name: string }) => entry.trailId ?? entry.name;

  // Scroll the newly-opened edit card into view — it renders down in the
  // "Your Trails" summary list, well below the trail chips someone just
  // tapped, so without this it can pop up entirely off-screen.
  useEffect(() => {
    if (!editingTrailKey) return;
    const card = trailCardRefs.current[editingTrailKey];
    const scroller = pageScrollRef.current;
    if (!card || !scroller) return;
    requestAnimationFrame(() => {
      card.measureInWindow((_cardX, cardY, _w, cardHeight) => {
        // ScrollView's TS types omit measureInWindow even though the
        // underlying native component implements it.
        (scroller as unknown as { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void }).measureInWindow((_containerX: number, containerY: number, _cw: number, containerHeight: number) => {
          const cardCenter = cardY + cardHeight / 2;
          const viewportCenter = containerY + containerHeight / 2;
          const targetY = Math.max(0, pageScrollY.current + (cardCenter - viewportCenter));
          scroller.scrollTo({ y: targetY, animated: true });
        });
      });
    });
  }, [editingTrailKey]);

  const toggleActivity = (label: TripActivity) => {
    const exists = value.activities.some((a) => a.activity === label);
    onChange({
      ...value,
      activities: exists
        ? value.activities.filter((a) => a.activity !== label)
        : [...value.activities, { activity: label }],
    });
  };

  const setViewpoint = (label: TripActivity, text: string) => {
    onChange({
      ...value,
      activities: value.activities.map((a) => (a.activity === label ? { ...a, viewpoint: text } : a)),
    });
  };

  const toggleTrail = (trailId: string, name: string, miles: number, elevationGainFt: number) => {
    const active = value.trails.some((t) => t.trailId === trailId);
    if (active) {
      onChange({ ...value, trails: value.trails.filter((t) => t.trailId !== trailId) });
      if (editingTrailKey === trailId) setEditingTrailKey(null);
      return;
    }
    onChange({ ...value, trails: [...value.trails, { trailId, name, miles, elevationGainFt }] });
    setEditingTrailKey(trailId);
    setEditMiles(convertMiles(miles, units).toFixed(1));
    setEditElevation(Math.round(convertFeet(elevationGainFt, units)).toString());
  };

  const addCustomTrail = () => {
    const name = customTrailName.trim();
    const enteredDistance = parseFloat(customTrailMiles);
    if (!name || Number.isNaN(enteredDistance)) return;
    const miles = toMiles(enteredDistance, units);
    const elevationGainFt = toFeet(parseFloat(customTrailElevation) || 0, units);
    onChange({ ...value, trails: [...value.trails, { name, miles, elevationGainFt }] });
    setCustomTrailName('');
    setCustomTrailMiles('');
    setCustomTrailElevation('');
  };

  const removeTrail = (entry: TripTrailEntry) => {
    onChange({
      ...value,
      trails: value.trails.filter((t) => (entry.trailId ? t.trailId !== entry.trailId : t.name !== entry.name)),
    });
    if (editingTrailKey === trailKeyOf(entry)) setEditingTrailKey(null);
  };

  const startEditTrail = (entry: TripTrailEntry) => {
    setEditingTrailKey(trailKeyOf(entry));
    setEditMiles(convertMiles(entry.miles, units).toFixed(1));
    setEditElevation(Math.round(convertFeet(entry.elevationGainFt, units)).toString());
  };

  const saveEditTrail = (entry: TripTrailEntry) => {
    const enteredDistance = parseFloat(editMiles);
    const miles = Number.isNaN(enteredDistance) ? entry.miles : toMiles(enteredDistance, units);
    const elevationGainFt = toFeet(parseFloat(editElevation) || 0, units);
    onChange({
      ...value,
      trails: value.trails.map((t) => (trailKeyOf(t) === trailKeyOf(entry) ? { ...t, miles, elevationGainFt } : t)),
    });
    setEditingTrailKey(null);
  };

  const addWildlifeSighting = () => {
    const trimmed = wildlifeInput.trim();
    if (!trimmed || value.wildlife.some((w) => w.toLowerCase() === trimmed.toLowerCase())) {
      setWildlifeInput('');
      return;
    }
    onChange({ ...value, wildlife: [...value.wildlife, trimmed] });
    setWildlifeInput('');
  };

  const removeWildlifeSighting = (sighting: string) => {
    onChange({ ...value, wildlife: value.wildlife.filter((w) => w !== sighting) });
  };

  const toggleAnimal = (name: string) => {
    const exists = value.wildlife.some((w) => w.toLowerCase() === name.toLowerCase());
    onChange({
      ...value,
      wildlife: exists
        ? value.wildlife.filter((w) => w.toLowerCase() !== name.toLowerCase())
        : [...value.wildlife, name],
    });
  };

  const toggleWeather = (type: WeatherType) => {
    onChange({ ...value, weather: value.weather === type ? undefined : type });
  };

  return (
    <View style={[styles.dayPage, { width }]}>
      <ScrollView
        ref={pageScrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.dayPageContent}
        nestedScrollEnabled
        onScroll={(e) => { pageScrollY.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
      >
        <Text style={styles.dayPageTitle}>Day {dayNumber} · {dateLabel}</Text>

        <Text style={styles.sublabel}>{mode === 'plan' ? 'What are you hoping to do?' : 'What did you do?'}</Text>
        <View style={styles.activityGrid}>
          {ACTIVITIES.map(({ label, render }) => {
            const active = value.activities.some((a) => a.activity === label);
            const iconColor = active ? colors.textInverse : colors.brown;
            return (
              <TouchableOpacity
                key={label}
                style={[styles.activityChip, active && styles.activityChipActive]}
                onPress={() => toggleActivity(label)}
                activeOpacity={0.8}
              >
                {render(iconColor)}
                <Text style={[styles.activityLabel, active && styles.activityLabelActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {parkActivities.length > 0 && (
          <>
            <Text style={[styles.sublabel, styles.sublabelSpaced]}>Only at this park</Text>
            <View style={styles.activityGrid}>
              {parkActivities.map((label) => {
                const active = value.activities.some((a) => a.activity === label);
                const iconColor = active ? colors.textInverse : colors.brown;
                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.activityChip, active && styles.activityChipActive]}
                    onPress={() => toggleActivity(label)}
                    activeOpacity={0.8}
                  >
                    {PARK_ACTIVITY_ICONS[label](iconColor)}
                    <Text style={[styles.activityLabel, active && styles.activityLabelActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Hiking and Wildlife already get their "what/where" from the trail
            and animal pickers below, so a separate viewpoint field would just
            duplicate that. "Other" asks what happened instead of where,
            since there's no picker to fall back on for it. */}
        {value.activities.some((a) => a.activity !== 'Hiking' && a.activity !== 'Wildlife') && (
          <View style={styles.viewpointList}>
            {value.activities
              .filter((a) => a.activity !== 'Hiking' && a.activity !== 'Wildlife')
              .map((a) => (
                <View key={a.activity} style={styles.viewpointRow}>
                  <Text style={styles.viewpointLabel}>{a.activity}</Text>
                  <TextInput
                    style={styles.wildlifeInput}
                    placeholder={viewpointPlaceholder(a.activity)}
                    placeholderTextColor={colors.textMuted}
                    value={a.viewpoint ?? ''}
                    onChangeText={(t) => setViewpoint(a.activity, t)}
                  />
                </View>
              ))}
          </View>
        )}

        {/* Trails can be planned ahead of time too — picking them now doesn't
            affect stats/badges, since those only ever look at logged trips,
            but it lets someone map out which trails they want each day
            before the trip happens. */}
        <>
            <Text style={[styles.sublabel, styles.sublabelSpaced]}>
              {mode === 'plan' ? "Trails you'd like to hike" : 'Trails'}
            </Text>
            {parkTrails.length > 0 && (
              <View style={styles.trailList}>
                {parkTrails.map((trail) => {
                  const active = value.trails.some((t) => t.trailId === trail.id);
                  return (
                    <TouchableOpacity
                      key={trail.id}
                      style={[styles.trailChip, active && styles.trailChipActive]}
                      onPress={() => toggleTrail(trail.id, trail.name, trail.miles, trail.elevationGainFt)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.trailChipName, active && styles.trailChipNameActive]}>{trail.name}</Text>
                      <Text style={[styles.trailChipMeta, active && styles.trailChipMetaActive]}>
                        {convertMiles(trail.miles, units).toFixed(1)} {distanceLabel(units)} · {Math.round(convertFeet(trail.elevationGainFt, units)).toLocaleString()} {elevationLabel(units)} gain
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={[styles.sublabel, styles.sublabelSpaced]}>Add a trail we don't have</Text>
            <TextInput
              style={[styles.wildlifeInput, styles.customTrailNameInput]}
              placeholder="Trail name"
              placeholderTextColor={colors.textMuted}
              value={customTrailName}
              onChangeText={setCustomTrailName}
            />
            <View style={styles.customTrailRow}>
              <TextInput
                style={[styles.wildlifeInput, styles.customTrailNumberInput]}
                placeholder={distanceLabel(units) === 'mi' ? 'Miles' : 'Kilometers'}
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={customTrailMiles}
                onChangeText={setCustomTrailMiles}
              />
              <TextInput
                style={[styles.wildlifeInput, styles.customTrailNumberInput]}
                placeholder={`Elev. ${elevationLabel(units)}`}
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={customTrailElevation}
                onChangeText={setCustomTrailElevation}
              />
              <TouchableOpacity style={styles.wildlifeAddBtn} onPress={addCustomTrail} activeOpacity={0.8}>
                <Text style={styles.wildlifeAddBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {value.trails.length > 0 && (
              <>
                <Text style={[styles.sublabel, styles.sublabelSpaced]}>Your Trails</Text>
                <View style={styles.trailSummaryList}>
                  {value.trails.map((entry) => {
                    const editing = editingTrailKey === trailKeyOf(entry);
                    return (
                      <View
                        key={trailKeyOf(entry)}
                        ref={(node) => { trailCardRefs.current[trailKeyOf(entry)] = node; }}
                        style={styles.trailSummaryCard}
                      >
                        {editing ? (
                          <>
                            <Text style={styles.trailSummaryName}>{entry.name}</Text>
                            <View style={styles.customTrailRow}>
                              <TextInput
                                style={[styles.wildlifeInput, styles.customTrailNumberInput]}
                                placeholder={distanceLabel(units) === 'mi' ? 'Miles' : 'Kilometers'}
                                placeholderTextColor={colors.textMuted}
                                keyboardType="decimal-pad"
                                value={editMiles}
                                onChangeText={setEditMiles}
                                autoFocus
                              />
                              <TextInput
                                style={[styles.wildlifeInput, styles.customTrailNumberInput]}
                                placeholder={`Elev. ${elevationLabel(units)}`}
                                placeholderTextColor={colors.textMuted}
                                keyboardType="decimal-pad"
                                value={editElevation}
                                onChangeText={setEditElevation}
                              />
                              <TouchableOpacity style={styles.wildlifeAddBtn} onPress={() => saveEditTrail(entry)} activeOpacity={0.8}>
                                <CheckIcon color={colors.textInverse} />
                              </TouchableOpacity>
                            </View>
                          </>
                        ) : (
                          <TouchableOpacity style={styles.trailSummaryRow} onPress={() => startEditTrail(entry)} activeOpacity={0.7}>
                            <View style={styles.trailSummaryText}>
                              <Text style={styles.trailSummaryName}>{entry.name}</Text>
                              <Text style={styles.trailSummaryMeta}>
                                {convertMiles(entry.miles, units).toFixed(1)} {distanceLabel(units)} · {Math.round(convertFeet(entry.elevationGainFt, units)).toLocaleString()} {elevationLabel(units)} gain
                              </Text>
                            </View>
                            <Text style={styles.trailSummaryEdit}>Edit</Text>
                            <TouchableOpacity onPress={() => removeTrail(entry)} hitSlop={8}>
                              <CloseIcon color={colors.orange} />
                            </TouchableOpacity>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              </>
            )}
        </>

        {mode !== 'plan' && (
          <>
            <Text style={[styles.sublabel, styles.sublabelSpaced]}>Wildlife Spotted</Text>
            {parkAnimals.length > 0 && (
              <View style={styles.animalChipRow}>
                {parkAnimals.map((animal) => {
                  const active = value.wildlife.some((w) => w.toLowerCase() === animal.name.toLowerCase());
                  return (
                    <TouchableOpacity
                      key={animal.id}
                      style={[styles.animalChip, active && styles.animalChipActive]}
                      onPress={() => toggleAnimal(animal.name)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.animalChipText, active && styles.animalChipTextActive]}>{animal.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <View style={styles.wildlifeInputRow}>
              <TextInput
                style={styles.wildlifeInput}
                placeholder="e.g. Elk, Moose, Bald Eagle..."
                placeholderTextColor={colors.textMuted}
                value={wildlifeInput}
                onChangeText={setWildlifeInput}
                onSubmitEditing={addWildlifeSighting}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.wildlifeAddBtn} onPress={addWildlifeSighting} activeOpacity={0.8}>
                <Text style={styles.wildlifeAddBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            {value.wildlife.length > 0 && (
              <View style={styles.wildlifeTagRow}>
                {value.wildlife.map((sighting) => (
                  <View key={sighting} style={styles.wildlifeTag}>
                    <Text style={styles.wildlifeTagText}>{sighting}</Text>
                    <TouchableOpacity onPress={() => removeWildlifeSighting(sighting)} hitSlop={8}>
                      <CloseIcon color={colors.orange} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <Text style={[styles.sublabel, styles.sublabelSpaced]}>Weather</Text>
            <View style={styles.weatherRow}>
              {WEATHER_OPTIONS.map(({ type, label, render }) => {
                const active = value.weather === type;
                const iconColor = active ? colors.textInverse : colors.brown;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.weatherChip, active && styles.weatherChipActive]}
                    onPress={() => toggleWeather(type)}
                    activeOpacity={0.8}
                  >
                    {render(iconColor)}
                    <Text style={[styles.weatherChipLabel, active && styles.weatherChipLabelActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function buildDayEntriesMap(trip: { days?: TripDayEntry[] } | undefined): Record<number, DayFormState> {
  const map: Record<number, DayFormState> = {};
  trip?.days?.forEach((d) => {
    map[d.dayNumber] = { activities: d.activities, trails: d.trailsHiked, wildlife: d.wildlifeSightings, weather: d.weather };
  });
  return map;
}

export default function LogTripScreen() {
  const { parks, trips, trails, animals, logTrip, updateTrip, completeTrip, userProfile } = useApp();
  const units = userProfile.units;
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const editingTrip = route.params?.tripId ? trips.find((t) => t.id === route.params.tripId) : undefined;
  const completingTrip = route.params?.completeTripId ? trips.find((t) => t.id === route.params.completeTripId) : undefined;
  const mode: FormMode = completingTrip
    ? 'complete'
    : editingTrip
      ? (editingTrip.tripType === 'planned' ? 'plan' : 'log')
      : (route.params?.initialTripType === 'planned' ? 'plan' : 'log');
  const [heroImage, setHeroImage] = useState<number>(randomHeroImage);
  const [selectedParkId, setSelectedParkId] = useState<string>(editingTrip?.parkId ?? route.params?.parkId ?? 'yellowstone');
  const [startDate, setStartDate] = useState(editingTrip?.startDate ?? '');
  const [endDate, setEndDate] = useState(editingTrip?.endDate ?? '');
  const [notes, setNotes] = useState(editingTrip?.notes ?? '');
  const [showParkPicker, setShowParkPicker] = useState(false);
  const [photos, setPhotos] = useState<string[]>(editingTrip?.photos ?? []);
  // Index-aligned with `photos`; a missing entry just means no caption.
  const [photoCaptions, setPhotoCaptions] = useState<string[]>(editingTrip?.photoCaptions ?? []);
  const [captionIndex, setCaptionIndex] = useState<number | null>(null);
  const [rating, setRating] = useState<number>(editingTrip?.rating ?? completingTrip?.rating ?? 0);
  const [saving, setSaving] = useState(false);
  // Step 1 ("details") collects everything trip-wide — park, dates, notes,
  // photos, rating. Step 2 ("days") is the per-day pager. Splitting the form
  // into these two steps (rather than one long scroll of stacked
  // per-day sections) keeps each day's picker UI focused on one day at a
  // time instead of competing for space with every other day at once.
  const [step, setStep] = useState<'details' | 'days'>('details');
  const [pageIndex, setPageIndex] = useState(0);
  const dayScrollRef = useRef<ScrollView>(null);
  const [dayEntries, setDayEntries] = useState<Record<number, DayFormState>>(() =>
    buildDayEntriesMap(editingTrip ?? completingTrip)
  );
  // Park and dates start open since they're required first; everything else
  // stays tucked away until tapped, so the form doesn't read as one long list.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ park: true, when: true });
  const toggleSection = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  useFocusEffect(
    useCallback(() => {
      setHeroImage(randomHeroImage());
    }, [])
  );

  // The LogTrip tab stays mounted once visited, so useState's initial value
  // above only ever applies to the very first time this screen is opened.
  // Re-navigating here later — to edit a different trip, or to log a fresh
  // trip after having just edited one — leaves stale fields from whatever
  // was last shown unless we resync whenever the requested trip/park
  // actually changes. Keyed on the param values (not focus) so it doesn't
  // wipe an in-progress "create" form just from switching tabs and back.
  const editingTripId: string | undefined = route.params?.tripId;
  const completeTripId: string | undefined = route.params?.completeTripId;
  const requestedParkId: string | undefined = route.params?.parkId;
  useEffect(() => {
    const trip = editingTripId
      ? trips.find((t) => t.id === editingTripId)
      : completeTripId
        ? trips.find((t) => t.id === completeTripId)
        : undefined;
    if (trip) {
      setSelectedParkId(trip.parkId);
      setStartDate(trip.startDate);
      setEndDate(trip.endDate);
      setNotes(trip.notes);
      setPhotos(trip.photos ?? []);
      setPhotoCaptions(trip.photoCaptions ?? []);
      setRating(trip.rating ?? 0);
    } else {
      setSelectedParkId(requestedParkId ?? 'yellowstone');
      setStartDate('');
      setEndDate('');
      setNotes('');
      setPhotos([]);
      setPhotoCaptions([]);
      setRating(0);
    }
    setDayEntries(buildDayEntriesMap(trip));
    setStep('details');
    setPageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTripId, completeTripId, requestedParkId]);

  const selectedPark = parks.find((p) => p.id === selectedParkId);
  const sortedParks = [...parks].sort((a, b) => a.name.localeCompare(b.name));
  const parkTrails = trails.filter((t) => t.parkId === selectedParkId).sort(
    (a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]
  );
  const parkAnimals = animals.filter((a) => a.parkId === selectedParkId).sort(
    (a, b) => RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity]
  );

  const parkActivities = getParkGuide(selectedParkId)?.parkActivities ?? [];

  const dayCount = startDate ? dayCountBetween(startDate, endDate || startDate) : 0;
  const dayNumbers = Array.from({ length: dayCount }, (_, i) => i + 1);

  const setDayEntry = (dayNumber: number, next: DayFormState) => {
    setDayEntries((prev) => ({ ...prev, [dayNumber]: next }));
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo access needed', 'Allow photo library access to add trip photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled) return;
    setPhotos((prev) => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS));
    setPhotoCaptions([...photos.map((_, i) => photoCaptions[i] ?? ''), ''].slice(0, MAX_PHOTOS));
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoCaptions(photos.map((_, i) => photoCaptions[i] ?? '').filter((_, i) => i !== index));
  };

  const saveCaption = (caption: string) => {
    if (captionIndex === null) return;
    setPhotoCaptions(photos.map((_, i) => (i === captionIndex ? caption : photoCaptions[i] ?? '')));
    setCaptionIndex(null);
  };

  const canProceedToDays = !!selectedParkId && !!startDate;

  const handleNext = () => {
    if (!canProceedToDays) {
      Alert.alert('Missing info', 'Please select a park and start date.');
      return;
    }
    setStep('days');
    setPageIndex(0);
    dayScrollRef.current?.scrollTo({ x: 0, animated: false });
  };

  // Web mouse-wheel scrolling never fires a "momentum" phase the way a touch
  // swipe does, so onMomentumScrollEnd alone leaves the dot indicator stuck
  // after a wheel-driven page change — track every scroll event instead.
  const handleDayScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / PAGE_WIDTH);
    setPageIndex((prev) => (prev === index ? prev : index));
  };

  const handleDayScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / PAGE_WIDTH);
    setPageIndex(index);
  };

  const buildDays = (): TripDayEntry[] =>
    dayNumbers.map((dayNumber) => {
      const entry = dayEntries[dayNumber] ?? emptyDay();
      return {
        dayNumber,
        date: addDays(startDate, dayNumber - 1),
        activities: entry.activities,
        trailsHiked: entry.trails.map((t) => ({ ...t, dayNumber })),
        wildlifeSightings: entry.wildlife,
        weather: entry.weather,
      };
    });

  const handleSave = async () => {
    if (saving) return;
    if (!selectedParkId || !startDate) {
      Alert.alert('Missing info', 'Please select a park and start date.');
      return;
    }

    const days = buildDays();
    setSaving(true);
    try {
      if (mode === 'complete' && completingTrip) {
        const saved = await completeTrip({
          ...completingTrip,
          parkId: selectedParkId,
          startDate,
          endDate: endDate || startDate,
          activities: [],
          notes,
          photos,
          photoCaptions: photos.map((_, i) => photoCaptions[i] ?? ''),
          wildlifeSightings: [],
          trailsHiked: [],
          milesHiked: undefined,
          elevationGainFt: undefined,
          rating: rating || undefined,
          days,
        });
        // A failed save has already shown its own error toast; stay on the
        // form so nothing the user typed is lost.
        if (!saved) return;
        successHaptic();
        showToast('Trip completed! A new postcard was added to your collection.', 'success');
        (navigation as any).navigate('TripsTab', { screen: 'Trips' });
        return;
      }

      if (editingTrip) {
        const saved = await updateTrip({
          ...editingTrip,
          tripType: mode === 'plan' ? 'planned' : 'logged',
          parkId: selectedParkId,
          startDate,
          endDate: endDate || startDate,
          activities: [],
          notes,
          photos,
          photoCaptions: photos.map((_, i) => photoCaptions[i] ?? ''),
          wildlifeSightings: [],
          trailsHiked: [],
          milesHiked: undefined,
          elevationGainFt: undefined,
          rating: rating || undefined,
          days,
        });
        if (!saved) return;
        successHaptic();
        showToast('Trip updated! Your changes have been saved.', 'success');
        (navigation as any).navigate('TripsTab', { screen: 'Trips' });
        return;
      }

      await logTrip({
        parkId: selectedParkId,
        tripType: mode === 'plan' ? 'planned' : 'logged',
        startDate,
        endDate: endDate || startDate,
        activities: [],
        notes,
        photos,
        photoCaptions: photos.map((_, i) => photoCaptions[i] ?? ''),
        wildlifeSightings: [],
        trailsHiked: [],
        rating: rating || undefined,
        days,
      });
      // Alert.alert is a no-op on web (same limitation worked around in
      // SettingsScreen), so success feedback goes through the cross-platform
      // toast instead — and unlike editing/completing a trip above, saving a
      // brand-new one used to just reset the form in place with nothing after
      // it, leaving the user stranded on a blank form instead of seeing where
      // the trip landed.
      successHaptic();
      showToast(mode === 'plan' ? 'Trip planned! We’ll be ready when you are.' : 'Adventure saved! A new postcard was added to your collection.', 'success');
      (navigation as any).navigate('TripsTab', { screen: 'Trips' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (step === 'days' ? setStep('details') : navigation.goBack())}
          hitSlop={10}
        >
          <BackArrowIcon />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>
          {mode === 'complete' ? 'Mark as Completed' : editingTrip ? 'Edit Trip' : mode === 'plan' ? 'Plan a Trip' : 'Log a Trip'}
        </Text>
        <View style={styles.backBtn} />
      </View>

      {step === 'details' ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header illustration */}
          <View style={styles.heroArea}>
            <Image source={heroImage} style={styles.heroImage} resizeMode="contain" />
          </View>

          {/* Park selector */}
          <Accordion
            title="Which park?"
            summary={selectedPark?.name ?? 'Select a park'}
            expanded={!!expanded.park}
            onToggle={() => toggleSection('park')}
          >
            <TouchableOpacity style={styles.selector} onPress={() => setShowParkPicker(!showParkPicker)}>
              <Text style={styles.selectorText}>{selectedPark?.name ?? 'Select a park'}</Text>
              <Text style={styles.selectorIcon}>{'▾'}</Text>
            </TouchableOpacity>
            {showParkPicker && (
              <View style={styles.dropdown}>
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                  {sortedParks.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedParkId(p.id);
                        setShowParkPicker(false);
                        setDayEntries({});
                      }}
                    >
                      <Text style={[styles.dropdownText, selectedParkId === p.id && styles.dropdownTextActive]}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </Accordion>

          {/* Date */}
          <Accordion
            title={mode === 'plan' ? 'When are you planning to go?' : 'When did you go?'}
            summary={startDate ? formatDateRange(startDate, endDate || startDate) : 'Not set'}
            expanded={!!expanded.when}
            onToggle={() => toggleSection('when')}
          >
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(s, e) => {
                setStartDate(s);
                setEndDate(e);
              }}
            />
          </Accordion>

          {/* Notes */}
          <Accordion
            title="Notes / Memories"
            summary={notes.trim() ? notes.trim() : 'Add notes'}
            expanded={!!expanded.notes}
            onToggle={() => toggleSection('notes')}
          >
            <View style={styles.notesBox}>
              <TextInput
                style={styles.notesInput}
                placeholder="Amazing views! We saw elk and hiked to the waterfall."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={200}
                value={notes}
                onChangeText={setNotes}
              />
              <Text style={styles.charCount}>{notes.length}/200</Text>
            </View>
          </Accordion>

          {/* Rating — trip-wide, not per-day, and only meaningful once
              something's actually happened. */}
          {mode !== 'plan' && (
            <Accordion
              title="Rate This Trip"
              summary={rating ? `${rating} of 5 stars` : 'Not rated yet'}
              expanded={!!expanded.rating}
              onToggle={() => toggleSection('rating')}
            >
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TouchableOpacity key={i} onPress={() => setRating(rating === i ? 0 : i)} hitSlop={6}>
                    <RatingStarIcon filled={i <= rating} />
                  </TouchableOpacity>
                ))}
              </View>
            </Accordion>
          )}

          {/* Add Photos */}
          {mode !== 'plan' && (
            <Accordion
              title="Add Photos"
              summary={photos.length ? `${photos.length} of ${MAX_PHOTOS} added` : 'Add photos'}
              expanded={!!expanded.photos}
              onToggle={() => toggleSection('photos')}
            >
              <View style={styles.photoRow}>
                {photos.map((uri, i) => (
                  <View key={uri} style={styles.photoItem}>
                    <View style={styles.photoThumbWrap}>
                      <TouchableOpacity onPress={() => setCaptionIndex(i)} activeOpacity={0.8}>
                        <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.photoRemoveBadge} onPress={() => removePhoto(i)} hitSlop={8}>
                        <CloseIcon color={colors.textInverse} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.photoCaptionText} numberOfLines={1}>
                      {photoCaptions[i] || 'Add caption'}
                    </Text>
                  </View>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <TouchableOpacity style={[styles.photoThumb, styles.photoAdd]} onPress={pickPhoto} activeOpacity={0.8}>
                    <Text style={styles.photoAddIcon}>+</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Accordion>
          )}

          <PrimaryButton
            label="NEXT: DAY-BY-DAY"
            icon={<TreeIcon color={colors.textInverse} />}
            onPress={handleNext}
            disabled={!canProceedToDays}
            style={styles.saveBtn}
          />
        </ScrollView>
      ) : (
        <View style={styles.daysStepContainer}>
          <View style={styles.daysHeaderRow}>
            <View style={styles.daysHeaderText}>
              <Text style={styles.daysHeaderTitle}>{selectedPark?.name}</Text>
              <Text style={styles.daysHeaderSubtitle}>{formatDateRange(startDate, endDate || startDate)}</Text>
            </View>
            <TouchableOpacity onPress={() => setStep('details')} hitSlop={8}>
              <Text style={styles.editDetailsLink}>Edit trip details</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={dayScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleDayScrollEnd}
            onScroll={handleDayScroll}
            scrollEventThrottle={32}
            style={styles.dayPager}
          >
            {dayNumbers.map((dayNumber) => (
              <DayPage
                key={dayNumber}
                dayNumber={dayNumber}
                dateLabel={parseLocalDate(addDays(startDate, dayNumber - 1)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                mode={mode}
                units={units}
                parkTrails={parkTrails}
                parkAnimals={parkAnimals}
                parkActivities={parkActivities}
                value={dayEntries[dayNumber] ?? emptyDay()}
                onChange={(next) => setDayEntry(dayNumber, next)}
                width={PAGE_WIDTH}
              />
            ))}
          </ScrollView>

          {dayCount > 1 && (
            <View style={styles.dots}>
              {dayNumbers.map((n, i) => (
                <View key={n} style={[styles.dot, i === pageIndex && styles.dotActive]} />
              ))}
            </View>
          )}

          <PrimaryButton
            label={mode === 'complete' ? 'MARK AS COMPLETED' : mode === 'plan' ? 'SAVE PLAN' : editingTrip ? 'SAVE CHANGES' : 'SAVE TRIP'}
            icon={<TreeIcon color={colors.textInverse} />}
            onPress={handleSave}
            loading={saving}
            style={styles.saveBtn}
          />
        </View>
      )}

      <PhotoCaptionSheet
        visible={captionIndex !== null}
        uri={captionIndex !== null ? photos[captionIndex] ?? null : null}
        caption={captionIndex !== null ? photoCaptions[captionIndex] ?? '' : ''}
        onSave={saveCaption}
        onClose={() => setCaptionIndex(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing['5xl'] },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing['2xl'] },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadows.sm },
  screenTitle: { ...typography.h3, color: colors.textPrimary },

  heroArea: { height: 190, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  heroImage: { width: 220, height: 190 },

  accordionCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    gap: spacing.md,
  },
  accordionHeaderText: { flex: 1 },
  accordionTitle: { ...typography.labelBold, color: colors.textPrimary },
  accordionSummary: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  accordionBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  chevronExpanded: { transform: [{ rotate: '180deg' }] },

  sublabel: { ...typography.labelBold, color: colors.textPrimary, marginBottom: spacing.sm },
  sublabelSpaced: { marginTop: spacing.md },

  selector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, ...shadows.sm },
  selectorText: { ...typography.body, color: colors.textPrimary },
  selectorIcon: { fontSize: 16, color: colors.textSecondary },

  dropdown: { backgroundColor: colors.surface, borderRadius: radius.lg, marginTop: spacing.xs, ...shadows.md, overflow: 'hidden' },
  dropdownItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  dropdownText: { ...typography.body, color: colors.textPrimary },
  dropdownTextActive: { color: colors.primary, fontFamily: typography.labelBold.fontFamily },


  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  activityChip: { width: '28%', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, paddingVertical: spacing.md, ...shadows.sm },
  activityChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  activityLabel: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  activityLabelActive: { color: colors.textInverse },

  trailList: { gap: spacing.sm },
  trailChip: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, padding: spacing.md, ...shadows.sm },
  trailChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  trailChipName: { ...typography.labelSemiBold, color: colors.textPrimary },
  trailChipNameActive: { color: colors.textInverse },
  trailChipMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  trailChipMetaActive: { color: colors.textInverse },

  customTrailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  customTrailNameInput: { width: '100%' },
  customTrailNumberInput: { flex: 1, minWidth: 0 },

  trailSummaryList: { gap: spacing.sm },
  trailSummaryCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, ...shadows.sm },
  trailSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  trailSummaryText: { flex: 1 },
  trailSummaryName: { ...typography.labelSemiBold, color: colors.textPrimary },
  trailSummaryMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  trailSummaryEdit: { ...typography.labelSmall, color: colors.sage },

  animalChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  animalChip: { backgroundColor: colors.surface, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  animalChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  animalChipText: { ...typography.labelSmall, color: colors.textSecondary },
  animalChipTextActive: { color: colors.textInverse },

  wildlifeInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wildlifeInput: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, ...typography.body, color: colors.textPrimary, ...shadows.sm },
  wildlifeAddBtn: { width: 44, height: 44, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.sm },
  wildlifeAddBtnText: { fontSize: 22, lineHeight: 24, color: colors.textInverse },
  wildlifeTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  wildlifeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  wildlifeTagText: { ...typography.labelSmall, color: colors.orange },

  notesBox: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, ...shadows.sm },
  notesInput: { ...typography.body, color: colors.textPrimary, minHeight: 80, textAlignVertical: 'top' },
  charCount: { ...typography.caption, color: colors.textMuted, textAlign: 'right', marginTop: spacing.xs },

  photoRow: { flexDirection: 'row', gap: spacing.md },
  photoItem: { width: 72, gap: spacing.xs },
  photoCaptionText: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  photoThumbWrap: { width: 72, height: 72 },
  photoThumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceWarm },
  photoAdd: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed' },
  photoAddIcon: { fontSize: 24, color: colors.textMuted },
  photoRemoveBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },

  saveBtn: { marginHorizontal: spacing.xl },

  viewpointList: { gap: spacing.md, marginTop: spacing.md },
  viewpointRow: { gap: spacing.xs },
  viewpointLabel: { ...typography.labelSmall, color: colors.textSecondary },

  weatherRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  weatherChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  weatherChipLabel: { ...typography.labelSmall, color: colors.textSecondary },
  weatherChipLabelActive: { color: colors.textInverse },

  ratingRow: { flexDirection: 'row', gap: spacing.sm },

  // Step 2 — the day-by-day pager. `daysStepContainer` fills the remaining
  // screen height (unlike step 1's ScrollView) so the horizontal pager has a
  // fixed height to page within.
  daysStepContainer: { flex: 1 },
  daysHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  daysHeaderText: { flex: 1 },
  daysHeaderTitle: { ...typography.labelBold, color: colors.textPrimary },
  daysHeaderSubtitle: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  editDetailsLink: { ...typography.labelSmall, color: colors.sage },

  dayPager: { flex: 1, width: PAGE_WIDTH, alignSelf: 'center' },
  dayPage: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  dayPageContent: { padding: spacing.lg },
  dayPageTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.md },

  dots: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', paddingVertical: spacing.md },
  dot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 18 },
});
