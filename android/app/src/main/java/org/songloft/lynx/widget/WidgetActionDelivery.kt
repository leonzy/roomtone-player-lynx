package org.songloft.lynx.widget

/** Page readiness, independent of whether the audio module has loaded a song. */
internal class WidgetActionDelivery {
    private var owner: Any? = null
    private var emitter: ((String) -> Unit)? = null
    private var ready = false
    private var pending: String? = null

    @Synchronized
    fun attach(owner: Any, emitter: (String) -> Unit) {
        this.owner = owner
        this.emitter = emitter
        ready = false
    }

    @Synchronized
    fun detach(owner: Any?) {
        if (owner !== this.owner) return
        ready = false
        emitter = null
        this.owner = null
    }

    @Synchronized
    fun consumeAction(): String {
        ready = true
        return pending.orEmpty().also { pending = null }
    }

    fun dispatch(action: String): Boolean {
        val emit =
            synchronized(this) {
                val current = emitter
                if (!ready || current == null) {
                    pending = action
                    return false
                }
                current
            }
        emit(action)
        return true
    }
}
