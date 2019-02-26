import { IClientOptions } from "mqtt"

import ClientWrapper from "./clientWrapper"

export default {
  connect(tcpUri: string, httpUri: string, options?: IClientOptions) {
    return new ClientWrapper(tcpUri, httpUri, options)
  }
}
