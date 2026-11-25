"""What fetch.py and stats.py both need to know about a replay log."""

FORMAT = "gen9nationaldex"
HIGH_RATING = 1500


def strip_chat(log):
    return "\n".join(line for line in log.split("\n") if not line.startswith(("|c|", "|c:|")))


def result_lines(lines):
    """Indexes of the |win| and |tie lines."""
    return [i for i, line in enumerate(lines) if line.startswith(("|win|", "|tie|")) or line == "|tie"]
