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
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.turbomodule.core.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**

# Keep RN module patterns
-keepclassmembers class * extends com.facebook.react.bridge.JavaScriptModule { *; }
-keepclassmembers class * extends com.facebook.react.bridge.NativeModule { *; }
-keepclassmembers class * extends com.facebook.react.uimanager.ViewManager { *; }

# Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.hermes.reactexecutor.** { *; }

# --- Google Mobile Ads (AdMob) ---
# Keep ALL public and internal AdMob/GMS classes so R8 doesn't strip
# reflection-based code used by the ads pipeline (mediation, rendering, etc.).
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.android.gms.internal.ads.** { *; }
-keep class com.google.android.gms.common.** { *; }
-keep class com.google.ads.** { *; }
-dontwarn com.google.android.gms.**

# Keep IMA SDK classes (if present via mediation)
-keep class com.google.ads.interactivemedia.** { *; }
-dontwarn com.google.ads.interactivemedia.**

# Keep annotation-based metadata used internally by AdMob
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses

# --- react-native-inappbrowser-reborn (Chrome Custom Tabs OAuth redirect) ---
# R8 strips ChromeTabsManagerActivity in release builds, which is the internal
# activity that intercepts custom-scheme redirects (keinti://auth-callback).
# Without it, openAuth() never resolves and the user gets "kicked out".
-keep class com.proyecto26.inappbrowser.** { *; }
-dontwarn com.proyecto26.inappbrowser.**

# Keep Chrome Custom Tabs support classes
-keep class androidx.browser.customtabs.** { *; }
-dontwarn androidx.browser.customtabs.**
