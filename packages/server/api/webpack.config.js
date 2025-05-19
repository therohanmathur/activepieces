const { composePlugins, withNx } = require('@nx/webpack');
const IgnoreDynamicRequire = require('webpack-ignore-dynamic-require');

module.exports = composePlugins(withNx(), (config) => {
  config.plugins.push(new IgnoreDynamicRequire());
  
  // Add JSON module handling
  config.module.rules.push({
    test: /\.json$/,
    type: 'json',
  });

  return config;
});
