module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Bundle only the lucide icons the app imports (see the plugin file for why).
    plugins: ['./babel-plugin-lucide-direct'],
  };
};
