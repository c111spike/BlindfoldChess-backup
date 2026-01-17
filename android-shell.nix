{ pkgs ? import <nixpkgs> {} }:

let
  androidSdk = pkgs.androidenv.composeAndroidPackages {
    platformVersions = [ "34" ];
    buildToolsVersions = [ "34.0.0" "33.0.1" ];
    includeNDK = false;
    includeEmulator = false;
  };
in
pkgs.mkShell {
  buildInputs = [
    pkgs.jdk17
    androidSdk.androidsdk
  ];

  ANDROID_HOME = "${androidSdk.androidsdk}/libexec/android-sdk";
  ANDROID_SDK_ROOT = "${androidSdk.androidsdk}/libexec/android-sdk";
  JAVA_HOME = "${pkgs.jdk17}";

  shellHook = ''
    export PATH="${androidSdk.androidsdk}/libexec/android-sdk/platform-tools:$PATH"
    export PATH="${androidSdk.androidsdk}/libexec/android-sdk/build-tools/34.0.0:$PATH"
    echo "Android SDK and JDK 17 ready"
  '';
}
