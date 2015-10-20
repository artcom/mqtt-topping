import _ from "lodash"
import axios from "axios"

function parsePayloads(result) {
  if (_.isArray(result)) {
    result.forEach(parsePayloads)
  } else {
    return parsePayload(result)
  }
}

function parsePayload(result) {
  if (result.payload) {
    result.payload = JSON.parse(result.payload)
  }

  if (result.children) {
    result.children.map(parsePayloads)
  }
}

export default class QueryWrapper {
  constructor(uri) {
    this.queryUri = uri + "/query"
  }

  send(query) {
    const parseJson = _.isBoolean(query.parseJson) ? query.parseJson : true

    return axios.post(this.queryUri, _.omit(query, "parseJson")).then(({data}) => {
      if (parseJson) {
        parsePayloads(data)
      }

      return data
    }).catch(({data}) => {
      throw data
    })
  }
}
