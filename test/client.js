/* eslint-env mocha */

import chai, {expect} from "chai"
import chaiAsPromised from "chai-as-promised"
import sinon from "sinon"
import sinonChai from "sinon-chai"

import {waitFor} from "./testHelpers"
import topping from "../src/topping"

chai.use(chaiAsPromised)
chai.use(sinonChai)

const httpBrokerUri = process.env.HTTP_BROKER_URI || "http://localhost:8080"
const tcpBrokerUri = process.env.TCP_BROKER_URI || "tcp://localhost"
console.log(tcpBrokerUri)

describe("MQTT Client", function() {
  this.timeout(5000)

  beforeEach(function() {
    this.client = topping.connect(tcpBrokerUri, httpBrokerUri)
    this.testTopic = "test/topping-" + Date.now()

    return waitFor(() => this.client.isConnected).then(() => {
      return this.client.publish(this.testTopic + "/foo", "bar")
    }).then(() => {
      return this.client.publish(this.testTopic + "/baz", 23)
    })
  })

  afterEach(function() {
    return this.client.unpublishRecursively(this.testTopic)
  })

  it("should retrieve retained messages", function() {
    const fooHandler = sinon.spy()
    const bazHandler = sinon.spy()

    this.client.subscribe(this.testTopic + "/foo", fooHandler)
    this.client.subscribe(this.testTopic + "/baz", bazHandler)

    return waitFor(() => fooHandler.called && bazHandler.called).then(() => {
      expect(fooHandler).to.have.been.calledOnce.and.calledWith("bar", this.testTopic + "/foo")
      expect(bazHandler).to.have.been.calledOnce.and.calledWith(23, this.testTopic + "/baz")
    })
  })

  it("should retrieve non-retained messages", function() {
    const handler = sinon.spy()
    const eventTopic = this.testTopic + "/onEvent"

    return this.client.subscribe(eventTopic, handler).then(() => {
      return this.client.publish(eventTopic, "hello")
    }).then(() => {
      return waitFor(() => handler.called)
    }).then(() => {
      expect(handler).to.have.been.calledWith("hello", eventTopic)
    })
  })

  it("should retrieve retained messages using hash wildcard", function() {
    const handler = sinon.spy()
    this.client.subscribe(this.testTopic + "/#", handler)

    return waitFor(() => handler.calledTwice).then(() => {
      expect(handler).to.have.been
        .calledWith("bar", this.testTopic + "/foo")
        .calledWith(23, this.testTopic + "/baz")
    })
  })

  it("should retrieve retained messages using plus wildcard", function() {
    const handler = sinon.spy()
    this.client.subscribe(this.testTopic + "/+", handler)

    return waitFor(() => handler.calledTwice).then(() => {
      expect(handler).to.have.been
        .calledWith("bar", this.testTopic + "/foo")
        .calledWith(23, this.testTopic + "/baz")
    })
  })

  it("should ignore malformed JSON payloads", function() {
    const handler = sinon.spy()
    const eventTopic = this.testTopic + "/onEvent"

    const consoleLog = console.log
    console.log = sinon.spy()

    return this.client.subscribe(eventTopic, handler).then(() => {
      this.client.client.publish(eventTopic, "this is invalid JSON")
      this.client.client.publish(eventTopic, "42")
      return waitFor(() => handler.called)
    }).then(() => {
      expect(handler).to.have.been.calledOnce.and.calledWith(42, eventTopic)
      expect(console.log).to.have.been.calledWith(
        sinon.match(eventTopic).and(sinon.match("this is invalid JSON"))
      )

      console.log = consoleLog
    }).catch((error) => {
      console.log = consoleLog
      throw error
    })
  })

  it("should not receive messages after unsubscribing", function() {
    const handler = sinon.spy()
    const eventTopic = this.testTopic + "/onEvent"

    return this.client.subscribe(eventTopic, handler).then(() => {
      return this.client.publish(eventTopic, "hello")
    }).then(() => {
      return waitFor(() => handler.called)
    }).then(() => {
      return this.client.unsubscribe(eventTopic, handler)
    }).then(() => {
      return this.client.publish(eventTopic, "goodbye")
    }).then(() => {
      return this.client.subscribe(eventTopic, handler)
    }).then(() => {
      return this.client.publish(eventTopic, "hello again")
    }).then(() => {
      return waitFor(() => handler.calledTwice)
    }).then(() => {
      expect(handler).not.to.have.been.calledWith("goodbye")
      expect(handler).to.have.been.calledWith("hello again")
    })
  })

  it("should unpublish messages", function() {
    return this.client.unpublish(this.testTopic + "/foo").then(() => {
      const query = this.client.query({
        topic: this.testTopic,
        depth: 1
      }).then((result) => result.children)

      return expect(query).to.eventually.deep.equal([
        { topic: this.testTopic + "/baz", payload: 23 }
      ])
    })
  })

  it("should unpublish messages recursively", function() {
    const query = this.client.unpublishRecursively(this.testTopic).then(() =>
      this.client.query({ topic: this.testTopic })
    )

    return Promise.all([
      expect(query).to.be.rejected,
      query.catch((error) => expect(error).to.deep.equal({ topic: this.testTopic, error: 404 }))
    ])
  })

  it("should receive messages with empty payload", function() {
    const handler = sinon.spy()

    return this.client.subscribe(this.testTopic + "/foo", handler).then(() => {
      return this.client.unpublish(this.testTopic + "/foo")
    }).then(() => {
      return waitFor(() => handler.calledTwice)
    }).then(() => {
      expect(handler).to.have.been.calledWith("bar", this.testTopic + "/foo")
      expect(handler).to.have.been.calledWith(undefined, this.testTopic + "/foo")
    })
  })
})
