import { Platform } from 'react-native';
import analytics from '@react-native-firebase/analytics';
import type { PaidEvent } from 'react-native-google-mobile-ads';

export type AdRevenueFormat = 'interstitial' | 'rewarded' | 'banner' | 'native' | 'app_open';

export type AdRevenueRecord = {
  format: AdRevenueFormat;
  placement: string;
  currency: string;
  precision: number;
  value: number;
  valueMicros: number;
  platform: 'android' | 'ios' | 'unknown';
  timestamp: string;
};

const MAX_BUFFERED_REVENUE_EVENTS = 100;
const bufferedAdRevenueEvents: AdRevenueRecord[] = [];
const AD_REVENUE_EVENT_NAME = 'ad_impression_revenue';

const toFiniteNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const toPlatform = (): AdRevenueRecord['platform'] => {
  if (Platform.OS === 'android' || Platform.OS === 'ios') return Platform.OS;
  return 'unknown';
};

const logAdRevenueToAnalytics = async (record: AdRevenueRecord) => {
  try {
    await analytics().logEvent(AD_REVENUE_EVENT_NAME, {
      ad_format: record.format,
      ad_placement: record.placement,
      ad_currency: record.currency,
      ad_precision: record.precision,
      ad_value: record.value,
      ad_value_micros: record.valueMicros,
      ad_platform: record.platform,
      value: record.value,
      currency: record.currency,
    });
  } catch (error) {
    if (__DEV__) {
      console.warn('[AdRevenue][Analytics] Failed to log event', error);
    }
  }
};

export const trackAdPaidEvent = (params: {
  format: AdRevenueFormat;
  placement: string;
  event?: PaidEvent;
}) => {
  if (!params.event) return null;

  const value = toFiniteNumber(params.event?.value);
  const valueMicros = Math.round(value * 1_000_000);

  const record: AdRevenueRecord = {
    format: params.format,
    placement: String(params.placement || '').trim() || 'unknown',
    currency: String(params.event?.currency || '').trim() || 'unknown',
    precision: toFiniteNumber(params.event?.precision),
    value,
    valueMicros,
    platform: toPlatform(),
    timestamp: new Date().toISOString(),
  };

  bufferedAdRevenueEvents.push(record);
  if (bufferedAdRevenueEvents.length > MAX_BUFFERED_REVENUE_EVENTS) {
    bufferedAdRevenueEvents.splice(0, bufferedAdRevenueEvents.length - MAX_BUFFERED_REVENUE_EVENTS);
  }

  if (__DEV__) {
    console.log('[AdRevenue][PAID]', record);
  }

  void logAdRevenueToAnalytics(record);

  return record;
};

export const getBufferedAdRevenueEvents = () => [...bufferedAdRevenueEvents];
