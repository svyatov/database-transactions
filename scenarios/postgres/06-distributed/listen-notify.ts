import { scenario, eq } from "../../../harness/scenario";

// #region listener
/**
 * Bun.sql has no async-notification API, so the listener is a psql subprocess —
 * the same client you'd use to eavesdrop on a channel in production.
 * ponytail: assumes the docker-compose stack from this repo (run from its root).
 */
class Listener {
  private proc = Bun.spawn(
    ["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "postgres", "-X", "-q", "-A", "-t"],
    { stdin: "pipe", stdout: "pipe" },
  );
  private out = "";

  static async start(channel: string): Promise<Listener> {
    const l = new Listener();
    l.drain();
    l.proc.stdin.write(`LISTEN ${channel};\nSELECT 'listening';\n`);
    const deadline = Date.now() + 15_000;
    while (!l.out.includes("listening")) {
      if (Date.now() > deadline) throw new Error("psql listener failed to start");
      await Bun.sleep(25);
    }
    return l;
  }

  private async drain() {
    for await (const chunk of this.proc.stdout) this.out += new TextDecoder().decode(chunk);
  }

  /** psql only checks for notifications around command execution — poke it, then look. */
  private poke() {
    this.proc.stdin.write("SELECT 1;\n");
  }

  /** Wait for the next notification psql prints. */
  async next(): Promise<{ channel: string; payload: string; pid: number }> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const m = this.out.match(
        /Asynchronous notification "(\w+)" with payload "([^"]*)" received from server process with PID (\d+)\./,
      );
      if (m) {
        this.out = this.out.slice(m.index! + m[0].length);
        return { channel: m[1]!, payload: m[2]!, pid: Number(m[3]) };
      }
      this.poke();
      await Bun.sleep(50);
    }
    throw new Error("no notification arrived within 10s");
  }

  /** Assert that nothing has been delivered — poke for a while and check. */
  async nothingYet(ms = 700): Promise<void> {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      this.poke();
      await Bun.sleep(50);
    }
    if (this.out.includes("Asynchronous notification")) {
      throw new Error(`expected silence, got: ${this.out}`);
    }
  }

  stop() {
    this.proc.kill();
  }
}
// #endregion listener

export default scenario({
  title: "NOTIFY is transactional",
  claim:
    "NOTIFY delivers nothing until COMMIT, a rolled-back NOTIFY is never delivered, and identical notifications within one transaction are folded into one.",
  setup: `
    CREATE TABLE orders (id int PRIMARY KEY, customer text NOT NULL);
  `,
  sessions: ["A"],

  async run({ A }, t) {
    // #region demo
    const listener = await Listener.start("orders");
    t.note("A psql process is attached and ran LISTEN orders; — a separate client, not one of our sessions.");

    const [me] = await A`SELECT pg_backend_pid() AS pid`;

    await A`BEGIN`;
    await A`INSERT INTO orders VALUES (1, 'alice')`;
    await A`NOTIFY orders, 'order 1 placed'`;
    await listener.nothingYet();
    t.note("The listener hears nothing — the notification is queued inside A's transaction.");

    await A`COMMIT`;
    const n = await listener.next();
    eq(n.channel, "orders");
    eq(n.payload, "order 1 placed");
    eq(n.pid, Number(me!.pid)); // sent by A's backend
    t.note(`The listener wakes up: Asynchronous notification "orders" with payload "order 1 placed" received from server process with PID pid(A).`);

    t.note("A rolled-back NOTIFY simply never happened:");
    await A`BEGIN`;
    await A`NOTIFY orders, 'order 2 placed'`;
    await A`ROLLBACK`;
    await listener.nothingYet();
    t.note("Silence — order 2's notification died with its transaction.");

    t.note("Identical notifications in one transaction are de-duplicated:");
    await A`BEGIN`;
    await A`NOTIFY orders, 'order 3 placed'`;
    await A`NOTIFY orders, 'order 3 placed'`;
    await A`COMMIT`;
    const once = await listener.next();
    eq(once.payload, "order 3 placed");
    await listener.nothingYet();
    t.note("Two NOTIFYs went in, one notification came out.");

    listener.stop();
    // #endregion demo
  },
});
