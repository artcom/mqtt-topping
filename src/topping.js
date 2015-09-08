import ClientWrapper from "./clientWrapper";
import QueryWrapper from "./queryWrapper";

module.exports = {
  connect(uri) {
    return new ClientWrapper(uri);
  },
  query(uri) {
    return new QueryWrapper(uri);
  }
}
