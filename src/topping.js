import ClientWrapper from "./clientWrapper"

module.exports = {
  connect(tcpUri, httpUri, options, callback) {
    return new ClientWrapper(tcpUri, httpUri, options, callback)
  }
}
