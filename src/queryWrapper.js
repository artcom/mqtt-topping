import _ from "lodash";
import axios from "axios";

function lastTopicLevel(topic) {
  return _(topic).split("/").last();
}

function addTopicsWithPayloadRecursively(topics, result, parseJson) {
  (topics || []).forEach(function({topic, payload, children}) {
    if (payload) {
      result[topic] = parseJson ? JSON.parse(payload) : payload;
    }

    addTopicsWithPayloadRecursively(children, result, parseJson);
  });
}

function topicsWithPayloadRecursively(topics, topicPathToPrune, parseJson) {
  const result = {};
  addTopicsWithPayloadRecursively(topics, result, parseJson);
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
    const parseJson = _.isBoolean(options.parseJson) ? options.parseJson : true;

    return this.sendQuery({ topic, depth }).then(({children}) => {
      return topicsWithPayloadRecursively(children, topic, parseJson);
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
