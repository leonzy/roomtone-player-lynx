package org.songloft.lynx.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import android.widget.RemoteViews
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.Future
import org.json.JSONObject
import org.songloft.lynx.MainActivity
import org.songloft.lynx.R
import org.songloft.lynx.net.InsecureTls

/** The widget owns no player: every action goes to the existing JS playback queue. */
class NowPlayingWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        render(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val action = intent.action?.removePrefix(ACTION_PREFIX) ?: return
        if (!intent.action.orEmpty().startsWith(ACTION_PREFIX) || action !in ACTIONS) return
        if (!actionDelivery.dispatch(action)) {
            context.startActivity(
                Intent(context, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    .putExtra(MainActivity.EXTRA_NAVIGATE_TO_PLAYER, true)
            )
        }
    }

    companion object {
        private const val ACTION_PREFIX = "org.songloft.lynx.WIDGET_"
        private val ACTIONS = setOf("toggle", "previous", "next", "favorite")
        private val main = Handler(Looper.getMainLooper())
        private val images = Executors.newSingleThreadExecutor()
        private var artworkTask: Future<*>? = null
        private var artworkUrl: String? = null
        private var artwork: Bitmap? = null
        private var generation = 0
        private var snapshot = JSONObject()
        private val actionDelivery = WidgetActionDelivery()

        fun attach(owner: Any, emitter: (String) -> Unit) = actionDelivery.attach(owner, emitter)

        fun consumeAction(): String = actionDelivery.consumeAction()

        fun detach(owner: Any?) = actionDelivery.detach(owner)

        fun update(context: Context, json: String) {
            val app = context.applicationContext
            val parsed = runCatching { JSONObject(json) }.getOrNull() ?: return
            main.post {
                val url = parsed.optString("coverUrl")
                parsed.remove(
                    "coverUrl"
                ) // Authenticated artwork URLs never go into widget preferences.
                snapshot = parsed
                app.getSharedPreferences("home_widget", Context.MODE_PRIVATE)
                    .edit()
                    .putString("snapshot", parsed.toString())
                    .apply()
                if (url != artworkUrl || !parsed.optBoolean("hasSong")) {
                    generation++
                    artworkTask?.cancel(true)
                    artworkUrl = url
                    artwork = null
                    File(app.filesDir, "widget-cover.png").delete()
                    if (url.isNotEmpty() && parsed.optBoolean("hasSong"))
                        fetchArtwork(app, url, generation)
                }
                render(app)
            }
        }

        private fun fetchArtwork(context: Context, url: String, expected: Int) {
            artworkTask = images.submit {
                val bitmap = runCatching {
                    val address = URL(url)
                    require(address.protocol == "https" || address.protocol == "http")
                    val connection = address.openConnection() as HttpURLConnection
                    try {
                        InsecureTls.configure(connection)
                        connection.connectTimeout = 8000
                        connection.readTimeout = 8000
                        connection.instanceFollowRedirects = false
                        require(connection.responseCode == 200)
                        val bytes = ByteArrayOutputStream()
                        connection.inputStream.use { input ->
                            val buffer = ByteArray(8192)
                            while (true) {
                                check(!Thread.currentThread().isInterrupted)
                                val read = input.read(buffer)
                                if (read < 0) break
                                require(bytes.size() + read <= 2 * 1024 * 1024)
                                bytes.write(buffer, 0, read)
                            }
                        }
                        val data = bytes.toByteArray()
                        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                        BitmapFactory.decodeByteArray(data, 0, data.size, bounds)
                        require(bounds.outWidth > 0 && bounds.outHeight > 0)
                        var sample = 1
                        while (
                            bounds.outWidth / sample > 256 || bounds.outHeight / sample > 256
                        ) sample *= 2
                        BitmapFactory.decodeByteArray(
                            data,
                            0,
                            data.size,
                            BitmapFactory.Options().apply { inSampleSize = sample },
                        )
                    } finally {
                        connection.disconnect()
                    }
                }
                    .getOrNull()
                main.post {
                    if (expected != generation || bitmap == null) return@post
                    artwork = bitmap
                    runCatching {
                        File(context.filesDir, "widget-cover.png").outputStream().use {
                            bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)
                        }
                    }
                    render(context)
                }
            }
        }

        fun render(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, NowPlayingWidget::class.java))
            if (ids.isEmpty()) return
            val saved =
                context
                    .getSharedPreferences("home_widget", Context.MODE_PRIVATE)
                    .getString("snapshot", null)
            val data = saved?.let { runCatching { JSONObject(it) }.getOrNull() } ?: snapshot
            val hasSong = data.optBoolean("hasSong")
            val playing = hasSong && data.optBoolean("isPlaying")
            val view = RemoteViews(context.packageName, R.layout.widget_now_playing)
            view.setTextViewText(
                R.id.widget_title,
                if (hasSong) data.optString("title") else context.getString(R.string.widget_empty),
            )
            view.setTextViewText(
                R.id.widget_artist,
                if (hasSong) data.optString("artist") else "Songloft",
            )
            val cover =
                if (hasSong)
                    artwork
                        ?: BitmapFactory.decodeFile(File(context.filesDir, "widget-cover.png").path)
                else null
            if (cover != null) view.setImageViewBitmap(R.id.widget_cover, cover)
            else view.setImageViewResource(R.id.widget_cover, R.mipmap.ic_launcher)
            view.setImageViewResource(
                R.id.widget_toggle,
                if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
            )
            view.setContentDescription(
                R.id.widget_toggle,
                context.getString(if (playing) R.string.widget_pause else R.string.widget_play),
            )
            view.setImageViewResource(
                R.id.widget_favorite,
                if (data.optBoolean("isFavorite")) R.drawable.ic_notification_favorite_filled
                else R.drawable.ic_notification_favorite_border,
            )
            val launch =
                PendingIntent.getActivity(
                    context,
                    9300,
                    Intent(context, MainActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                        .putExtra(MainActivity.EXTRA_NAVIGATE_TO_PLAYER, true),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
            view.setOnClickPendingIntent(R.id.widget_title, launch)
            view.setOnClickPendingIntent(R.id.widget_cover, launch)
            view.setOnClickPendingIntent(R.id.widget_artist, launch)
            val controls =
                listOf(
                    R.id.widget_previous to "previous",
                    R.id.widget_toggle to "toggle",
                    R.id.widget_next to "next",
                    R.id.widget_favorite to "favorite",
                )
            for ((id, action) in controls) {
                val intent =
                    Intent(context, NowPlayingWidget::class.java)
                        .setAction(ACTION_PREFIX + action)
                        .addFlags(Intent.FLAG_RECEIVER_FOREGROUND)
                view.setOnClickPendingIntent(
                    id,
                    if (hasSong)
                        PendingIntent.getBroadcast(
                            context,
                            id,
                            intent,
                            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                        )
                    else launch,
                )
                view.setFloat(id, "setAlpha", if (hasSong) 1f else 0.45f)
            }
            manager.updateAppWidget(ids, view)
        }
    }
}
