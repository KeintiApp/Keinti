module.exports = {
  openPicker: () => Promise.reject(new Error('Image picker mocked')),
  openCamera: () => Promise.reject(new Error('Camera mocked')),
  clean: () => Promise.resolve(),
  cleanSingle: () => Promise.resolve(),
};
