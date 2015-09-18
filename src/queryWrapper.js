import _ from "lodash";
import axios from "axios";

function lastTopicLevel(topic) {
  return _(topic).split("/").last();
}

export default class QueryWrapper {
  constructor(uri) {
    this.queryUri = uri + "/query";
  }

  topic(topic) {
    return this.sendQuery({ topic }).then(({payload}) => JSON.parse(payload));
  }

  subtopics(topic) {
    return this.sendQuery({ topic, depth: 1 }).then(({children}) => {
      return _(children || [])
        .filter((child) => child.payload)
        .map((child) => [lastTopicLevel(child.topic), JSON.parse(child.payload)])
        .zipObject()
        .value();
    });
  }

  subtopicNames(topic) {
    return this.sendQuery({ topic, depth: 1}).then(({children}) =>
      children.map((child) => lastTopicLevel(child.topic))
    );
  }

  sendQuery(query) {
    return axios.post(this.queryUri, query).then(({data}) => data);
  }
}
