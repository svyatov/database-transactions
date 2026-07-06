from harness import Scenario, eq


def run(s, t):
    A, B, M = s["A"], s["B"], s["M"]
    # region demo
    A("BEGIN")
    A("UPDATE accounts SET balance = 200 WHERE id = 1")

    t.note("One innocent UPDATE = four locks: table, index, its own xid, its own virtual xid.")
    held = M("""
        SELECT l.locktype, l.relation::regclass AS relation, l.mode, l.granted
        FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
        WHERE a.application_name = 'A'
        ORDER BY l.locktype, l.relation::regclass::text, l.mode""")
    eq(
        held,
        [
            {"locktype": "relation", "relation": "accounts", "mode": "RowExclusiveLock", "granted": True},
            {"locktype": "relation", "relation": "accounts_pkey", "mode": "RowExclusiveLock", "granted": True},
            {"locktype": "transactionid", "relation": None, "mode": "ExclusiveLock", "granted": True},
            {"locktype": "virtualxid", "relation": None, "mode": "ExclusiveLock", "granted": True},
        ],
    )
    # endregion demo

    # region waiter
    pending = B.blocked("UPDATE accounts SET balance = 300 WHERE id = 1")

    t.note("The waiter's tell: a lock row with granted = f — it wants A's transaction id.")
    waiting = M("""
        SELECT l.locktype, l.mode, l.granted
        FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
        WHERE a.application_name = 'B' AND NOT l.granted""")
    eq(waiting, [{"locktype": "transactionid", "mode": "ShareLock", "granted": False}])

    t.note("You rarely need to decode pg_locks by hand — pg_blocking_pids() names the culprit.")
    chain = M("""
        SELECT waiter.application_name AS waiter, blocker.application_name AS blocker
        FROM pg_stat_activity waiter
        JOIN pg_stat_activity blocker ON blocker.pid = ANY (pg_blocking_pids(waiter.pid))
        WHERE waiter.wait_event_type = 'Lock'
        ORDER BY waiter.application_name, blocker.application_name""")
    eq(chain, [{"waiter": "B", "blocker": "A"}])

    A("COMMIT")
    pending.success()
    # endregion waiter


scenario = Scenario(
    title="Reading pg_locks: what one UPDATE really holds",
    claim="pg_locks shows every lock a transaction holds — a single-row UPDATE takes four — and a waiter shows up as granted = false, findable via pg_blocking_pids().",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B", "M"),
    run=run,
)
