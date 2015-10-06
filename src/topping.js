import ClientWrapper from "./clientWrapper";
import QueryWrapper from "./queryWrapper";

module.exports = {
  connect(tcpUri, httpUri, options, callback) {
    return new ClientWrapper(tcpUri, httpUri, options, callback);
  }
}
