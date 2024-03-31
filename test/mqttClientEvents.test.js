// works
const { connectAsync } = require("../lib/main")

const tcpBrokerUri = process.env.TCP_BROKER_URI || "tcp://127.0.0.1"

describe("MQTT Client Events", () => {
  let client

  beforeEach(async () => {
    client = await connectAsync(tcpBrokerUri)
  })

  test("should publish close event", async () => {
    const onEnd = jest.fn()
    client.on("end", onEnd)

    const onClose = jest.fn()
    client.on("close", onClose)

    await client.disconnect(true)

    expect(onEnd.mock.calls.length).toBe(1)

    await new Promise((resolve) => setTimeout(resolve, 1000))

    expect(onClose.mock.calls.length).toBe(1)
  })
})
