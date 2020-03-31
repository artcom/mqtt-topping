const topping = require("../lib/main")

const httpBrokerUri = process.env.HTTP_BROKER_URI || "http://localhost:8080"
const tcpBrokerUri = process.env.TCP_BROKER_URI || "tcp://localhost"


describe("Events", () => {
  let client

  beforeEach(async () => {
    client = await topping.connect(tcpBrokerUri, httpBrokerUri)
  })

  test("should publish close event", async () => {
    const onClose = jest.fn()
    client.on("close", onClose)

    await client.disconnect()

    expect(onClose.mock.calls.length).toBe(1)
  })
})
