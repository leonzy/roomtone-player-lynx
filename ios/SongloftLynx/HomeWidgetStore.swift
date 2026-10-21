import Foundation
import ImageIO
import UIKit
import WidgetKit

/// The extension receives only a snapshot and a local thumbnail, never server credentials.
enum HomeWidgetStore {
  static let group = "group.org.songloft.lynx"
  static let kind = "SongloftNowPlaying"
  static var actionEmitter: ((String) -> Void)?
  private static var pendingAction: String?
  private static var actionsReady = false
  // A new process must invalidate the previous session's thumbnail even when
  // the restored song has no cover URL.
  private static var coverURL: String?
  private static var generation = 0
  private static var task: URLSessionDataTask?

  static func consumeAction() -> String {
    actionsReady = true
    let result = pendingAction ?? ""
    pendingAction = nil
    return result
  }

  static func handle(_ url: URL) {
    guard url.scheme == "songloft-lynx", url.host == "player" else { return }
    let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    let action = components?.queryItems?.first(where: { $0.name == "action" })?.value ?? "open"
    guard ["open", "toggle", "previous", "next", "favorite"].contains(action) else { return }
    if actionsReady, let emit = actionEmitter { emit(action) } else { pendingAction = action }
  }

  static func detach() {
    actionsReady = false
    actionEmitter = nil
  }

  static func update(_ json: String) {
    guard let data = json.data(using: .utf8),
      var snapshot = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return }
    let url = snapshot.removeValue(forKey: "coverUrl") as? String ?? ""
    guard let defaults = UserDefaults(suiteName: group) else { return }
    defaults.set(snapshot, forKey: "snapshot")
    if url != coverURL || snapshot["hasSong"] as? Bool != true {
      generation += 1
      task?.cancel()
      coverURL = url
      if let location = coverFile { try? FileManager.default.removeItem(at: location) }
      if snapshot["hasSong"] as? Bool == true, let address = URL(string: url),
        ["http", "https"].contains(address.scheme ?? "")
      {
        let expected = generation
        var request = URLRequest(url: address)
        request.timeoutInterval = 10
        task = InsecureTls.shared.session.dataTask(with: request) { data, response, _ in
          guard let data, data.count <= 2 * 1024 * 1024,
            (response as? HTTPURLResponse)?.statusCode == 200,
            let source = CGImageSourceCreateWithData(data as CFData, nil),
            let image = CGImageSourceCreateThumbnailAtIndex(
              source, 0,
              [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceThumbnailMaxPixelSize: 256,
                kCGImageSourceCreateThumbnailWithTransform: true,
              ] as CFDictionary), let png = UIImage(cgImage: image).pngData()
          else { return }
          DispatchQueue.main.async {
            guard expected == generation, let location = coverFile else { return }
            try? png.write(to: location, options: .atomic)
            WidgetCenter.shared.reloadTimelines(ofKind: kind)
          }
        }
        task?.resume()
      }
    }
    WidgetCenter.shared.reloadTimelines(ofKind: kind)
  }

  private static var coverFile: URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?
      .appendingPathComponent("widget-cover.png")
  }
}
