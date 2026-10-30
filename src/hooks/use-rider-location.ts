import { useEffect, useRef, useState } from "react";
import { updateRiderLocation } from "../lib/supabase";

export type RiderLocationState = "idle" | "requesting" | "sharing" | "unavailable" | "error";

export function useRiderLocation(active: boolean, intervalMs = 15_000) {
  const [state, setState] = useState<RiderLocationState>("idle");
  const latest = useRef<GeolocationPosition | null>(null);

  useEffect(() => {
    if (!active) {
      setState("idle");
      return;
    }
    if (!navigator.geolocation) {
      setState("unavailable");
      return;
    }

    setState("requesting");
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        latest.current = position;
        setState("sharing");
      },
      () => setState("error"),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );

    const publish = async () => {
      const position = latest.current;
      if (!position || position.coords.accuracy > 100) return;
      try {
        await updateRiderLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMetres: position.coords.accuracy,
        });
        setState("sharing");
      } catch {
        setState("error");
      }
    };

    void publish();
    const timer = window.setInterval(() => void publish(), intervalMs);
    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(timer);
    };
  }, [active, intervalMs]);

  return state;
}
