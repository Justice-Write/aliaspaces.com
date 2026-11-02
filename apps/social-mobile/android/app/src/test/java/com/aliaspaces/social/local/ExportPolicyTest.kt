package com.aliaspaces.social.local

import org.junit.Assert.*
import org.junit.Test

class ExportPolicyTest {
    @Test fun nativePayloadCapIsNotRaisedForRecovery() {
        assertEquals(10485760, ExportPolicy.MAX_PAYLOAD_BYTES)
        assertTrue(ExportPolicy.acceptsPayload(ExportPolicy.MAX_PAYLOAD_BYTES))
        assertFalse(ExportPolicy.acceptsPayload(ExportPolicy.MAX_PAYLOAD_BYTES + 1))
        assertFalse(ExportPolicy.acceptsPayload(-1))
    }
    @Test fun expandedEnvelopeIsRejectedButCompactRecoveryFits() {
        assertFalse(ExportPolicy.acceptsPayload(12583033))
        assertTrue(ExportPolicy.acceptsMessage(14680249))
        assertTrue(ExportPolicy.acceptsPayload(5592600))
    }
    @Test fun messageCapRemainsBounded() {
        assertTrue(ExportPolicy.acceptsMessage(ExportPolicy.MAX_MESSAGE_BYTES))
        assertFalse(ExportPolicy.acceptsMessage(ExportPolicy.MAX_MESSAGE_BYTES + 1))
        assertFalse(ExportPolicy.acceptsMessage(-1))
    }
}
