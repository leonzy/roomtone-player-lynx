/// Executes the actual native task owner. Does not simulate UIKit or AVPlayer.
@main
struct VerifyPlaybackBackground {
  static func main() {
    var nextToken = 0
    var expirations: [() -> Void] = []
    var ended: [Int] = []
    let task = PlaybackBackgroundTask(
      begin: { expiration in
        nextToken += 1
        expirations.append(expiration)
        return nextToken
      }, end: { ended.append($0) }, log: { _ in })

    task.begin()
    task.begin()
    precondition(nextToken == 1, "one task across buffering, loading and retries")
    task.end()
    task.end()
    precondition(ended == [1], "cleanup is idempotent")
    task.begin()
    expirations[0]()
    precondition(ended == [1], "stale expiration cannot end a newer task")
    expirations[1]()
    precondition(ended == [1, 2], "expiration ends the active task")
    task.begin()
    task.end(reset: false)
    task.begin()
    precondition(nextToken == 2, "expired gaps cannot renew through retries or failure cleanup")
    task.end()
    task.begin()
    precondition(nextToken == 3, "real playback/foreground/pause resets the expired gap")
    task.end(reset: false)
    precondition(ended == [1, 2, 3], "failure releases acquired task")
    task.begin()
    precondition(nextToken == 4, "finite retry can acquire when the window did not expire")
    task.end()
    expirations[3]()
    precondition(ended == [1, 2, 3, 4], "expiration after teardown is inert")

    var denied = 0
    let unavailable = PlaybackBackgroundTask(
      begin: { _ in
        denied += 1
        return nil
      },
      end: { _ in preconditionFailure("invalid token ended") }, log: { _ in })
    unavailable.begin()
    unavailable.end()
    unavailable.begin()
    precondition(denied == 2, "denied acquisition does not invent a token")

    var immediateEnded: [Int] = []
    var immediateBegins = 0
    let immediate = PlaybackBackgroundTask(
      begin: { expiration in
        immediateBegins += 1
        expiration()
        return 7
      }, end: { immediateEnded.append($0) }, log: { _ in })
    immediate.begin()
    immediate.begin()
    precondition(
      immediateEnded == [7] && immediateBegins == 1,
      "synchronous expiration releases exactly once without renewal")
    print("PASS: native playback task acquisition, expiration, retry, stale callback and cleanup")
  }
}
