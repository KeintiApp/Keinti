const store = new Map();

const getService = (options) => {
  const service = options && typeof options.service === 'string' ? options.service.trim() : '';
  return service || 'default';
};

const api = {
  setGenericPassword: async (username, password, options) => {
    store.set(getService(options), {
      username: String(username || ''),
      password: String(password || ''),
    });
    return true;
  },
  getGenericPassword: async (options) => {
    const entry = store.get(getService(options));
    return entry || false;
  },
  resetGenericPassword: async (options) => {
    store.delete(getService(options));
    return true;
  },
  __reset: () => {
    store.clear();
  },
};

module.exports = api;