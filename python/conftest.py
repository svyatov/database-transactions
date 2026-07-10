import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

# The site's footer claims psycopg and PyMySQL agreed only when this file exists. `gen`
# deletes it before regenerating transcripts, so the marker can never outlive what it proved.
MARKER = Path(__file__).parent.parent / ".cross-driver-ok"


def pytest_sessionfinish(session, exitstatus):
    if exitstatus == 0:
        MARKER.touch()
    else:
        MARKER.unlink(missing_ok=True)
