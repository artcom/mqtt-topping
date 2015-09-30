import _ from "lodash";
import axios from "axios";

function lastTopicLevel(topic) {
  return _(topic).split("/").last();
}

function addTopicsWithPayloadRecursively(topics, result) {
  (topics || []).forEach(function({topic, payload, children}) {
    if(payload) {
      result[topic] = JSON.parse(payload);
    }

    addTopicsWithPayloadRecursively(children, result);
  });
}

function topicsWithPayloadRecursively(topics, topicPathToPrune) {
  const result = {};
  addTopicsWithPayloadRecursively(topics, result);
  return _.mapKeys(result, (value, key) => key.substring(topicPathToPrune.length + 1));
}

export default class QueryWrapper {
  constructor(uri) {
    this.queryUri = uri + "/query";
  }

  topic(topic) {
    return this.sendQuery({ topic }).then(({payload}) => JSON.parse(payload));
  }

  subtopics(topic, options = {}) {
    const depth = options.depth || 1;
    return this.sendQuery({ topic, depth }).then(({children}) => {
      return topicsWithPayloadRecursively(children, topic);
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
