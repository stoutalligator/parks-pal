import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ImageStyle, StyleProp, ImageSourcePropType } from 'react-native';
import { colors, radius, shadows, typography } from '@/theme';
import SkeletonPulse from './SkeletonPulse';

// A little washi-tape variety across stacks/photos so the album doesn't feel
// monochrome — cycles deterministically by index rather than randomly, so a
// given trip/photo always gets the same color across re-renders.
const TAPE_COLORS = [colors.tan, colors.sky, colors.rose, colors.orange, colors.sage];
export function tapeColorForIndex(index: number): string {
  return TAPE_COLORS[index % TAPE_COLORS.length];
}

interface Props {
  // A photo's URI, or `source` for a bundled image (e.g. a park scene).
  uri?: string;
  source?: ImageSourcePropType;
  // Fires once the image has loaded (or failed), so a caller that is about to
  // capture the frame as a picture knows when it's safe to.
  onLoad?: () => void;
  size: number;
  tapeColor?: string;
  rotate?: number;
  variant?: 'stack' | 'page';
  style?: StyleProp<ImageStyle>;
  // Written in the bottom strip, like a note under the photo. Callers only
  // pass it where the frame is large enough to read it.
  caption?: string;
  // Makes the bottom strip tall enough for a two-line caption on small frames.
  // A row of photos should all pass the same value, so the frames stay the
  // same height whether or not each one has a caption.
  roomForCaption?: boolean;
}

export default function Polaroid({
  uri,
  source,
  onLoad,
  size,
  tapeColor = colors.tan,
  rotate = 0,
  variant = 'page',
  style,
  caption,
  roomForCaption = false,
}: Props) {
  const framePad = variant === 'stack' ? size * 0.05 : size * 0.045;
  const bottomStrip = roomForCaption ? size * 0.27 : variant === 'stack' ? size * 0.14 : size * 0.16;
  const photoSize = size - framePad * 2;
  const tapeWidth = size * 0.42;
  const tapeHeight = tapeWidth * 0.34;
  // Remote photos (trip uploads) can take a moment; bundled art is instant.
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const loading = !source && !!uri && loadedUri !== uri;
  const handleLoad = () => {
    setLoadedUri(uri ?? null);
    onLoad?.();
  };

  return (
    <View
      style={[
        {
          width: size,
          paddingTop: framePad,
          paddingHorizontal: framePad,
          paddingBottom: framePad + bottomStrip,
          transform: [{ rotate: `${rotate}deg` }],
        },
        styles.frame,
        style,
      ]}
    >
      <Image
        source={source ?? { uri: uri ?? '' }}
        style={[styles.photo, { width: photoSize, height: photoSize }]}
        resizeMode="cover"
        onLoad={handleLoad}
        onError={handleLoad}
      />
      {loading && (
        <SkeletonPulse
          style={[styles.photo, styles.photoPlaceholder, { top: framePad, left: framePad, width: photoSize, height: photoSize }]}
        />
      )}
      <View
        style={[
          styles.tape,
          {
            width: tapeWidth,
            height: tapeHeight,
            top: -tapeHeight * 0.45,
            marginLeft: -tapeWidth / 2,
            backgroundColor: tapeColor,
            transform: [{ rotate: `${rotate < 0 ? 4 : -4}deg` }],
          },
        ]}
      />
      {caption ? (
        <View
          pointerEvents="none"
          style={[styles.captionArea, { height: bottomStrip + framePad, paddingHorizontal: framePad * 1.5 }]}
        >
          <Text
            style={[styles.caption, { fontSize: Math.max(10, size * 0.05), lineHeight: Math.max(13, size * 0.062) }]}
            numberOfLines={2}
          >
            {caption}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    ...shadows.md,
  },
  tape: {
    position: 'absolute',
    left: '50%',
    borderRadius: 2,
    opacity: 0.88,
  },
  captionArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { ...typography.labelSemiBold, color: colors.brownDark, textAlign: 'center' },
  photo: {
    borderRadius: 2,
    backgroundColor: colors.surfaceWarm,
  },
  photoPlaceholder: { position: 'absolute', backgroundColor: colors.cream },
});
