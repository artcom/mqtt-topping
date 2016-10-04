import ClientWrapper from "./clientWrapper"

module.exports = {
  connect(tcpUri, httpUri, options) {
    return new ClientWrapper(tcpUri, httpUri, options)
  }
}
