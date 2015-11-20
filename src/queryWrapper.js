import axios from "axios"
import isBoolean from "lodash.isboolean"
import omit from "lodash.omit"

function shouldParseJson(query) {
  return isBoolean(query.parseJson) ? query.parseJson : true
}

function omitParseJson(query) {
  return omit(query, "parseJson")
}

function parsePayloads(result) {
  if (Array.isArray(result)) {
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
    if (Array.isArray(query)) {
      return this.sendBatch(query)
    } else {
      return this.sendSingle(query)
    }
  }

  sendBatch(queries) {
    return axios.post(this.queryUri, queries.map(omitParseJson)).then(({data}) => {
      return data.map((result, index) => {
        const query = queries[index]

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
