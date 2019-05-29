let path = require('path');

module.exports = {
    entry: {
        IndexPage: './web/src/script/IndexPage.tsx',
        AdminPage: './web/src/script/AdminPage.tsx'
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'web/dist'),
        publicPath: '/static/'
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader",
            },
            {
                test: /\.scss$/,
                use: [
                    "style-loader",
                    "css-loader",
                    "sass-loader",
                ],
            },
            {
                test: /\.css$/,
                use: [
                    "style-loader",
                    "css-loader",
                ],
            },
            {
                test: /\.(png|jpe?g)$/,
                loader: "file-loader",
            },
        ]
    },
};
