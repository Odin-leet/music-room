// Shared TypeScript contracts between apps/api and apps/mobile.
//
// This is the "link" between the two apps: the mobile client imports these
// same types instead of redefining its own guess at what the API returns,
// so a change to a shape is a compile error in the mobile app, not a
// runtime surprise.
//
// Left empty on purpose — real shapes (User, Event, Track, Vote, Playlist…)
// get defined here in the next step, alongside the API/DB structure.
export {};
