// app.json holds the config; this only adds what can't be committed (the repo is public).
// google-services.json (Firebase, for Android push) is git-ignored: EAS builds get it from the
// GOOGLE_SERVICES_JSON file variable, local builds from the project root. Without it, Android
// builds still work but can't get a push token.
const fs = require('fs');
const { withSettingsGradle } = require('expo/config-plugins');

// PUGDOM_FOSS=1: the F-Droid / IzzyOnDroid build (scripts/build-foss.sh). No Google code (expo-notifications
// brings Firebase, so no push) and no over-the-air updates (those stores only allow code they reviewed).
const FOSS = process.env.PUGDOM_FOSS === '1';

const googleServicesFile = FOSS
    ? undefined
    : process.env.GOOGLE_SERVICES_JSON ?? (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);

// Leaves expo-notifications (and Firebase with it) out of the native build; metro.config.js swaps its JS for a stub.
// expo-application only comes with it, and brings Google Play's install referrer library.
const withoutNotifications = config => withSettingsGradle(config, mod => {
    mod.modResults.contents = mod.modResults.contents.replace(
        'expoAutolinking.useExpoModules()',
        "expoAutolinking.exclude = ['expo-notifications', 'expo-application']\nexpoAutolinking.useExpoModules()",
    );
    return mod;
});

// 1.3.4 → 10304: those stores need a version code in the build itself (Play's comes from EAS)
const versionCode = version => version.split('.').reduce((code, part) => code * 100 + Number(part), 0);

module.exports = ({ config }) => {
    if (!FOSS) return { ...config, android: { ...config.android, googleServicesFile } };
    return withoutNotifications({
        ...config,
        android: { ...config.android, versionCode: versionCode(config.version) },
        updates: { enabled: false },
        plugins: config.plugins.filter(plugin => [].concat(plugin)[0] !== 'expo-notifications'),
        extra: { ...config.extra, foss: true },
    });
};
