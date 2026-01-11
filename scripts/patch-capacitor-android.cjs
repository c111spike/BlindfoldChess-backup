#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Patching Capacitor Android for SDK 34 / JDK 17 compatibility...');

const patchJavaVersion = (filePath) => {
  if (!fs.existsSync(filePath)) return false;
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  content = content.replace(/JavaVersion\.VERSION_21/g, 'JavaVersion.VERSION_17');
  content = content.replace(/jvmTarget = "21"/g, 'jvmTarget = "17"');
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✓ Patched Java version: ${filePath}`);
    return true;
  }
  return false;
};

const patchSystemBars = () => {
  const systemBarsPath = path.join(
    __dirname, 
    '../node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/plugin/SystemBars.java'
  );
  if (!fs.existsSync(systemBarsPath)) {
    console.log('  ⚠ SystemBars.java not found (skipping VANILLA_ICE_CREAM patch)');
    return;
  }
  let content = fs.readFileSync(systemBarsPath, 'utf8');
  const original = content;
  content = content.replace(/Build\.VERSION_CODES\.VANILLA_ICE_CREAM/g, '35');
  if (content !== original) {
    fs.writeFileSync(systemBarsPath, content, 'utf8');
    console.log(`  ✓ Patched VANILLA_ICE_CREAM → 35: ${systemBarsPath}`);
  }
};

const capacitorDirs = [
  'node_modules/@capacitor/android/capacitor',
  'node_modules/@capacitor/browser/android',
  'node_modules/@capacitor/haptics/android',
  'node_modules/@capacitor-community/speech-recognition/android',
  'node_modules/@capacitor-community/keep-awake/android',
  'node_modules/@capacitor-community/sqlite/android',
  'node_modules/@capgo/capacitor-speech-synthesis/android'
];

let patchCount = 0;
capacitorDirs.forEach(dir => {
  const buildGradle = path.join(__dirname, '..', dir, 'build.gradle');
  if (patchJavaVersion(buildGradle)) patchCount++;
});

const appCapacitorBuildGradle = path.join(__dirname, '../android/app/capacitor.build.gradle');
if (patchJavaVersion(appCapacitorBuildGradle)) patchCount++;

const cordovaPluginsBuildGradle = path.join(__dirname, '../android/capacitor-cordova-android-plugins/build.gradle');
if (patchJavaVersion(cordovaPluginsBuildGradle)) patchCount++;

patchSystemBars();

console.log(`✅ Patched ${patchCount} build.gradle files for JDK 17 compatibility`);
console.log('📋 Note: resolutionStrategy in android/app/build.gradle forces SDK-34-compatible AndroidX versions');
