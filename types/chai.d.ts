declare namespace Chai {
  interface Assertion {
    matchTopic(topic: string): Assertion;
  }
}
