import SwiftUI
import UIKit
import WidgetKit

private let widgetGroup = "group.org.songloft.lynx"

struct NowPlayingEntry: TimelineEntry {
  let date: Date
  let title: String
  let artist: String
  let playing: Bool
  let hasSong: Bool
  let favorite: Bool
  let cover: UIImage?
}

struct NowPlayingProvider: TimelineProvider {
  func placeholder(in context: Context) -> NowPlayingEntry {
    NowPlayingEntry(
      date: Date(), title: "Songloft", artist: "", playing: false, hasSong: false, favorite: false,
      cover: nil)
  }
  func getSnapshot(in context: Context, completion: @escaping (NowPlayingEntry) -> Void) {
    completion(read())
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<NowPlayingEntry>) -> Void) {
    completion(Timeline(entries: [read()], policy: .never))
  }
  private func read() -> NowPlayingEntry {
    let data = UserDefaults(suiteName: widgetGroup)?.dictionary(forKey: "snapshot") ?? [:]
    let file = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: widgetGroup)?
      .appendingPathComponent("widget-cover.png")
    return NowPlayingEntry(
      date: Date(), title: data["title"] as? String ?? "Songloft",
      artist: data["artist"] as? String ?? "", playing: data["isPlaying"] as? Bool ?? false,
      hasSong: data["hasSong"] as? Bool ?? false, favorite: data["isFavorite"] as? Bool ?? false,
      cover: file.flatMap { UIImage(contentsOfFile: $0.path) })
  }
}

struct NowPlayingView: View {
  let entry: NowPlayingEntry
  @Environment(\.widgetFamily) private var family
  private func action(_ action: String) -> URL {
    URL(string: "songloft-lynx://player?action=\(action)")!
  }
  private var content: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 12) {
        Group {
          if let image = entry.cover, entry.hasSong {
            Image(uiImage: image).resizable().scaledToFill()
          } else {
            Image(systemName: "music.note").font(.title).frame(
              maxWidth: .infinity, maxHeight: .infinity)
          }
        }
        .frame(width: 52, height: 52).clipped().cornerRadius(10)
        if family != .systemSmall {
          VStack(alignment: .leading, spacing: 4) {
            Text(entry.hasSong ? entry.title : String(localized: "Choose a song"))
              .font(.headline).lineLimit(2)
            Text(entry.hasSong ? entry.artist : "Songloft").font(.caption).foregroundColor(
              .secondary
            ).lineLimit(1)
          }
        }
      }
      if family == .systemSmall {
        Text(entry.hasSong ? entry.title : "Songloft").font(.headline).lineLimit(2)
      } else {
        HStack {
          Link(destination: action("previous")) {
            Image(systemName: "backward.end.fill").frame(maxWidth: .infinity, minHeight: 32)
          }
          .accessibilityLabel(Text("Previous track"))
          Link(destination: action("toggle")) {
            Image(systemName: entry.playing ? "pause.fill" : "play.fill").frame(
              maxWidth: .infinity, minHeight: 32)
          }
          .accessibilityLabel(entry.playing ? Text("Pause") : Text("Play"))
          Link(destination: action("next")) {
            Image(systemName: "forward.end.fill").frame(maxWidth: .infinity, minHeight: 32)
          }
          .accessibilityLabel(Text("Next track"))
          Link(destination: action("favorite")) {
            Image(systemName: entry.favorite ? "heart.fill" : "heart").frame(
              maxWidth: .infinity, minHeight: 32)
          }
          .accessibilityLabel(Text("Toggle favorite"))
        }.foregroundColor(.primary)
      }
    }.padding(12).widgetURL(action("open"))
  }
  var body: some View {
    if #available(iOSApplicationExtension 17.0, *) {
      content.containerBackground(.background, for: .widget)
    } else {
      content.background(Color(UIColor.systemBackground))
    }
  }
}

@main
struct SongloftNowPlayingWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SongloftNowPlaying", provider: NowPlayingProvider()) {
      NowPlayingView(entry: $0)
    }
    .configurationDisplayName("Now Playing")
    .description("Current song and playback controls. Tap a control to open Songloft.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
