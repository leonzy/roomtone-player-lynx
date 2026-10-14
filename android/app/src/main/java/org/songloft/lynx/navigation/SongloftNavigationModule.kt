package org.songloft.lynx.navigation

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.tasm.behavior.LynxContext

/**
 * Back-key plumbing. Exposed to JS as `NativeModules.SongloftNavigation`;
 * see `src/native/navigation.ts` and `docs/reference/back-navigation.md`.
 *
 * Every method is a fire-and-forget write with no `Callback`, matching
 * `SongloftStorageModule.setItem`: the host is the follower in this relationship
 * and has nothing to report back. The one thing that travels the other way — a
 * back press — is a global event sent from [org.songloft.lynx.MainActivity], which
 * is where the `LynxView` lives.
 */
class SongloftNavigationModule(context: Context) : LynxModule(context) {

    companion object {
        const val NAME = "SongloftNavigation"

        /** Global event carrying one back press. Must match `BACK_PRESSED_EVENT` in TS. */
        const val EVENT_BACK_PRESSED = "SongloftNavigation.backPressed"

        private val mainHandler = Handler(Looper.getMainLooper())
    }

    /** JS's answer to "is the next back press yours?". */
    @LynxMethod
    fun setBackConsumable(consumable: Boolean) {
        BackKeyState.setConsumable(consumable)
    }

    /** Resets the watchdog — JS is alive and finished with press [seq]. */
    @LynxMethod
    fun notifyBackHandled(seq: Int) {
        BackKeyState.ackHandled(seq)
    }

    /**
     * Leave the app.
     *
     * Stops playback and both services, then removes the task. Home/background
     * navigation still keeps playback; an explicit exit means the user is done.
     *
     * Posted to the main looper because `@LynxMethod` runs on the Lynx JS thread,
     * and touching the Activity from there throws — an exception this module's
     * caller would never see.
     */
    @LynxMethod
    fun exitApp() {
        mainHandler.post {
            val host = (mContext as? LynxContext)?.getContext()
            if (host is Activity) AppExit.exit(host)
        }
    }
}
