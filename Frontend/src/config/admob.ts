import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

// IMPORTANT:
// - While developing, we use AdMob test IDs to avoid policy violations.
// - Replace the production IDs below with your real AdMob IDs before releasing.

export const ADMOB_APP_ID_ANDROID = __DEV__
  ? 'ca-app-pub-3940256099942544~3347511713'
  : 'ca-app-pub-2435078373922090~4991297093';

export const ADMOB_APP_ID_IOS = __DEV__
  ? 'ca-app-pub-3940256099942544~1458002511'
  : 'REPLACE_WITH_YOUR_IOS_APP_ID';

export const INTERSTITIAL_AD_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : 'ca-app-pub-2435078373922090/5642033783';

export const REWARDED_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-2435078373922090/5255020970';

export const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : 'REPLACE_WITH_YOUR_BANNER_AD_UNIT_ID';

// Native Ads are the AdMob format intended for image/text creatives.
// Use a real Native Ad unit id in production.
export const NATIVE_AD_UNIT_ID = __DEV__ ? TestIds.NATIVE : 'REPLACE_WITH_YOUR_NATIVE_AD_UNIT_ID';

export const getAdmobAppIdForPlatform = () =>
  Platform.OS === 'android' ? ADMOB_APP_ID_ANDROID : ADMOB_APP_ID_IOS;
