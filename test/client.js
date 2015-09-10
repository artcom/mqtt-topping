/* eslint-env mocha */

import chai, {expect} from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";

import topping from "../src/topping";

chai.use(sinonChai);

const brokerUri = process.env.BROKER || "mqtt://localhost";

function waitFor(condition, timeout=2000) {
  return new Promise(function(resolve, reject) {
    const start = Date.now();
    const interval = setInterval(function() {
      const elapsed = Date.now() - start;

      if (elapsed > timeout) {
        clearInterval(interval);
        reject(new Error("Timeout"));
      } else if (condition()) {
        clearInterval(interval);
        resolve();
      }
    }, 20);
  });
};

describe("MQTT Client", function() {
  beforeEach(function() {
    this.client = topping.connect(brokerUri);
    this.testTopic = "test/topping-" + Date.now();

    return waitFor(() => this.client.isConnected).then(() => {
      return this.client.publish(this.testTopic + "/foo", "bar");
    }).then(() => {
      return this.client.publish(this.testTopic + "/baz", 23);
    });
  });

  it("should retrieve retained messages", function() {
    const fooHandler = sinon.spy();
    const bazHandler = sinon.spy();

    this.client.subscribe(this.testTopic + "/foo", fooHandler);
    this.client.subscribe(this.testTopic + "/baz", bazHandler);

    return waitFor(() => fooHandler.called && bazHandler.called).then(() => {
      expect(fooHandler).to.have.been.calledOnce.and.calledWith("bar", this.testTopic + "/foo");
      expect(bazHandler).to.have.been.calledOnce.and.calledWith(23, this.testTopic + "/baz");
    });
  });

  it("should retrieve non-retained messages", function() {
    const handler = sinon.spy();
    const eventTopic = this.testTopic + "/onEvent";

    return this.client.subscribe(eventTopic, handler).then(() => {
      return this.client.publish(eventTopic, "hello");
    }).then(() => {
      return waitFor(() => handler.called);
    }).then(() => {
      expect(handler).to.have.been.calledWith("hello", eventTopic);
    });
  });

  it("should retrieve retained messages using hash wildcard", function() {
    const handler = sinon.spy();
    this.client.subscribe(this.testTopic + "/#", handler);

    return waitFor(() => handler.calledTwice).then(() => {
      expect(handler).to.have.been
        .calledWith("bar", this.testTopic + "/foo")
        .calledWith(23, this.testTopic + "/baz");
    });
  });

  it("should retrieve retained messages using plus wildcard", function() {
    const handler = sinon.spy();
    this.client.subscribe(this.testTopic + "/+", handler);

    return waitFor(() => handler.calledTwice).then(() => {
      expect(handler).to.have.been
        .calledWith("bar", this.testTopic + "/foo")
        .calledWith(23, this.testTopic + "/baz");
    });
  });

  it("should ignore malformed JSON payloads", function() {
    const handler = sinon.spy();
    const eventTopic = this.testTopic + "/onEvent";

    return this.client.subscribe(eventTopic, handler).then(() => {
      this.client.client.publish(eventTopic, "{g:rbl!");
      this.client.client.publish(eventTopic, "42");
      return waitFor(() => handler.called);
    }).then(() => {
      expect(handler).to.have.been.calledOnce.and.calledWith(42, eventTopic);
    });
  });

  it("should not receive messages after unsubscribing", function() {
    const handler = sinon.spy();
    const eventTopic = this.testTopic + "/onEvent";

    return this.client.subscribe(eventTopic, handler).then(() => {
      return this.client.publish(eventTopic, "hello");
    }).then(() => {
      return waitFor(() => handler.called);
    }).then(() => {
      return this.client.unsubscribe(eventTopic, handler);
    }).then(() => {
      return this.client.publish(eventTopic, "goodbye");
    }).then(() => {
      return this.client.subscribe(eventTopic, handler);
    }).then(() => {
      return this.client.publish(eventTopic, "hello again");
    }).then(() => {
      return waitFor(() => handler.called);
    }).then(() => {
      expect(handler).not.to.have.been.calledWith("goodbye");
      expect(handler).to.have.been.calledWith("hello again");
    });
  });
});
