const { connect } = require("../lib/main")

const tcpBrokerUri = process.env.TCP_BROKER_URI || "tcp://localhost"

describe("MQTT Client Events", () => {
  let client

  beforeEach(async () => {
    client = await connect(tcpBrokerUri)
  })

  test("should publish close event", async () => {
    const onClose = jest.fn()
    client.on("close", onClose)

    await client.disconnect()

    expect(onClose.mock.calls.length).toBe(1)
  })
})
