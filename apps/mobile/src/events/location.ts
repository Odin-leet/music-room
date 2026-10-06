import * as Location from 'expo-location';

export type Coords = { lat: number; lng: number };

export class LocationError extends Error {}

// The phone's current position, asking for permission the first time.
// The server treats it as untrusted input (it checks and logs it).
export async function getCurrentCoords(): Promise<Coords> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new LocationError('Location permission was denied. Allow it in your phone settings to use geo events.');
  }
  try {
    const position = await Location.getCurrentPositionAsync({
      // High = GPS. 'Balanced' needs network location, which is often off
      // (and the radius check wants metres-level precision anyway).
      accuracy: Location.Accuracy.High,
      // Android: don't push the user into Google's "Location Accuracy"
      // setting (it also opts them into Google's location data collection).
      // Plain device location is enough for a radius check.
      mayShowUserSettingsDialog: false,
    });
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch {
    // Fall back to the last position the phone already knows, if recent enough.
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 }).catch(() => null);
    if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
    throw new LocationError('Could not get your location. Is location turned on?');
  }
}
