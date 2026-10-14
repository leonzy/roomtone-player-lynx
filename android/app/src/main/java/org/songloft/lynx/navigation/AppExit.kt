package org.songloft.lynx.navigation

import android.app.Activity
import android.content.Intent
import android.os.Handler
import android.os.Looper
import org.songloft.lynx.audio.SongloftAudioEngine
import org.songloft.lynx.audio.SongloftPlaybackService
import org.songloft.lynx.lyric.FloatingLyricService
import org.songloft.lynx.platform.ClientFileLog

/** Explicit exit and the second root back press share the same native cleanup. */
object AppExit {
    fun exit(activity: Activity) {
        val main = Handler(Looper.getMainLooper())
        main.post {
            for (cleanup in listOf<() -> Unit>(
                { SongloftAudioEngine.stop() },
                { activity.stopService(Intent(activity, SongloftPlaybackService::class.java)) },
                { activity.stopService(Intent(activity, FloatingLyricService::class.java)) },
                { activity.finishAndRemoveTask() },
            )) {
                try {
                    cleanup()
                } catch (error: Exception) {
                    ClientFileLog.write('E', "app-exit", "cleanup failed: ${error.message}")
                }
            }
            // Let Activity/service destruction run before releasing the process,
            // including the retained Lynx runtime and any native download work.
            main.postDelayed({ android.os.Process.killProcess(android.os.Process.myPid()) }, 200)
        }
    }
}
