jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// React Native's Linking export often points to this internal module.
// Mock it directly so App.tsx can subscribe to deep links in Jest.
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
  openURL: jest.fn(() => Promise.resolve()),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
}));

// Some React Native versions / Jest environments can end up with missing core exports.
// Provide safe fallbacks to avoid crashing snapshot/render tests.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const RN = require('react-native');
  if (!RN.SafeAreaView) RN.SafeAreaView = RN.View;
  if (!RN.KeyboardAvoidingView) RN.KeyboardAvoidingView = RN.View;

  // In some Jest environments, the RN preset provides a partial Linking mock
  // without addEventListener/getInitialURL. Patch the instance directly.
  const linking = RN.Linking;
  if (linking && typeof linking.getInitialURL !== 'function') {
    linking.getInitialURL = () => Promise.resolve(null);
  }
  if (linking && typeof linking.addEventListener !== 'function') {
    linking.addEventListener = () => ({ remove: () => {} });
  }
} catch {
  // ignore
}

jest.mock('react-native-vector-icons/MaterialIcons', () => {
  const React = require('react');
  const MaterialIconsMock = function MaterialIconsMock(props) {
    return React.createElement('MaterialIcons', props, props.children);
  };

  return {
    __esModule: true,
    default: MaterialIconsMock,
  };
});

jest.mock('react-native-vector-icons/FontAwesome', () => {
  const React = require('react');
  const FontAwesomeMock = function FontAwesomeMock(props) {
    return React.createElement('FontAwesome', props, props.children);
  };

  return {
    __esModule: true,
    default: FontAwesomeMock,
  };
});

jest.mock('react-native-inappbrowser-reborn', () => ({
  isAvailable: jest.fn(() => Promise.resolve(false)),
  openAuth: jest.fn(() => Promise.resolve({ type: 'cancel' })),
}));

jest.mock('react-native-google-mobile-ads', () => {
  const makeFakeAd = () => ({
    addAdEventListener: jest.fn(() => () => {}),
    load: jest.fn(),
    show: jest.fn(() => Promise.resolve()),
  });

  return {
    __esModule: true,
    default: () => ({
      initialize: jest.fn(() => Promise.resolve({})),
    }),
    TestIds: {
      INTERSTITIAL: 'test-interstitial',
      REWARDED: 'test-rewarded',
      NATIVE: 'test-native',
    },
    AdEventType: {
      LOADED: 'LOADED',
      CLOSED: 'CLOSED',
      ERROR: 'ERROR',
    },
    RewardedAdEventType: {
      LOADED: 'LOADED',
      EARNED_REWARD: 'EARNED_REWARD',
    },
    InterstitialAd: {
      createForAdRequest: jest.fn(() => makeFakeAd()),
    },
    RewardedAd: {
      createForAdRequest: jest.fn(() => makeFakeAd()),
    },
  };
});
