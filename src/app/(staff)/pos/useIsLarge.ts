import { useSyncExternalStore } from "react";

// Tailwind's `lg` breakpoint. The POS renders its cart once: beside the catalogue from lg up, or in a
// bottom sheet below it, so the cart's own state (payment method, discounts) never splits in two.
const QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useIsLarge(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => true);
}
