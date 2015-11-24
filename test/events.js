/* eslint-env mocha */

import chai, {expect} from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"

import {waitFor} from "./testHelpers"
import topping from "../src/topping"

chai.use(sinonChai)

const httpBrokerUri = process.env.HTTP_BROKER_URI || "http://localhost:8080"
const tcpBrokerUri = process.env.TCP_BROKER_URI || "tcp://localhost"

describe("Events", function() {
  beforeEach(function() {
    this.client = topping.connect(tcpBrokerUri, httpBrokerUri)
  })

  it("should publish connect event", function() {
    const connect = sinon.spy()

    this.client.on("connect", connect)

    return waitFor(() => this.client.isConnected).then(() => {
      expect(connect).to.have.been.called
    })
  })

  it("should publish close event", function() {
    const close = sinon.spy()

    this.client.on("close", close)

    return waitFor(() => this.client.isConnected).then(() => {
      this.client.client.end()
      return waitFor(() => !this.client.isConnected)
    }).then(() => {
      expect(close).to.have.been.called
    })
  })
})
