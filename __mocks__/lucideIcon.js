// Jest stand-in for every `lucide-react-native/icons/<name>` import (see jest.config.js). The
// package ships ES modules that Jest does not transform; the pure tests only need a component.
const LucideIcon = () => null;
module.exports = LucideIcon;
module.exports.default = LucideIcon;
