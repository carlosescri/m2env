const semver = require('semver');

function clean(version, length = 3) {
  const valid = semver.coerce(version);
  if (valid) {
    return `${valid}`.split('.').slice(0, length).join('.');
  } else {
    return null;
  }
}

function phpversion(magentoversion) {
  switch (true) {
    case semver.satisfies(magentoversion, '>=2.3.0'):
      return '7.1';
    default:
      return '7.0';
  }
}

module.exports = {clean, phpversion};
