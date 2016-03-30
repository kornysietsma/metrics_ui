var path = require('path');
var HtmlwebpackPlugin = require('html-webpack-plugin');
var webpack = require('webpack');
var merge = require('webpack-merge');

var TARGET = process.env.npm_lifecycle_event;
var ROOT_PATH = path.resolve(__dirname);
var APP_PATH = path.resolve(ROOT_PATH, 'app');

var common = {
    entry: path.resolve(APP_PATH, 'main.js'),
    resolve: {
        extensions: ['', '.js', '.jsx']
    },
    output: {
        path: path.resolve(ROOT_PATH, 'build'),
        publicPath: '/assets/',
        filename: 'bundle.js'
    },
    module: {
        loaders: [
            {
                test: /\.css$/,
                loaders: ['style', 'css'],
                include: APP_PATH
            },
            {
                test: /\.jsx?$/,
                loaders: ['babel'],
                include: APP_PATH
            }
        ],
        externals: {
            lodash: 'lodash'
        },
        plugins: [
            new webpack.ProvidePlugin({
                d3: 'd3'
            })
        ]
    }
};

if (TARGET === 'start' || !TARGET) {
    module.exports = merge(common, {
        devtool: 'source-map',
        devServer: {
            historyApiFallback: true, hot: true,
            inline: true,
            progress: true,
            proxy: {
                '/data*': {
                    target: 'http://localhost:3000',
                    secure: false,
                },
            },
        },
        plugins: [
            new webpack.HotModuleReplacementPlugin()
        ]
    });
}

