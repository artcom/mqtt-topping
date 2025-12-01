import * as helpers from "../src/http/helpers"
import { TopicResult, FlatTopicResult } from "../src/http/types"
import { HttpQueryError, HttpPayloadParseError } from "../src/errors"

describe("HTTP Module - Helper Functions", () => {
  it("makeJsonQuery should create a proper query object", () => {
    const result = helpers.makeJsonQuery("test/topic")
    expect(result).toEqual({
      topic: "test/topic",
      depth: -1,
      flatten: false,
      parseJson: false,
    })
  })

  it("makeJsonQuery should throw HttpQueryError for wildcards", () => {
    expect(() => helpers.makeJsonQuery("test/+/topic")).toThrow(HttpQueryError)
    expect(() => helpers.makeJsonQuery("test/+/topic")).toThrow(
      "Wildcards (+, #) are not supported in queryJson()",
    )
    expect(() => helpers.makeJsonQuery("test/#")).toThrow(HttpQueryError)
  })

  it("makeObject should convert TopicResult to object", () => {
    const input: TopicResult<string | null | { value: number }> = {
      topic: "parent",
      payload: null,
      children: [
        {
          topic: "parent/child1",
          payload: JSON.stringify({ value: 1 }),
          children: [
            {
              topic: "parent/child1/grandchild",
              payload: JSON.stringify(true),
            },
          ],
        },
        {
          topic: "parent/child2",
          payload: JSON.stringify("a string payload"),
        },
        {
          topic: "parent/child3",
          payload: null,
        },
      ],
    }

    // Need to cast or convert this TopicResult to the appropriate type
    const grandChild = input.children![0]
      .children![0] as unknown as TopicResult<boolean>
    grandChild.payload = true
    input.children![0].payload = { value: 1 }
    input.children![1].payload = "a string payload"

    const result = helpers.makeObject(input)

    expect(result).toEqual({
      child1: { grandchild: true },
      child2: "a string payload",
      child3: null,
    })

    const child1Result = helpers.makeObject(input.children![0])
    expect(child1Result).toEqual({
      grandchild: true,
    })
  })

  it("parsePayload should parse JSON string or buffer, throw HttpPayloadParseError on failure", () => {
    const goodJson: FlatTopicResult = {
      topic: "good/json",
      payload: '{"a": 1}',
    }
    helpers.parsePayload(goodJson)
    expect(goodJson.payload).toEqual({ a: 1 })

    const goodBuffer: FlatTopicResult = {
      topic: "good/buffer",
      payload: Buffer.from('{"b": 2}'),
    }
    helpers.parsePayload(goodBuffer)
    expect(goodBuffer.payload).toEqual({ b: 2 })

    const badJson: FlatTopicResult = {
      topic: "bad/json",
      payload: "{invalid json",
    }
    expect(() => helpers.parsePayload(badJson)).toThrow(HttpPayloadParseError)
    expect(() => helpers.parsePayload(badJson)).toThrow(
      /Failed to parse JSON payload/,
    )

    const alreadyObject: FlatTopicResult = { topic: "obj", payload: { c: 3 } }
    helpers.parsePayload(alreadyObject)
    expect(alreadyObject.payload).toEqual({ c: 3 }) // Should not change

    const emptyString: FlatTopicResult = { topic: "empty", payload: "" }
    helpers.parsePayload(emptyString)
    expect(emptyString.payload).toBeNull() // Empty string parsed as null

    const nullPayload: FlatTopicResult = { topic: "nullish", payload: null }
    helpers.parsePayload(nullPayload)
    expect(nullPayload.payload).toBeNull()
  })

  it("parsePayloads should handle arrays and recursion, throw on error", () => {
    const results: FlatTopicResult[] = [
      { topic: "item/1", payload: '{"a": 1}' },
      { topic: "item/2", payload: '{"b": 2}' },
    ]
    helpers.parsePayloads(results)
    expect(results[0].payload).toEqual({ a: 1 })
    expect(results[1].payload).toEqual({ b: 2 })

    const nestedResults: TopicResult = {
      topic: "parent",
      payload: "{}",
      children: [{ topic: "parent/child", payload: '{"c": 3}' }],
    }
    helpers.parsePayloads(nestedResults)
    expect(nestedResults.payload).toEqual({})
    expect(nestedResults.children![0].payload).toEqual({ c: 3 })

    const badResults: FlatTopicResult[] = [
      { topic: "item/good", payload: '{"a": 1}' },
      { topic: "item/bad", payload: "{invalid" },
    ]
    expect(() => helpers.parsePayloads(badResults)).toThrow(
      HttpPayloadParseError,
    )

    try {
      helpers.parsePayloads(badResults)
    } catch (e: unknown) {
      if (e instanceof HttpPayloadParseError) {
        expect(e.topic).toBe("item/bad")
      } else {
        throw new Error("Caught unexpected error type in parsePayloads test")
      }
    }
  })
})
