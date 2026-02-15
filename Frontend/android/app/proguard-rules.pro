# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# --- React Native / Hermes (Release builds) ---
# Keep debug info so crash reports can be retraced with mapping.txt
-keepattributes SourceFile,LineNumberTable

# React Native bridge / modules
-keep class com.facebook.react.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.turbomodule.core.** { *; }
-keep class com.facebook.react.defaults.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**

# --- SoLoader (CRITICAL: R8 strips mapLibName, causing startup crash) ---
-keep class com.facebook.soloader.** { *; }
-keep class com.facebook.react.soloader.** { *; }

# Keep RN module patterns (use -keep, not just -keepclassmembers)
-keep class * extends com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keep class * extends com.facebook.react.uimanager.ViewManager { *; }
-keep class * extends com.facebook.react.ReactPackage { *; }

# Hermes
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.hermes.reactexecutor.** { *; }

# --- AndroidX edge-to-edge (required by MainActivity.enableEdgeToEdge()) ---
-keep class androidx.activity.EdgeToEdge** { *; }
-keep class androidx.activity.SystemBarStyle** { *; }
-keep class androidx.core.view.WindowCompat** { *; }
-keep class androidx.core.view.WindowInsetsCompat** { *; }
-keep class androidx.core.view.WindowInsetsControllerCompat** { *; }

# --- Google Mobile Ads (AdMob) ---
# Keep ALL public and internal AdMob/GMS classes so R8 doesn't strip
# reflection-based code used by the ads pipeline (mediation, rendering, etc.).
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.android.gms.internal.ads.** { *; }
-keep class com.google.android.gms.common.** { *; }
-keep class com.google.ads.** { *; }
-keep class io.invertase.googlemobileads.** { *; }
-dontwarn com.google.android.gms.**

# Keep IMA SDK classes (if present via mediation)
-keep class com.google.ads.interactivemedia.** { *; }
-dontwarn com.google.ads.interactivemedia.**

# Keep annotation-based metadata used internally by AdMob
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# --- react-native-inappbrowser-reborn (Chrome Custom Tabs OAuth redirect) ---
-keep class com.proyecto26.inappbrowser.** { *; }
-dontwarn com.proyecto26.inappbrowser.**

# Keep Chrome Custom Tabs support classes
-keep class androidx.browser.customtabs.** { *; }
-dontwarn androidx.browser.customtabs.**

# --- react-native-svg ---
-keep class com.horcrux.svg.** { *; }

# --- react-native-maps ---
-keep class com.rnmaps.maps.** { *; }
-keep class com.google.android.gms.maps.** { *; }

# --- react-native-vector-icons ---
-keep class com.oblador.vectoricons.** { *; }

# --- react-native-safe-area-context ---
-keep class com.th3rdwave.safeareacontext.** { *; }

# --- react-native-image-crop-picker ---
-keep class com.reactnative.ivpusic.imagepicker.** { *; }
-keep class com.yalantis.ucrop.** { *; }

# --- react-native-image-picker ---
-keep class com.imagepicker.** { *; }

# --- @react-native-async-storage/async-storage ---
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# --- @react-native-clipboard/clipboard ---
-keep class com.reactnativecommunity.clipboard.** { *; }

# --- @react-native-community/datetimepicker ---
-keep class com.reactcommunity.rndatetimepicker.** { *; }

# --- @react-native-community/geolocation ---
-keep class com.reactnativecommunity.geolocation.** { *; }

# --- @react-native-firebase ---
-keep class io.invertase.firebase.** { *; }
-dontwarn io.invertase.firebase.**

# --- react-native-get-random-values ---
-keep class org.nicholasgalante.getRandomValues.** { *; }

# --- Fresco (image pipeline used by React Native) ---
-keep class com.facebook.imagepipeline.** { *; }
-keep class com.facebook.fresco.** { *; }
-dontwarn com.facebook.imagepipeline.**
