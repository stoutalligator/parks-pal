import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '@/theme';

export function FlowerIcon({ size = 12, color = colors.rose }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="6" r="3.6" fill={color} />
      <Circle cx="6.3" cy="10.2" r="3.6" fill={color} />
      <Circle cx="17.7" cy="10.2" r="3.6" fill={color} />
      <Circle cx="8.5" cy="16.6" r="3.6" fill={color} />
      <Circle cx="15.5" cy="16.6" r="3.6" fill={color} />
      <Circle cx="12" cy="11.6" r="2.6" fill={colors.cream} />
    </Svg>
  );
}

export function TrailSignIcon({ size = 12, color = colors.brown }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M11 22V3" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M5 5h13l3 3-3 3H5z" fill={color} />
      <Path d="M19 13H6l-3 3 3 3h13z" fill={color} opacity={0.6} />
    </Svg>
  );
}

export function FieldGuideIcon({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26">
      <Rect x="4" y="3" width="16" height="20" rx="3" fill={colors.cream} stroke={colors.brown} strokeWidth={1.6} />
      <Path d="M8 3v20" stroke={colors.brown} strokeWidth={1.6} />
      <Path d="M13 16c0-3 1.5-5 4-6-0.5 3-1.5 5-4 6z" fill={colors.sage} />
      <Path d="M13 16v-3" stroke={colors.primary} strokeWidth={1.2} />
    </Svg>
  );
}

export function PawIcon({ size = 12, color = colors.brown }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="16" r="5" fill={color} />
      <Circle cx="5" cy="9" r="2.6" fill={color} />
      <Circle cx="11" cy="5" r="2.6" fill={color} />
      <Circle cx="17.5" cy="6.5" r="2.6" fill={color} />
      <Circle cx="21.5" cy="12" r="2.4" fill={color} />
    </Svg>
  );
}
