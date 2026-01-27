const React = require('react');

function FontAwesomeMock(props) {
  return React.createElement('FontAwesome', props, props.children);
}

module.exports = FontAwesomeMock;
module.exports.default = FontAwesomeMock;
module.exports.__esModule = true;
