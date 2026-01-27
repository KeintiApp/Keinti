const React = require('react');
const { View } = require('react-native');

function MaskedView(props) {
  // Jest-only mock: render children directly.
  return React.createElement(View, props, props.children);
}

module.exports = MaskedView;
module.exports.default = MaskedView;
