import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"

import { waitFor } from "./testHelpers"
import topping from "../src/topping"

chai.use(chaiAsPromised)

const httpBrokerUri = process.env.HTTP_BROKER_URI || "http://localhost:8080"
const tcpBrokerUri = process.env.TCP_BROKER_URI || "tcp://localhost"

describe("HTTP Query API", function() {
  this.timeout(5000)

  beforeEach(function() {
    this.client = topping.connect(tcpBrokerUri, httpBrokerUri)
    this.testTopic = `test/topping-${Date.now()}`

    return waitFor(() => this.client.isConnected).then(() =>
      this.client.publish(`${this.testTopic}/foo`, "bar")
    ).then(() =>
      this.client.publish(`${this.testTopic}/baz`, 23)
    ).then(() =>
      this.client.publish(`${this.testTopic}/more/one`, 1)
    ).then(() =>
      this.client.publish(`${this.testTopic}/more/two`, 2)
    )
  })

  afterEach(function() {
    return this.client.unpublishRecursively(this.testTopic).then(() => this.client.disconnect())
  })

  describe("Single Queries", function() {
    it("should query single topics", function() {
      const query = this.client.query({ topic: `${this.testTopic}/foo` })
      return expect(query).to.eventually.deep.equal({
        topic: `${this.testTopic}/foo`,
        payload: "bar"
      })
    })

    it("should query wildcard topics", function() {
      const query = this.client.query({ topic: `${this.testTopic}/+` })
      return expect(query).to.eventually.deep.equal([
        { topic: `${this.testTopic}/baz`, payload: 23 },
        { topic: `${this.testTopic}/foo`, payload: "bar" },
        { topic: `${this.testTopic}/more` }
      ])
    })

    it("should query subtopics", function() {
      const query = this.client.query({ topic: `${this.testTopic}/more`, depth: 1 })
      return expect(query).to.eventually.deep.equal({
        topic: `${this.testTopic}/more`,
        children: [
          { topic: `${this.testTopic}/more/one`, payload: 1 },
          { topic: `${this.testTopic}/more/two`, payload: 2 }
        ]
      })
    })

    it("should query subtopics with grandchildren", function() {
      const query = this.client.query({ topic: this.testTopic, depth: 2 })
      return expect(query).to.eventually.deep.equal({
        topic: this.testTopic,
        children: [
          {
            topic: `${this.testTopic}/baz`,
            payload: 23
          },
          {
            topic: `${this.testTopic}/foo`,
            payload: "bar"
          },
          {
            topic: `${this.testTopic}/more`,
            children: [
              { topic: `${this.testTopic}/more/one`, payload: 1 },
              { topic: `${this.testTopic}/more/two`, payload: 2 }
            ]
          }
        ]
      })
    })

    it("should flatten query results", function() {
      const query = this.client.query({ topic: this.testTopic, depth: 2, flatten: true })
      return expect(query).to.eventually.deep.equal([
        { topic: this.testTopic },
        { topic: `${this.testTopic}/baz`, payload: 23 },
        { topic: `${this.testTopic}/foo`, payload: "bar" },
        { topic: `${this.testTopic}/more` },
        { topic: `${this.testTopic}/more/one`, payload: 1 },
        { topic: `${this.testTopic}/more/two`, payload: 2 }
      ])
    })

    it("should fail when querying an inexistent topic", function() {
      const query = this.client.query({ topic: `${this.testTopic}/does-not-exist` })
      return Promise.all([
        expect(query).to.be.rejected,
        query.catch(error => {
          expect(error).to.deep.equal({
            topic: `${this.testTopic}/does-not-exist`,
            error: 404
          })
        })
      ])
    })
  })

  describe("Batch Queries", function() {
    it("should query multiple topics", function() {
      const query = this.client.query([
        { topic: `${this.testTopic}/foo` },
        { topic: `${this.testTopic}/baz` }
      ])

      return expect(query).to.eventually.deep.equal([
        { topic: `${this.testTopic}/foo`, payload: "bar" },
        { topic: `${this.testTopic}/baz`, payload: 23 }
      ])
    })

    it("should include errors in the results", function() {
      const query = this.client.query([
        { topic: `${this.testTopic}/foo` },
        { topic: `${this.testTopic}/does-not-exist` }
      ])

      return expect(query).to.eventually.deep.equal([
        { topic: `${this.testTopic}/foo`, payload: "bar" },
        { topic: `${this.testTopic}/does-not-exist`, error: 404 }
      ])
    })
  })

  describe("JSON Parsing", function() {
    beforeEach(function(done) {
      this.client.client.publish(
        `${this.testTopic}/invalid`,
        "this is invalid JSON",
        { retain: true },
        done
      )
    })

    it("should fail on invalid payloads", function() {
      const query = this.client.query({ topic: `${this.testTopic}/invalid` })
      return expect(query).to.be.rejected
    })

    it("should represent errors in batch queries", function() {
      const query = this.client.query([
        { topic: `${this.testTopic}/foo` },
        { topic: `${this.testTopic}/invalid` }
      ])

      return expect(query).to.eventually.deep.equal([
        { topic: `${this.testTopic}/foo`, payload: "bar" },
        { topic: `${this.testTopic}/invalid`, error: new SyntaxError("Unexpected token h") }
      ])
    })

    it("can be disabled in single queries", function() {
      const query = this.client.query({ topic: `${this.testTopic}/invalid`, parseJson: false })
      return expect(query).to.eventually.deep.equal({
        topic: `${this.testTopic}/invalid`,
        payload: "this is invalid JSON"
      })
    })

    it("can be disabled in batch queries", function() {
      const query = this.client.query([
        { topic: `${this.testTopic}/foo` },
        { topic: `${this.testTopic}/invalid`, parseJson: false }
      ])

      return expect(query).to.eventually.deep.equal([
        { topic: `${this.testTopic}/foo`, payload: "bar" },
        { topic: `${this.testTopic}/invalid`, payload: "this is invalid JSON" }
      ])
    })
  })
})
