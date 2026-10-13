/// One finite execution window for a playback gap. Main-thread confined.
/// UIKit is injected so expiration/cleanup can be verified without an Apple SDK.
final class PlaybackBackgroundTask {
  private let beginTask: (@escaping () -> Void) -> Int?
  private let endTask: (Int) -> Void
  private let log: (String) -> Void
  private var token: Int?
  private var generation = 0
  private var expired = false

  init(
    begin: @escaping (@escaping () -> Void) -> Int?,
    end: @escaping (Int) -> Void, log: @escaping (String) -> Void
  ) {
    beginTask = begin
    endTask = end
    self.log = log
  }

  func begin() {
    guard token == nil, !expired else { return }
    generation += 1
    let expected = generation
    let acquired = beginTask { [weak self] in
      guard let self, self.generation == expected else { return }
      self.expired = true
      self.end(reset: false)
      self.log("background playback window expired")
    }
    // A synchronous expiration must not leave the newly returned token alive.
    guard generation == expected else {
      if let acquired { endTask(acquired) }
      return
    }
    token = acquired
    log(
      acquired == nil
        ? "background playback window unavailable" : "background playback window began")
  }

  func end(reset: Bool = true) {
    generation += 1
    let acquired = token
    token = nil
    if reset { expired = false }
    if let acquired {
      endTask(acquired)
      log("background playback window ended")
    }
  }
}
