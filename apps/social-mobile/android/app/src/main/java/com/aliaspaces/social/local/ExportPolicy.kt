package com.aliaspaces.social.local

internal object ExportPolicy {
    const val MAX_PAYLOAD_BYTES = 10 * 1024 * 1024
    const val MAX_MESSAGE_BYTES = MAX_PAYLOAD_BYTES * 6 + 1024
    fun acceptsPayload(byteCount: Int) = byteCount in 0..MAX_PAYLOAD_BYTES
    fun acceptsMessage(byteCount: Int) = byteCount in 0..MAX_MESSAGE_BYTES
}
