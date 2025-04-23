// esbuild.config.js
const esbuild = require('esbuild');

esbuild.build({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    platform: 'node',
    target: ['node18'],
    outdir: 'dist',
    sourcemap: true,
    external: [
        'vscode', // VS Code API must be external
    ],
    minify: false,
    tsconfig: 'tsconfig.json',
    logLevel: 'info',
}).catch(() => process.exit(1));
