import _ from "lodash"
import axios from "axios"

function shouldParseJson(query) {
  return _.isBoolean(query.parseJson) ? query.parseJson : true
}

function omitParseJson(query) {
  return _.omit(query, "parseJson")
}

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
    if (_.isArray(query)) {
      return this.sendBatch(query)
    } else {
      return this.sendSingle(query)
    }
  }

  sendBatch(queries) {
    return axios.post(this.queryUri, queries.map(omitParseJson)).then(({data}) => {
      return _(data)
        .zip(queries)
        .map(([result, query]) => {
          if (shouldParseJson(query)) {
            try {
              parsePayloads(result)
            } catch (error) {
              return {
                topic: query.topic,
                error
              }
            }
          }

          return result
        })
        .value()
    })
  }

  sendSingle(query) {
    return axios.post(this.queryUri, omitParseJson(query)).then(({data}) => {
      if (shouldParseJson(query)) {
        parsePayloads(data)
      }

      return data
    }).catch(({data}) => {
      throw data
    })
  }
}
