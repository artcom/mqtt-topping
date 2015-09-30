/* eslint-env mocha */

import chai, {expect} from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
import sinonChai from "sinon-chai";

import {waitFor} from "./testHelpers";
import topping from "../src/topping";

chai.use(chaiAsPromised);
chai.use(sinonChai);

const httpBrokerUri = process.env.HTTP_BROKER_URI || "http://localhost:8080";
const tcpBrokerUri = process.env.TCP_BROKER_URI || "tcp://localhost";

describe("HTTP Query API", function() {
  beforeEach(function() {
    this.client = topping.connect(tcpBrokerUri);
    this.query = topping.query(httpBrokerUri);
    this.testTopic = "test/topping-" + Date.now();

    return waitFor(() => this.client.isConnected).then(() => {
      return this.client.publish(this.testTopic + "/foo", "bar");
    }).then(() => {
      return this.client.publish(this.testTopic + "/baz", 23);
    }).then(() => {
      return this.client.publish(this.testTopic + "/more/one", 1);
    }).then(() => {
      return this.client.publish(this.testTopic + "/more/two", 2);
    });
  });

  it("should query single topics", function() {
    const query = this.query.topic(this.testTopic + "/foo");
    return expect(query).to.eventually.equal("bar");
  });

  it("should query subtopics with payload", function() {
    const query = this.query.subtopics(this.testTopic + "/more");
    return expect(query).to.eventually.deep.equal({ one: 1, two: 2 });
  });

  it("should query subtopics with payload only", function() {
    const query = this.query.subtopics(this.testTopic);
    return expect(query).to.eventually.deep.equal({ foo: "bar", baz: 23 });
  });

  it("should query subtopics with depth==2", function() {
    const query = this.query.subtopics(this.testTopic, { depth: 2 });
    return expect(query).to.eventually.deep.equal({
      "foo": "bar",
      "baz": 23,
      "more/one": 1,
      "more/two": 2
    });
  });

  it("should query subtopic names", function() {
    const query = this.query.subtopicNames(this.testTopic);
    return expect(query).to.eventually.have.members(["foo", "baz", "more"]);
  });
});
