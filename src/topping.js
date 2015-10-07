import ClientWrapper from "./clientWrapper";
import QueryWrapper from "./queryWrapper";

module.exports = {
  connect(uri, options, callback) {
    return new ClientWrapper(uri, options, callback);
  },
  query(uri) {
    return new QueryWrapper(uri);
  }
}
