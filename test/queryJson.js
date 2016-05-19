import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"

import { waitFor } from "./testHelpers"
import topping from "../src/topping"

chai.use(chaiAsPromised)

const httpBrokerUri = process.env.HTTP_BROKER_URI || "http://localhost:8080"
const tcpBrokerUri = process.env.TCP_BROKER_URI || "tcp://localhost"

describe("JSON Query API", function() {
  beforeEach(function() {
    this.client = topping.connect(tcpBrokerUri, httpBrokerUri)
    this.testTopic = `test/topping-${Date.now()}`

    const publish = (topic, payload, options) => () => this.client.publish(topic, payload, options)

    return waitFor(() => this.client.isConnected)
      .then(publish(`${this.testTopic}/array`, ["a", "b", "c"]))
      .then(publish(`${this.testTopic}/nested1/one`, 1))
      .then(publish(`${this.testTopic}/nested1/two`, 2))
      .then(publish(`${this.testTopic}/nested1/three`, "invalid", { stringifyJson: false }))
      .then(publish(`${this.testTopic}/nested2`, "valid"))
      .then(publish(`${this.testTopic}/nested2/one`, 10))
      .then(publish(`${this.testTopic}/nested3`, "invalid", { stringifyJson: false }))
      .then(publish(`${this.testTopic}/nested3/one`, 100))
      .then(publish(`${this.testTopic}/string`, "bar"))
  })

  afterEach(function() {
    return this.client.unpublishRecursively(this.testTopic)
  })

  describe("Single Queries", function() {
    it("should return a nested object with all children", function() {
      const query = this.client.queryJson({ topic: this.testTopic })
      return expect(query).to.eventually.deep.equal({
        string: "bar",
        array: ["a", "b", "c"],
        nested1: {
          one: 1,
          two: 2
        },
        nested2: {
          one: 10
        },
        nested3: {
          one: 100
        }
      })
    })

    it("should return an empty object for leaf topics", function() {
      const query = this.client.queryJson({ topic: `${this.testTopic}/string` })
      return expect(query).to.eventually.deep.equal({})
    })

    it("should return an empty object for inexistent topic", function() {
      const query = this.client.queryJson({ topic: `${this.testTopic}/does-not-exist` })
      return expect(query).to.eventually.deep.equal({})
    })

    it("should throw for wildcard queries", function() {
      expect(() => this.client.queryJson({ topic: `${this.testTopic}/+` })).to.throw(Error)
    })
  })

  describe("Batch Queries", function() {
    it("should query multiple topics", function() {
      const query = this.client.queryJson([
        { topic: `${this.testTopic}/nested1` },
        { topic: `${this.testTopic}/nested2` },
        { topic: `${this.testTopic}/does-not-exist` }
      ])

      return expect(query).to.eventually.deep.equal([
        {
          one: 1,
          two: 2
        },
        {
          one: 10
        },
        {}
      ])
    })

    it("should throw for wildcard queries", function() {
      expect(() => this.client.queryJson([
        { topic: `${this.testTopic}/+` },
        { topic: `${this.testTopic}/nested1` }
      ])).to.throw(Error)
    })
  })
})
