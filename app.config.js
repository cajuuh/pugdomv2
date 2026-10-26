// app.json holds the config; this only adds what can't be committed (the repo is public).
// google-services.json (Firebase, for Android push) is git-ignored: EAS builds get it from the
// GOOGLE_SERVICES_JSON file variable, local builds from the project root. Without it, Android
// builds still work but can't get a push token.
const fs = require('fs');

const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ?? (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);

module.exports = ({ config }) => ({
    ...config,
    android: { ...config.android, googleServicesFile },
});
