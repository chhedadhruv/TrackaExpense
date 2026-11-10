# R8 rules for the release build (injected by app.config.js through expo-build-properties).
#
# Code is shrunk, optimized and obfuscated. Play Console reports the share of obfuscated code, and
# anything under 25 percent can hurt visibility, so do NOT add broad keep rules such as
# "-keep class com.google.android.gms.** { *; }" or "-keep class * { public static final String *; }":
# every class they match stays unrenamed. Libraries ship their own consumer rules. Add a keep rule
# only for a class that a release build actually fails to find, and keep it as narrow as possible.

# ===== BASIC SETTINGS =====
-verbose
-dontpreverify
-optimizations !code/simplification/arithmetic,!code/allocation/variable,!field/*,!class/merging/*

# Keep line numbers so native stack traces stay readable once the R8 mapping is uploaded.
-keepattributes Exceptions,InnerClasses,Signature,Deprecated,SourceFile,LineNumberTable,*Annotation*,EnclosingMethod
-renamesourcefileattribute SourceFile

# ===== REACT NATIVE CORE =====
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-keep class com.facebook.react.common.** { *; }
-keep class com.facebook.react.module.** { *; }
-keep class com.facebook.react.animated.** { *; }
-keep class com.facebook.react.devsupport.** { *; }
-keep class com.facebook.react.runtime.** { *; }
-keep class com.facebook.react.defaults.** { *; }
-keep class com.facebook.react.bridge.WritableNative** { *; }
-keep class com.facebook.react.bridge.ReadableNative** { *; }

# ===== HERMES AND JSI =====
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jsi.** { *; }
-keep class com.facebook.soloader.** { *; }
-keep class com.facebook.jsc.** { *; }
-keep class com.facebook.yoga.** { *; }

# Classes with JNI methods
-keepclasseswithmembernames class * {
    native <methods>;
}
-keepclassmembers class * {
    native <methods>;
}

# New Architecture (Fabric and TurboModules)
-keep class com.facebook.react.fabric.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class * implements com.facebook.react.turbomodule.core.interfaces.TurboModule { *; }

# React Native modules, packages and view managers
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
    public <init>(...);
    <methods>;
}
-keep class * extends com.facebook.react.bridge.BaseJavaModule { *; }
-keep class * implements com.facebook.react.bridge.ReactPackage {
    public <init>(...);
    <methods>;
}
-keep class * extends com.facebook.react.uimanager.ViewManager {
    public <init>(...);
    <methods>;
}
-keep @com.facebook.react.bridge.ReactMethod class * { *; }
-keep @com.facebook.react.bridge.ReactModule class * { *; }
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

# ===== APP CLASSES =====
-keep class com.trackaexpense.MainApplication { *; }
-keep class com.trackaexpense.MainActivity { *; }
-keep class com.trackaexpense.BuildConfig { *; }

# ===== FIREBASE AND PLAY SERVICES =====
# Play services and Firebase ship consumer rules, so they are shrunk and renamed normally.
# Only the React Native Firebase bridge is kept by package name.
-keep class io.invertase.firebase.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ===== GOOGLE SIGN-IN =====
-keep class com.reactnativegooglesignin.** { *; }
-dontwarn com.reactnativegooglesignin.**

# ===== REACT NATIVE LIBRARIES =====
-keep class com.reactnativecommunity.** { *; }
-keep class com.oblador.vectoricons.** { *; }
# Gesture Handler, Reanimated, Screens
-keep class com.swmansion.** { *; }
-keep class com.imagepicker.** { *; }
-keep class com.callstack.** { *; }
-keep class com.th3rdwave.** { *; }
-keep class com.BV.LinearGradient.** { *; }
-keep class com.horcrux.svg.** { *; }
-keep class com.reactnativedotenv.** { *; }
-keep class org.reactnative.maskedview.** { *; }

# ===== GENERAL ANDROID =====
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    !private <fields>;
    !private <methods>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Classes and members annotated for keeping
-keep @androidx.annotation.Keep class * { *; }
-keepclassmembers class * {
    @androidx.annotation.Keep *;
}
-keep @com.google.android.gms.common.annotation.KeepForSdk class * { *; }
-keepclassmembers class * {
    @com.google.android.gms.common.annotation.KeepForSdk *;
}

# ===== WARNINGS THAT ARE SAFE TO SUPPRESS =====
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn java.nio.file.*
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn sun.misc.Unsafe
-dontwarn java.lang.ClassValue
-dontwarn com.google.j2objc.annotations.**
-dontwarn afu.org.checkerframework.**
-dontwarn org.checkerframework.**
# Coil3 (optional image loading library)
-dontwarn coil3.PlatformContext

# ===== SENTRY, MIXPANEL, ONESIGNAL =====
# R8 reported this annotation as missing (referenced by a library bundled in Sentry's dependencies).
-dontwarn org.osgi.annotation.bundle.Export
# React Native bridge classes of the three SDKs
-keep class io.sentry.react.** { *; }
-keep class com.mixpanel.reactnative.** { *; }
-keep class com.onesignal.rnonesignalandroid.** { *; }
