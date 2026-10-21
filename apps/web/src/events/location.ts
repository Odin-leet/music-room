export type Coords = { lat: number; lng: number };

export class LocationError extends Error {}

// This device's current position, from the browser (it asks for permission
// the first time). The server treats it as untrusted input (it checks and
// logs it). Browsers only allow it on https or localhost.
export function getCurrentCoords(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new LocationError('This browser cannot share a location.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) =>
        reject(
          new LocationError(
            err.code === err.PERMISSION_DENIED
              ? 'Location permission was denied. Allow it for this site in your browser to use geo events.'
              : 'Could not get your location. Is location turned on?',
          ),
        ),
      // GPS-level precision for the radius check; a position up to 5 min old is fine.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5 * 60_000 },
    );
  });
}
