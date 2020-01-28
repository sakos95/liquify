const path = require('path');
const webpack = require('webpack');
const WorkerPlugin = require('worker-plugin');

module.exports = {
  entry: {
    lib: './src/public-api.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: "liquify.js",
    library: "liquify", // library name
    libraryTarget: 'umd', // the umd format
    umdNamedDefine: true
  },
  devtool: 'source-map',
  resolve: {
    extensions: ['.webpack.js', '.web.js', '.ts',  '.js'],
    modules: [ path.join(__dirname, "node_modules") ]
  },
  module: {
    rules: [
      {
        test: /\.html$/,
        loader: 'html-loader'
      },
      { test: /\.ts$/, loaders: [
          {
            loader: 'awesome-typescript-loader',
            options: {
              // If it's called anything else we receive error: "Experimental support for decorators is a feature that is subject to change in a future release."
              configFileName: 'tsconfig.json'
            }
          },
          // 'angular2-template-loader',
        ]
      },
    ]
  },
  optimization: {
    minimize: true
  },
  plugins: [
    new WorkerPlugin()
  ]
};
