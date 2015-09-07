/* eslint-env mocha */

import async from "async";
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
    }, 100);
  });
};

describe("Topping", function() {
  function afterHandlerWasCalled(callback) {
    waitFor(function() {
      return handler.called;
    }, callback);
  }

  beforeEach(function() {
    this.testTopic = "test/topping-" + Date.now();
    this.handler = sinon.spy();
    this.waitForHandler = waitFor.bind(null, () => this.handler.called);

    return topping.connect(brokerUri).then((client) => {
      this.client = client;
      return this.client.publish(this.testTopic + "/foo", "bar");
    }).then(() => {
      return this.client.publish(this.testTopic + "/baz", 23);
    });
  });

  it("should retrieve retained message", function() {
    this.client.subscribe(this.testTopic + "/foo", this.handler);

    return this.waitForHandler().then(() => {
      expect(this.handler).to.have.been.calledWith("bar", this.testTopic + "/foo");
    });
  });
});
