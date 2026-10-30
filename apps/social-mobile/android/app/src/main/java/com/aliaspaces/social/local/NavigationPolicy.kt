package com.aliaspaces.social.local

import java.net.URI

/** Navigation is distinct from subresource loading and never uses suffix host trust. */
object NavigationPolicy {
    private const val assetHost = "appassets.androidplatform.net"
    private val productHosts = setOf("mypersonas.online", "www.mypersonas.online", "aliaspaces.com", "www.aliaspaces.com")
    private val authHosts = setOf("nwsqyuucwzihruszocge.supabase.co", "accounts.google.com", "accounts.youtube.com", "appleid.apple.com")

    private fun https(url: String): URI? = try {
        URI(url).takeIf {
            it.scheme == "https" && it.host != null && it.rawUserInfo == null &&
                (it.port == -1 || it.port == 443) && !url.contains('\\')
        }
    } catch (_: Exception) { null }

    fun isExternalHttps(url: String) = https(url) != null
    fun isProduct(url: String) = https(url)?.host?.lowercase() in productHosts
    fun isAsset(url: String) = https(url)?.let { it.host == assetHost && it.rawPath.startsWith("/assets/www/") } == true
    fun isLocalDocument(url: String) = https(url)?.let { it.host == assetHost && it.rawPath == "/assets/www/index.html" } == true
    fun isAkashaDocument(url: String) = https(url)?.let { it.host == assetHost && it.rawPath == "/assets/www/akasha.html" } == true

    fun isAllowed(url: String, mode: String): Boolean {
        val uri = https(url) ?: return false
        val host = uri.host.lowercase()
        if (host == assetHost) {
            return when (mode) {
                "local" -> uri.rawPath in setOf("/assets/www/index.html", "/assets/www/pantry.html", "/assets/www/akasha.html")
                "social" -> uri.rawPath in setOf("/assets/www/live.html", "/assets/www/error.html")
                "website" -> uri.rawPath == "/assets/www/error.html"
                else -> false
            }
        }
        return mode == "website" && (host in productHosts || host in authHosts)
    }

    fun fileTypes(url: String, mode: String): List<String> = when {
        mode == "local" && isAkashaDocument(url) -> listOf("application/json", "text/json", "text/plain", "application/zip", "application/x-zip-compressed")
        mode == "local" && isLocalDocument(url) -> listOf("application/json")
        mode == "website" && isProduct(url) -> listOf("image/*", "video/*")
        else -> emptyList()
    }
}
