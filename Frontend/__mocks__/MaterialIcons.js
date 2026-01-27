const React = require('react');

function MaterialIconsMock(props) {
  return React.createElement('MaterialIcons', props, props.children);
}

module.exports = MaterialIconsMock;
module.exports.default = MaterialIconsMock;
module.exports.__esModule = true;
