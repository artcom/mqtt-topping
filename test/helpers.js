/* eslint-env mocha */

import {expect} from "chai"

import {isEventOrCommand, topicRegexp} from "../src/helpers"

describe("Helpers", function() {
  it("should identify event and command topics", function() {
    expect(isEventOrCommand("foo/bar/baz")).to.be.false
    expect(isEventOrCommand("foo/bar/door")).to.be.false
    expect(isEventOrCommand("foo/bar/onwards")).to.be.false
    expect(isEventOrCommand("foo/bar/do")).to.be.false
    expect(isEventOrCommand("on")).to.be.false

    expect(isEventOrCommand("foo/bar/onBaz")).to.be.true
    expect(isEventOrCommand("foo/bar/doBaz")).to.be.true
  })

  it("should create simple topic regexp", function() {
    const re = topicRegexp("foo/bar/baz")

    expect("foo/bar/baz").to.match(re)

    expect("foo/bar/bazinga").not.to.match(re)
    expect("foo/bar/ba").not.to.match(re)
    expect("foo/bar/.*").not.to.match(re)
  })

  it("should create wildcard topic regexp with plus", function() {
    const re = topicRegexp("foo/+/baz")

    expect("foo/bar/baz").to.match(re)
    expect("foo/lala/baz").to.match(re)

    expect("foo/lala/bazinga").not.to.match(re)
    expect("foo/lala/ba").not.to.match(re)
  })

  it("should create wildcard topic regexp with trailing plus", function() {
    const re = topicRegexp("foo/bar/+")

    expect("foo/bar/baz").to.match(re)
    expect("foo/bar/bazinga").to.match(re)

    expect("foo/bar").not.to.match(re)
    expect("foo/bar/ba/zin/ga").not.to.match(re)
    expect("foo/lala/baz").not.to.match(re)
  })

  it("should create wildcard topic regexp with hash", function() {
    const re = topicRegexp("foo/bar/#")

    expect("foo/bar/baz").to.match(re)
    expect("foo/bar/bazinga").to.match(re)
    expect("foo/bar/ba").to.match(re)
    expect("foo/bar/ba/zin/ga").to.match(re)
    expect("foo/bar").to.match(re)

    expect("foo/barista").not.to.match(re)
    expect("foo/lala").not.to.match(re)
  })

  it("should create wildcard topic regexp with hash only", function() {
    const re = topicRegexp("#")

    expect("foo").to.match(re)
    expect("foo/bar").to.match(re)
    expect("").to.match(re)
  })
})
