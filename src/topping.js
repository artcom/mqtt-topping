import ClientWrapper from "./clientWrapper";
import QueryWrapper from "./queryWrapper";

module.exports = {
  connect(uri, callback) {
    return new ClientWrapper(uri, callback);
  },
  query(uri) {
    return new QueryWrapper(uri);
  }
}
