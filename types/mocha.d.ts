import ClientWrapper from "../src/clientWrapper"

declare namespace Mocha {
  class Context {
    client?: ClientWrapper
  }
}
