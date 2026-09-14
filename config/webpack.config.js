const path = require('path');
const fs = require('fs');

// 把项目根目录的 app.json 复制到上一级目录，
// 供 @lark-opdev/block-bitable-webpack-utils 读取
const appJsonSrc = path.resolve(__dirname, '..', 'app.json');
const appJsonDest = path.resolve(__dirname, '..', '..', 'app.json');
try {
  if (fs.existsSync(appJsonSrc)) {
    fs.copyFileSync(appJsonSrc, appJsonDest);
    console.log('✅ 已将 app.json 复制到:', appJsonDest);
  } else {
    console.warn('⚠️ 项目根目录没有 app.json:', appJsonSrc);
  }
} catch (e) {
  console.warn('⚠️ 复制 app.json 失败:', e.message);
}

const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ESBuildMinifyPlugin } = require('esbuild-loader');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const WebpackBar = require('webpackbar');

// 条件加载飞书 Webpack 工具，避免在 Vercel 等环境因内部依赖缺失而报错
let BitableAppWebpackPlugin = null;
let opdevMiddleware = null;
try {
  const utils = require('@lark-opdev/block-bitable-webpack-utils');
  BitableAppWebpackPlugin = utils.BitableAppWebpackPlugin;
  opdevMiddleware = utils.opdevMiddleware;
  console.log('✅ 已加载 @lark-opdev/block-bitable-webpack-utils');
} catch (e) {
  console.warn(
    '⚠️ 未能加载 @lark-opdev/block-bitable-webpack-utils (Vercel 生产构建中可忽略):',
    e.message
  );
}

const cwd = process.cwd();
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

const config = {
  entry: './src/index.tsx',
  devtool: isProduction ? false : 'inline-source-map',
  mode: isDevelopment ? 'development' : 'production',
  stats: 'errors-only',
  output: {
    path: path.resolve(__dirname, '../dist'),
    clean: true,
    publicPath: isDevelopment ? '/block/' : './',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        include: [/node_modules\/@lark-open/],
        use: ['source-map-loader'],
        enforce: 'pre',
      },
      {
        oneOf: [
          {
            test: /\.[jt]sx?$/,
            include: [path.join(cwd, 'src')],
            exclude: /node_modules/,
            use: [
              {
                loader: require.resolve('esbuild-loader'),
                options: {
                  loader: 'tsx',
                  target: 'es2015',
                },
              },
            ],
          },
          {
            test: /\.css$/,
            use: [
              isDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader,
              'css-loader',
            ],
          },
          {
            test: /\.less$/,
            use: [
              isDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader,
              'css-loader',
              'less-loader',
            ],
          },
          {
            test: /\.(png|jpg|jpeg|gif|ico|svg)$/,
            type: 'asset/resource',
            generator: {
              filename: 'assets/[name][ext][query]',
            },
          },
        ],
      },
    ],
  },
  plugins: [
    ...(isDevelopment
      ? [new ReactRefreshWebpackPlugin(), new WebpackBar()]
      : [new MiniCssExtractPlugin()]),

    // 仅在 BitableAppWebpackPlugin 可用时添加
    ...(BitableAppWebpackPlugin
      ? [
          new BitableAppWebpackPlugin({
            // open: true, // 控制是否自动打开多维表格
          }),
        ]
      : []),

    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: './public/index.html',
      publicPath: isDevelopment ? '/block/' : './',
    }),
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  optimization: {
    minimize: isProduction,
    minimizer: [new ESBuildMinifyPlugin({ target: 'es2015', css: true })],
    moduleIds: 'deterministic',
    runtimeChunk: true,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          name: 'vendor',
          test: /[\\/]node_modules[\\/]/,
          chunks: 'all',
        },
      },
    },
  },
  devServer: isProduction
    ? undefined
    : {
        hot: true,
        client: {
          logging: 'error',
        },
        setupMiddlewares: (middlewares, devServer) => {
          if (!devServer || !devServer.app) {
            throw new Error('webpack-dev-server is not defined');
          }
          // 仅在 opdevMiddleware 可用时添加
          if (opdevMiddleware) {
            middlewares.push(opdevMiddleware(devServer));
          }
          return middlewares;
        },
      },
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  },
};

module.exports = config;