package org.songloft.lynx.widget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WidgetActionDeliveryTest {
    @Test
    fun warmActionNeedsOnlyAReadyPage() {
        val delivery = WidgetActionDelivery()
        val received = mutableListOf<String>()
        delivery.attach(Any()) { received.add(it) }
        assertEquals("", delivery.consumeAction())
        assertTrue(delivery.dispatch("toggle"))
        assertEquals(listOf("toggle"), received)
    }

    @Test
    fun coldActionWaitsForTheListenerAndIsConsumedOnce() {
        val delivery = WidgetActionDelivery()
        assertFalse(delivery.dispatch("next"))
        val received = mutableListOf<String>()
        delivery.attach(Any()) { received.add(it) }
        assertEquals(emptyList<String>(), received)
        assertEquals("next", delivery.consumeAction())
        assertEquals("", delivery.consumeAction())
        assertTrue(delivery.dispatch("previous"))
        assertEquals(listOf("previous"), received)
    }

    @Test
    fun detachedPageQueuesTheNextLaunchAction() {
        val delivery = WidgetActionDelivery()
        val owner = Any()
        val received = mutableListOf<String>()
        delivery.attach(owner) { received.add(it) }
        delivery.consumeAction()
        delivery.detach(owner)
        assertFalse(delivery.dispatch("toggle"))
        assertEquals(emptyList<String>(), received)
        delivery.attach(Any()) { received.add(it) }
        assertEquals("toggle", delivery.consumeAction())
    }

    @Test
    fun replacementPageMustInstallItsOwnListener() {
        val delivery = WidgetActionDelivery()
        val oldOwner = Any()
        val received = mutableListOf<String>()
        delivery.attach(oldOwner) { received.add("old:$it") }
        delivery.consumeAction()
        delivery.attach(Any()) { received.add("new:$it") }
        delivery.detach(oldOwner)
        assertFalse(delivery.dispatch("favorite"))
        assertEquals("favorite", delivery.consumeAction())
        assertTrue(delivery.dispatch("next"))
        assertEquals(listOf("new:next"), received)
    }
}
