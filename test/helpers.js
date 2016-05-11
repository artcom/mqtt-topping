import chai, { expect } from "chai"

import { isEventOrCommand, matchTopic } from "../src/helpers"

chai.use(function({ Assertion }) {
  Assertion.addMethod("matchTopic", function(topic) {
    this.assert(
      matchTopic(this._obj)(topic), // eslint-disable-line no-underscore-dangle
      `expected #{this} to match ${topic}`,
      `expected #{this} not to match ${topic}`
    )
  })
})

describe("Helpers", function() {
  describe("isEventOrCommand", function() {
    it("should identify event and command topics", function() {
      expect(isEventOrCommand("foo/bar/baz")).to.be.false
      expect(isEventOrCommand("foo/bar/door")).to.be.false
      expect(isEventOrCommand("foo/bar/onwards")).to.be.false
      expect(isEventOrCommand("foo/bar/do")).to.be.false
      expect(isEventOrCommand("on")).to.be.false

      expect(isEventOrCommand("foo/bar/onBaz")).to.be.true
      expect(isEventOrCommand("foo/bar/doBaz")).to.be.true
    })
  })

  describe("matchTopic", function() {
    context("without wildcards", function() {
      it("should match one-level topic", function() {
        const subscription = "foo"
        expect(subscription).to.matchTopic("foo")

        expect(subscription).not.to.matchTopic("foo/bar")
        expect(subscription).not.to.matchTopic("foo/bar/baz")
        expect(subscription).not.to.matchTopic("foosball")
        expect(subscription).not.to.matchTopic("/foo")
      })

      it("should match multi-level topic", function() {
        const subscription = "foo/bar/baz"
        expect(subscription).to.matchTopic("foo/bar/baz")

        expect(subscription).not.to.matchTopic("foo/bar/bazinga")
        expect(subscription).not.to.matchTopic("foo/bar/ba")
        expect(subscription).not.to.matchTopic("foo/bar/.*")
      })

      it("should match topic with leading slash", function() {
        const subscription = "/foo"
        expect(subscription).to.matchTopic("/foo")

        expect(subscription).not.to.matchTopic("foo")
        expect(subscription).not.to.matchTopic("foo/bar")
        expect(subscription).not.to.matchTopic("/foo/bar")
        expect(subscription).not.to.matchTopic("/foosball")
      })
    })

    context("'plus' wildcards", function() {
      it("should match topic with 'plus' wildcard", function() {
        const subscription = "foo/+/baz"

        expect(subscription).to.matchTopic("foo/bar/baz")
        expect(subscription).to.matchTopic("foo/lala/baz")

        expect(subscription).not.to.matchTopic("foo/lala/bazinga")
        expect(subscription).not.to.matchTopic("foo/lala/ba")
        expect(subscription).not.to.matchTopic("something/else")
      })

      it("should match topic with trailing 'plus' wildcard", function() {
        const subscription = "foo/bar/+"

        expect(subscription).to.matchTopic("foo/bar/baz")
        expect(subscription).to.matchTopic("foo/bar/bazinga")

        expect(subscription).not.to.matchTopic("foo/bar")
        expect(subscription).not.to.matchTopic("foo/bar/ba/zin/ga")
        expect(subscription).not.to.matchTopic("foo/lala/baz")
      })

      it("should match topic with leading 'plus' wildcard", function() {
        const subscription = "+/foo/bar"

        expect(subscription).to.matchTopic("one/foo/bar")
        expect(subscription).to.matchTopic("two/foo/bar")

        expect(subscription).not.to.matchTopic("foo/bar")
        expect(subscription).not.to.matchTopic("one/foo/bar/baz")
      })

      it("should match topic with multiple 'plus' wildcards", function() {
        const subscription = "foo/+/+/bar"

        expect(subscription).to.matchTopic("foo/to/the/bar")
        expect(subscription).to.matchTopic("foo/is/a/bar")

        expect(subscription).not.to.matchTopic("foo/is/a/bar/not")
        expect(subscription).not.to.matchTopic("foo/to/bar")
        expect(subscription).not.to.matchTopic("/foo/to/the/bar")
      })
    })

    context("'hash' wildcards", function() {
      it("should match topic with 'hash' wildcard", function() {
        const subscription = "foo/bar/#"

        expect(subscription).to.matchTopic("foo/bar/baz")
        expect(subscription).to.matchTopic("foo/bar/bazinga")
        expect(subscription).to.matchTopic("foo/bar/ba")
        expect(subscription).to.matchTopic("foo/bar/ba/zin/ga")
        expect(subscription).to.matchTopic("foo/bar")

        expect(subscription).not.to.matchTopic("foo/barista")
        expect(subscription).not.to.matchTopic("foo/lala")
      })

      it("should match topic with 'hash' wildcard only", function() {
        const subscription = "#"

        expect(subscription).to.matchTopic("foo")
        expect(subscription).to.matchTopic("foo/bar")
        expect(subscription).to.matchTopic("")
      })

      it("should match topic with 'hash' and 'plus' wildcard", function() {
        const subscription = "foo/+/bar/#"

        expect(subscription).to.matchTopic("foo/and/bar")
        expect(subscription).to.matchTopic("foo/or/bar/baz")

        expect(subscription).not.to.matchTopic("foo/bar")
        expect(subscription).not.to.matchTopic("foo/bar/baz")
        expect(subscription).not.to.matchTopic("foo/to/barista")
      })
    })

    context("with regexp characters", function() {
      it("should not be confused by a dot in the subscription string", function() {
        const subscription = "foo2.0"
        expect(subscription).to.matchTopic("foo2.0")
        expect(subscription).not.to.matchTopic("foo200")
      })
    })
  })
})
