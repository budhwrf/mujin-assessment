const token = (name: string, fallback: string) => {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

/** Konva needs resolved color strings. These read the same CSS theme tokens as the rest of the app. */
export const mapColors = {
  get background() {
    return token('--background', 'oklch(0.145 0.025 255)')
  },
  get gridMinor() {
    return token('--border', 'oklch(0.34 0.03 255 / 50%)')
  },
  get gridMajor() {
    return token('--muted-foreground', 'oklch(0.7 0.02 250)')
  },
  get path() {
    return token('--chart-1', 'oklch(0.66 0.16 250)')
  },
  get pathSelected() {
    return token('--primary', 'oklch(0.66 0.16 250)')
  },
  get node() {
    return token('--chart-1', 'oklch(0.66 0.16 250)')
  },
  get nodeStroke() {
    return token('--foreground', 'oklch(0.97 0.01 250)')
  },
  get charger() {
    return token('--chart-2', 'oklch(0.84 0.16 85)')
  },
  get chute() {
    return token('--chart-3', 'oklch(0.72 0.17 45)')
  },
  get selected() {
    return token('--ring', 'oklch(0.66 0.16 250)')
  },
  get label() {
    return token('--foreground', 'oklch(0.97 0.01 250)')
  },
  get muted() {
    return token('--muted-foreground', 'oklch(0.7 0.02 250)')
  },
  get onMarker() {
    return token('--background', 'oklch(0.145 0.025 255)')
  },
}
