const path = require('path')

const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
  stories: ['../ui/app/**/*.stories.js'],
  addons: [
    '@storybook/addon-knobs',
    '@storybook/addon-actions',
    '@storybook/addon-backgrounds'
  ],
  webpackFinal: async (config) => {
    config.module.strictExportPresence = true
    config.module.rules.push({
      test: /\.scss$/,
      loaders: [
        'style-loader',
        {
          loader: 'css-loader',
          options: {
            import: false,
            url: false,
          },
        },
        'resolve-url-loader',
        {
          loader: 'sass-loader',
          options: {
            sourceMap: true,
          },
        },
      ],
    })
    config.plugins.push(new CopyWebpackPlugin({
      patterns: [
        {
          from: path.join('node_modules', '@fortawesome', 'fontawesome-free', 'webfonts'),
          to: path.join('fonts', 'fontawesome'),
        },
      ],
    }))
    return config
  },
}
