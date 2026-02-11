import {
  isEventOrCommand,
  matchTopic,
  validateTopic,
  processHandlersForTopic,
  parsePayload,
  createClientId,
} from "../../src/mqtt/helpers"
import { InvalidTopicError } from "../../src/errors" // Adjusted import path if moved
import type { SubscriptionHandler } from "../../src/mqtt/types" // Keep type import
import { Packet } from "mqtt"

describe("MQTT Helper Functions", () => {
  describe("validateTopic", () => {
    it("should accept valid topics", () => {
      expect(() => validateTopic("home/livingroom")).not.toThrow()
      expect(() => validateTopic("home/+/lights")).not.toThrow()
      expect(() => validateTopic("home/#")).not.toThrow()
      expect(() => validateTopic("/")).not.toThrow()
      expect(() => validateTopic("#")).not.toThrow()
      expect(() => validateTopic("+")).not.toThrow()
      expect(() => validateTopic("+/+/+")).not.toThrow()
    })

    it("should throw InvalidTopicError for empty topics", () => {
      expect(() => validateTopic("")).toThrow(InvalidTopicError)
      expect(() => validateTopic("")).toThrow(
        "topic must be a non-empty string",
      )
    })

    it("should throw InvalidTopicError for non-string topics", () => {
      expect(() => validateTopic(undefined as unknown as string)).toThrow(
        InvalidTopicError,
      )
      expect(() => validateTopic(null as unknown as string)).toThrow(
        InvalidTopicError,
      )
      expect(() => validateTopic(123 as unknown as string)).toThrow(
        InvalidTopicError,
      )
    })

    it("should throw InvalidTopicError for null characters", () => {
      expect(() => validateTopic("topic/with\u0000null")).toThrow(
        InvalidTopicError,
      )
      expect(() => validateTopic("topic/with\u0000null")).toThrow(
        /must not contain null characters/,
      )
    })

    it("should throw InvalidTopicError for invalid # wildcard usage", () => {
      expect(() => validateTopic("home/#/room")).toThrow(InvalidTopicError)
      expect(() => validateTopic("home/living#room")).toThrow(InvalidTopicError)
      expect(() => validateTopic("home/#/room")).toThrow(
        /wildcard '#' must occupy an entire level and be the last character/,
      )
    })

    it("should throw InvalidTopicError for invalid + wildcard usage", () => {
      expect(() => validateTopic("home/living+room")).toThrow(InvalidTopicError)
      expect(() => validateTopic("home/+room")).toThrow(InvalidTopicError)
      expect(() => validateTopic("home/living+")).toThrow(InvalidTopicError)
      expect(() => validateTopic("home/living+room")).toThrow(
        /wildcard '\+' must occupy an entire level/,
      )
    })

    it("should throw InvalidTopicError for empty levels", () => {
      expect(() => validateTopic("home//room")).toThrow(InvalidTopicError)
      expect(() => validateTopic("home//room")).toThrow(
        /must not contain empty levels/,
      )
      expect(() => validateTopic("//")).toThrow(InvalidTopicError)
      expect(() => validateTopic("a//b")).toThrow(InvalidTopicError)
      expect(() => validateTopic("/a/")).toThrow(InvalidTopicError)
      expect(() => validateTopic("a/b/")).toThrow(InvalidTopicError)
    })
  })

  describe("isEventOrCommand", () => {
    it("should return true for topics starting with 'on' followed by an uppercase letter", () => {
      expect(isEventOrCommand("devices/room1/onLight")).toBe(true)
      expect(isEventOrCommand("commands/onStartProcess")).toBe(true)
      expect(isEventOrCommand("onDirect")).toBe(true)
    })

    it("should return true for topics starting with 'do' followed by an uppercase letter", () => {
      expect(isEventOrCommand("devices/room1/doRestart")).toBe(true)
      expect(isEventOrCommand("commands/doUpdateFirmware")).toBe(true)
      expect(isEventOrCommand("doDirect")).toBe(true)
    })

    it("should return false for topics not starting with 'on' or 'do'", () => {
      expect(isEventOrCommand("devices/room1/lightStatus")).toBe(false)
      expect(isEventOrCommand("commands/startProcess")).toBe(false)
      expect(isEventOrCommand("events/statusUpdate")).toBe(false)
      expect(isEventOrCommand("ondoAction")).toBe(false)
    })

    it("should return false if 'on' or 'do' is not followed by an uppercase letter", () => {
      expect(isEventOrCommand("devices/room1/onlight")).toBe(false)
      expect(isEventOrCommand("commands/dostartProcess")).toBe(false)
      expect(isEventOrCommand("on_lower")).toBe(false)
      expect(isEventOrCommand("do_lower")).toBe(false)
      expect(isEventOrCommand("on1Number")).toBe(false)
    })

    it("should return false for topics with insufficient length after 'on' or 'do'", () => {
      expect(isEventOrCommand("devices/room1/on")).toBe(false)
      expect(isEventOrCommand("commands/do")).toBe(false)
      expect(isEventOrCommand("on")).toBe(false)
      expect(isEventOrCommand("do")).toBe(false)
    })

    it("should handle topics with multiple levels correctly", () => {
      expect(isEventOrCommand("home/livingroom/onLight")).toBe(true)
      expect(isEventOrCommand("home/livingroom/doRestart")).toBe(true)
      expect(isEventOrCommand("home/livingroom/on")).toBe(false)
      expect(isEventOrCommand("home/livingroom/do")).toBe(false)
    })

    it("should handle non-string input gracefully", () => {
      expect(isEventOrCommand(null as unknown as string)).toBe(false)
      expect(isEventOrCommand(undefined as unknown as string)).toBe(false)
      expect(isEventOrCommand(123 as unknown as string)).toBe(false)
    })
  })

  describe("matchTopic", () => {
    it("should return a function", () => {
      expect(typeof matchTopic("a/b")).toBe("function")
    })

    it("should handle invalid subscription input", () => {
      const invalidMatcher1 = matchTopic(null as unknown as string)
      const invalidMatcher2 = matchTopic("")
      const invalidMatcher3 = matchTopic(123 as unknown as string)
      expect(invalidMatcher1("any/topic")).toBe(false)
      expect(invalidMatcher2("any/topic")).toBe(false)
      expect(invalidMatcher3("any/topic")).toBe(false)
    })

    it("matcher should handle invalid topic input", () => {
      const matcher = matchTopic("valid/sub")
      expect(matcher(null as unknown as string)).toBe(false)
      expect(matcher(undefined as unknown as string)).toBe(false)
      expect(matcher("")).toBe(false)
      expect(matcher(123 as unknown as string)).toBe(false)
    })

    it("should match exact topics correctly", () => {
      const matcher = matchTopic("home/livingroom")
      expect(matcher("home/livingroom")).toBe(true)
      expect(matcher("home/kitchen")).toBe(false)
      expect(matcher("home/livingroom/lights")).toBe(false)
    })

    it("should match root topic exactly", () => {
      const matcher = matchTopic("/")
      expect(matcher("/")).toBe(true)
      expect(matcher("a")).toBe(false)
      expect(matcher("/a")).toBe(false)
    })

    it("should match '+' single-level wildcard", () => {
      const matcher1 = matchTopic("home/+/lights")
      expect(matcher1("home/livingroom/lights")).toBe(true)
      expect(matcher1("home/kitchen/lights")).toBe(true)
      expect(matcher1("home/bedroom/lights")).toBe(true)
      expect(matcher1("home/+/lights")).toBe(true)
      expect(matcher1("home/livingroom/switch")).toBe(false)
      expect(matcher1("home/livingroom/lights/ceiling")).toBe(false)
      expect(matcher1("home/lights")).toBe(false)
      expect(matcher1("office/kitchen/lights")).toBe(false)

      const matcher2 = matchTopic("+/+/+")
      expect(matcher2("a/b/c")).toBe(true)
      expect(matcher2("x/y/z")).toBe(true)
      expect(matcher2("+/b/c")).toBe(true)
      expect(matcher2("a/b")).toBe(false)
      expect(matcher2("a/b/c/d")).toBe(false)

      const matcher3 = matchTopic("+")
      expect(matcher3("a")).toBe(true)
      expect(matcher3("topic")).toBe(true)
      expect(matcher3("a/b")).toBe(false)
      expect(matcher3("")).toBe(false)

      const matcher4 = matchTopic("a/+")
      expect(matcher4("a/b")).toBe(true)
      expect(matcher4("a/c")).toBe(true)
      expect(matcher4("a/")).toBe(false)
      expect(matcher4("a")).toBe(false)
      expect(matcher4("a/b/c")).toBe(false)
    })

    it("should match '#' multi-level wildcard at the end", () => {
      const matcher1 = matchTopic("home/livingroom/#")
      expect(matcher1("home/livingroom")).toBe(true)
      expect(matcher1("home/livingroom/lights")).toBe(true)
      expect(matcher1("home/livingroom/lights/ceiling")).toBe(true)
      expect(matcher1("home/livingroom/lights/ceiling/rgb")).toBe(true)
      expect(matcher1("home/kitchen")).toBe(false)
      expect(matcher1("home")).toBe(false)
      expect(matcher1("/home/livingroom")).toBe(false)

      const matcher2 = matchTopic("#")
      expect(matcher2("a")).toBe(true)
      expect(matcher2("a/b")).toBe(true)
      expect(matcher2("/")).toBe(true)
      expect(matcher2("a/b/c/d/e")).toBe(true)
      expect(matcher2("")).toBe(false)

      const matcher3 = matchTopic("home/#")
      expect(matcher3("home")).toBe(true)
      expect(matcher3("home/kitchen")).toBe(true)
      expect(matcher3("home/kitchen/light")).toBe(true)
      expect(matcher3("office")).toBe(false)
      expect(matcher3("hometest")).toBe(false)
      expect(matcher3("/home")).toBe(false)
    })

    it("should handle combined wildcards", () => {
      const matcher1 = matchTopic("a/+/c/#")
      expect(matcher1("a/b/c")).toBe(true)
      expect(matcher1("a/xyz/c")).toBe(true)
      expect(matcher1("a/b/c/d")).toBe(true)
      expect(matcher1("a/b/c/d/e")).toBe(true)
      expect(matcher1("a/b/x")).toBe(false)
      expect(matcher1("a/b")).toBe(false)
      expect(matcher1("x/y/c/d")).toBe(false)

      const matcher2 = matchTopic("+/b/#")
      expect(matcher2("a/b")).toBe(true)
      expect(matcher2("x/b")).toBe(true)
      expect(matcher2("a/b/c")).toBe(true)
      expect(matcher2("x/b/c/d")).toBe(true)
      expect(matcher2("a/c")).toBe(false)
      expect(matcher2("a/b/c/d")).toBe(true)
    })
  })

  describe("parsePayload", () => {
    it("should parse valid JSON buffer", () => {
      const payload = Buffer.from(JSON.stringify({ test: "value" }))
      const result = parsePayload(payload)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value).toEqual({ test: "value" })
    })

    it("should return undefined for empty buffer", () => {
      const payload = Buffer.from("")
      const result = parsePayload(payload)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value).toBeUndefined()
    })

    it("should return undefined for null input", () => {
      const result = parsePayload(null as unknown as Buffer)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toBeNull()
    })

    it("should return undefined for undefined input", () => {
      const result = parsePayload(undefined as unknown as Buffer)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toBeNull()
    })

    it("should handle invalid JSON buffer and return error", () => {
      const payload = Buffer.from("invalid JSON")
      const result = parsePayload(payload)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toBeInstanceOf(SyntaxError)
    })

    it("should parse numbers and booleans correctly (after stringify)", () => {
      const payloadNum = Buffer.from(JSON.stringify(123))
      const resultNum = parsePayload(payloadNum)
      expect(resultNum.ok).toBe(true)
      if (resultNum.ok) expect(resultNum.value).toBe(123)

      const payloadBool = Buffer.from(JSON.stringify(true))
      const resultBool = parsePayload(payloadBool)
      expect(resultBool.ok).toBe(true)
      if (resultBool.ok) expect(resultBool.value).toBe(true)
    })
  })

  describe("processHandlersForTopic", () => {
    let callback: jest.Mock
    let subscription: { handlers: SubscriptionHandler[] }
    const topic = "test/topic"
    const packet = {} as Packet

    beforeEach(() => {
      callback = jest.fn()
      subscription = {
        handlers: [{ callback, qos: 1, parseType: "json" }],
      }
    })

    it("should process JSON handler correctly", () => {
      const payload = Buffer.from(JSON.stringify({ test: "value" }))
      const result = processHandlersForTopic(
        subscription,
        topic,
        payload,
        packet,
      )
      expect(result).toBeNull()
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith({ test: "value" }, topic, packet)
    })

    it("should return Error on JSON parse error and not call callback", () => {
      const payload = Buffer.from("invalid JSON")
      const result = processHandlersForTopic(
        subscription,
        topic,
        payload,
        packet,
      )
      expect(result).toBeInstanceOf(Error)
      expect(callback).not.toHaveBeenCalled()
    })

    it("should process string handler correctly", () => {
      subscription.handlers[0].parseType = "string"
      const payload = Buffer.from("hello world")
      const result = processHandlersForTopic(
        subscription,
        topic,
        payload,
        packet,
      )
      expect(result).toBeNull()
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith("hello world", topic, packet)
    })

    it("should process buffer handler correctly", () => {
      subscription.handlers[0].parseType = "buffer"
      const payload = Buffer.from([0x01, 0x02, 0x03])
      const result = processHandlersForTopic(
        subscription,
        topic,
        payload,
        packet,
      )
      expect(result).toBeNull()
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(payload, topic, packet)
    })

    it("should process custom handler correctly", () => {
      const customParser = jest
        .fn()
        .mockImplementation((buf: Buffer) => `parsed:${buf.toString()}`)
      subscription.handlers[0].parseType = "custom"
      subscription.handlers[0].customParser = customParser
      const payload = Buffer.from("custom data")

      const result = processHandlersForTopic(
        subscription,
        topic,
        payload,
        packet,
      )

      expect(result).toBeNull()
      expect(customParser).toHaveBeenCalledWith(payload)
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith("parsed:custom data", topic, packet)
    })

    it("should return Error on custom parser error and not call callback", () => {
      const error = new Error("Parser failed")
      const customParser = jest.fn().mockImplementation(() => {
        throw error
      })
      subscription.handlers[0].parseType = "custom"
      subscription.handlers[0].customParser = customParser
      const payload = Buffer.from("data")

      const result = processHandlersForTopic(
        subscription,
        topic,
        payload,
        packet,
      )

      expect(result).toBeInstanceOf(Error)
      expect(customParser).toHaveBeenCalledWith(payload)
      expect(callback).not.toHaveBeenCalled()
    })

    it("should pass buffer if custom parser is missing", () => {
      subscription.handlers[0].parseType = "custom"
      subscription.handlers[0].customParser = undefined
      const payload = Buffer.from("raw data")

      const result = processHandlersForTopic(
        subscription,
        topic,
        payload,
        packet,
      )

      expect(result).toBeNull()
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(payload, topic, packet)
    })

    it("should handle errors within the user callback gracefully", () => {
      const callbackError = new Error("Callback failed")

      callback.mockImplementation(() => {
        throw callbackError
      })
      const payload = Buffer.from(JSON.stringify({ test: "value" }))

      const result = processHandlersForTopic(
        subscription,
        topic,
        payload,
        packet,
      )

      // Callback errors are swallowed (consumer's responsibility)
      expect(result).toBeNull()
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it("should process multiple handlers correctly", () => {
      const callback2 = jest.fn()
      subscription.handlers.push({
        callback: callback2,
        qos: 0,
        parseType: "string",
      })
      const payload = Buffer.from(JSON.stringify({ test: "value" }))

      const result = processHandlersForTopic(
        subscription,
        topic,
        payload,
        packet,
      )

      expect(result).toBeNull()
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith({ test: "value" }, topic, packet)
      expect(callback2).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledWith('{"test":"value"}', topic, packet)
    })

    it("should return Error if any handler has parse error", () => {
      const callback2 = jest.fn()
      subscription.handlers.push({
        callback: callback2,
        qos: 0,
        parseType: "json", // Both are JSON now
      })
      const payload = Buffer.from("invalid JSON")

      const result = processHandlersForTopic(
        subscription,
        topic,
        payload,
        packet,
      )

      expect(result).toBeInstanceOf(Error)
      expect(callback).not.toHaveBeenCalled()
      expect(callback2).not.toHaveBeenCalled()
    })
  })

  describe("createClientId", () => {
    it("should generate a client ID with appId prefix", () => {
      const appId = "MyApp"
      const clientId = createClientId(appId)
      expect(clientId).toMatch(new RegExp(`^${appId}-[0-9a-f]{8}$`))
    })

    it("should use UnknownApp if appId is missing or empty", () => {
      const clientId1 = createClientId("")
      expect(clientId1).toMatch(/^UnknownApp-[0-9a-f]{8}$/)
      const clientId2 = createClientId()
      expect(clientId2).toMatch(/^UnknownApp-[0-9a-f]{8}$/)
      const clientId3 = createClientId(null as unknown as string)
      expect(clientId3).toMatch(/^UnknownApp-[0-9a-f]{8}$/)
    })

    it("should include deviceId if provided", () => {
      const appId = "AppX"
      const deviceId = "Device123"
      const clientId = createClientId(appId, deviceId)
      expect(clientId).toMatch(new RegExp(`^${appId}-${deviceId}-[0-9a-f]{8}$`))
    })

    it("should generate unique IDs on subsequent calls", () => {
      const id1 = createClientId("Test")
      const id2 = createClientId("Test")
      expect(id1).not.toEqual(id2)
    })
  })
})
