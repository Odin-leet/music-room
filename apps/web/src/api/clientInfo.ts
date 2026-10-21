// Who is calling, for the API's action log (brief V.6: platform, device,
// app version on every action). Sent as headers on every REST call and in
// the socket handshake (`auth.client`). Only for logging: the API never
// trusts it for decisions.
function browserName(ua: string) {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Browser';
}

function osName(ua: string) {
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'unknown OS';
}

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;

export const CLIENT_INFO = {
  platform: 'web',
  device: `${browserName(ua)} on ${osName(ua)}`,
  version: __APP_VERSION__,
};

export const CLIENT_HEADERS = {
  'X-Client-Platform': CLIENT_INFO.platform,
  'X-Client-Device': CLIENT_INFO.device,
  'X-Client-Version': CLIENT_INFO.version,
};
