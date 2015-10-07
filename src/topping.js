import ClientWrapper from "./clientWrapper";
import QueryWrapper from "./queryWrapper";

module.exports = {
  connect(uri, callback, options) {
    return new ClientWrapper(uri, callback, options);
  },
  query(uri) {
    return new QueryWrapper(uri);
  }
}
