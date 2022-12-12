import * as fcl from "@onflow/fcl"

describe("init", () => {
  beforeEach(async () => {})

  // Stop emulator, so it could be restarted
  afterEach(async () => {})

  test("init test", async () => {

    for (let index = 0; index < 100; index++) {
      const res = await fcl.query({
        cadence: `
          pub fun main(a: Int, b: Int, addr: Address): Int {
            log(addr)
            return a + b
          }
        `,
        args: (arg, t) => [
          arg("7", t.Int), // a: Int
          arg("6", t.Int), // b: Int
          arg("0xba1132bc08f82fe2", t.Address), // addr: Address
        ],
      })
      expect(res).toEqual("13")
    }
  })
})