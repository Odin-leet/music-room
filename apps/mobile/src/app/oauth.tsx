import { router } from 'expo-router';
import { useEffect } from 'react';

// Landing route for the social-login return link (…/--/oauth?… in Expo Go,
// musicroom://oauth?… in our own builds). WebBrowser.openAuthSessionAsync has
// already captured the URL; expo-router also treats it as navigation, so
// this screen just steps back to where the user started. Outside both route
// groups so it works whether signed in or not.
export default function OAuthReturnScreen() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  return null;
}
