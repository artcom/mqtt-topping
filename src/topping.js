import ClientWrapper from "./clientWrapper"

export default {
  connect(tcpUri, httpUri, options) {
    return new ClientWrapper(tcpUri, httpUri, options)
  }
}
