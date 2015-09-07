/* eslint-env mocha */

import {expect} from "chai";

import {isEventOrCommand, topicRegexp} from "../src/helpers";

describe("Helpers", function() {
  it("should identify event and command topics", function() {
    expect(isEventOrCommand("foo/bar/baz")).to.be.false;
    expect(isEventOrCommand("foo/bar/onbaz")).to.be.false;
    expect(isEventOrCommand("foo/bar/dobaz")).to.be.false;
    expect(isEventOrCommand("foo/bar/onBaz")).to.be.true;
    expect(isEventOrCommand("foo/bar/doBaz")).to.be.true;
  });

  it("should create simple topic regexp", function() {
    const re = topicRegexp("foo/bar/baz");

    expect(re.test("foo/bar/baz")).to.be.true;

    expect(re.test("foo/bar/bazinga")).to.be.false;
    expect(re.test("foo/bar/ba")).to.be.false;
    expect(re.test("foo/bar/.*")).to.be.false;
  });

  it("should create wildcard topic regexp with plus", function() {
    const re = topicRegexp("foo/+/baz");

    expect(re.test("foo/bar/baz")).to.be.true;
    expect(re.test("foo/lala/baz")).to.be.true;

    expect(re.test("foo/lala/bazinga")).to.be.false;
    expect(re.test("foo/lala/ba")).to.be.false;
  });

  it("should create wildcard topic regexp with trailing plus", function() {
    const re = topicRegexp("foo/bar/+");

    expect(re.test("foo/bar/baz")).to.be.true;
    expect(re.test("foo/bar/bazinga")).to.be.true;

    expect(re.test("foo/bar")).to.be.false;
    expect(re.test("foo/lala/baz")).to.be.false;
  });

  it("should create wildcard topic regexp with hash", function() {
    const re = topicRegexp("foo/bar/#");

    expect(re.test("foo/bar/baz")).to.be.true;
    expect(re.test("foo/bar/bazinga")).to.be.true;
    expect(re.test("foo/bar/ba")).to.be.true;
    expect(re.test("foo/bar")).to.be.true;

    expect(re.test("foo/barista")).to.be.false;
    expect(re.test("foo/lala")).to.be.false;
  });
});
