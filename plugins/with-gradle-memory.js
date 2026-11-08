const {withGradleProperties} = require('expo/config-plugins');

// The default 2 GB Gradle heap is not enough for R8 on release builds since the Firebase v27
// upgrade (R8 fails with "java.lang.OutOfMemoryError: Java heap space").
const JVM_ARGS = '-Xmx4g -XX:MaxMetaspaceSize=1g';

module.exports = config =>
  withGradleProperties(config, cfg => {
    cfg.modResults = cfg.modResults.filter(
      item => !(item.type === 'property' && item.key === 'org.gradle.jvmargs'),
    );
    cfg.modResults.push({
      type: 'property',
      key: 'org.gradle.jvmargs',
      value: JVM_ARGS,
    });
    return cfg;
  });
