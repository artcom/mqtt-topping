import _ from "lodash";
import axios from "axios";

export default class QueryWrapper {
  constructor(uri) {
    this.queryUri = uri + "/query";
  }

  list(topic) {
    return this.sendQuery({ topic, depth: 1 }).then(({children}) => {
      return _(children || [])
        .map((child) => [_(child.topic).split("/").last(), JSON.parse(child.payload)])
        .zipObject()
        .value();
    });
  }

  sendQuery(query) {
    return axios.post(this.queryUri, query).then(({data}) => data);
  }
}
