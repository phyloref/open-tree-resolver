const webpack = require('webpack');

module.exports = {
  // Set a prefix so we can host this on Github Pages.
  publicPath: '/open-tree-resolver/',

  // Write out to ./docs so we can host on Github Pages without
  // deploying separately to gh-pages.
  outputDir: 'docs',

  // Set up Webpack
  configureWebpack: {
      resolve: {
          extensions: ['.js'],
          alias: {
              'jquery': 'jquery/dist/jquery.min.js'
          }
      },
      plugins: [
          new webpack.ProvidePlugin({
              '$': 'jquery',
              jQuery: 'jquery',
          })
      ]
  }
};
