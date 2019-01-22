import ClientWrapper from "./clientWrapper"

import { IClientOptions } from "mqtt"

export default {
  connect(tcpUri: string, httpUri: string, options: IClientOptions) {
    return new ClientWrapper(tcpUri, httpUri, options)
  }
}
