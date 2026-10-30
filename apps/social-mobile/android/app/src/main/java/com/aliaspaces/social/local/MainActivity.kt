package com.aliaspaces.social.local

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.view.View
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import androidx.webkit.WebViewAssetLoader
import java.nio.charset.StandardCharsets

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var modeLabel: TextView
    private lateinit var offlineBanner: TextView
    private lateinit var liveButton: Button
    private lateinit var socialButton: Button
    private lateinit var localButton: Button
    private var appMode = MODE_WEBSITE
    private var pendingExport: String? = null
    private var bridgeInstalled = false
    private var documentEpoch = 0
    private var pendingDocumentEpoch = -1
    private var pendingFileUrl: String? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private lateinit var liveShellJs: String
    private lateinit var assetLoader: WebViewAssetLoader
    private var connectivityCallback: ConnectivityManager.NetworkCallback? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        com.portfolio.guide.AppGuide.install(this)
        setContentView(R.layout.activity_main)
        com.portfolio.guide.WindowSafety.apply(this)
        webView = findViewById(R.id.webView)
        modeLabel = findViewById(R.id.modeLabel)
        offlineBanner = findViewById(R.id.offlineBanner)
        liveButton = findViewById(R.id.liveButton)
        socialButton = findViewById(R.id.socialButton)
        localButton = findViewById(R.id.localButton)
        liveShellJs = assets.open("www/src/live/social-shell.js").bufferedReader().use { it.readText() } +
            "\nwindow.AliaSpacesLiveShell.watch();"

        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        val cookies = CookieManager.getInstance()
        cookies.setAcceptCookie(true)
        cookies.setAcceptThirdPartyCookies(webView, true)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = true
        webView.settings.javaScriptCanOpenWindowsAutomatically = false
        webView.settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
        webView.settings.userAgentString = webView.settings.userAgentString.replace("; wv", "")
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                return if (NavigationPolicy.isAsset(request.url.toString())) assetLoader.shouldInterceptRequest(request.url) else null
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url.toString()
                if (!request.isForMainFrame) return false
                if (NavigationPolicy.isAllowed(url, appMode)) return false
                if (appMode != MODE_LOCAL) openChrome(url)
                return true
            }

            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                documentEpoch += 1
                cancelPendingDocuments()
            }

            override fun onPageFinished(view: WebView, url: String) {
                if (appMode == MODE_WEBSITE && isProductUrl(url)) {
                    view.evaluateJavascript(liveShellJs, null)
                }
                if (appMode == MODE_WEBSITE && isProductUrl(url)) {
                    prefs().edit().putString(PREF_WEBSITE_URL, url).apply()
                }
                updateOfflineBanner()
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                if (!request.isForMainFrame) return
                if (appMode == MODE_LOCAL) return
                view.loadUrl(ERROR_URL)
                Toast.makeText(this@MainActivity, getString(R.string.load_error_hint), Toast.LENGTH_LONG).show()
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?
            ): Boolean {
                cancelPendingDocuments()
                val activeUrl = view?.url ?: ""
                val mimeTypes = NavigationPolicy.fileTypes(activeUrl, appMode)
                if (mimeTypes.isEmpty()) {
                    callback?.onReceiveValue(null)
                    return true
                }
                fileCallback = callback
                pendingFileUrl = activeUrl
                pendingDocumentEpoch = documentEpoch
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = if (mimeTypes.size == 1) mimeTypes.first() else "*/*"
                    putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toTypedArray())
                }
                try { startActivityForResult(intent, REQUEST_FILE) }
                catch (_: android.content.ActivityNotFoundException) { cancelPendingDocuments() }
                return true
            }
        }

        liveButton.setOnClickListener { showMode(MODE_WEBSITE) }
        socialButton.setOnClickListener { showMode(MODE_SOCIAL) }
        localButton.setOnClickListener { showMode(MODE_LOCAL) }
        findViewById<Button>(R.id.browserButton).setOnClickListener {
            openChrome(if (appMode == MODE_WEBSITE) webView.url ?: LIVE_URL else LIVE_URL)
            Toast.makeText(this, getString(R.string.google_login_hint), Toast.LENGTH_LONG).show()
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        if (savedInstanceState != null) {
            appMode = savedInstanceState.getString(STATE_MODE, MODE_WEBSITE) ?: MODE_WEBSITE
            showMode(appMode, restoreWebsite = true)
        } else if (!openIntent(intent)) {
            showMode(prefs().getString(PREF_MODE, MODE_WEBSITE) ?: MODE_WEBSITE, restoreWebsite = true)
        }
        registerConnectivity()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        openIntent(intent)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString(STATE_MODE, appMode)
        webView.saveState(outState)
    }

    override fun onPause() {
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onDestroy() {
        connectivityCallback?.let { callback ->
            connectivityManager()?.unregisterNetworkCallback(callback)
        }
        super.onDestroy()
    }

    private fun showMode(mode: String, url: String? = null, restoreWebsite: Boolean = false) {
        cancelPendingDocuments()
        if (bridgeInstalled) {
            WebViewCompat.removeWebMessageListener(webView, "AliaSpacesAndroid")
            bridgeInstalled = false
        }
        appMode = if (mode in setOf(MODE_LOCAL, MODE_SOCIAL, MODE_WEBSITE)) mode else MODE_WEBSITE
        if (appMode == MODE_LOCAL) installLocalBridge()
        prefs().edit().putString(PREF_MODE, mode).apply()
        renderMode()
        val target = when (mode) {
            MODE_SOCIAL -> SOCIAL_URL
            MODE_LOCAL -> LOCAL_URL
            else -> url
                ?: if (restoreWebsite) prefs().getString(PREF_WEBSITE_URL, LIVE_URL) else LIVE_URL
        }
        val safeTarget = target?.takeIf { NavigationPolicy.isAllowed(it, appMode) }
        webView.loadUrl(safeTarget ?: if (appMode == MODE_LOCAL) LOCAL_URL else if (appMode == MODE_SOCIAL) SOCIAL_URL else LIVE_URL)
        updateOfflineBanner()
    }

    private fun renderMode() {
        modeLabel.setText(
            when (appMode) {
                MODE_SOCIAL -> R.string.social_mode_hint
                MODE_LOCAL -> R.string.local_mode_hint
                else -> R.string.website_mode_hint
            }
        )
        liveButton.isEnabled = appMode != MODE_WEBSITE
        socialButton.isEnabled = appMode != MODE_SOCIAL
        localButton.isEnabled = appMode != MODE_LOCAL
    }

    private fun openIntent(intent: Intent?): Boolean {
        val uri = intent?.data ?: return false
        when {
            uri.scheme == "aliaspaces" && uri.host == MODE_SOCIAL -> showMode(MODE_SOCIAL)
            uri.scheme == "aliaspaces" && uri.host == MODE_LOCAL -> showMode(MODE_LOCAL)
            uri.scheme == "aliaspaces" -> showMode(MODE_WEBSITE)
            isProductUrl(uri.toString()) -> showMode(MODE_WEBSITE, uri.toString())
            else -> return false
        }
        return true
    }

    private fun openChrome(url: String) {
        if (!NavigationPolicy.isExternalHttps(url)) return
        try { CustomTabsIntent.Builder().build().launchUrl(this, Uri.parse(url)) }
        catch (_: android.content.ActivityNotFoundException) { Toast.makeText(this, "No browser available", Toast.LENGTH_SHORT).show() }
    }

    private fun prefs() = getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun connectivityManager() =
        getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager

    private fun isOnline(): Boolean {
        val manager = connectivityManager() ?: return true
        val network = manager.activeNetwork ?: return false
        val capabilities = manager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun updateOfflineBanner() {
        offlineBanner.visibility = if (appMode != MODE_LOCAL && !isOnline()) View.VISIBLE else View.GONE
    }

    private fun registerConnectivity() {
        val manager = connectivityManager() ?: return
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                runOnUiThread { updateOfflineBanner() }
            }

            override fun onLost(network: Network) {
                runOnUiThread { updateOfflineBanner() }
            }
        }
        connectivityCallback = callback
        manager.registerDefaultNetworkCallback(callback)
        updateOfflineBanner()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_FILE) {
            val currentDocument = pendingDocumentEpoch == documentEpoch && pendingFileUrl == webView.url
            val allowed = NavigationPolicy.fileTypes(webView.url ?: "", appMode)
            val mime = data?.data?.let { contentResolver.getType(it) }
            val validMime = mime != null && allowed.any { it == mime || (it.endsWith("/*") && mime.startsWith(it.removeSuffix("*"))) }
            val uris = if (currentDocument && validMime && resultCode == Activity.RESULT_OK && data?.data != null) arrayOf(data.data!!) else null
            fileCallback?.onReceiveValue(uris)
            fileCallback = null
            return
        }
        if (pendingDocumentEpoch != documentEpoch || pendingFileUrl != webView.url || !isLocalExportDocument()) { pendingExport = null; return }
        if (resultCode != Activity.RESULT_OK || data?.data == null) { pendingExport = null; return }
        val uri = data.data ?: return
        if (requestCode == REQUEST_EXPORT) writeExport(uri)
        if (requestCode == REQUEST_IMPORT && isLocalDocument()) readImport(uri)
    }

    private fun writeExport(uri: Uri) {
        val payload = pendingExport ?: return
        try {
            val stream = contentResolver.openOutputStream(uri) ?: throw java.io.IOException("No output stream")
            stream.use { it.write(payload.toByteArray(StandardCharsets.UTF_8)) }
            Toast.makeText(this, "Local JSON backup saved. Keep it private; it is not an online backup.", Toast.LENGTH_LONG).show()
        } catch (_: Exception) {
            Toast.makeText(this, "Backup could not be saved. Your device records are unchanged.", Toast.LENGTH_LONG).show()
        } finally {
            pendingExport = null
        }
    }

    private fun readImport(uri: Uri) {
        val text = contentResolver.openInputStream(uri)?.use { stream ->
            val buffer = java.io.ByteArrayOutputStream()
            val chunk = ByteArray(8192)
            while (buffer.size() <= MAX_JSON_BYTES) {
                val count = stream.read(chunk, 0, minOf(chunk.size, MAX_JSON_BYTES + 1 - buffer.size()))
                if (count < 0) break
                buffer.write(chunk, 0, count)
            }
            val bytes = buffer.toByteArray()
            if (bytes.size > MAX_JSON_BYTES) { Toast.makeText(this, "Import is too large", Toast.LENGTH_LONG).show(); return }
            String(bytes, StandardCharsets.UTF_8)
        } ?: return
        val escaped = org.json.JSONObject.quote(text)
        webView.evaluateJavascript("window.AliaSpacesLocalApp && window.AliaSpacesLocalApp.replaceFromAndroid($escaped)", null)
    }

    private fun cancelPendingDocuments() {
        fileCallback?.onReceiveValue(null)
        fileCallback = null
        pendingFileUrl = null
        pendingExport = null
        pendingDocumentEpoch = -1
    }

    private fun isLocalDocument() = appMode == MODE_LOCAL && NavigationPolicy.isLocalDocument(webView.url ?: "")
    private fun isLocalExportDocument() = appMode == MODE_LOCAL &&
        (NavigationPolicy.isLocalDocument(webView.url ?: "") || NavigationPolicy.isAkashaDocument(webView.url ?: ""))

    private fun installLocalBridge() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        WebViewCompat.addWebMessageListener(webView, "AliaSpacesAndroid", setOf("https://$ASSET_HOST")) {
                _, message, sourceOrigin, isMainFrame, _ ->
            if (!isMainFrame || sourceOrigin.toString() != "https://$ASSET_HOST" || !isLocalExportDocument()) return@addWebMessageListener
            val data = message.data ?: return@addWebMessageListener
            if (data.toByteArray(StandardCharsets.UTF_8).size > MAX_EXPORT_BYTES + 1024) return@addWebMessageListener
            val request = try { org.json.JSONObject(data) } catch (_: Exception) { return@addWebMessageListener }
            when (request.optString("action")) {
                "export" -> {
                    val payload = request.optString("payload")
                    if (payload.toByteArray(StandardCharsets.UTF_8).size > MAX_EXPORT_BYTES) {
                        Toast.makeText(this, "Backup exceeds the 10 MB native export limit.", Toast.LENGTH_LONG).show()
                        return@addWebMessageListener
                    }
                    cancelPendingDocuments()
                    pendingExport = payload
                    pendingFileUrl = webView.url
                    pendingDocumentEpoch = documentEpoch
                    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "application/json"
                        putExtra(Intent.EXTRA_TITLE, if (NavigationPolicy.isAkashaDocument(webView.url ?: "")) "aliaspaces-akashic-records-local.json" else "aliaspaces-local-demo.json")
                    }
                    try { startActivityForResult(intent, REQUEST_EXPORT) }
                    catch (_: android.content.ActivityNotFoundException) { cancelPendingDocuments() }
                }
                "import" -> {
                    if (!isLocalDocument()) return@addWebMessageListener
                    cancelPendingDocuments()
                    pendingFileUrl = webView.url
                    pendingDocumentEpoch = documentEpoch
                    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "application/json"
                    }
                    try { startActivityForResult(intent, REQUEST_IMPORT) }
                    catch (_: android.content.ActivityNotFoundException) { cancelPendingDocuments() }
                }
            }
        }
        bridgeInstalled = true
    }

    companion object {
        const val MODE_WEBSITE = "website"
        const val MODE_SOCIAL = "social"
        const val MODE_LOCAL = "local"
        private const val LIVE_URL = "https://mypersonas.online/"
        private const val SOCIAL_URL = "https://appassets.androidplatform.net/assets/www/live.html"
        private const val LOCAL_URL = "https://appassets.androidplatform.net/assets/www/index.html"
        private const val ERROR_URL = "https://appassets.androidplatform.net/assets/www/error.html"
        private const val ASSET_HOST = "appassets.androidplatform.net"
        private const val REQUEST_EXPORT = 41
        private const val REQUEST_IMPORT = 42
        private const val REQUEST_FILE = 43
        private const val STATE_MODE = "appMode"
        private const val PREFS = "aliaspaces.mobile"
        private const val PREF_MODE = "lastMode"
        private const val PREF_WEBSITE_URL = "lastWebsiteUrl"

        private const val MAX_JSON_BYTES = 2 * 1024 * 1024
        private const val MAX_EXPORT_BYTES = 10 * 1024 * 1024
        fun isProductUrl(url: String) = NavigationPolicy.isProduct(url)
    }
}
