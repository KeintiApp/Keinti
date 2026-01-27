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
# (Usually safe without explicit rules, but keeping this avoids edge-case reflection stripping.)
-keep class com.google.android.gms.ads.** { *; }
