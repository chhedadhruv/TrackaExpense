# Add project specific ProGuard rules here.
# Optimized for React Native 0.76+ and Play Store publishing

# ===== BASIC SETTINGS =====
-verbose
-dontpreverify
-dontobfuscate
-optimizations !code/simplification/arithmetic,!code/allocation/variable,!field/*,!class/merging/*

# Keep important attributes
-keepattributes Exceptions,InnerClasses,Signature,Deprecated,SourceFile,LineNumberTable,*Annotation*,EnclosingMethod

# ===== CRITICAL: Prevent JavaScript Bridge Issues =====
# Keep ALL Java core classes that JavaScript might need
-keep class java.lang.** { *; }
-keep class java.util.** { *; }
-keep class java.io.** { *; }
-keep class java.net.** { *; }

# Keep all classes that interact with JavaScript runtime
-keep class * implements java.util.Iterator { *; }
-keep class * implements java.lang.Iterable { *; }
-keep class * extends java.util.** { *; }

# Keep JavaScript interface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
    public void *(android.webkit.WebView, java.lang.String);
}

# Prevent ANY modification of collection classes
-keep class java.util.ArrayList { *; }
-keep class java.util.HashMap { *; }
-keep class java.util.LinkedList { *; }
-keep class java.util.Map { *; }
-keep class java.util.List { *; }
-keep class java.util.Set { *; }
-keep class java.util.Collection { *; }

# Keep all array-related methods
-keepclassmembers class * {
    *** toArray(...);
    *** iterator();
    *** values();
    *** keySet();
    *** entrySet();
}

# Keep all object conversion methods
-keepclassmembers class * {
    public java.lang.String toString();
    public boolean equals(java.lang.Object);
    public int hashCode();
}

# ===== REACT NATIVE CORE =====
# Essential React Native classes only
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-keep class com.facebook.react.common.** { *; }
-keep class com.facebook.react.module.** { *; }
-keep class com.facebook.react.animated.** { *; }
-keep class com.facebook.react.devsupport.** { *; }

# Critical: Keep all React Native runtime classes
-keep class com.facebook.react.runtime.** { *; }
-keep class com.facebook.react.defaults.** { *; }

# Keep React Native data structures and serialization
-keep class com.facebook.react.bridge.WritableMap { *; }
-keep class com.facebook.react.bridge.ReadableMap { *; }
-keep class com.facebook.react.bridge.WritableArray { *; }
-keep class com.facebook.react.bridge.ReadableArray { *; }
-keep class com.facebook.react.bridge.Arguments { *; }

# Keep all React Native argument conversion methods
-keepclassmembers class com.facebook.react.bridge.Arguments {
    public static <methods>;
}

# Keep all WritableNativeMap/Array methods
-keep class com.facebook.react.bridge.WritableNative** { *; }
-keep class com.facebook.react.bridge.ReadableNative** { *; }

# ===== HERMES AND JSI - CRITICAL =====
# Keep ALL Hermes classes completely untouched
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jsi.** { *; }
-keep class com.facebook.soloader.** { *; }
-keep class com.facebook.jsc.** { *; }
-keep class com.facebook.yoga.** { *; }

# Keep all JSI interfaces and implementations
-keepclassmembers class com.facebook.jsi.** {
    *;
}

# Keep Hermes executor and runtime
-keep class com.facebook.hermes.reactexecutor.** { *; }
-keep class com.facebook.hermes.intl.** { *; }
-keep class com.facebook.hermes.HermesExecutorFactory { *; }
-keep class com.facebook.hermes.HermesExecutor { *; }

# Keep all JNI methods (critical for native bridge)
-keepclassmembers class * {
    native <methods>;
}

# Keep all classes with JNI methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# New Architecture (Fabric & TurboModules)
-keep class com.facebook.react.fabric.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class * implements com.facebook.react.turbomodule.core.interfaces.TurboModule { *; }

# React Native modules and packages
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }
-keep class * extends com.facebook.react.bridge.BaseJavaModule { *; }
-keep class * implements com.facebook.react.bridge.ReactPackage { *; }

# ViewManagers
-keep class * extends com.facebook.react.uimanager.ViewManager { *; }
-keep class * extends com.facebook.react.uimanager.SimpleViewManager { *; }

# React methods and modules
-keep @com.facebook.react.bridge.ReactMethod class * { *; }
-keep @com.facebook.react.bridge.ReactModule class * { *; }

# React props
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

# Native methods
-keepclassmembers class * {
    native <methods>;
}

# ===== YOUR APP CLASSES =====
-keep class com.trackaexpense.MainApplication { *; }
-keep class com.trackaexpense.MainActivity { *; }
-keep class com.trackaexpense.BuildConfig { *; }

# ===== FIREBASE =====
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-keep class io.invertase.firebase.** { *; }
-keepclassmembers class com.google.firebase.** { *; }

# Suppress Firebase warnings
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ===== GOOGLE SIGN-IN =====
-keep class com.google.android.gms.auth.** { *; }
-keep class com.google.android.gms.common.** { *; }
-keep class com.google.android.gms.tasks.** { *; }
-keep class com.google.android.gms.internal.** { *; }
-keep class com.google.android.gms.signin.** { *; }
-keep class com.google.android.gms.identity.** { *; }
-keep class com.google.android.gms.auth.api.** { *; }
-keep class com.google.android.gms.auth.api.signin.** { *; }
-keep class com.google.android.gms.auth.api.signin.internal.** { *; }

# Google Sign-In specific classes
-keep class com.google.android.gms.auth.api.signin.GoogleSignInAccount { *; }
-keep class com.google.android.gms.auth.api.signin.GoogleSignInOptions { *; }
-keep class com.google.android.gms.auth.api.signin.GoogleSignInClient { *; }
-keep class com.google.android.gms.auth.api.signin.GoogleSignIn { *; }
-keep class com.google.android.gms.auth.api.signin.GoogleSignInResult { *; }

# Google Sign-In React Native bridge
-keep class com.reactnativegooglesignin.** { *; }
-keep class * extends com.reactnativegooglesignin.** { *; }

# Keep Google Sign-In methods
-keepclassmembers class * {
    @com.google.android.gms.auth.api.signin.GoogleSignInAccount <methods>;
    @com.google.android.gms.auth.api.signin.GoogleSignInOptions <methods>;
}

# Suppress Google Sign-In warnings
-dontwarn com.google.android.gms.auth.**
-dontwarn com.google.android.gms.common.**
-dontwarn com.google.android.gms.tasks.**
-dontwarn com.google.android.gms.internal.**
-dontwarn com.google.android.gms.signin.**
-dontwarn com.google.android.gms.identity.**
-dontwarn com.reactnativegooglesignin.**

# ===== REACT NATIVE LIBRARIES =====
# Keep ALL React Native community libraries
-keep class com.reactnativecommunity.** { *; }

# Vector Icons
-keep class com.oblador.vectoricons.** { *; }

# Gesture Handler & Reanimated
-keep class com.swmansion.** { *; }

# AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# Image Picker
-keep class com.imagepicker.** { *; }

# React Native Paper
-keep class com.callstack.** { *; }

# Safe Area Context
-keep class com.th3rdwave.** { *; }

# Linear Gradient
-keep class com.BV.LinearGradient.** { *; }

# SVG
-keep class com.horcrux.svg.** { *; }

# Dropdown Picker
-keep class com.hossein.zaman.dropdownpicker.** { *; }

# React Native Dotenv
-keep class com.reactnativedotenv.** { *; }
-keep class * extends com.reactnativedotenv.** { *; }

# Contacts
-keep class com.rt2zz.reactnativecontacts.** { *; }

# Gifted Charts and related
-keep class com.github.** { *; }

# React Native Navigation
-keep class com.reactnavigation.** { *; }

# Masked View
-keep class org.reactnative.maskedview.** { *; }

# Any other React Native modules
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { 
    public <init>(...);
    <methods>;
}

# Keep all React Native package classes
-keep class * implements com.facebook.react.bridge.ReactPackage {
    public <init>(...);
    <methods>;
}

# ===== GENERAL ANDROID =====
# Keep serializable classes
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

# Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ===== NETWORKING =====
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-keep interface okhttp3.** { *; }
-keep interface okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# ===== JAVASCRIPT INTERFACE =====
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ===== SUPPRESS COMMON WARNINGS =====
-dontwarn java.nio.file.*
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn sun.misc.Unsafe
-dontwarn java.lang.ClassValue
-dontwarn com.google.j2objc.annotations.**
-dontwarn afu.org.checkerframework.**
-dontwarn org.checkerframework.**

# ===== PLAY STORE OPTIMIZATION =====
# Keep all native methods for JNI
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep all classes that have native methods
-keepclasseswithmembers class * {
    native <methods>;
}

# Keep all classes with @Keep annotation
-keep @androidx.annotation.Keep class * { *; }
-keepclassmembers class * {
    @androidx.annotation.Keep *;
}

# Keep all classes with @KeepForSdk annotation
-keep @com.google.android.gms.common.annotation.KeepForSdk class * { *; }
-keepclassmembers class * {
    @com.google.android.gms.common.annotation.KeepForSdk *;
}

# ===== ADDITIONAL GOOGLE SERVICES =====
# Keep Google Play Services classes
-keep class com.google.android.gms.** { *; }
-keep interface com.google.android.gms.** { *; }

# Keep Google API classes
-keep class com.google.api.** { *; }
-keep class com.google.protobuf.** { *; }

# Keep Google Auth classes
-keep class com.google.auth.** { *; }
-keep class com.google.oauth2.** { *; }

# ===== ENVIRONMENT VARIABLES =====
# Keep classes that might be used for environment variable access
-keep class * {
    public static final java.lang.String *;
}

# Keep BuildConfig fields
-keepclassmembers class * {
    public static final java.lang.String *;
}

# ===== COIL IMAGE LOADING LIBRARY =====
# Keep all Coil classes
-keep class coil3.** { *; }
-keep class coil.** { *; }
-keep class coil3.PlatformContext { *; }
-keep class coil3.network.** { *; }
-keep class coil3.network.okhttp.** { *; }
-keep class coil3.network.ConnectivityChecker { *; }
-keep class coil3.network.okhttp.OkHttpNetworkFetcher** { *; }

# Suppress Coil warnings
-dontwarn coil3.**
-dontwarn coil.**

# ===== REACT NATIVE MODULE BRIDGES =====
# Keep all React Native module bridges
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
    public <init>(...);
    <methods>;
}

# Keep all React Native package implementations
-keep class * implements com.facebook.react.bridge.ReactPackage {
    public <init>(...);
    <methods>;
}

# Keep all React Native view managers
-keep class * extends com.facebook.react.uimanager.ViewManager {
    public <init>(...);
    <methods>;
}
