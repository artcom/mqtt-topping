import mqtt from "mqtt";

import ClientWrapper from "./clientWrapper";
import QueryWrapper from "./queryWrapper";

module.exports = {
  connect(uri) {
    return new Promise(function(resolve, reject) {
      const client = mqtt.connect(uri)
      client.once("connect", function() {
        resolve(new ClientWrapper(client));
      });
    });
  },
  query(uri) {
    return new QueryWrapper(uri);
  }
}
