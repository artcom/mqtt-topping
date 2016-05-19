import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"

import { waitFor } from "./testHelpers"
import topping from "../src/topping"

chai.use(chaiAsPromised)

const httpBrokerUri = process.env.HTTP_BROKER_URI || "http://localhost:8080"
const tcpBrokerUri = process.env.TCP_BROKER_URI || "tcp://localhost"

describe("JSON Query API", function() {
  this.timeout(5000)

  beforeEach(function() {
    this.client = topping.connect(tcpBrokerUri, httpBrokerUri)
    this.testTopic = `test/topping-${Date.now()}`

    const publish = (topic, payload, options) => () => this.client.publish(topic, payload, options)

    return waitFor(() => this.client.isConnected)
      .then(publish(`${this.testTopic}/foo`, "bar"))
      .then(publish(`${this.testTopic}/baz`, 23))
      .then(publish(`${this.testTopic}/nested1/one`, 1))
      .then(publish(`${this.testTopic}/nested1/two`, 2))
      .then(publish(`${this.testTopic}/nested1/three`, "invalid", { stringifyJson: false }))
      .then(publish(`${this.testTopic}/nested2`, "valid"))
      .then(publish(`${this.testTopic}/nested2/one`, 10))
      .then(publish(`${this.testTopic}/nested3`, "invalid", { stringifyJson: false }))
      .then(publish(`${this.testTopic}/nested3/one`, 100))
  })

  afterEach(function() {
    return this.client.unpublishRecursively(this.testTopic)
  })

  describe("Single Queries", function() {
    it("should return a nested object with all children", function() {
      const query = this.client.queryJson({ topic: this.testTopic })
      return expect(query).to.eventually.deep.equal({
        foo: "bar",
        baz: 23,
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
      const query = this.client.queryJson({ topic: `${this.testTopic}/foo` })
      return expect(query).to.eventually.deep.equal({})
    })

    it("should return an empty object for inexistent topic", function() {
      const query = this.client.queryJson({ topic: `${this.testTopic}/does-not-exist` })
      return expect(query).to.eventually.deep.equal({})
    })

    xit("should query wildcard topics", function() {
      const query = this.client.queryJson({ topic: `${this.testTopic}/+` })
      return expect(query).to.eventually.deep.equal([
        {},
        {},
        {
          one: 1,
          two: 2
        },
        {
          one: 10
        },
        {
          one: 100
        }
      ])
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
  })
})
