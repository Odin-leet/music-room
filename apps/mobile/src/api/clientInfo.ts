import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Who is calling, for the API's action log (brief V.6: platform, device
// model, app version on every action). Sent as headers on every REST call
// and in the socket handshake (`auth.client`). Only for logging: the API
// never trusts it for decisions.
export const CLIENT_INFO = {
  platform: Platform.OS, // 'android' | 'ios' | 'web'
  device: [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || 'unknown',
  version: Constants.expoConfig?.version ?? 'unknown', // app.json "version"
};

export const CLIENT_HEADERS = {
  'X-Client-Platform': CLIENT_INFO.platform,
  'X-Client-Device': CLIENT_INFO.device,
  'X-Client-Version': CLIENT_INFO.version,
};
