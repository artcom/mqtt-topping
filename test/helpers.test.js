const { isEventOrCommand, matchTopic } = require("../dist/helpers")

describe("Helpers", () => {
  describe("isEventOrCommand", () => {
    test("should identify event and command topics", () => {
      expect(isEventOrCommand("foo/bar/baz")).toBe(false)
      expect(isEventOrCommand("foo/bar/door")).toBe(false)
      expect(isEventOrCommand("foo/bar/onwards")).toBe(false)
      expect(isEventOrCommand("foo/bar/do")).toBe(false)
      expect(isEventOrCommand("on")).toBe(false)

      expect(isEventOrCommand("foo/bar/onBaz")).toBe(true)
      expect(isEventOrCommand("foo/bar/doBaz")).toBe(true)
    })
  })

  describe("matchTopic", () => {
    describe("without wildcards", () => {
      test("should match one-level topic", () => {
        const subscription = "foo"
        expect(matchTopic(subscription)("foo")).toBe(true)

        expect(matchTopic(subscription)("foo/bar")).toBe(false)
        expect(matchTopic(subscription)("foo/bar/baz")).toBe(false)
        expect(matchTopic(subscription)("foosball")).toBe(false)
        expect(matchTopic(subscription)("/foo")).toBe(false)
      })

      test("should match multi-level topic", () => {
        const subscription = "foo/bar/baz"
        expect(matchTopic(subscription)("foo/bar/baz")).toBe(true)

        expect(matchTopic(subscription)("foo/bar/bazinga")).toBe(false)
        expect(matchTopic(subscription)("foo/bar/ba")).toBe(false)
        expect(matchTopic(subscription)("foo/bar/.*")).toBe(false)
      })

      test("should match topic with leading slash", () => {
        const subscription = "/foo"
        expect(matchTopic(subscription)("/foo")).toBe(true)

        expect(matchTopic(subscription)("foo")).toBe(false)
        expect(matchTopic(subscription)("foo/bar")).toBe(false)
        expect(matchTopic(subscription)("/foo/bar")).toBe(false)
        expect(matchTopic(subscription)("/foosball")).toBe(false)
      })
    })

    describe("'plus' wildcards", () => {
      test("should match topic with 'plus' wildcard", () => {
        const subscription = "foo/+/baz"

        expect(matchTopic(subscription)("foo/bar/baz")).toBe(true)
        expect(matchTopic(subscription)("foo/lala/baz")).toBe(true)

        expect(matchTopic(subscription)("foo/lala/bazinga")).toBe(false)
        expect(matchTopic(subscription)("foo/lala/ba")).toBe(false)
        expect(matchTopic(subscription)("something/else")).toBe(false)
      })

      test("should match topic with trailing 'plus' wildcard", () => {
        const subscription = "foo/bar/+"

        expect(matchTopic(subscription)("foo/bar/baz")).toBe(true)
        expect(matchTopic(subscription)("foo/bar/bazinga")).toBe(true)

        expect(matchTopic(subscription)("foo/bar")).toBe(false)
        expect(matchTopic(subscription)("foo/bar/ba/zin/ga")).toBe(false)
        expect(matchTopic(subscription)("foo/lala/baz")).toBe(false)
      })

      test("should match topic with leading 'plus' wildcard", () => {
        const subscription = "+/foo/bar"

        expect(matchTopic(subscription)("one/foo/bar")).toBe(true)
        expect(matchTopic(subscription)("two/foo/bar")).toBe(true)

        expect(matchTopic(subscription)("foo/bar")).toBe(false)
        expect(matchTopic(subscription)("one/foo/bar/baz")).toBe(false)
      })

      test("should match topic with multiple 'plus' wildcards", () => {
        const subscription = "foo/+/+/bar"

        expect(matchTopic(subscription)("foo/to/the/bar")).toBe(true)
        expect(matchTopic(subscription)("foo/is/a/bar")).toBe(true)

        expect(matchTopic(subscription)("foo/is/a/bar/not")).toBe(false)
        expect(matchTopic(subscription)("foo/to/bar")).toBe(false)
        expect(matchTopic(subscription)("/foo/to/the/bar")).toBe(false)
      })
    })

    describe("'hash' wildcards", () => {
      test("should match topic with 'hash' wildcard", () => {
        const subscription = "foo/bar/#"

        expect(matchTopic(subscription)("foo/bar/baz")).toBe(true)
        expect(matchTopic(subscription)("foo/bar/bazinga")).toBe(true)
        expect(matchTopic(subscription)("foo/bar/ba")).toBe(true)
        expect(matchTopic(subscription)("foo/bar/ba/zin/ga")).toBe(true)
        expect(matchTopic(subscription)("foo/bar")).toBe(true)

        expect(matchTopic(subscription)("foo/barista")).toBe(false)
        expect(matchTopic(subscription)("foo/lala")).toBe(false)
      })

      test("should match topic with 'hash' wildcard only", () => {
        const subscription = "#"

        expect(matchTopic(subscription)("foo")).toBe(true)
        expect(matchTopic(subscription)("foo/bar")).toBe(true)
        expect(matchTopic(subscription)("")).toBe(true)
      })

      test("should match topic with 'hash' and 'plus' wildcard", () => {
        const subscription = "foo/+/bar/#"

        expect(matchTopic(subscription)("foo/and/bar")).toBe(true)
        expect(matchTopic(subscription)("foo/or/bar/baz")).toBe(true)

        expect(matchTopic(subscription)("foo/bar")).toBe(false)
        expect(matchTopic(subscription)("foo/bar/baz")).toBe(false)
        expect(matchTopic(subscription)("foo/to/barista")).toBe(false)
      })
    })

    describe("with regexp characters", () => {
      test("should not be confused by a dot in the subscription string", () => {
        const subscription = "foo2.0"
        expect(matchTopic(subscription)("foo2.0")).toBe(true)
        expect(matchTopic(subscription)("foo200")).toBe(false)
      })
    })
  })
})
