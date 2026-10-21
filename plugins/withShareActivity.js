const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

// Shares from other apps arrive at a small ShareActivity that hands them to MainActivity in pugdon's own
// task. Apps that share "for result" (Samsung Internet, through the system chooser) otherwise get a second
// MainActivity inside their own task, despite singleTask: two copies of pugdon, each opening Compose.
// Runs after expo-sharing's plugin and moves its intent filters from MainActivity to ShareActivity.

const shareActivity = pkg => `package ${pkg}

import android.app.Activity
import android.content.Intent
import android.os.Bundle

class ShareActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Not for result: MainActivity's singleTask then applies, so the running pugdon gets the share.
    // The read grant goes along for shared photos and videos.
    startActivity(
      Intent(intent)
        .setClass(this, MainActivity::class.java)
        .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK or (intent.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION))
    )
    finish()
  }
}
`;

const withShareActivityManifest = config =>
    withAndroidManifest(config, config => {
        const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
        const main = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
        const filters = (main['intent-filter'] ?? []).filter(filter => filter.$?.['expo-sharing-intent-filters'] === 'true');
        main['intent-filter'] = (main['intent-filter'] ?? []).filter(filter => !filters.includes(filter));
        app.activity = (app.activity ?? []).filter(activity => activity.$['android:name'] !== '.ShareActivity');
        app.activity.push({
            $: {
                'android:name': '.ShareActivity',
                'android:exported': 'true',
                'android:excludeFromRecents': 'true',
                'android:noHistory': 'true',
                'android:taskAffinity': '',
                'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
            },
            'intent-filter': filters,
        });
        return config;
    });

const withShareActivitySource = config =>
    withDangerousMod(config, [
        'android',
        async config => {
            const pkg = config.android.package;
            const dir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/java', ...pkg.split('.'));
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, 'ShareActivity.kt'), shareActivity(pkg));
            return config;
        },
    ]);

module.exports = config => withShareActivitySource(withShareActivityManifest(config));
