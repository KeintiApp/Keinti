const createMockAd = () => {
  const listeners = new Map();

  return {
    load: jest.fn(() => undefined),
    show: jest.fn(() => undefined),
    addAdEventListener: jest.fn((type, listener) => {
      listeners.set(type, listener);
      return () => {
        listeners.delete(type);
      };
    }),

    // Test helper (not used by app code): trigger an event.
    __emit: (type, payload) => {
      const handler = listeners.get(type);
      if (typeof handler === 'function') handler(payload);
    },
  };
};

// In the real library, the default export is a function (mobileAds) with an initialize() method.
const mobileAds = () => ({
  initialize: jest.fn(() => Promise.resolve()),
});

const AdEventType = {
  LOADED: 'loaded',
  ERROR: 'error',
  CLOSED: 'closed',
  OPENED: 'opened',
};

const RewardedAdEventType = {
  LOADED: 'loaded',
  EARNED_REWARD: 'earned_reward',
};

const InterstitialAd = {
  createForAdRequest: jest.fn(() => createMockAd()),
};

const RewardedAd = {
  createForAdRequest: jest.fn(() => createMockAd()),
};

const TestIds = {
  APP_OPEN: 'test-app-open',
  BANNER: 'test-banner',
  INTERSTITIAL: 'test-interstitial',
  REWARDED: 'test-rewarded',
  REWARDED_INTERSTITIAL: 'test-rewarded-interstitial',
  NATIVE: 'test-native',
};

// CommonJS export that behaves like the real package:
// - default export: function
// - named exports: attached props
module.exports = mobileAds;
module.exports.default = mobileAds;
module.exports.AdEventType = AdEventType;
module.exports.RewardedAdEventType = RewardedAdEventType;
module.exports.InterstitialAd = InterstitialAd;
module.exports.RewardedAd = RewardedAd;
module.exports.TestIds = TestIds;
