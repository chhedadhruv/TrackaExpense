const {withGradleProperties} = require('expo/config-plugins');

// The default 2 GB Gradle heap is not enough for R8 on release builds since the Firebase v27
// upgrade (R8 fails with "java.lang.OutOfMemoryError: Java heap space").
const JVM_ARGS = '-Xmx4g -XX:MaxMetaspaceSize=1g';

// The native C++ libraries (Skia, Reanimated, worklets, MMKV, expo-modules-core) are heavy to
// compile. With Gradle running projects in parallel the builder ran out of memory and killed the
// Gradle daemon ("Gradle build daemon disappeared unexpectedly", EAS build efcae534, 2026-11-12).
// Building one project at a time, with a small worker pool, keeps the peak memory down at the
// cost of a longer build.
const PROPERTIES = {
  'org.gradle.jvmargs': JVM_ARGS,
  'org.gradle.parallel': 'false',
  'org.gradle.workers.max': '2',
};

module.exports = config =>
  withGradleProperties(config, cfg => {
    cfg.modResults = cfg.modResults.filter(
      item => !(item.type === 'property' && item.key in PROPERTIES),
    );
    Object.entries(PROPERTIES).forEach(([key, value]) => {
      cfg.modResults.push({type: 'property', key, value});
    });
    return cfg;
  });
