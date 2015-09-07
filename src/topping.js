import mqtt from "mqtt";

import ClientWrapper from "./clientWrapper";

module.exports = {
  connect: function(uri) {
    return new Promise(function(resolve, reject) {
      const client = mqtt.connect(uri)
      client.once("connect", function() {
        resolve(new ClientWrapper(client));
      });
    });
  }
}
