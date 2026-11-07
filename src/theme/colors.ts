export const colors = {
  // Backgrounds
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceWarm: '#FAF7F2',
  cream: '#EAD9B7',

  // Brand / Primary
  primary: '#2D5016',
  primaryLight: '#3D6B20',
  primaryTint: '#EEF3E8',

  // Accents
  sage: '#6B8C5A',
  sky: '#A8C5D4',
  skyTint: '#EEF4F7',
  // Readable-as-text shades of sky/orange (the base accents are too light for small text).
  skyDark: '#2F5A6E',
  tan: '#C9A96E',
  orange: '#D4845A',
  orangeDark: '#A35A33',
  rose: '#C4847A',
  // Field Guide bloom pills: a soft rose fill with readable rose text.
  roseTint: '#F7ECE9',
  roseDark: '#8E4F45',
  brown: '#8B6340',
  brownDark: '#5C4028',

  // Text
  textPrimary: '#1C2B13',
  textSecondary: '#5A6B4E',
  textMuted: '#9BA88D',
  textInverse: '#FFFFFF',

  // Status
  visited: '#2D5016',
  bucketList: '#D4845A',
  planned: '#A8C5D4',
  notVisited: '#C9A96E',

  // UI
  border: '#E2DAD0',
  divider: '#EDE8E0',
  overlay: 'rgba(28, 43, 19, 0.5)',

  // Tab bar
  tabActive: '#2D5016',
  tabInactive: '#9BA88D',
  tabBackground: '#FFFFFF',
} as const;

export type ColorKey = keyof typeof colors;
