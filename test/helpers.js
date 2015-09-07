/* eslint-env mocha */

import {expect} from "chai";

import {isEventOrCommand} from "../src/helpers";

describe("Helpers", function() {
  it("should identify event and command topics", function() {
    expect(isEventOrCommand("foo/bar/baz")).to.be.false;
    expect(isEventOrCommand("foo/bar/onbaz")).to.be.false;
    expect(isEventOrCommand("foo/bar/dobaz")).to.be.false;
    expect(isEventOrCommand("foo/bar/onBaz")).to.be.true;
    expect(isEventOrCommand("foo/bar/doBaz")).to.be.true;
  });
});
