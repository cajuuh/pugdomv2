import fs from 'fs';
import path from 'path';
import * as stub from '../services/notificationsStub';

// The F-Droid / IzzyOnDroid build (PUGDOM_FOSS=1): no expo-notifications native module, so its JS is a stub
const root = path.resolve(__dirname, '..');
const sourceFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(full);
        return /\.tsx?$/.test(entry.name) ? [full] : [];
    });

describe('F-Droid build', () => {
    it('stubs every expo-notifications call the app makes', () => {
        const used = new Set(['services', 'hooks', 'screens', 'components'].flatMap(dir => sourceFiles(path.join(root, dir)))
            .flatMap(file => [...fs.readFileSync(file, 'utf8').matchAll(/\bNotifications\.(\w+)/g)].map(match => match[1])));
        expect(used.size).toBeGreaterThan(5);
        expect([...used].filter(name => !(name in stub))).toEqual([]);
    });

    describe('app config', () => {
        const load = (foss: boolean) => {
            const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
            process.env.PUGDOM_FOSS = foss ? '1' : '';
            let config;
            jest.isolateModules(() => { config = require('../app.config.js')({ config: appJson }); });
            delete process.env.PUGDOM_FOSS;
            return { appJson, config: config as any };
        };

        it('leaves the Play build as app.json has it', () => {
            const { appJson, config } = load(false);
            expect(config.plugins).toEqual(appJson.plugins);
            expect(config.updates).toEqual(appJson.updates);
            expect(config.extra.foss).toBeUndefined();
        });

        it('drops push and over-the-air updates, and sets a version code', () => {
            const { appJson, config } = load(true);
            expect(JSON.stringify(config.plugins)).not.toContain('expo-notifications');
            expect(config.updates).toEqual({ enabled: false });
            expect(config.android.googleServicesFile).toBeUndefined();
            expect(config.extra.foss).toBe(true);
            const [major, minor, patch] = appJson.version.split('.').map(Number);
            expect(config.android.versionCode).toBe(major * 10000 + minor * 100 + patch);
        });
    });
});
