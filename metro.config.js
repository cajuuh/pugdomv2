const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The F-Droid build has no expo-notifications native module (app.config.js), so its JS gets a stub that does nothing
if (process.env.PUGDOM_FOSS === '1') {
    config.resolver.resolveRequest = (context, moduleName, platform) => moduleName === 'expo-notifications'
        ? { type: 'sourceFile', filePath: path.join(__dirname, 'services/notificationsStub.ts') }
        : context.resolveRequest(context, moduleName, platform);
}

module.exports = config;
